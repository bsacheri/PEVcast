@echo off
REM Start the Python server and open the browser

cd /d "%~dp0"

set "PORT=8001"

REM Stop any process already listening on the target port
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  if not "%%P"=="0" (
    echo Stopping existing server on port %PORT% ^(PID %%P^)^...
    taskkill /PID %%P /F >nul 2>&1
  )
)

REM Start a simple static web server in the background
start "PEVcast Server" cmd /c python -m http.server %PORT%

REM Wait a moment for the server to start
timeout /t 2 /nobreak

REM Open the browser to the page
start http://localhost:%PORT%/index.html

echo Server started and browser opened!

timeout /t 2
