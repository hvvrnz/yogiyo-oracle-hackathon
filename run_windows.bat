@echo off
setlocal
cd /d "%~dp0"
if not exist .venv (
  python -m venv .venv
)
call .venv\Scripts\activate
python -m pip install -r requirements.txt
if not exist .env copy .env.example .env >nul
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload