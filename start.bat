@echo off
chcp 65001 >nul
cd /d "%~dp0"

set NODE_EXTRA_CA_CERTS=%~dp0russian_trusted_ca_bundle.pem

echo === Запуск бота ===
node bot/index.js

pause
