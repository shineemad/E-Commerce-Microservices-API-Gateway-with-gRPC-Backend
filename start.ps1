# Setup Go environment
$goRoot = "$env:TEMP\go-portable"
$go = Join-Path $goRoot 'go\bin\go.exe'
$env:GOBIN = "$env:TEMP\gobin"
$env:PATH = "$env:GOBIN;$(Split-Path $go);$env:PATH"

# Check if Go exists
if (-not (Test-Path $go)) {
    Write-Host "Downloading Go 1.24.3..." -ForegroundColor Cyan
    $goZip = "$env:TEMP\go1.24.3.windows-amd64.zip"
    Invoke-WebRequest 'https://go.dev/dl/go1.24.3.windows-amd64.zip' -OutFile $goZip -UseBasicParsing
    Write-Host "Extracting..." -ForegroundColor Cyan
    if (Test-Path $goRoot) { Remove-Item $goRoot -Recurse -Force }
    Expand-Archive $goZip $goRoot -Force
}

Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🚀 Starting Services...                   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Change to project directory
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start services in new terminals
Write-Host "Opening Auth Service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$projectDir\auth-service'; & '$go' run main.go`""

Start-Sleep -Milliseconds 500

Write-Host "Opening Product Service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$projectDir\product-service'; & '$go' run main.go`""

Start-Sleep -Milliseconds 500

Write-Host "Opening Order Service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$projectDir\order-service'; & '$go' run main.go`""

Start-Sleep -Milliseconds 500

Write-Host "Opening Gateway..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$projectDir\gateway'; & '$go' run main.go`""

Write-Host "`n✓ All services started in separate windows!" -ForegroundColor Green
Write-Host "Waiting for services to initialize..." -ForegroundColor Yellow

Start-Sleep -Seconds 3

Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Ready to test!                        ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "Run this in a new terminal to test API:" -ForegroundColor Cyan
Write-Host "  powershell -ExecutionPolicy Bypass -File test-api.ps1`n" -ForegroundColor White
