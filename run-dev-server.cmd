@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\npm.cmd" run dev -- --port 3001 > dev-server-active.log 2>&1
