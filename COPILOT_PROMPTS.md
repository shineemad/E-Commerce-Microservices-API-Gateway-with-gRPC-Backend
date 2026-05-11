# GitHub Copilot Prompts — gRPC Gateway Improvements

> **Cara pakai:** Buka GitHub Copilot Chat (`Ctrl+Alt+I`), lampirkan file yang disebutkan
> dengan klik **paperclip / #** lalu paste prompt-nya. Gunakan mode **Agent** untuk hasil terbaik.

---

## PROMPT 1 — Auth Middleware (Token Validation)

**Lampirkan file sebelum kirim:**

- `#gateway/main.go`
- `#auth-service/main.go`
- `#pb/auth/auth_grpc.pb.go`

```
Saya punya project gRPC Gateway di Go. Lihat file #gateway/main.go dan #auth-service/main.go yang sudah terlampir.

Masalah: gateway/main.go saat ini tidak memvalidasi token sama sekali. Siapapun bisa akses /products dan /orders tanpa login.

Auth service sudah punya method ValidateToken (lihat #pb/auth/auth_grpc.pb.go). Saya ingin menggunakannya sebagai middleware.

Lakukan perubahan berikut HANYA pada gateway/main.go:

1. Tambahkan import "strings"

2. Buat fungsi baru:
   func authMiddleware(ac authpb.AuthServiceClient, next http.HandlerFunc) http.HandlerFunc
   - Ambil token dari header: Authorization: Bearer <token>
   - Jika header kosong → writeError 401 "missing token"
   - Panggil ac.ValidateToken dengan token tersebut menggunakan newCtx()
   - Jika error atau resp.Valid == false → writeError 401 "invalid token"
   - Jika valid → panggil next(w, r)

3. Di fungsi main(), wrap route berikut dengan authMiddleware(ac, ...):
   - GET /products
   - GET /products/{id}
   - POST /products
   - POST /orders
   - GET /orders/{id}
   - GET /users/{user_id}/orders

4. Route POST /auth/register dan POST /auth/login JANGAN diubah (tetap publik)

5. Jangan ubah fungsi handler yang sudah ada, hanya ubah di bagian route registration

Tampilkan isi lengkap gateway/main.go setelah perubahan.
```

---

## PROMPT 2 — CRUD Lengkap (Update & Delete)

**Lampirkan file sebelum kirim:**

- `#proto/product.proto`
- `#proto/order.proto`
- `#product-service/main.go`
- `#order-service/main.go`
- `#gateway/main.go`

```
Saya punya project gRPC Gateway di Go. Lihat semua file yang sudah terlampir.

Saat ini product hanya bisa Create, Get, List. Order hanya bisa Create, Get, List.
Saya ingin CRUD lengkap. Lakukan perubahan berikut:

── LANGKAH 1: Update #proto/product.proto ──
Tambahkan di dalam service ProductService:
  rpc UpdateProduct (UpdateProductRequest) returns (Product);
  rpc DeleteProduct (DeleteProductRequest) returns (DeleteProductResponse);

Tambahkan message baru:
  message UpdateProductRequest {
    string id = 1; string name = 2; double price = 3; string description = 4;
  }
  message DeleteProductRequest  { string id = 1; }
  message DeleteProductResponse { bool success = 1; }

── LANGKAH 2: Update #proto/order.proto ──
Tambahkan di dalam service OrderService:
  rpc UpdateOrderStatus (UpdateOrderStatusRequest) returns (Order);

Tambahkan message baru:
  message UpdateOrderStatusRequest { string id = 1; string status = 2; }

── LANGKAH 3: Update #product-service/main.go ──
Tambahkan 2 method baru ke productServer:

UpdateProduct:
  - Lock dengan s.mu.Lock()
  - Jika req.Id tidak ada di s.items → return nil, status.Errorf(codes.NotFound, ...)
  - Update hanya field yang tidak kosong (name != "" atau price != 0 atau description != "")
  - Return product yang sudah diupdate

DeleteProduct:
  - Lock dengan s.mu.Lock()
  - Jika req.Id tidak ada → return nil, status.Errorf(codes.NotFound, ...)
  - delete(s.items, req.Id)
  - Return &pb.DeleteProductResponse{Success: true}, nil

── LANGKAH 4: Update #order-service/main.go ──
Tambahkan method baru ke orderServer:

UpdateOrderStatus:
  - Lock dengan s.mu.Lock()
  - Jika req.Id tidak ada di s.orders → return nil, status.Errorf(codes.NotFound, ...)
  - s.orders[req.Id].Status = req.Status
  - Return order yang sudah diupdate

── LANGKAH 5: Update #gateway/main.go ──
Tambahkan 3 handler baru:

handleUpdateProduct → decode JSON body {name, price, description} → panggil pc.UpdateProduct
handleDeleteProduct → panggil pc.DeleteProduct dengan id dari path
handleUpdateOrderStatus → decode JSON body {status} → panggil oc.UpdateOrderStatus

Tambahkan route baru di main():
  mux.HandleFunc("PUT /products/{id}",        handleUpdateProduct(pc))
  mux.HandleFunc("DELETE /products/{id}",     handleDeleteProduct(pc))
  mux.HandleFunc("PATCH /orders/{id}/status", handleUpdateOrderStatus(oc))

Update corsMiddleware agar Allow-Methods mencakup: GET, POST, PUT, PATCH, DELETE, OPTIONS

Tampilkan isi lengkap SEMUA file yang berubah.

Catatan penting: Setelah proto diubah, jalankan perintah ini dari root project:
  .\setup_protoc.ps1
untuk regenerate file pb/product/ dan pb/order/
```

---

## PROMPT 3 — gRPC Server Interceptor (Logging)

**Lampirkan file sebelum kirim:**

- `#auth-service/main.go`
- `#product-service/main.go`
- `#order-service/main.go`

```
Saya punya project gRPC Gateway di Go dengan 3 service. Lihat file yang terlampir.

Tambahkan unary server interceptor untuk logging ke ketiga service tersebut.

Untuk SETIAP file (#auth-service/main.go, #product-service/main.go, #order-service/main.go):

1. Tambahkan import "time" jika belum ada

2. Tambahkan fungsi loggingInterceptor SEBELUM fungsi main():
   func loggingInterceptor(
       ctx context.Context,
       req interface{},
       info *grpc.UnaryServerInfo,
       handler grpc.UnaryHandler,
   ) (interface{}, error) {
       start := time.Now()
       resp, err := handler(ctx, req)
       st := "OK"
       if err != nil { st = "ERROR" }
       log.Printf("[grpc] method=%s duration=%v status=%s", info.FullMethod, time.Since(start), st)
       return resp, err
   }

3. Di dalam main(), ubah:
   DARI: s := grpc.NewServer()
   MENJADI: s := grpc.NewServer(grpc.UnaryInterceptor(loggingInterceptor))

Jangan ubah kode lain apapun.

Tampilkan isi lengkap ketiga file setelah perubahan.
```

---

## PROMPT 4 — Health Check Endpoint

**Lampirkan file sebelum kirim:**

- `#gateway/main.go`
- `#pb/auth/auth_grpc.pb.go`
- `#pb/product/product_grpc.pb.go`
- `#pb/order/order_grpc.pb.go`

```
Saya punya project gRPC Gateway di Go. Lihat #gateway/main.go yang sudah terlampir.

Tambahkan health check endpoint ke gateway/main.go saja. Tidak ada file lain yang perlu diubah.

1. Tambahkan import berikut jika belum ada:
   "google.golang.org/grpc/codes"
   "google.golang.org/grpc/status"

2. Buat fungsi baru:
   func handleHealth(
       ac authpb.AuthServiceClient,
       pc productpb.ProductServiceClient,
       oc orderpb.OrderServiceClient,
   ) http.HandlerFunc

   Logika di dalam handler:
   - Buat helper func isAlive(err error) string:
     · Jika err == nil → return "ok"
     · Jika status.Code(err) == codes.Unavailable → return "unreachable"
     · Selain itu (NotFound, Unauthenticated, dll) → return "ok" (service hidup, hanya data tidak ada)

   - Cek auth-service: panggil ac.ValidateToken dengan token kosong, timeout 3 detik
   - Cek product-service: panggil pc.ListProducts, timeout 3 detik
   - Cek order-service: panggil oc.ListOrders dengan user_id kosong, timeout 3 detik

   - Response JSON:
     {"auth": "ok", "product": "ok", "order": "ok"}

   - Set header Content-Type: application/json sebelum encode

3. Di fungsi main(), tambahkan route (letakkan SEBELUM route lain):
   mux.HandleFunc("GET /health", handleHealth(ac, pc, oc))

Tampilkan isi lengkap gateway/main.go setelah perubahan.
```

---

## PROMPT 5 — gRPC Reflection

**Lampirkan file sebelum kirim:**

- `#auth-service/main.go`
- `#product-service/main.go`
- `#order-service/main.go`

```
Saya punya project gRPC Gateway di Go. Lihat file yang terlampir.

Tambahkan gRPC server reflection ke ketiga service (auth-service, product-service, order-service).

Untuk SETIAP file:
1. Tambahkan import: "google.golang.org/grpc/reflection"
2. Di dalam main(), tambahkan satu baris setelah pb.RegisterXxxServiceServer(...):
   reflection.Register(s)
3. Jangan ubah kode lain apapun

Manfaat: service bisa langsung ditest dengan Postman (gRPC mode) atau grpcurl tanpa perlu file proto.

Tampilkan bagian import dan fungsi main() dari ketiga file setelah perubahan.
```

---

## PROMPT 6 — gRPC Server-Side Streaming

**Lampirkan file sebelum kirim:**

- `#proto/product.proto`
- `#product-service/main.go`
- `#gateway/main.go`
- `#pb/product/product_grpc.pb.go`

```
Saya punya project gRPC Gateway di Go. Lihat file yang terlampir.

Saya ingin menambahkan server-side streaming untuk product. Ini adalah fitur khas gRPC yang tidak bisa dilakukan REST biasa.

── LANGKAH 1: Update #proto/product.proto ──
Tambahkan di dalam service ProductService, SEBELUM baris closing brace:
  rpc StreamProducts (ListProductsRequest) returns (stream Product);

── LANGKAH 2: Update #product-service/main.go ──
Tambahkan import "time" jika belum ada.

Tambahkan method baru ke productServer:
  func (s *productServer) StreamProducts(
      req *pb.ListProductsRequest,
      stream pb.ProductService_StreamProductsServer,
  ) error {
      s.mu.RLock()
      defer s.mu.RUnlock()
      for _, p := range s.items {
          if err := stream.Send(p); err != nil {
              return err
          }
          time.Sleep(300 * time.Millisecond)
      }
      return nil
  }

── LANGKAH 3: Update #gateway/main.go ──
Tambahkan import "io" jika belum ada.

Tambahkan fungsi handler baru:
  func handleStreamProducts(c productpb.ProductServiceClient) http.HandlerFunc
  - Buat context timeout 10 detik
  - Panggil c.StreamProducts(ctx, &productpb.ListProductsRequest{})
  - Loop stream.Recv() hingga io.EOF, kumpulkan ke []*productpb.Product
  - Jika ada error selain EOF → writeError 500
  - Marshal hasil ke JSON dengan pj.Marshal untuk setiap item, kumpulkan ke []json.RawMessage
  - Encode array ke response dengan json.NewEncoder(w).Encode(results)
  - Set header Content-Type: application/json

Di fungsi main(), tambahkan route INI SEBELUM "GET /products/{id}":
  mux.HandleFunc("GET /products/stream", handleStreamProducts(pc))

Mengapa harus sebelum: Go 1.22 ServeMux memilih route lebih spesifik duluan,
tapi "stream" bisa konflik dengan pattern {id} jika urutan salah.

── LANGKAH 4: Jalankan protoc ──
Setelah mengubah proto, generate ulang dengan menjalankan di PowerShell dari root project:
  .\setup_protoc.ps1

Tampilkan isi lengkap SEMUA file yang berubah beserta perintah protoc jika diperlukan.
```

---

## CARA PAKAI DI GITHUB COPILOT

### Langkah-langkah:

1. Buka **Copilot Chat** → `Ctrl+Alt+I`
2. Pilih mode **Agent** (ikon robot / dropdown di atas chat)
3. Klik ikon **paperclip** atau ketik `#` untuk lampirkan file yang disebutkan
4. Paste prompt, lalu tekan Enter
5. Review perubahan yang diusulkan sebelum **Accept**

### Tips agar hasil lebih akurat:

- Selalu lampirkan **semua file** yang disebutkan di bagian "Lampirkan file"
- Jika Copilot hanya menampilkan sebagian kode, ketik: `tampilkan kode lengkapnya`
- Jika ada error setelah diterapkan, ketik: `ada error: <paste error>` di chat yang sama

### Urutan yang Disarankan:

```
1. Prompt 3  →  Logging Interceptor   (10 menit, tidak ubah proto)
2. Prompt 5  →  gRPC Reflection       (5 menit, tidak ubah proto)
3. Prompt 4  →  Health Check          (10 menit, tidak ubah proto)
4. Prompt 1  →  Auth Middleware       (15 menit, tidak ubah proto)
5. Prompt 2  →  CRUD Lengkap         (20 menit, ubah proto → jalankan setup_protoc.ps1)
6. Prompt 6  →  gRPC Streaming        (30 menit, ubah proto → jalankan setup_protoc.ps1)
```

### Setelah selesai semua:

```powershell
# Di folder root project
cd "C:\MY CODE\my codingan\tugas gRPC\grpc-gateway"

# Jika ada perubahan proto (Prompt 2 atau 6)
.\setup_protoc.ps1

# Pastikan semua dependency ok
cd auth-service;    go mod tidy; cd ..
cd product-service; go mod tidy; cd ..
cd order-service;   go mod tidy; cd ..
cd gateway;         go mod tidy; cd ..
```
