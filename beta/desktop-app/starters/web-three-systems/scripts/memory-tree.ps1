# Private memory summed over a process and all of its descendants, as JSON,
# compared with the budget and ceiling in app.config.json.
# Windows definition: private bytes (PrivateMemorySize64).
# The macOS and Linux scripts beside this one print the same shape by those systems' definitions.
# Usage: powershell -NoProfile -File scripts\memory-tree.ps1 -ProcessId <pid>
param([Parameter(Mandatory = $true)][int]$ProcessId)
$config = Get-Content (Join-Path $PSScriptRoot '..\app.config.json') -Raw | ConvertFrom-Json
$all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name
$ids = [System.Collections.Generic.List[int]]::new(); $ids.Add($ProcessId)
for ($i = 0; $i -lt $ids.Count; $i++) {
  $all | Where-Object { $_.ParentProcessId -eq $ids[$i] -and -not $ids.Contains([int]$_.ProcessId) } | ForEach-Object { $ids.Add([int]$_.ProcessId) }
}
$p = @(Get-Process -Id $ids -ErrorAction SilentlyContinue)
$private = [math]::Round(($p | Measure-Object PrivateMemorySize64 -Sum).Sum / 1MB, 1)
$resident = [math]::Round(($p | Measure-Object WorkingSet64 -Sum).Sum / 1MB, 1)
[pscustomobject]@{
  at = (Get-Date -Format o)
  system = 'windows'
  definition = 'private bytes'
  root = $ProcessId
  processes = $p.Count
  names = @($p | ForEach-Object ProcessName | Sort-Object -Unique)
  privateMB = $private
  residentMB = $resident
  workingSetMB = $resident
  budgetMB = $config.memory.budgetMB
  ceilingMB = $config.memory.ceilingMB
  withinBudget = ($private -le $config.memory.budgetMB)
  underCeiling = ($private -le $config.memory.ceilingMB)
  detail = @($p | ForEach-Object { [pscustomobject]@{ pid = $_.Id; name = $_.ProcessName; privateMB = [math]::Round($_.PrivateMemorySize64 / 1MB, 1); residentMB = [math]::Round($_.WorkingSet64 / 1MB, 1) } })
} | ConvertTo-Json -Compress -Depth 4
