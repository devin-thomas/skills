#!/bin/sh
# Private memory summed over a process and all of its descendants, as JSON,
# compared with the budget and ceiling in app.config.json.
# Linux definition: anonymous resident memory plus swap (Anonymous + Swap in
# /proc/<pid>/smaps_rollup), which is what Chromium calls private footprint.
# ps and top report resident size, which counts shared pages once per process
# and reads several times higher; it is printed only for comparison.
# The Windows and macOS scripts beside this one print the same shape.
# Usage: scripts/memory-tree.linux.sh <pid>
set -eu
root=${1:?usage: memory-tree.linux.sh <pid>}
config="$(cd "$(dirname "$0")" && pwd)/../app.config.json"
number() { tr -d '\n' <"$config" | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\([0-9.]*\).*/\1/p"; }
budget=$(number budgetMB)
ceiling=$(number ceilingMB)

# "pid parent" for every process, then the root and everything under it.
pairs=$(for stat in /proc/[0-9]*/stat; do
  pid=${stat#/proc/}; pid=${pid%/stat}
  parent=$(sed 's/^.*) [A-Za-z] //; s/ .*$//' "$stat" 2>/dev/null) || continue
  [ -n "$parent" ] && echo "$pid $parent"
done)
ids=$(echo "$pairs" | awk -v root="$root" '
  { parent[$1] = $2; order[NR] = $1 }
  END {
    if (!(root in parent)) exit
    want[root] = 1; changed = 1
    while (changed) { changed = 0; for (i = 1; i <= NR; i++) { p = order[i]; if (!(p in want) && (parent[p] in want)) { want[p] = 1; changed = 1 } } }
    for (i = 1; i <= NR; i++) if (order[i] in want) printf "%s ", order[i]
  }')
if [ -z "$ids" ]; then echo "{\"error\":\"no process $root\"}"; exit 1; fi

for id in $ids; do
  [ -r "/proc/$id/smaps_rollup" ] || { echo "$id unreadable 0 0 0"; continue; }
  name=$(tr -d '"\\' <"/proc/$id/comm" 2>/dev/null | tr ' ' '_')
  [ -n "$name" ] || name=unknown
  awk -v id="$id" -v name="$name" '
    /^Anonymous:/ { anon = $2 } /^Swap:/ { swap = $2 } /^Rss:/ { rss = $2 }
    END { printf "%s %s %d %d %d\n", id, name, anon, swap, rss }' "/proc/$id/smaps_rollup" 2>/dev/null || echo "$id unreadable 0 0 0"
done | awk -v root="$root" -v budget="$budget" -v ceiling="$ceiling" -v at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  {
    n++; pids[n] = $1; names[n] = $2; private[n] = ($3 + $4) / 1024; sum += $3 + $4; resident += $5
    if (!($2 in seen)) { seen[$2] = 1; unique = unique (unique == "" ? "" : ",") "\"" $2 "\"" }
  }
  END {
    total = sum / 1024
    printf "{\"at\":\"%s\",\"system\":\"linux\",\"definition\":\"anonymous resident memory plus swap\",\"root\":%d,\"processes\":%d,\"names\":[%s],\"privateMB\":%.1f,\"residentMB\":%.1f,\"budgetMB\":%s,\"ceilingMB\":%s,\"withinBudget\":%s,\"underCeiling\":%s,\"detail\":[", at, root, n, unique, total, resident / 1024, budget, ceiling, (total <= budget ? "true" : "false"), (total <= ceiling ? "true" : "false")
    for (i = 1; i <= n; i++) printf "%s{\"pid\":%d,\"name\":\"%s\",\"privateMB\":%.1f}", (i > 1 ? "," : ""), pids[i], names[i], private[i]
    print "]}"
  }'
