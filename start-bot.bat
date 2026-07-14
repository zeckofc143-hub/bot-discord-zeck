@echo off
cd /d "c:\Users\Zeck\Documents\bot-discord"
:loop
node src/index.js
echo Bot encerrou. Reiniciando em 5 segundos...
timeout /t 5 /nobreak
goto loop
