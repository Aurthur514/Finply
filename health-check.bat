@echo off
REM Health check script for Sentinel AI Financial Sandbox

set BACKEND_URL=http://localhost:8000
set FRONTEND_URL=http://localhost:3000

echo 🔍 Checking Sentinel AI Financial Sandbox health...

REM Check backend
echo Checking backend API...
curl -s -f "%BACKEND_URL%/api/health" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Backend API is healthy
) else (
    echo ❌ Backend API is not responding
    pause
    exit /b 1
)

REM Check frontend
echo Checking frontend...
curl -s -f "%FRONTEND_URL%" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Frontend is responding
) else (
    echo ❌ Frontend is not responding
    pause
    exit /b 1
)

echo 🎉 All services are healthy!
echo.
echo 🌐 Application URLs:
echo    Frontend: %FRONTEND_URL%
echo    Backend API: %BACKEND_URL%
echo    API Documentation: %BACKEND_URL%/docs

pause
