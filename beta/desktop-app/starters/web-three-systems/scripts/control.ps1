# Sends one request to the running app through its control channel (electron/control.ts)
# and prints the reply, without starting any program: a named-pipe client in PowerShell.
# Works in Windows PowerShell 5.1 and PowerShell 7.
#
#   scripts\control.ps1 -DataDir C:\temp\run\app-data -Arguments '--diagnostics=C:\x.json', '--capture=C:\x.png'
#
# Exit code 0 when the app answered ok, 2 when no app answered, 1 when it answered with an error.
#
# Call it from PowerShell (`& scripts\control.ps1 ... -Arguments @(...)`), or from another program
# through `powershell -Command`. Under `powershell -File`, -Arguments takes one value only: a second
# one is read as a parameter name ("A parameter cannot be found that matches parameter name '-quit'").
param(
  [Parameter(Mandatory)][string]$DataDir,
  [string[]]$Arguments = @(),
  [int]$WaitSeconds = 20,
  [int]$TimeoutSeconds = 60
)
$ErrorActionPreference = 'Stop'
$info = Join-Path $DataDir 'control.json'
$deadline = (Get-Date).AddSeconds($WaitSeconds)
$last = "no $info"
$request = (@{ v = 1; argv = @($Arguments); cwd = (Get-Location).Path } | ConvertTo-Json -Compress -Depth 4) + "`n"
while ($true) {
  if (Test-Path $info) {
    try {
      $endpoint = (Get-Content $info -Raw | ConvertFrom-Json).endpoint
      $name = $endpoint -replace '^\\\\\.\\pipe\\', ''
      $pipe = [System.IO.Pipes.NamedPipeClientStream]::new('.', $name, [System.IO.Pipes.PipeDirection]::InOut)
      $pipe.Connect(2000)
      $writer = [System.IO.StreamWriter]::new($pipe, [System.Text.UTF8Encoding]::new($false))
      $writer.Write($request)
      $writer.Flush()
      $reader = [System.IO.StreamReader]::new($pipe, [System.Text.UTF8Encoding]::new($false))
      $task = $reader.ReadLineAsync()
      if (-not $task.Wait($TimeoutSeconds * 1000)) { $pipe.Dispose(); Write-Output "{`"ok`":false,`"error`":`"no reply in $TimeoutSeconds s`"}"; exit 1 }
      $line = $task.Result
      $pipe.Dispose()
      Write-Output $line
      if (($line | ConvertFrom-Json).ok) { exit 0 } else { exit 1 }
    } catch {
      $last = $_.Exception.Message
    }
  }
  if ((Get-Date) -ge $deadline) { Write-Output "{`"ok`":false,`"answered`":false,`"error`":`"no running app answers for $($DataDir -replace '\\','\\'): $($last -replace '"','''' -replace '\\','\\')`"}"; exit 2 }
  Start-Sleep -Milliseconds 200
}
