<#
.SYNOPSIS
  Create a standalone fastwin app crate from the starter (examples\hello).
.EXAMPLE
  .\new-app.ps1 -Name my-tool
  .\new-app.ps1 -Name my-tool -Dest C:\src -FrameworkPath C:\src\fastwin
#>
param(
    [Parameter(Mandatory)] [string]$Name,
    [string]$Dest = (Get-Location).Path,
    [string]$FrameworkPath = (Join-Path $PSScriptRoot 'fastwin')
)
$ErrorActionPreference = 'Stop'

if ($Name -notmatch '^[a-z][a-z0-9_-]*$') { throw "Name must be lowercase letters, digits, - or _, starting with a letter: '$Name'" }
$fw = (Resolve-Path $FrameworkPath).Path
if (-not (Select-String -Path (Join-Path $fw 'Cargo.toml') -Pattern '^name = "fastwin"' -Quiet)) { throw "No fastwin crate at $fw" }
$starter = Join-Path $PSScriptRoot 'examples\hello\src\main.rs'
if (-not (Test-Path $starter)) { throw "Starter not found: $starter" }

$dir = Join-Path (Resolve-Path $Dest).Path $Name
if ((Test-Path $dir) -and (Get-ChildItem $dir -Force | Select-Object -First 1)) { throw "$dir already exists and is not empty" }
New-Item -ItemType Directory -Force (Join-Path $dir 'src') | Out-Null

# Relative path when possible (PowerShell 7); Windows PowerShell 5.1 gets an absolute one.
$rel = if ([IO.Path].GetMethod('GetRelativePath', [type[]]@([string], [string]))) { [IO.Path]::GetRelativePath($dir, $fw) } else { $fw }
$rel = $rel -replace '\\', '/'
$utf8 = New-Object Text.UTF8Encoding $false
$cargo = @"
[package]
name = "$Name"
version = "0.1.0"
edition = "2021"

[dependencies]
fastwin = { path = "$rel" }

# Standalone even when created inside another Cargo workspace.
[workspace]

[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = true
"@
[IO.File]::WriteAllText((Join-Path $dir 'Cargo.toml'), $cargo, $utf8)

$main = (Get-Content $starter -Raw) `
    -replace '//! hello: the smallest useful fastwin app\.', "//! ${Name}: a fastwin app (started from the hello starter)." `
    -replace 'Hello, fastwin', $Name
[IO.File]::WriteAllText((Join-Path $dir 'src\main.rs'), $main, $utf8)
[IO.File]::WriteAllText((Join-Path $dir '.gitignore'), "/target`n", $utf8)

Write-Host "Created $dir (fastwin at $rel)"
Write-Host "  cd $dir; cargo build --release"
Write-Host "  .\target\release\$Name.exe --no-focus     # agents: always --no-focus or --bench"
Write-Host "  .\target\release\$Name.exe --bench        # writes target\release\bench.txt"
