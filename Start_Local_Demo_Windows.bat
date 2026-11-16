@echo off
cd /d "%~dp0"
echo Starting Accounts Management without Python...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start_Local_Demo.ps1"
