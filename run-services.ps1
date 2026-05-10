# Setup Go portable path (jika belum ada)
$goRoot = "$env:TEMP\go-portable"
$go = Join-Path $goRoot 'go\bin\go.exe'

# Jika Go belum di-download, download sekarang
if (-not (Test-Path $go)) {
    Write-Host "Downloading Go 1.24.3..." -ForegroundColor Cyan
    $goZip = "$env:TEMP\go1.24.3.windows-amd64.zip"
    if (-not (Test-Path $goZip)) {
        Invoke-WebRequest 'https://go.dev/dl/go1.24.3.windows-amd64.zip' `
            -OutFile $goZip -UseBasicParsing
    }
    Write-Host "Extracting Go..." -ForegroundColor Cyan
    if (Test-Path $goRoot) { Remove-Item $goRoot -Recurse -Force }
    Expand-Archive $goZip $goRoot -Force
}

# Setup environment
$env:GOBIN = "$env:TEMP\gobin"
$env:PATH = "$env:GOBIN;$(Split-Path $go);$env:PATH"

Write-Host "Go version: " -NoNewline
& $go version

Write-Host "`n=== Setup Complete ===" -ForegroundColor Green
Write-Host "You can now run services. Use these commands in separate terminals:`n" -ForegroundColor Yellow

Write-Host "Terminal 1 (Auth Service):" -ForegroundColor Cyan
Write-Host "cd auth-service; `$go run main.go`n"

Write-Host "Terminal 2 (Product Service):" -ForegroundColor Cyan
Write-Host "cd product-service; `$go run main.go`n"

Write-Host "Terminal 3 (Order Service):" -ForegroundColor Cyan
Write-Host "cd order-service; `$go run main.go`n"

Write-Host "Terminal 4 (Gateway):" -ForegroundColor Cyan
Write-Host "cd gateway; `$go run main.go`n"

Write-Host "Terminal 5 (Testing):" -ForegroundColor Cyan
Write-Host "`$TOKEN = '<paste-token-here>'; curl -H 'Authorization: Bearer `$TOKEN' http://localhost:8080/products`n"
