@echo off
REM Setup environment
set goRoot=%TEMP%\go-portable
set go=%goRoot%\go\bin\go.exe
set GOBIN=%TEMP%\gobin

REM Check if Go exists
if not exist %go% (
    echo Downloading Go 1.24.3...
    powershell -Command "Invoke-WebRequest 'https://go.dev/dl/go1.24.3.windows-amd64.zip' -OutFile '%TEMP%\go1.24.3.windows-amd64.zip' -UseBasicParsing"
    echo Extracting Go...
    powershell -Command "Expand-Archive '%TEMP%\go1.24.3.windows-amd64.zip' '%goRoot%' -Force"
)

REM Setup PATH
set PATH=%GOBIN%;%goRoot%\go\bin;%PATH%

echo.
echo ╔════════════════════════════════════════════╗
echo ║  Starting E-Commerce Microservices...      ║
echo ╚════════════════════════════════════════════╝
echo.

REM Open 4 terminals for services
cd /d %~dp0

echo Starting Auth Service (port 50051)...
start "Auth Service" cmd /k "cd auth-service && %go% run main.go"
timeout /t 1 /nobreak

echo Starting Product Service (port 50052)...
start "Product Service" cmd /k "cd product-service && %go% run main.go"
timeout /t 1 /nobreak

echo Starting Order Service (port 50053)...
start "Order Service" cmd /k "cd order-service && %go% run main.go"
timeout /t 1 /nobreak

echo Starting Gateway (port 8080)...
start "Gateway" cmd /k "cd gateway && %go% run main.go"
timeout /t 2 /nobreak

echo.
echo ✓ All services started!
echo.
echo Open new terminal and run:
echo   powershell -ExecutionPolicy Bypass -File test-api.ps1
echo.
pause
