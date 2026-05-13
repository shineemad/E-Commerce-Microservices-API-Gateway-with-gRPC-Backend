# 📡 Frontend & Backend Synchronization Guide

## ✅ Perbaikan yang Telah Dilakukan

### 1. **Authorization Header di Frontend** ✓

Frontend sekarang mengirimkan token dalam setiap request ke protected endpoints:

```javascript
if (S.token) {
  opts.headers.Authorization = "Bearer " + S.token;
}
```

**Endpoints yang dilindungi (memerlukan token):**

- `GET /products`
- `POST /products`
- `PUT /products/{id}`
- `DELETE /products/{id}`
- `GET /products/stream`
- `POST /orders`
- `GET /orders/{id}`
- `PATCH /orders/{id}/status`
- `GET /users/{user_id}/orders`

**Endpoints publik (tanpa token):**

- `POST /auth/register`
- `POST /auth/login`
- `GET /health`

---

## 📊 API Endpoints Mapping

### Authentication APIs

#### Register

```
Method: POST
Path: /auth/register
Frontend Kirim: { username, password, email }
Backend Response: { token: string, user_id: string }
Frontend Terima: d.token, d.user_id
```

#### Login

```
Method: POST
Path: /auth/login
Frontend Kirim: { username, password }
Backend Response: { token: string, user_id: string }
Frontend Terima: d.token, d.user_id
```

---

### Product APIs

#### List Products

```
Method: GET
Path: /products
Auth: ✓ Required (Bearer token)
Backend Response: { products: [{ id, name, price, description }] }
Frontend Terima: d.products (array)
Frontend Expects: S.products.length
```

#### Get Single Product

```
Method: GET
Path: /products/{id}
Auth: ✓ Required
Backend Response: { id, name, price, description }
```

#### Create Product

```
Method: POST
Path: /products
Auth: ✓ Required
Frontend Kirim: { name, price, description }
Backend Response: { id, name, price, description }
```

#### Update Product

```
Method: PUT
Path: /products/{id}
Auth: ✓ Required
Frontend Kirim: { name, price, description }
Backend Response: { id, name, price, description }
```

#### Delete Product

```
Method: DELETE
Path: /products/{id}
Auth: ✓ Required
Backend Response: { success: boolean }
```

#### Stream Products

```
Method: GET
Path: /products/stream
Auth: ✓ Required
Backend Response: Stream of products (JSON array)
```

---

### Order APIs

#### Create Order

```
Method: POST
Path: /orders
Auth: ✓ Required
Frontend Kirim: { user_id, product_id, quantity, unit_price }
Backend Response: { id, user_id, product_id, quantity, status, total_price }
Field Names Match:
  - Frontend: user_id → Backend: userId (converted to user_id in JSON)
  - Frontend: product_id → Backend: productId (converted to product_id in JSON)
  - Frontend: quantity → Backend: quantity
  - Frontend: unit_price → Backend: unitPrice (converted to unit_price in JSON)
```

#### Get Order

```
Method: GET
Path: /orders/{id}
Auth: ✓ Required
Backend Response: { id, user_id, product_id, quantity, status, total_price }
```

#### List Orders (by User)

```
Method: GET
Path: /users/{user_id}/orders
Auth: ✓ Required
Frontend Kirim: S.userId (dari path)
Backend Response: { orders: [{ id, user_id, product_id, quantity, status, total_price }] }
Frontend Terima: d.orders
```

#### Update Order Status

```
Method: PATCH
Path: /orders/{id}/status
Auth: ✓ Required
Frontend Kirim: { status }
Backend Response: { id, user_id, product_id, quantity, status, total_price }
Valid Status Transitions:
  - pending → processing, cancelled
  - processing → shipped, cancelled
  - shipped → delivered
  - delivered → (no transitions)
  - cancelled → (no transitions)
```

---

## 🔑 Token Management

### How it works:

1. **Register/Login** → User mendapat token
2. **Token Storage** → Disimpan di sessionStorage

   ```javascript
   sessionStorage.setItem("v_tok", token); // Token
   sessionStorage.setItem("v_uid", uid); // User ID
   sessionStorage.setItem("v_user", username); // Username
   ```

3. **Token Usage** → Dikirim di setiap request

   ```
   Authorization: Bearer <token>
   ```

4. **Token Validation** → Backend memvalidasi di authMiddleware
5. **Logout** → sessionStorage.clear() hapus semua data

---

## 🛒 Cart & Checkout Flow

### Frontend Cart Management:

```javascript
// Store cart locally in memory (S.cart)
S.cart = [{ product: {...}, qty: number }]

// Checkout: Loop through items
for (const c of S.cart) {
  await api("POST", "/orders", {
    user_id: S.userId,
    product_id: c.product.id,
    quantity: c.qty,
    unit_price: c.product.price,
  });
}
```

### Important:

- Cart tidak disimpan di database (local only)
- Setiap item di cart menjadi order terpisah saat checkout
- User bisa track orders di "My Orders" page

---

## 🐛 Troubleshooting

### 1. "Invalid Token" Error

**Kemungkinan Penyebab:**

- Token tidak dikirim di Authorization header → ✅ FIXED
- Token kadaluarsa
- Format token salah

**Solusi:**

```javascript
// Pastikan token dikirim:
Authorization: Bearer <token>
// Bukan:
Authorization: <token>
// Atau:
Bearer <token>
```

### 2. CORS Error

**Backend CORS Middleware:**

```go
w.Header().Set("Access-Control-Allow-Origin", "*")
w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
```

Memastikan `Authorization` header diizinkan.

### 3. "Missing Token" Error

**Cause:** Endpoint memerlukan auth tapi frontend tidak mengirim token
**Solution:** Login terlebih dahulu untuk mendapatkan token

### 4. Products tidak muncul

**Debug:**

1. Buka DevTools → Network tab
2. Cek GET /products request
3. Pastikan Authorization header ada
4. Cek response statusnya (200 = OK, 401 = Unauthorized, 500 = Server Error)

---

## 🚀 Cara Menjalankan Sistem

### Terminal 1 - Auth Service

```powershell
cd auth-service
go run .
# Output: Auth Service  ->  :50051
```

### Terminal 2 - Product Service

```powershell
cd product-service
go run .
# Output: Product Service  ->  :50052
```

### Terminal 3 - Order Service

```powershell
cd order-service
go run .
# Output: Order Service  ->  :50053
```

### Terminal 4 - Gateway & Frontend

```powershell
cd gateway
go run .
# Output: API Gateway  ->  :8080
```

### Akses Frontend

```
http://localhost:8080
```

**Atau gunakan runner (semua services dalam 1 proses):**

```powershell
cd runner
go run .
```

---

## 📝 Field Name Conversions

Protobuf menggunakan camelCase, tapi saat di-marshal ke JSON dengan `UseProtoNames: true`, berubah ke snake_case:

| Proto Field   | JSON Field    | Go Field     |
| ------------- | ------------- | ------------ |
| `user_id`     | `user_id`     | `UserId`     |
| `product_id`  | `product_id`  | `ProductId`  |
| `unit_price`  | `unit_price`  | `UnitPrice`  |
| `total_price` | `total_price` | `TotalPrice` |
| `is_active`   | `is_active`   | `IsActive`   |

Frontend mengirim/terima JSON field names (snake_case), jadi tidak perlu konversi.

---

## ✨ Frontend Features Status

- ✅ Auth (Register/Login)
- ✅ Product Listing
- ✅ Product Creation
- ✅ Shopping Cart (Local)
- ✅ Checkout & Order Placement
- ✅ View My Orders
- ✅ Order Status Tracking
- ✅ Authorization with Bearer Token
- ✅ Logout

---

## 🔍 Health Check

Test backend connectivity:

```powershell
curl http://localhost:8080/health
# Response:
# {
#   "auth": "ok",
#   "product": "ok",
#   "order": "ok"
# }
```

If any service shows "unreachable", pastikan service tersebut sudah running.

---

**Last Updated:** May 12, 2026
**Status:** Frontend-Backend Synchronized ✅
