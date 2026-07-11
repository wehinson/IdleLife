@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "APP_NAME=IdleLife-main"
set "APP_DIR=%~dp0"
set "PIDFILE=%TEMP%\%APP_NAME%-server.pid"
set "PORTFILE=%TEMP%\%APP_NAME%-server.port"
set "PORT=8123"

title Launch IdleLife

if exist "!PIDFILE!" (
  set "OLD_PID="
  set /p OLD_PID=<"!PIDFILE!"
  if defined OLD_PID (
    echo(!OLD_PID!| findstr /R "^[0-9][0-9]*$" >nul 2>nul
    if not errorlevel 1 (
      taskkill /PID !OLD_PID! /F >nul 2>nul
    )
  )
  del "!PIDFILE!" >nul 2>nul
)

for /f "delims=" %%P in ('powershell -NoProfile -Command "$p=8123; while (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) { $p++ }; $p"') do set "PORT=%%P"

where py >nul 2>nul
if not errorlevel 1 (
  set "PYTHON_EXE=py"
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Python was not found. Install Python or add it to PATH, then run this launcher again.
    pause
    exit /b 1
  )
  set "PYTHON_EXE=python"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$argList=@('-m','http.server','!PORT!','--bind','127.0.0.1'); $p=Start-Process -FilePath '!PYTHON_EXE!' -ArgumentList $argList -WorkingDirectory '!APP_DIR!' -PassThru -WindowStyle Hidden; Set-Content -Path '!PIDFILE!' -Value $p.Id; Set-Content -Path '!PORTFILE!' -Value '!PORT!'"
if errorlevel 1 (
  echo Failed to start the IdleLife local server.
  pause
  exit /b 1
)

ping -n 2 127.0.0.1 >nul
start "" "http://127.0.0.1:!PORT!/"
echo IdleLife is running at http://127.0.0.1:!PORT!/
echo Close this window whenever you like; the server will be restarted next time you run this launcher.
ping -n 4 127.0.0.1 >nul
