@echo off
chcp 65001 >nul
title NovaVis
rem Starts NovaVis. The first time it downloads the newest installer
rem from GitHub, installs the launcher silently and opens it.

set "EXE=%LOCALAPPDATA%\NovaVis\NovaVis.exe"
if exist "%EXE%" goto run

echo Скачиваю NovaVis...
set "SETUP=%TEMP%\NovaVis-setup.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol='Tls12';" ^
  "$r = Invoke-RestMethod 'https://api.github.com/repos/masterrengoky-lab/bi4visual-launcher/releases?per_page=50' -Headers @{'User-Agent'='NovaVis'};" ^
  "$rel = $r | Where-Object { $_.tag_name -like 'novavis-v*' -and -not $_.draft } | Select-Object -First 1;" ^
  "if (-not $rel) { throw 'Релиз NovaVis не найден' };" ^
  "$a = $rel.assets | Where-Object { $_.name -like '*-setup.exe' } | Select-Object -First 1;" ^
  "Write-Host ('Версия ' + $rel.tag_name);" ^
  "Invoke-WebRequest $a.browser_download_url -OutFile $env:SETUP -UseBasicParsing"
if errorlevel 1 (
    echo Не получилось скачать установщик. Проверь интернет и запусти ещё раз.
    pause
    exit /b 1
)

echo Устанавливаю...
start "" /wait "%SETUP%" /S
del "%SETUP%" >nul 2>&1
if not exist "%EXE%" (
    echo Установка не завершилась. Запусти батник ещё раз.
    pause
    exit /b 1
)

:run
start "" "%EXE%"
exit /b 0
