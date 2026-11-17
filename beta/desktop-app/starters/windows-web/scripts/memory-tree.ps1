# Private memory summed over a process and all of its descendants, as JSON.
# Usage: powershell -NoProfile -File scripts\memory-tree.ps1 -ProcessId <pid>
param([Parameter(Mandatory = $true)][int]$ProcessId)
$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name
$ids = [System.Collections.Generic.List[int]]::new(); $ids.Add($ProcessId)
for ($i = 0; $i -lt $ids.Count; $i++) {
  $all | Where-Object { $_.ParentProcessId -eq $ids[$i] -and -not $ids.Contains([int]$_.ProcessId) } | ForEach-Object { $ids.Add([int]$_.ProcessId) }
}
$p = Get-Process -Id $ids -ErrorAction SilentlyContinue
[pscustomobject]@{
  at = (Get-Date -Format o)
  root = $ProcessId
  processes = $p.Count
  names = @($p | ForEach-Object ProcessName | Sort-Object -Unique)
  privateMB = [math]::Round(($p | Measure-Object PrivateMemorySize64 -Sum).Sum / 1MB, 1)
  workingSetMB = [math]::Round(($p | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1)
} | ConvertTo-Json -Compress
