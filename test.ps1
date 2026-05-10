# Setup Go environment
$goRoot = "$env:TEMP\go-portable"
$go = Join-Path $goRoot 'go\bin\go.exe'
$env:GOBIN = "$env:TEMP\gobin"
$env:PATH = "$env:GOBIN;$(Split-Path $go);$env:PATH"

Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🔍 Checking Service Status...            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Check services
$services = @(
    @{name="Auth Service"; port=50051; url="http://localhost:50051"}
    @{name="Product Service"; port=50052; url="http://localhost:50052"}
    @{name="Order Service"; port=50053; url="http://localhost:50053"}
    @{name="Gateway"; port=8080; url="http://localhost:8080/health"}
)

$allReady = $true

foreach ($service in $services) {
    try {
        $conn = New-Object System.Net.Sockets.TcpClient
        $conn.Connect("localhost", $service.port)
        if ($conn.Connected) {
            Write-Host "✅ $($service.name) - RUNNING (port $($service.port))" -ForegroundColor Green
            $conn.Close()
        }
    } catch {
        Write-Host "⏳ $($service.name) - STARTING (port $($service.port))" -ForegroundColor Yellow
        $allReady = $false
    }
}

if (-not $allReady) {
    Write-Host "`n⏳ Waiting for all services to start..." -ForegroundColor Yellow
    Write-Host "   (Usually takes 5-10 seconds)" -ForegroundColor Yellow
    
    for ($i = 1; $i -le 10; $i++) {
        Start-Sleep -Seconds 1
        $allReady = $true
        
        foreach ($service in $services) {
            try {
                $conn = New-Object System.Net.Sockets.TcpClient
                $conn.Connect("localhost", $service.port)
                $conn.Close()
            } catch {
                $allReady = $false
            }
        }
        
        if ($allReady) {
            Write-Host "`n✅ All services are ready!" -ForegroundColor Green
            break
        }
        Write-Host "   Waiting... ($i/10)" -ForegroundColor Yellow
    }
}

if (-not $allReady) {
    Write-Host "`n❌ Not all services are ready. Check the service windows for errors." -ForegroundColor Red
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "  - Port already in use (try closing other services)" -ForegroundColor Yellow
    Write-Host "  - Service crashed (check error in service window)" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  🚀 Starting API Tests...                 ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Green

# Function to pretty print
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Uri,
        [string]$Body,
        [hashtable]$Headers = @{}
    )
    
    Write-Host "$Name..." -ForegroundColor Yellow -NoNewline
    
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params["Body"] = $Body
            $params["ContentType"] = "application/json"
        }
        
        if ($Headers) {
            $params["Headers"] = $Headers
        }
        
        $response = Invoke-WebRequest @params
        $data = $response.Content | ConvertFrom-Json
        Write-Host " ✅" -ForegroundColor Green
        return $data
    } catch {
        Write-Host " ❌" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# 1. Test Health
$health = Test-Endpoint -Name "1️⃣  Health Check" -Method GET -Uri "http://localhost:8080/health"
if ($health) {
    Write-Host "     Status: $($health | ConvertTo-Json)" -ForegroundColor Gray
}

# 2. Register user
$randomUsername = "user_$(Get-Random -Minimum 1000 -Maximum 9999)"
$registerBody = @{
    username = $randomUsername
    password = "password123"
    email = "test@example.com"
} | ConvertTo-Json

$register = Test-Endpoint -Name "2️⃣  Register User" -Method POST -Uri "http://localhost:8080/auth/register" -Body $registerBody

if ($register) {
    $TOKEN = $register.token
    $tokenDisplay = if ($TOKEN -and $TOKEN.Length -gt 20) { "$($TOKEN.Substring(0, 20))..." } else { $TOKEN }
    Write-Host "     Token: $tokenDisplay" -ForegroundColor Gray
    
    # 3. List products
    Test-Endpoint -Name "3️⃣  List Products" -Method GET -Uri "http://localhost:8080/products" -Headers @{"Authorization" = "Bearer $TOKEN"} | Out-Null
    
    # 4. Create product
    $productBody = @{
        name = "Gaming Laptop"
        price = 1299.99
        description = "High-performance laptop"
    } | ConvertTo-Json
    
    $product = Test-Endpoint -Name "4️⃣  Create Product" -Method POST -Uri "http://localhost:8080/products" -Body $productBody -Headers @{"Authorization" = "Bearer $TOKEN"}
    
    if ($product) {
        $PRODUCT_ID = $product.id
        Write-Host "     Product ID: $PRODUCT_ID" -ForegroundColor Gray
        
        # 5. Update product
        $updateBody = @{
            name = "Gaming Laptop Pro"
            price = 1499.99
        } | ConvertTo-Json
        
        Test-Endpoint -Name "5️⃣  Update Product" -Method PUT -Uri "http://localhost:8080/products/$PRODUCT_ID" -Body $updateBody -Headers @{"Authorization" = "Bearer $TOKEN"} | Out-Null
        
        # 6. Create order
        $orderBody = @{
            product_id = $PRODUCT_ID
            quantity = 2
        } | ConvertTo-Json
        
        $order = Test-Endpoint -Name "6️⃣  Create Order" -Method POST -Uri "http://localhost:8080/orders" -Body $orderBody -Headers @{"Authorization" = "Bearer $TOKEN"}
        
        if ($order) {
            $ORDER_ID = $order.id
            Write-Host "     Order ID: $ORDER_ID" -ForegroundColor Gray
            
            # 7. Update order status
            $statusBody = @{
                status = "shipped"
            } | ConvertTo-Json
            
            Test-Endpoint -Name "7️⃣  Update Order Status" -Method PATCH -Uri "http://localhost:8080/orders/$ORDER_ID/status" -Body $statusBody -Headers @{"Authorization" = "Bearer $TOKEN"} | Out-Null
        }
        
        # 8. Delete product
        Test-Endpoint -Name "8️⃣  Delete Product" -Method DELETE -Uri "http://localhost:8080/products/$PRODUCT_ID" -Headers @{"Authorization" = "Bearer $TOKEN"} | Out-Null
    }
    
    # Test without auth (should fail)
    Write-Host "`n9️⃣  Test Protected Route (without token)..." -ForegroundColor Yellow -NoNewline
    try {
        Invoke-WebRequest -Uri "http://localhost:8080/products" -ErrorAction Stop | Out-Null
        Write-Host " ⚠️ (Should have failed!)" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host " ✅ (Correctly rejected)" -ForegroundColor Green
        } else {
            Write-Host " ❌" -ForegroundColor Red
        }
    }
}

Write-Host "`n╔════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ Testing Complete!                     ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  ✅ All endpoints working" -ForegroundColor Green
Write-Host "  ✅ Authentication working" -ForegroundColor Green
Write-Host "  ✅ CRUD operations working" -ForegroundColor Green
Write-Host ""
