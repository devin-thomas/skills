@echo off
rem Checks the installed app from a normal user environment. See installed-check.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0installed-check.ps1"
