@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Установка Джарвиса

echo === Установка голосового помощника ===
echo.

if not exist "%~dp0assistant.py" (
  echo Похоже, install.bat запущен прямо из архива, и остальных файлов рядом нет.
  echo Распакуй архив целиком: правой кнопкой по Jarvis.zip, "Извлечь все...",
  echo потом открой распакованную папку Jarvis и запусти install.bat оттуда.
  pause
  exit /b
)

rem Ищем настоящий Python (ярлык из Microsoft Store не считается).
set PY=
py -3 -c "import sys" >nul 2>nul && set "PY=py -3"
if not defined PY python -c "import sys" >nul 2>nul && set "PY=python"
if not defined PY call :findlocal
if not defined PY (
  echo Python не найден. Ставлю Python 3.12 через winget, подожди...
  winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
  call :findlocal
)
if not defined PY (
  echo.
  echo Не получилось поставить Python автоматически.
  echo Скачай его с https://www.python.org/downloads/ и при установке отметь галочку "Add python.exe to PATH".
  echo Потом запусти install.bat ещё раз.
  pause
  exit /b
)
echo Python: %PY%

if not exist ".venv\Scripts\python.exe" (
  echo [1/4] Создаю окружение Python...
  %PY% -m venv .venv || goto :fail
)

echo [2/4] Ставлю библиотеки, это пара минут...
".venv\Scripts\python.exe" -m pip install --upgrade pip -q
".venv\Scripts\python.exe" -m pip install -r "%~dp0requirements.txt" -q || goto :fail

if not exist "models\vosk-model-small-ru-0.22" (
  echo [3/4] Качаю модель распознавания русской речи, около 45 МБ...
  if not exist models mkdir models
  powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest 'https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip' -OutFile 'models\vosk.zip'; Expand-Archive 'models\vosk.zip' -DestinationPath 'models' -Force; Remove-Item 'models\vosk.zip'" || goto :fail
) else (
  echo [3/4] Модель речи уже есть.
)

echo [4/4] Настройка «мозга».
echo.
echo   1 - локальный (Ollama, бесплатно, нужна видеокарта от 8 ГБ)
echo   2 - облачный (Claude, нужен ключ API)
echo   3 - настроить оба
set /p CHOICE=Выбери 1, 2 или 3 и нажми Enter: 

if "%CHOICE%"=="1" goto :ollama
if "%CHOICE%"=="3" goto :ollama
goto :claude

:ollama
where ollama >nul 2>nul
if errorlevel 1 (
  echo Ставлю Ollama через winget...
  winget install -e --id Ollama.Ollama --accept-package-agreements --accept-source-agreements
  set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama"
)
echo Качаю локальную модель qwen2.5:7b, около 4,7 ГБ...
ollama pull qwen2.5:7b
".venv\Scripts\python.exe" -c "import json;p='config.json';c=json.load(open(p,encoding='utf-8'));c['brain']='ollama';json.dump(c,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=2)"
if "%CHOICE%"=="1" goto :done

:claude
echo.
echo Ключ API берётся на https://console.anthropic.com/settings/keys
set /p KEY=Вставь ключ (sk-ant-...) или просто нажми Enter, чтобы пропустить: 
if not "%KEY%"=="" (
  ".venv\Scripts\python.exe" -c "import json,sys;p='config.json';c=json.load(open(p,encoding='utf-8'));c['claude']['api_key']=sys.argv[1];c['brain']='claude' if sys.argv[2]=='2' else c['brain'];json.dump(c,open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=2)" "%KEY%" "%CHOICE%"
  echo Ключ сохранён в config.json.
)

:done
echo.
echo === Готово! Запускай run.bat ===
pause
exit /b

:findlocal
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do if exist "%%D\python.exe" set PY="%%D\python.exe"
exit /b

:fail
echo.
echo Что-то пошло не так, смотри сообщения выше.
pause
