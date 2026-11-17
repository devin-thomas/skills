# Checks the installed app from a normal user environment. A person runs
# installed-check.cmd; an agent runs scripts\run-as-user.ps1 installed-check
# -Step <step> (see that file for why). What it does is chosen by the first
# line of qa\evidence\installed-step.txt:
#   list      the installed files, the bundled helpers, the notices, the shortcut and the data folder
#   helpers   run every bundled helper from its installed location, started by the installed
#             app's own executable with PATH emptied (scripts\installed-helpers.cjs)
#   launch    start the app from its Start Menu shortcut, the way a person does
#   collect   ask the running app (through its control channel, never a second launch) for its diagnostics and a picture of its window, and report
#             where it runs from and what it says about its tool
#   about     open About in the running app, then diagnostics and a picture
#   memory    private memory over the running app's process tree, against the budget and ceiling
#   quit      ask the running app to close
#   uninstall remove the installed copy and the shortcut (never the data folder)
# Further lines of that file are options:
#   no-activate       launch without taking focus (the shortcut is started with --no-activate added)
#   empty-path        launch with PATH emptied, to prove nothing is looked up there
#   data-dir=<folder> keep the app's data in this folder; required by collect, about and quit,
#                     which find the running app's control channel through control.json there
#   debug-port=<n>    launch only: open the DevTools protocol on 127.0.0.1:<n>, so a script can drive the
#                     page with input events inside it (build 2's measure/final.mjs drove the installed page this way)
#   mute              launch only: start the app with Chromium's --mute-audio, so a scripted run is silent
# Each step writes qa\evidence\installed-<step>.txt when it is done.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$config = Get-Content (Join-Path $root 'app.config.json') -Raw | ConvertFrom-Json
$product = $config.productName
$exeName = "$($config.exeName).exe"
$evidence = Join-Path $root 'qa\evidence'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$stepLines = @(Get-Content (Join-Path $evidence 'installed-step.txt') -ErrorAction SilentlyContinue | ForEach-Object { $_.Trim() } | Where-Object { $_ })
$step = if ($stepLines.Count) { $stepLines[0] } else { 'list' }
$options = @($stepLines | Select-Object -Skip 1)
$noActivate = $options -contains 'no-activate'
$emptyPath = $options -contains 'empty-path'
$dataDir = ($options | Where-Object { $_ -like 'data-dir=*' } | Select-Object -First 1) -replace '^data-dir=', ''
$debugPort = ($options | Where-Object { $_ -like 'debug-port=*' } | Select-Object -First 1) -replace '^debug-port=', ''
$mute = $options -contains 'mute'
$target = Join-Path $env:LOCALAPPDATA "Programs\$product"
$exe = Join-Path $target $exeName
$programs = [Environment]::GetFolderPath('Programs')
$shortcutPath = Join-Path $programs "$product.lnk"
$out = [System.Collections.Generic.List[string]]::new()
$out.Add("step $step at $(Get-Date -Format o)$(if ($options.Count) { "; options: $($options -join ', ')" })")

# Arguments every call to the installed exe carries.
function Common {
  $a = @()
  if ($dataDir) { $a += "--data-dir=`"$dataDir`"" }
  if ($noActivate) { $a += '--no-activate' }
  return $a
}
# Hands a command to the running app through its control channel (electron\control.cjs) with
# scripts\control.ps1, a named-pipe client that starts no program. Never a second launch of the
# exe: that reaches the app through Chromium's process singleton, which grants it the right to
# take the foreground (the desktop-app skill's references/packaging.md, "Focus on Windows"). The
# app serves the channel because the launch step started it with --no-activate; it is found
# through control.json in the data folder, so data-dir is required.
function Ask([string[]]$arguments) {
  if (-not $dataDir) { throw 'This step needs the data-dir option the launch step used.' }
  $reply = & (Join-Path $PSScriptRoot 'control.ps1') -DataDir $dataDir -Arguments $arguments -WaitSeconds 20
  $out.Add("control channel: $reply")
  if ($LASTEXITCODE -ne 0) { throw "The running app did not carry out $($arguments -join ' ')." }
}
# The installed exe acting as Node, for the checks written in JavaScript. No window opens.
function AsNode([string[]]$arguments) {
  $env:ELECTRON_RUN_AS_NODE = '1'
  try { return (Start-Process -FilePath $exe -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden).ExitCode }
  finally { Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue }
}
function Running {
  return @(Get-CimInstance Win32_Process -Filter "Name = '$exeName'" | Where-Object { $_.ExecutablePath -eq $exe })
}
function Foreground {
  if (-not ('Fg' -as [type])) {
    Add-Type @"
using System; using System.Runtime.InteropServices;
public static class Fg { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid); }
"@
  }
  $p = 0; [void][Fg]::GetWindowThreadProcessId([Fg]::GetForegroundWindow(), [ref]$p)
  return [int]$p
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
      $bin = Join-Path $target 'resources\bin\win32-x64'
      $out.Add("helpers folder: $bin (exists: $(Test-Path $bin))")
      if (Test-Path $bin) { Get-ChildItem $bin -File | ForEach-Object { $out.Add("  $($_.Name)  $($_.Length) bytes  sha256 $((Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower())") } }
      $notices = Join-Path $target 'resources\THIRD-PARTY-NOTICES.txt'
      $out.Add("notices: $notices (exists: $(Test-Path $notices)$(if (Test-Path $notices) { ", $((Get-Item $notices).Length) bytes" }))")
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
    'helpers' {
      $json = Join-Path $evidence 'installed-helpers.json'
      Remove-Item $json -ErrorAction SilentlyContinue
      $code = AsNode @("`"$(Join-Path $PSScriptRoot 'installed-helpers.cjs')`"", '--out', "`"$json`"")
      if (-not (Test-Path $json)) { throw "The installed exe did not run the check (exit $code). If the app's RunAsNode fuse is off, run it with Node: node scripts\installed-helpers.cjs --resources `"$target\resources`"" }
      $r = Get-Content $json -Raw | ConvertFrom-Json
      $out.Add("run by: $($r.runBy)")
      $out.Add("  $($r.execPath)")
      $out.Add("PATH given to the helpers: '$($r.pathGivenToHelpers)'")
      foreach ($c in $r.checks) { $out.Add("$(if ($c.ok) { 'ok  ' } else { 'FAIL' }) $($c.name)$(if ($c.detail) { ": $($c.detail)" })") }
      $out.Add("tool: $($r.tool | ConvertTo-Json -Compress -Depth 6)")
      $out.Add($(if ($r.passed) { "helpers passed ($($r.checks.Count) checks)" } else { 'FAILED: a helper check did not pass' }))
    }
    'launch' {
      $before = Foreground
      $savedPath = $env:Path
      if ($emptyPath) { $env:Path = '' }
      try {
        # Extra arguments given to a shortcut are added after the shortcut's own.
        $extra = @(Common)
        if ($debugPort) { $extra += "--remote-debugging-port=$debugPort" }
        if ($mute) { $extra += '--mute-audio' }
        if ($extra.Count) { Start-Process -FilePath $shortcutPath -ArgumentList $extra } else { Start-Process -FilePath $shortcutPath }
      } finally { $env:Path = $savedPath }
      Start-Sleep -Seconds 6
      $after = Foreground
      $running = Running
      $out.Add("started from $shortcutPath$(if ($emptyPath) { ' with PATH emptied' }); processes running from ${exe}: $($running.Count)")
      $ours = @($running | ForEach-Object { [int]$_.ProcessId })
      $out.Add("foreground process before: $before ($((Get-Process -Id $before -ErrorAction SilentlyContinue).ProcessName)); after: $after ($((Get-Process -Id $after -ErrorAction SilentlyContinue).ProcessName))")
      if ($ours -contains $after) { $out.Add($(if ($noActivate) { 'FAILED: the app took focus although no-activate was asked for' } else { 'the app has focus, as a normal launch does' })) }
      else { $out.Add('the app does not have focus') }
      if ($running.Count -eq 0) { $out.Add('FAILED: the app is not running') }
    }
    'collect' {
      if ((Running).Count -eq 0) { throw "The app is not running from $exe. Run the 'launch' step first." }
      $diag = Join-Path $evidence 'installed-diagnostics.json'
      $shot = Join-Path $evidence 'installed-window.png'
      Remove-Item $diag, $shot -ErrorAction SilentlyContinue
      Ask @("--diagnostics=$diag", "--capture=$shot")
      Start-Sleep -Milliseconds 500
      if (-not (Test-Path $diag)) { throw 'The running app wrote no diagnostics. Is it running with the same data folder?' }
      $summary = Join-Path $evidence 'installed-diagnostics-summary.txt'
      Remove-Item $summary -ErrorAction SilentlyContinue
      [void](AsNode @("`"$(Join-Path $PSScriptRoot 'installed-diagnostics.cjs')`"", "`"$diag`"", "`"$target`"", "`"$summary`""))
      if (Test-Path $summary) { Get-Content $summary | ForEach-Object { $out.Add($_) } } else { $out.Add("diagnostics written to $diag (no summary: the installed exe would not run as Node)") }
      $out.Add("window picture: $shot (exists: $(Test-Path $shot)$(if (Test-Path $shot) { ", $((Get-Item $shot).Length) bytes" }))")
    }
    'about' {
      if ((Running).Count -eq 0) { throw "The app is not running from $exe. Run the 'launch' step first." }
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
      if ((Running).Count -eq 0) { $out.Add('the app is not running; nothing to close') } else { Ask @('--quit') }
      # Electron 45 took 4 to 11 s on Windows from the app's own exit to the end of its main process (build 2).
      $deadline = (Get-Date).AddSeconds(30)
      while ((Running).Count -gt 0 -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
      $out.Add("processes still running from ${exe}: $((Running).Count)")
    }
    'uninstall' {
      if ((Running).Count -gt 0) { throw 'The app is running. Run the quit step first.' }
      if ($target -notlike "$env:LOCALAPPDATA\Programs\*" -or -not $product) { throw "Refusing to remove $target" }
      if (Test-Path $target) { Remove-Item -Recurse -Force $target; $out.Add("removed $target") } else { $out.Add("nothing at $target") }
      if (Test-Path $shortcutPath) { Remove-Item -Force $shortcutPath; $out.Add("removed $shortcutPath") } else { $out.Add("nothing at $shortcutPath") }
      $out.Add("the data folder $(Join-Path $env:APPDATA $product) is left alone (exists: $(Test-Path (Join-Path $env:APPDATA $product)))")
    }
    default { $out.Add("unknown step '$step'") }
  }
  $out.Add('done')
} catch {
  $out.Add("FAILED: $($_.Exception.Message)")
}
$out | Set-Content -Path (Join-Path $evidence "installed-$step.txt") -Encoding UTF8
