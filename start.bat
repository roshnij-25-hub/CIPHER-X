@echo off
echo.
echo  ============================================================
echo   CIPHER-X Satellite Change Detection Prototype
echo  ============================================================
echo.

cd /d "%~dp0"

echo  [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "CIPHER-X Backend" cmd /k ".\.venv\Scripts\uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo  [2/2] Starting Next.js Frontend on http://localhost:3000 ...
start "CIPHER-X Frontend" cmd /k "cd cipher-x-dashboard && npm run dev"

echo.
echo  ============================================================
echo   CIPHER-X is starting up!
echo.
echo   Backend  : http://localhost:8000
echo   Frontend : http://localhost:3000
echo   API Docs : http://localhost:8000/docs
echo  ============================================================
echo.
echo  Press any key to exit this launcher (services keep running)
pause >nul
