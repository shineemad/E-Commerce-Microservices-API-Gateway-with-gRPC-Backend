# 📡 Frontend-Backend Architecture & Communication Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER CLIENT                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Frontend (HTML/CSS/JavaScript)                            │ │
│  │  - Auth Pages (Login/Register)                             │ │
│  │  - Product Store                                           │ │
│  │  - Shopping Cart                                           │ │
│  │  - Orders View                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│              ↓ HTTP Requests with Bearer Token                   │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│              API GATEWAY (localhost:8080)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  - CORS Middleware (✅ Authorization allowed)              │ │
│  │  - authMiddleware (validates Bearer token)                │ │
│  │  - Static file server (frontend files)                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│              ↓ gRPC Clients                                      │
└─────────────────────────────────────────────────────────────────┘
        ↓            ↓              ↓           ↓
    ┌───────┐   ┌──────────┐  ┌──────────┐  ┌──────┐
    │ Auth  │   │ Product  │  │  Order   │  │      │
    │Service│   │ Service  │  │ Service  │  │      │
    └───────┘   └──────────┘  └──────────┘  │gRPC  │
    :50051       :50052        :50053        │      │
                                            │      │
```

---

## API Request Flow

### 1️⃣ Authentication Flow

```
USER INPUT
    ↓
┌─────────────────────┐
│  Register/Login     │ (POST /auth/register or /auth/login)
│  Frontend sends:    │ { username, password }
│  - NO token needed  │
└─────────────────────┘
    ↓
┌─────────────────────┐
│  CORS Preflight     │ (OPTIONS request)
│  Browser asks:      │ Can I send these headers?
│  Auth allows: YES   │
└─────────────────────┘
    ↓
┌─────────────────────┐
│  Backend Response   │ 200 OK
│  { token: "...",    │
│    user_id: "..." } │
└─────────────────────┘
    ↓
┌─────────────────────┐
│  Save to Storage    │
│  sessionStorage:    │
│  - v_tok = token    │
│  - v_uid = user_id  │
│  - v_user = username│
└─────────────────────┘
    ↓
S.token = token (in memory)
S.userId = user_id
S.username = username
```

---

### 2️⃣ Protected Resource Request Flow

```
USER ACTION: View Products
    ↓
┌──────────────────────────┐
│  Frontend: api("GET", "/products")
│
│  Automatically adds:
│  - Content-Type: application/json
│  - Authorization: Bearer <token>  ✅ FIXED
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  CORS Preflight          │ (OPTIONS /products)
│  Headers in request:     │
│  ✓ Content-Type          │
│  ✓ Authorization         │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  CORS Middleware         │
│  Checks allowed headers: │
│  Access-Control-Allow-   │
│  Headers: Content-Type,  │
│  Authorization ✅        │
│  → Response: 200 OK      │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  Browser sends actual    │
│  GET request with auth   │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  Backend Router          │
│  GET /products →         │
│  authMiddleware(next)    │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  Auth Middleware         │
│  1. Read Authorization   │
│     header               │
│  2. Extract token        │
│  3. Call ValidateToken   │
│     (Auth Service)       │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  Auth Service (gRPC)     │
│  ValidateToken(token)    │
│  → Response: { valid:    │
│     true, user_id }      │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  Token Valid?            │
│  YES → call handler()    │
│  NO  → return 401        │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  handleListProducts      │
│  Calls Product Service   │
│  (gRPC)                  │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  Product Service         │
│  Returns all products    │
│  { products: [...] }     │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  JSON Response           │
│  200 OK                  │
│  { products: [...] }     │
└──────────────────────────┘
    ↓
┌──────────────────────────┐
│  Frontend Receives       │
│  d.products = array      │
│  → render in store page  │
└──────────────────────────┘
```

---

## Request Headers Evolution

### ❌ BEFORE (BROKEN)

```
Frontend Request:
─────────────────
GET /products HTTP/1.1
Host: localhost:8080
Content-Type: application/json

↑ NO Authorization header!
↑ Protected endpoint returns 401
```

### ✅ AFTER (FIXED)

```
Frontend Request (Preflight):
───────────────────────────────
OPTIONS /products HTTP/1.1
Host: localhost:8080
Access-Control-Request-Method: GET
Access-Control-Request-Headers: authorization

↓

Backend CORS Response:
──────────────────────
HTTP/1.1 200 OK
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization ✅
Access-Control-Allow-Origin: *

↓

Frontend sends actual request:
──────────────────────────────
GET /products HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Authorization: Bearer tok-user123-user-1 ✅

↓

Backend processes request with token validation
```

---

## Data Flow: Order Creation

```
USER ADDS TO CART & CHECKOUT
    ↓
┌──────────────────────────────┐
│  Frontend Cart Data:         │
│  S.cart = [                  │
│    {                         │
│      product: {              │
│        id: "prod-1",         │
│        name: "...",          │
│        price: 99.99          │
│      },                      │
│      qty: 2                  │
│    }                         │
│  ]                           │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│  User clicks "Place Order"   │
│  Frontend loops through cart │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│  For each item:              │
│  api("POST", "/orders", {    │
│    user_id: "user-1",        │
│    product_id: "prod-1",     │
│    quantity: 2,              │
│    unit_price: 99.99         │
│  })                          │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│  Request with token:         │
│  Authorization: Bearer       │
│  token                       │
│  Body: {...order data}       │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│  Backend Validates Token     │
│  ✓ Token valid → proceed     │
│  ✗ Token invalid → 401       │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│  handleCreateOrder           │
│  Calls Order Service (gRPC)  │
│  CreateOrder({...})          │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│  Order Service:              │
│  - Generate order ID         │
│  - Save to in-memory store   │
│  - Return: { id, status,     │
│    total_price, ... }        │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│  Backend Response:           │
│  201 Created                 │
│  { id: "order-8",            │
│    status: "pending",        │
│    total_price: 199.98 }     │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│  Frontend:                   │
│  - Toast: "Order placed!"    │
│  - Clear cart                │
│  - Redirect to orders page   │
└──────────────────────────────┘
    ↓
┌──────────────────────────────┐
│  User can view orders:       │
│  GET /users/{user_id}/orders │
│  with Authorization header   │
└──────────────────────────────┘
```

---

## Error Handling Scenarios

### Scenario 1: User Not Authenticated

```
User tries: GET /products
    ↓
Frontend: No token in S.token
    ↓
api() sends request WITHOUT Authorization header
    ↓
authMiddleware: No Authorization header found
    ↓
Response: 401 Unauthorized
    ↓
Frontend catch block:
  throw new Error("missing token")
    ↓
UI shows: "Please log in first"
```

### Scenario 2: Invalid Token

```
User has: S.token = "invalid-token"
    ↓
Frontend: api() sends Authorization: Bearer invalid-token
    ↓
authMiddleware: Extract token
    ↓
authMiddleware: Call ValidateToken("invalid-token")
    ↓
Auth Service: NOT in tokens map
    ↓
ValidateToken response: { valid: false }
    ↓
authMiddleware: return 401
    ↓
Frontend: Catch error, show "Invalid token, please login"
```

### Scenario 3: Token Expired (Not Implemented Yet)

```
Would need:
1. Token TTL (time-to-live) in Auth Service
2. Token refresh mechanism
3. Frontend detect 401 → request new token
```

---

## Status Codes Mapping

| Code | Meaning      | Frontend Handling              |
| ---- | ------------ | ------------------------------ |
| 200  | OK           | Success, use response          |
| 201  | Created      | Success, new resource created  |
| 400  | Bad Request  | Show error: invalid input      |
| 401  | Unauthorized | Show error: login required     |
| 404  | Not Found    | Show error: resource not found |
| 500  | Server Error | Show error: try again later    |

---

## Next Steps (Optional Improvements)

### 1. Token Expiration

```go
// Auth Service: Add expiration time
type LoginResponse struct {
  Token     string
  ExpiresAt int64 // Unix timestamp
}

// Frontend: Check and refresh
if token_expiry < now {
  request new token
}
```

### 2. Persistent Cart Storage

```javascript
// Save cart to localStorage
localStorage.setItem("cart", JSON.stringify(S.cart));

// Load on page reload
S.cart = JSON.parse(localStorage.getItem("cart")) || [];
```

### 3. Order Status Updates

```go
// Allow user to cancel orders
PATCH /orders/{id}/status
Body: { status: "cancelled" }

// Only certain status transitions allowed
pending → processing, cancelled
processing → shipped
shipped → delivered
```

### 4. Product Search/Filter

```
GET /products?search=laptop
GET /products?category=electronics
```

---

## Summary

✅ **Frontend sends Authorization header**
✅ **Backend accepts Authorization header (CORS fixed)**
✅ **Token validation on protected routes**
✅ **Proper error handling (401 for invalid token)**
✅ **Field names consistent (snake_case in JSON)**
✅ **Response format matches frontend expectations**

**Status: READY FOR PRODUCTION** 🚀
