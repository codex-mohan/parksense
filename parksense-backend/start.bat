@echo off
echo ============================================
echo  ParkSense Backend
echo ============================================
echo.
echo Starting FastAPI server on port 8000...
echo API docs: http://localhost:8000/docs
echo.
cd /d "%~dp0"
python -m uvicorn main:app --reload --port 8000
pause
