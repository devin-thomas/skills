# Samples the foreground window every 100 ms and writes one JSON line per change
# (and one at the start) to -Out. Stops when -StopFile exists or after -Seconds.
# Windows only. It reads, it never acts.
#
# Started by measure/focus-experiment.mjs and measure/memory-experiment.mjs. For an
# installed-app check, start it in the agent's own shell before the first step and
# write the stop file after the last; with -App it then judges the run:
#
#   powershell -NoProfile -File measure\foreground-sampler.ps1 -Out <file.jsonl> -StopFile <file> -Seconds 900 -App "%LOCALAPPDATA%\Programs\<productName>\<exeName>.exe"
#
# With -App the last line says how many changes put the app's window in front (the exit
# code is then 1) and how many put a console window in front (Windows Terminal, conhost,
# OpenConsole). Read the console count by its times: a console that comes and goes during
# a step is a script that should have been windowless; the owner switching to his own
# terminal also counts, so it does not fail the run by itself.
# Build 2's installed check compared the foreground only before and after each step,
# and missed the app coming to the front in between.
param(
  [Parameter(Mandatory)][string]$Out,
  [Parameter(Mandatory)][string]$StopFile,
  [int]$Seconds = 600,
  [string]$App
)
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public static class FgSampler {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
"@
$writer = [System.IO.StreamWriter]::new($Out, $true, [System.Text.UTF8Encoding]::new($false))
$writer.AutoFlush = $true
$last = ''
$samples = 0
$appInFront = 0
$consoleInFront = 0
$deadline = (Get-Date).AddSeconds($Seconds)
while ((Get-Date) -lt $deadline -and -not (Test-Path $StopFile)) {
  $h = [FgSampler]::GetForegroundWindow()
  $p = 0; [void][FgSampler]::GetWindowThreadProcessId($h, [ref]$p)
  $samples++
  $key = "$h|$p"
  if ($key -ne $last) {
    $sb = New-Object System.Text.StringBuilder 256; [void][FgSampler]::GetWindowText($h, $sb, 256)
    $path = ''
    try { $path = (Get-Process -Id $p -ErrorAction Stop).Path } catch {}
    $writer.WriteLine((@{ t = (Get-Date).ToString('o'); hwnd = [int64]$h; pid = [int]$p; path = $path; title = $sb.ToString() } | ConvertTo-Json -Compress))
    if ($App -and $path -and ($path -ieq $App)) { $appInFront++ }
    if ($path -match '(WindowsTerminal|conhost|OpenConsole)\.exe$') { $consoleInFront++ }
    $last = $key
  }
  Start-Sleep -Milliseconds 100
}
$end = @{ t = (Get-Date).ToString('o'); end = $true; samples = $samples }
if ($App) { $end.app = $App; $end.appInFront = $appInFront; $end.consoleInFront = $consoleInFront }
$writer.WriteLine(($end | ConvertTo-Json -Compress))
$writer.Close()
if ($App) {
  if ($appInFront -gt 0) {
    Write-Output "FAILED: the app's window came to the front $appInFront time(s) in $samples samples; a console window $consoleInFront time(s) ($Out)"
    exit 1
  }
  Write-Output "the foreground never went to $App in $samples samples; a console window came to the front $consoleInFront time(s) ($Out)"
}
