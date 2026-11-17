@echo off
rem Installs the app for the current user. See install.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0install.ps1"
