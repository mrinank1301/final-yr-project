@echo off
title Video Calling App - Starting All Services
color 0B

echo.
echo  ==============================================================
echo        VIDEO CALLING APPLICATION - STARTUP
echo  ==============================================================
echo.
echo  Starting all services in PowerShell...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0start-all.ps1"

pause
