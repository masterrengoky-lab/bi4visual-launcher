@echo off
chcp 65001 >nul
title KissLauncherVis
rem Starts KissLauncherVis. The first time it downloads the newest installer
rem from GitHub, installs the launcher silently and opens it.

set "EXE=%LOCALAPPDATA%\KissLauncherVis\KissLauncherVis.exe"
if exist "%EXE%" goto run

echo Скачиваю KissLauncherVis...
set "SETUP=%TEMP%\KissLauncherVis-setup.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol='Tls12';" ^
  "$r = Invoke-RestMethod 'https://api.github.com/repos/masterrengoky-lab/bi4visual-launcher/releases?per_page=50' -Headers @{'User-Agent'='KissLauncherVis'};" ^
  "$rel = $r | Where-Object { $_.tag_name -like 'kiss-v*' -and -not $_.draft } | Select-Object -First 1;" ^
  "if (-not $rel) { throw 'Релиз KissLauncherVis не найден' };" ^
  "$a = $rel.assets | Where-Object { $_.name -like '*-setup.exe' } | Select-Object -First 1;" ^
  "Write-Host ('Версия ' + $rel.tag_name);" ^
  "Invoke-WebRequest $a.browser_download_url -OutFile $env:SETUP -UseBasicParsing"
if errorlevel 1 (
    echo Не получилось скачать установщик. Проверьте интернет и запустите ещё раз.
    pause
    exit /b 1
)

echo Устанавливаю...
start "" /wait "%SETUP%" /S
del "%SETUP%" >nul 2>&1
if not exist "%EXE%" (
    echo Установка не завершилась. Запустите батник ещё раз.
    pause
    exit /b 1
)

:run
start "" "%EXE%"
exit /b 0
