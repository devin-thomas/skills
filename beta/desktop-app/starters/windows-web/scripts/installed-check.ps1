# Checks the installed app from a normal user environment. Start it through
# Explorer (explorer.exe "<project>\scripts\installed-check.cmd") for the same
# reason as install.ps1. What it does is chosen by the single word in
# qa\evidence\installed-step.txt:
#   list      list the installed files, the shortcut and the data folder
#   launch    start the app from its Start Menu shortcut, the way a person does
#   collect   ask the running app for its diagnostics and a picture of its window
#   about     open About in the running app, then diagnostics and a picture
#   memory    private memory over the running app's process tree, against the budget and ceiling
#   quit      ask the running app to close
# Each step writes qa\evidence\installed-<step>.txt when it is done.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$config = Get-Content (Join-Path $root 'app.config.json') -Raw | ConvertFrom-Json
$product = $config.productName
$exeName = "$($config.exeName).exe"
$evidence = Join-Path $root 'qa\evidence'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$step = (Get-Content (Join-Path $evidence 'installed-step.txt') -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $step) { $step = 'list' }
$step = $step.Trim()
$target = Join-Path $env:LOCALAPPDATA "Programs\$product"
$exe = Join-Path $target $exeName
$programs = [Environment]::GetFolderPath('Programs')
$shortcutPath = Join-Path $programs "$product.lnk"
$out = [System.Collections.Generic.List[string]]::new()
$out.Add("step $step at $(Get-Date -Format o)")

function Ask([string[]]$arguments) {
  Start-Process -FilePath $exe -ArgumentList $arguments -Wait
}

try {
  switch ($step) {
    'list' {
      $out.Add("LOCALAPPDATA = $env:LOCALAPPDATA")
      $out.Add("APPDATA = $env:APPDATA")
      $item = Get-Item $exe
      $out.Add("exe: $exe")
      $out.Add("  size $($item.Length) bytes, modified $($item.LastWriteTime.ToString('o'))")
      $out.Add("  product '$($item.VersionInfo.ProductName)', file version $($item.VersionInfo.FileVersion), company '$($item.VersionInfo.CompanyName)'")
      $out.Add("  sha256 $((Get-FileHash $exe -Algorithm SHA256).Hash)")
      $files = Get-ChildItem -Recurse -File $target
      $out.Add("installed files: $($files.Count), $([math]::Round(($files | Measure-Object Length -Sum).Sum / 1MB, 1)) MB")
      Get-ChildItem $target | ForEach-Object { $out.Add("  $($_.Name)$(if ($_.PSIsContainer) { '\' })") }
      $asar = Join-Path $target 'resources\app.asar'
      $out.Add("app.asar present: $(Test-Path $asar), $((Get-Item $asar).Length) bytes")
      $shell = New-Object -ComObject WScript.Shell
      $lnk = $shell.CreateShortcut($shortcutPath)
      $out.Add("shortcut: $shortcutPath (exists: $(Test-Path $shortcutPath))")
      $out.Add("  target $($lnk.TargetPath)")
      $out.Add("  working directory $($lnk.WorkingDirectory)")
      $out.Add("  icon $($lnk.IconLocation)")
      $data = Join-Path $env:APPDATA $product
      $out.Add("data folder: $data (exists: $(Test-Path $data))")
      if (Test-Path $data) { Get-ChildItem $data -Recurse -Depth 2 | Select-Object -First 40 | ForEach-Object { $out.Add("  $($_.FullName.Substring($data.Length))") } }
    }
    'launch' {
      Start-Process -FilePath $shortcutPath
      Start-Sleep -Seconds 6
      $running = @(Get-CimInstance Win32_Process -Filter "Name = '$exeName'" | Where-Object { $_.ExecutablePath -eq $exe })
      $out.Add("started from $shortcutPath; processes running from ${exe}: $($running.Count)")
    }
    'collect' {
      Ask @("--diagnostics=$evidence\installed-diagnostics.json", "--capture=$evidence\installed-window.png")
    }
    'about' {
      Ask @('--show-about', "--diagnostics=$evidence\installed-diagnostics-about.json", "--capture=$evidence\installed-about.png")
    }
    'memory' {
      $all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, ExecutablePath
      $main = $all | Where-Object { $_.ExecutablePath -eq $exe } | Where-Object { $parent = $_.ParentProcessId; -not ($all | Where-Object { $_.ProcessId -eq $parent -and $_.ExecutablePath -eq $exe }) } | Select-Object -First 1
      if (-not $main) { throw "The app is not running from $exe. Run the 'launch' step first." }
      $json = & (Join-Path $PSScriptRoot 'memory-tree.ps1') -ProcessId $main.ProcessId
      $m = $json | ConvertFrom-Json
      $out.Add($json)
      $out.Add("private memory $($m.privateMB) MB over $($m.processes) processes; budget $($config.memory.budgetMB) MB, ceiling $($config.memory.ceilingMB) MB")
      if ($m.privateMB -gt $config.memory.ceilingMB) { $out.Add('FAILED: over the ceiling') }
      elseif ($m.privateMB -gt $config.memory.budgetMB) { $out.Add("over budget by $([math]::Round($m.privateMB - $config.memory.budgetMB, 1)) MB: record the reason in docs\DECISIONS.md or bring it down") }
      else { $out.Add('within budget') }
    }
    'quit' {
      Ask @('--quit')
    }
    default { $out.Add("unknown step '$step'") }
  }
  $out.Add('done')
} catch {
  $out.Add("FAILED: $($_.Exception.Message)")
}
$out | Set-Content -Path (Join-Path $evidence "installed-$step.txt") -Encoding UTF8
