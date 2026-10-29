@echo off
title SivarStock Enterprise - Servidor Local Windows Server (LAN)
color 0A
echo ============================================================================
echo   SIVARSTOCK ENTERPRISE - SERVIDOR LOCAL DE INVENTARIO Y BASE DE DATOS
echo   Responsable de IT: Alexander Turcios Melendez
echo ============================================================================
echo.
cd /d "%~dp0"

echo [1/4] Verificando carpeta de Base de Datos Local (data\sivarstock.db)...
if not exist "data" mkdir data

echo [2/4] Abriendo puerto 3000 en el Firewall de Windows Server (si tiene permisos)...
netsh advfirewall firewall show rule name="SivarStock LAN Port 3000" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="SivarStock LAN Port 3000" dir=in action=allow protocol=TCP localport=3000 >nul 2>&1
)

echo [3/4] Direcciones IP de este Servidor para conectar tu Honor 400 por Wi-Fi:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    echo    - Conectar desde Honor 400 / PCs: http:%%a:3000
)
echo.

if not exist "node_modules" (
    echo Instalando dependencias por primera vez...
    call npm install
)

if not exist ".next\BUILD_ID" (
    echo Compilando version optimizada de produccion para Windows Server...
    call npm run build
)

echo [4/4] Iniciando SivarStock en toda la red local (0.0.0.0:3000)...
echo No cierres esta ventana mientras uses el sistema desde tu celular o PCs.
echo.
call npx next start -H 0.0.0.0 -p 3000
pause
