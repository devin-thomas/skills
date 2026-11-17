#!/bin/sh
# Private memory summed over a process and all of its descendants, as JSON,
# compared with the budget and ceiling in app.config.json.
# macOS definition: phys_footprint, read with /usr/bin/footprint (its "Summary
# Footprint" over the tree). Resident size is wrong in both directions on macOS
# and is printed only for comparison.
# The Windows and Linux scripts beside this one print the same shape.
# Usage: scripts/memory-tree.macos.sh <pid>
set -eu
root=${1:?usage: memory-tree.macos.sh <pid>}
config="$(cd "$(dirname "$0")" && pwd)/../app.config.json"
budget=$(/usr/bin/plutil -extract memory.budgetMB raw -o - "$config")
ceiling=$(/usr/bin/plutil -extract memory.ceilingMB raw -o - "$config")

ids=$(/bin/ps -axo pid=,ppid= | /usr/bin/awk -v root="$root" '
  { parent[$1] = $2; order[NR] = $1 }
  END {
    want[root] = 1; changed = 1
    while (changed) { changed = 0; for (i = 1; i <= NR; i++) { p = order[i]; if (!(p in want) && (parent[p] in want)) { want[p] = 1; changed = 1 } } }
    for (i = 1; i <= NR; i++) if (order[i] in want) printf "%s ", order[i]
  }')
if [ -z "$ids" ]; then echo "{\"error\":\"no process $root\"}"; exit 1; fi

pidargs=
for id in $ids; do pidargs="$pidargs --pid $id"; done
rss=$(/bin/ps -o rss= $(for id in $ids; do printf -- '-p %s ' "$id"; done) | /usr/bin/awk '{ s += $1 } END { printf "%.1f", s / 1024 }')

# shellcheck disable=SC2086
/usr/bin/footprint -f bytes --noCategories $pidargs 2>/dev/null | /usr/bin/awk -v root="$root" -v budget="$budget" -v ceiling="$ceiling" -v rss="$rss" -v at="$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  / \[[0-9]+\]: .*Footprint: [0-9]+ B/ {
    line = $0
    pid = line; sub(/^.* \[/, "", pid); sub(/\]:.*$/, "", pid)
    name = line; sub(/ \[[0-9]+\]:.*$/, "", name); gsub(/["\\]/, "", name)
    bytes = line; sub(/^.*Footprint: /, "", bytes); sub(/ B.*$/, "", bytes)
    n++; pids[n] = pid; names[n] = name; size[n] = bytes; sum += bytes
    if (!(name in seen)) { seen[name] = 1; unique = unique (unique == "" ? "" : ",") "\"" name "\"" }
  }
  /^Summary Footprint: [0-9]+ B/ { summary = $3 }
  END {
    if (n == 0) { print "{\"error\":\"footprint could not read the processes\"}"; exit 1 }
    total = (summary != "" ? summary : sum) / 1048576
    printf "{\"at\":\"%s\",\"system\":\"macos\",\"definition\":\"phys_footprint\",\"root\":%d,\"processes\":%d,\"names\":[%s],\"privateMB\":%.1f,\"residentMB\":%s,\"budgetMB\":%s,\"ceilingMB\":%s,\"withinBudget\":%s,\"underCeiling\":%s,\"detail\":[", at, root, n, unique, total, rss, budget, ceiling, (total <= budget ? "true" : "false"), (total <= ceiling ? "true" : "false")
    for (i = 1; i <= n; i++) printf "%s{\"pid\":%d,\"name\":\"%s\",\"privateMB\":%.1f}", (i > 1 ? "," : ""), pids[i], names[i], size[i] / 1048576
    print "]}"
  }'
