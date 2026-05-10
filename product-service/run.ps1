# Setup Go portable path
$goRoot = "$env:TEMP\go-portable"
$go = Join-Path $goRoot 'go\bin\go.exe'
$env:GOBIN = "$env:TEMP\gobin"
$env:PATH = "$env:GOBIN;$(Split-Path $go);$env:PATH"

# Run product service
& $go run main.go
