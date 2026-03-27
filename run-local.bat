@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "GAUSS_DIR=%ROOT%..\gauss-safe-starter"
set "PYTHON_CMD=python"
set "BACKEND_OUT=%BACKEND_DIR%\server.out.log"
set "BACKEND_ERR=%BACKEND_DIR%\server.err.log"
set "FRONTEND_OUT=%FRONTEND_DIR%\frontend.out.log"
set "FRONTEND_ERR=%FRONTEND_DIR%\frontend.err.log"
set "MODE=%~1"

if "%MODE%"=="" set "MODE=sentinel"

if exist "%BACKEND_DIR%\venv\Scripts\python.exe" (
  set "PYTHON_CMD=%BACKEND_DIR%\venv\Scripts\python.exe"
)

if /I "%MODE%"=="gauss" goto start_gauss
if /I "%MODE%"=="all" goto start_all
if /I not "%MODE%"=="sentinel" (
  echo Unknown mode "%MODE%".
  echo Usage:
  echo   run-local.bat
  echo   run-local.bat sentinel
  echo   run-local.bat gauss
  echo   run-local.bat all
  exit /b 1
)

:start_sentinel
if not exist "%BACKEND_DIR%\requirements.txt" (
  echo Backend requirements file not found at "%BACKEND_DIR%\requirements.txt".
  exit /b 1
)

if not exist "%FRONTEND_DIR%\package.json" (
  echo Frontend package file not found at "%FRONTEND_DIR%\package.json".
  exit /b 1
)

echo Using backend Python: %PYTHON_CMD%
echo Starting Sentinel backend...
start "Sentinel Backend" /D "%BACKEND_DIR%" cmd /k ""%PYTHON_CMD%" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload 1>>"%BACKEND_OUT%" 2>>"%BACKEND_ERR%"""

echo Starting Sentinel frontend...
start "Sentinel Frontend" /D "%FRONTEND_DIR%" cmd /k "npm.cmd start 1>>"%FRONTEND_OUT%" 2>>"%FRONTEND_ERR%""

echo.
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:3000
echo API Docs: http://127.0.0.1:8000/docs
echo Backend logs:  %BACKEND_OUT% and %BACKEND_ERR%
echo Frontend logs: %FRONTEND_OUT% and %FRONTEND_ERR%
echo.
echo Close the opened windows to stop the services.
exit /b 0

:start_gauss
if not exist "%GAUSS_DIR%\examples\run_momentum_analysis.py" (
  echo Gauss starter example not found at "%GAUSS_DIR%\examples\run_momentum_analysis.py".
  exit /b 1
)

echo Using Python: %PYTHON_CMD%
echo Starting Gauss safe starter analysis...
start "Gauss Safe Starter" /D "%GAUSS_DIR%" cmd /k ""%PYTHON_CMD%" examples\run_momentum_analysis.py"

echo.
echo Gauss starter launched from: %GAUSS_DIR%
echo No web server or frontend ports are used in this mode.
echo.
echo Close the opened window to stop the analysis session.
exit /b 0

:start_all
call "%~f0" sentinel
if errorlevel 1 exit /b 1
call "%~f0" gauss
exit /b %errorlevel%
