# 🚀 Quick Start Guide - Frontend & Backend Connected

## ⚡ TL;DR - Jalankan Sistem Sekarang

### Option 1: Run All Services (Recommended)

```powershell
cd runner
go run .
```

Opens: http://localhost:8080

---

### Option 2: Run Services Individually

**Terminal 1:**

```powershell
cd auth-service
go run .
# Auth Service  ->  :50051
```

**Terminal 2:**

```powershell
cd product-service
go run .
# Product Service  ->  :50052
```

**Terminal 3:**

```powershell
cd order-service
go run .
# Order Service  ->  :50053
```

**Terminal 4:**

```powershell
cd gateway
go run .
# API Gateway  ->  :8080
```

---

## 🧪 Test Connection

```powershell
./test-connection.ps1
```

Expected: ✓ All tests pass

---

## 🌐 Access Frontend

```
http://localhost:8080
```

---

## 🔑 Test User Account

### Create New Account

1. Go to http://localhost:8080
2. Click "Create Account"
3. Fill: Username, Email, Password
4. Submit

### Or Use Existing (if created previously)

- Frontend auto-remembers session via sessionStorage

---

## 📋 What You Can Do

### ✓ Auth

- Register: Create account with username, email, password
- Login: Login with username, password
- Logout: Clear session

### ✓ Products

- View all products
- Add new product (admin)
- Edit product (admin)
- Delete product (admin)

### ✓ Shopping

- Add products to cart
- Change quantity
- Checkout & place order
- View order history

### ✓ Orders

- Create orders
- View my orders
- Check order status
- Update order status (admin)

---

## 🛠️ Fixed Issues

| Issue                | Problem                                | Fix                                    |
| -------------------- | -------------------------------------- | -------------------------------------- |
| Authorization Header | Frontend not sending token             | ✅ Added Bearer token to all requests  |
| CORS Error           | Backend rejecting Authorization header | ✅ Added Authorization to CORS headers |
| Protected Routes     | Not working without token              | ✅ Now validates token properly        |

---

## 📚 Documentation

- **SYNC_SUMMARY.md** - Overview of fixes and status
- **FRONTEND_BACKEND_SYNC.md** - Detailed API endpoints & field mapping
- **ARCHITECTURE.md** - System architecture & data flow diagrams

---

## 🐛 Troubleshooting

### "401 Unauthorized"

→ Log in first, then try again

### "CORS error"

→ All services must be running
→ Check if gateway is at :8080

### "Cannot connect to localhost:8080"

→ Ensure gateway service is running: `cd gateway && go run .`

### Products not showing

→ Login required first
→ Check browser DevTools for error messages

---

## ✨ Key Features Now Working

- ✅ Bearer token sent automatically
- ✅ CORS headers configured correctly
- ✅ Protected routes secured
- ✅ Error handling (401, 404, 500)
- ✅ Session management
- ✅ Cart & checkout
- ✅ Order tracking

---

**Everything is now synchronized and ready to use!** 🎉

Run `./test-connection.ps1` to verify all endpoints are working.
