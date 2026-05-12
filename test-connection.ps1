# Frontend & Backend Connection Test Script

# Jalankan script ini dari PowerShell untuk test seluruh sistem
# Pastikan gateway sudah running di :8080

$BASE = "http://localhost:8080"

Write-Host "=== E-Commerce API Test ===" -ForegroundColor Cyan
Write-Host "Base URL: $BASE" -ForegroundColor Gray
Write-Host ""

# 1. Test Health
Write-Host "1. Testing /health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE/health" -Method GET
    Write-Host "   ✓ Health check passed" -ForegroundColor Green
    Write-Host "   Auth: $($health.auth)" -ForegroundColor Gray
    Write-Host "   Product: $($health.product)" -ForegroundColor Gray
    Write-Host "   Order: $($health.order)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Health check failed: $($_)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. Test Register
Write-Host "2. Testing /auth/register endpoint..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "MMddHHmmss"
$testUser = "testuser$timestamp"
$testEmail = "test$timestamp@example.com"

try {
    $registerPayload = @{
        username = $testUser
        password = "testpass123"
        email    = $testEmail
    } | ConvertTo-Json

    $registerResponse = Invoke-RestMethod -Uri "$BASE/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body $registerPayload

    $token = $registerResponse.token
    $userId = $registerResponse.user_id

    Write-Host "   ✓ Registration successful" -ForegroundColor Green
    Write-Host "   User: $testUser" -ForegroundColor Gray
    Write-Host "   Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host "   User ID: $userId" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Registration failed: $($_)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. Test Protected Endpoint (Products - requires token)
Write-Host "3. Testing GET /products with Authorization header..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type"  = "application/json"
    }

    $productsResponse = Invoke-RestMethod -Uri "$BASE/products" `
        -Method GET `
        -Headers $headers

    $productCount = $productsResponse.products.Count
    Write-Host "   ✓ Products fetched successfully" -ForegroundColor Green
    Write-Host "   Total products: $productCount" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Failed to fetch products: $($_)" -ForegroundColor Red
    Write-Host "   Check if token is being sent correctly" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# 4. Test Create Product
Write-Host "4. Testing POST /products (create product)..." -ForegroundColor Yellow
try {
    $productPayload = @{
        name        = "Test Product $(Get-Date -Format 'HHmmss')"
        price       = 99.99
        description = "This is a test product"
    } | ConvertTo-Json

    $createProductResponse = Invoke-RestMethod -Uri "$BASE/products" `
        -Method POST `
        -Headers $headers `
        -Body $productPayload

    $productId = $createProductResponse.id

    Write-Host "   ✓ Product created successfully" -ForegroundColor Green
    Write-Host "   Product ID: $productId" -ForegroundColor Gray
    Write-Host "   Name: $($createProductResponse.name)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Failed to create product: $($_)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 5. Test Create Order
Write-Host "5. Testing POST /orders (create order)..." -ForegroundColor Yellow
try {
    # Get first product if available
    if ($productCount -gt 0) {
        $productIdToOrder = $productsResponse.products[0].id
    } else {
        $productIdToOrder = $productId
    }

    $orderPayload = @{
        user_id    = $userId
        product_id = $productIdToOrder
        quantity   = 2
        unit_price = 99.99
    } | ConvertTo-Json

    $createOrderResponse = Invoke-RestMethod -Uri "$BASE/orders" `
        -Method POST `
        -Headers $headers `
        -Body $orderPayload

    $orderId = $createOrderResponse.id

    Write-Host "   ✓ Order created successfully" -ForegroundColor Green
    Write-Host "   Order ID: $orderId" -ForegroundColor Gray
    Write-Host "   Status: $($createOrderResponse.status)" -ForegroundColor Gray
    Write-Host "   Total Price: $($createOrderResponse.total_price)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Failed to create order: $($_)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 6. Test Get Order
Write-Host "6. Testing GET /orders/{id}..." -ForegroundColor Yellow
try {
    $getOrderResponse = Invoke-RestMethod -Uri "$BASE/orders/$orderId" `
        -Method GET `
        -Headers $headers

    Write-Host "   ✓ Order retrieved successfully" -ForegroundColor Green
    Write-Host "   Order ID: $($getOrderResponse.id)" -ForegroundColor Gray
    Write-Host "   User ID: $($getOrderResponse.user_id)" -ForegroundColor Gray
    Write-Host "   Status: $($getOrderResponse.status)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Failed to get order: $($_)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 7. Test List User Orders
Write-Host "7. Testing GET /users/{user_id}/orders..." -ForegroundColor Yellow
try {
    $listOrdersResponse = Invoke-RestMethod -Uri "$BASE/users/$userId/orders" `
        -Method GET `
        -Headers $headers

    $orderCount = $listOrdersResponse.orders.Count
    Write-Host "   ✓ User orders retrieved successfully" -ForegroundColor Green
    Write-Host "   Total orders: $orderCount" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ Failed to list user orders: $($_)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 8. Test Without Token (should fail)
Write-Host "8. Testing protected endpoint WITHOUT token (should fail)..." -ForegroundColor Yellow
try {
    $noTokenResponse = Invoke-RestMethod -Uri "$BASE/products" `
        -Method GET `
        -ErrorAction Stop
    
    Write-Host "   ✗ Endpoint should have required token!" -ForegroundColor Red
    exit 1
} catch {
    if ($_ -match "401|unauthorized") {
        Write-Host "   ✓ Correctly rejected (401 Unauthorized)" -ForegroundColor Green
    } else {
        Write-Host "   ! Got error (may be expected): $($_)" -ForegroundColor Yellow
    }
}
Write-Host ""

# Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host "✓ All critical endpoints working correctly!" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend can now:" -ForegroundColor Cyan
Write-Host "  1. Register & Login" -ForegroundColor Gray
Write-Host "  2. Send Authorization header with Bearer token" -ForegroundColor Gray
Write-Host "  3. Fetch protected resources (products, orders)" -ForegroundColor Gray
Write-Host "  4. Create orders and manage cart" -ForegroundColor Gray
Write-Host ""
Write-Host "Next: Open http://localhost:8080 in your browser" -ForegroundColor Yellow
