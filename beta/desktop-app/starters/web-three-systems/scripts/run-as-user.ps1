# Runs install.ps1 or installed-check.ps1 in the owner's normal environment, in a
# console with no window, and prints the result file the script writes.
#
#   scripts\run-as-user.ps1 install
#   scripts\run-as-user.ps1 installed-check -Step launch -Option no-activate, empty-path, "data-dir=C:\temp\app-data"
#   scripts\run-as-user.ps1 installed-check -Step quit -Option "data-dir=C:\temp\app-data"
#
# Why it exists. An agent session inside a packaged (MSIX) desktop app has its
# %APPDATA% and %LOCALAPPDATA% writes redirected into that package, where the
# owner's own apps cannot see them. Anything Explorer starts runs outside the
# package, so the script is handed to Explorer, as a shortcut written to
# qa\evidence\run-as-user.lnk each time.
#
# The shortcut starts PowerShell inside `conhost.exe --headless`, a console with no
# window. Any visible console takes the foreground: a .cmd file does; and on a
# Windows 11 where Windows Terminal is the default terminal, so does a shortcut to
# powershell.exe set to Minimized with -WindowStyle Hidden, because Terminal opens
# its own window for the console and ignores both (seen on Windows 11, 2026-11-15:
# Terminal in front for 0.45 to 0.77 s on every call; microsoft/terminal issue
# 12464). Worse, when PowerShell then hides that window Windows activates another
# one, and an app this script started earlier holds the right to take it: that is
# how build 2's installed check put its app in front of the owner's work twice
# (measure/focus-experiment.mjs reproduces it; the desktop-app skill's
# references/packaging.md, "Focus on Windows"). Run measure\foreground-sampler.ps1
# with -App in the agent's own shell from before the first step to after the last.
#
# A person does not need this: double-click install.cmd or installed-check.cmd.
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Script,
  [string]$Step,
  [string[]]$Option = @(),
  [int]$WaitSeconds = 180
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$evidence = Join-Path $root 'qa\evidence'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$target = if (Test-Path $Script) { (Resolve-Path $Script).Path } else { Join-Path $PSScriptRoot "$Script.ps1" }
if (-not (Test-Path $target)) { throw "No script at $target" }
$name = [IO.Path]::GetFileNameWithoutExtension($target)

# The file the script writes when it is done.
$result = switch ($name) {
  'install' { Join-Path $evidence 'install-log.txt' }
  'installed-check' {
    if (-not $Step) { throw 'installed-check needs -Step' }
    Set-Content -Path (Join-Path $evidence 'installed-step.txt') -Value (@($Step) + $Option) -Encoding ASCII
    Join-Path $evidence "installed-$Step.txt"
  }
  default { Join-Path $evidence "$name-result.txt" }
}
Remove-Item $result -ErrorAction SilentlyContinue

$lnkPath = Join-Path $evidence 'run-as-user.lnk'
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$lnk.TargetPath = Join-Path $env:SystemRoot 'System32\conhost.exe'
$lnk.Arguments = "--headless `"$powershell`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$target`""
$lnk.WorkingDirectory = $root
$lnk.WindowStyle = 7   # minimized, not activated
$lnk.Save()
Start-Process -FilePath (Join-Path $env:SystemRoot 'explorer.exe') -ArgumentList "`"$lnkPath`""

$deadline = (Get-Date).AddSeconds($WaitSeconds)
while (-not (Test-Path $result) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
if (-not (Test-Path $result)) { throw "No result at $result after $WaitSeconds s." }
Start-Sleep -Milliseconds 300
Get-Content $result
