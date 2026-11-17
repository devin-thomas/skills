# Installs the packaged app for the current user and creates its Start Menu shortcut.
# Names come from app.config.json. It copies out\<exeName>-win32-x64 to
# %LOCALAPPDATA%\Programs\<productName> and writes "<productName>.lnk" into the
# user's Start Menu Programs folder. Nothing is installed system-wide and
# nothing needs administrator rights.
#
# Run it from Explorer or a normal PowerShell window. An agent session inside a
# packaged (MSIX) desktop app has its %APPDATA% and %LOCALAPPDATA% writes
# redirected into that package, where the owner's own apps cannot see them, so
# an agent starts this through Explorer instead:
#   scripts\run-as-user.ps1 install
# which hands this script to Explorer in a console with no window and prints
# qa\evidence\install-log.txt, which this script always writes.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$config = Get-Content (Join-Path $root 'app.config.json') -Raw | ConvertFrom-Json
$product = $config.productName
$exeName = "$($config.exeName).exe"
$source = Join-Path $root "out\$($config.exeName)-win32-x64"
$target = Join-Path $env:LOCALAPPDATA "Programs\$product"
$evidence = Join-Path $root 'qa\evidence'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
$log = Join-Path $evidence 'install-log.txt'
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("install started $(Get-Date -Format o)")
$lines.Add("LOCALAPPDATA = $env:LOCALAPPDATA")
$lines.Add("APPDATA = $env:APPDATA")

try {
  if (-not (Test-Path (Join-Path $source $exeName))) { throw "No packaged app at $source. Run 'pnpm package' first." }

  # If the installed app is running, stop here: it may be a window a person is using, and
  # asking it to quit by starting the exe again would be a second launch, which can bring
  # it to the front (the desktop-app skill's references/packaging.md, "Focus on Windows").
  # Close it first: a person closes their own window; a check quits its own app with the
  # installed check's quit step, which goes through the app's control channel.
  $exe = Join-Path $target $exeName
  if (Test-Path $exe) {
    $running = @(Get-CimInstance Win32_Process -Filter "Name = '$exeName'" | Where-Object { $_.ExecutablePath -eq $exe })
    if ($running.Count -gt 0) { throw "The installed app is running ($($running.Count) processes). Close it, then install again." }
  }

  New-Item -ItemType Directory -Force -Path $target | Out-Null
  robocopy $source $target /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }
  $lines.Add("copied to $target (robocopy exit $LASTEXITCODE)")

  $programs = [Environment]::GetFolderPath('Programs')
  $shortcutPath = Join-Path $programs "$product.lnk"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $exe
  $shortcut.WorkingDirectory = $target
  $shortcut.IconLocation = "$exe,0"
  $shortcut.Description = $product
  $shortcut.Save()
  $lines.Add("shortcut written: $shortcutPath -> $exe")
  $lines.Add("installed files: $((Get-ChildItem -Recurse -File $target | Measure-Object).Count)")
  $bin = Join-Path $target 'resources\bin\win32-x64'
  foreach ($name in @($config.tool.binaries | ForEach-Object { "$_.exe" })) {
    $helper = Join-Path $bin $name
    if (-not (Test-Path $helper)) { throw "The installed copy is missing $helper" }
    $lines.Add("helper: $helper ($((Get-Item $helper).Length) bytes)")
  }
  $notices = Join-Path $target 'resources\THIRD-PARTY-NOTICES.txt'
  if (-not (Test-Path $notices)) { throw "The installed copy is missing $notices" }
  $lines.Add("notices: $notices")
  $lines.Add('install finished OK')
} catch {
  $lines.Add("INSTALL FAILED: $($_.Exception.Message)")
}
$lines | Set-Content -Path $log -Encoding UTF8
