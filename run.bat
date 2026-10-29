@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Джарвис
set PYTHONUTF8=1
".venv\Scripts\python.exe" assistant.py %*
pause
