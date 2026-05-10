$ErrorActionPreference = "Stop"
$go    = "C:\Program Files\Go\bin\go.exe"
$gobin = "$env:USERPROFILE\go\bin"
$base  = "C:\MY CODE\my codingan\tugas gRPC\grpc-gateway"
$env:PATH = "C:\Program Files\Go\bin;$gobin;$env:PATH"

function Die($msg) { Write-Error $msg; exit 1 }

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[1/6] Downloading protoc..." -ForegroundColor Cyan
$ver     = "29.3"
$zipPath = "$env:TEMP\protoc-$ver-win64.zip"
$extPath = "$env:TEMP\protoc-win64"

if (-not (Test-Path $zipPath)) {
    try {
        Invoke-WebRequest `
            "https://github.com/protocolbuffers/protobuf/releases/download/v$ver/protoc-$ver-win64.zip" `
            -OutFile $zipPath -UseBasicParsing
    } catch {
        Write-Warning "v$ver failed, trying v28.3..."
        $ver = "28.3"; $zipPath = "$env:TEMP\protoc-$ver-win64.zip"
        Invoke-WebRequest `
            "https://github.com/protocolbuffers/protobuf/releases/download/v$ver/protoc-$ver-win64.zip" `
            -OutFile $zipPath -UseBasicParsing
    }
}
if (Test-Path $extPath) { Remove-Item $extPath -Recurse -Force }
Expand-Archive $zipPath $extPath
$env:PATH = "$extPath\bin;$env:PATH"
Write-Host "$(protoc --version)" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[2/6] Installing protoc-gen-go plugins..." -ForegroundColor Cyan
& $go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
if ($LASTEXITCODE -ne 0) { Die "protoc-gen-go install failed" }
& $go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
if ($LASTEXITCODE -ne 0) { Die "protoc-gen-go-grpc install failed" }
Write-Host "Plugins installed at $gobin" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[3/6] Writing proto files with go_package..." -ForegroundColor Cyan

@'
syntax = "proto3";
package auth;
option go_package = "example.com/grpcpb/auth;auth";

service AuthService {
  rpc Login          (LoginRequest)         returns (LoginResponse);
  rpc Register       (RegisterRequest)      returns (RegisterResponse);
  rpc ValidateToken  (ValidateTokenRequest) returns (ValidateTokenResponse);
}

message LoginRequest          { string username = 1; string password = 2; }
message LoginResponse         { string token    = 1; string user_id  = 2; }
message RegisterRequest       { string username = 1; string password = 2; string email = 3; }
message RegisterResponse      { string user_id  = 1; string token    = 2; }
message ValidateTokenRequest  { string token    = 1; }
message ValidateTokenResponse { bool   valid    = 1; string user_id  = 2; }
'@ | Set-Content "$base\proto\auth.proto" -Encoding UTF8

@'
syntax = "proto3";
package product;
option go_package = "example.com/grpcpb/product;product";

service ProductService {
  rpc GetProduct    (GetProductRequest)    returns (Product);
  rpc ListProducts  (ListProductsRequest)  returns (ListProductsResponse);
  rpc CreateProduct (CreateProductRequest) returns (Product);
}

message GetProductRequest    { string id = 1; }
message ListProductsRequest  {}
message ListProductsResponse { repeated Product products = 1; }
message CreateProductRequest { string name = 1; double price = 2; string description = 3; }
message Product {
  string id = 1; string name = 2; double price = 3; string description = 4;
}
'@ | Set-Content "$base\proto\product.proto" -Encoding UTF8

@'
syntax = "proto3";
package order;
option go_package = "example.com/grpcpb/order;order";

service OrderService {
  rpc CreateOrder (CreateOrderRequest) returns (Order);
  rpc GetOrder    (GetOrderRequest)    returns (Order);
  rpc ListOrders  (ListOrdersRequest)  returns (ListOrdersResponse);
}

message CreateOrderRequest {
  string user_id    = 1; string product_id = 2;
  int32  quantity   = 3; double unit_price = 4;
}
message GetOrderRequest    { string id      = 1; }
message ListOrdersRequest  { string user_id = 1; }
message ListOrdersResponse { repeated Order orders = 1; }
message Order {
  string id = 1; string user_id = 2; string product_id = 3;
  int32  quantity = 4; string status = 5; double total_price = 6;
}
'@ | Set-Content "$base\proto\order.proto" -Encoding UTF8

Write-Host "Proto files updated." -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[4/6] Generating protobuf code + initializing pb module..." -ForegroundColor Cyan

New-Item -ItemType Directory "$base\pb\auth"    -Force | Out-Null
New-Item -ItemType Directory "$base\pb\product" -Force | Out-Null
New-Item -ItemType Directory "$base\pb\order"   -Force | Out-Null

Set-Location $base
protoc `
    "--go_out=pb"      "--go_opt=module=example.com/grpcpb" `
    "--go-grpc_out=pb" "--go-grpc_opt=module=example.com/grpcpb" `
    proto/auth.proto proto/product.proto proto/order.proto
if ($LASTEXITCODE -ne 0) { Die "protoc failed" }

Write-Host "Generated files:" -ForegroundColor Green
Get-ChildItem "$base\pb" -Recurse -Filter "*.go" | Select-Object -ExpandProperty FullName

# Init pb module (GOWORK=off so service go.mods with stale refs don't interfere)
$env:GOWORK = "off"
Set-Location "$base\pb"
Remove-Item go.mod -ErrorAction SilentlyContinue
Remove-Item go.sum -ErrorAction SilentlyContinue
& $go mod init example.com/grpcpb
& $go get google.golang.org/grpc@latest
& $go get google.golang.org/protobuf@latest
& $go mod tidy
$env:GOWORK = ""
Write-Host "pb module ready." -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[5/6] Writing service implementations (using generated pb types)..." -ForegroundColor Cyan

# ── auth-service ──────────────────────────────────────────────────────────────
@'
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "example.com/grpcpb/auth"
)

type authServer struct {
	pb.UnimplementedAuthServiceServer
	mu     sync.RWMutex
	users  map[string]string // username -> password
	tokens map[string]string // token    -> username
}

func newAuthServer() *authServer {
	return &authServer{users: make(map[string]string), tokens: make(map[string]string)}
}

func (s *authServer) Register(_ context.Context, req *pb.RegisterRequest) (*pb.RegisterResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.users[req.Username]; ok {
		return nil, status.Errorf(codes.AlreadyExists, "username %q already registered", req.Username)
	}
	s.users[req.Username] = req.Password
	uid := fmt.Sprintf("user-%d", len(s.users))
	tok := fmt.Sprintf("tok-%s-%s", req.Username, uid)
	s.tokens[tok] = req.Username
	log.Printf("[auth] register user=%s id=%s", req.Username, uid)
	return &pb.RegisterResponse{UserId: uid, Token: tok}, nil
}

func (s *authServer) Login(_ context.Context, req *pb.LoginRequest) (*pb.LoginResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if pass, ok := s.users[req.Username]; !ok || pass != req.Password {
		return nil, status.Error(codes.Unauthenticated, "invalid credentials")
	}
	tok := "tok-" + req.Username
	s.tokens[tok] = req.Username
	log.Printf("[auth] login user=%s", req.Username)
	return &pb.LoginResponse{Token: tok, UserId: "user-" + req.Username}, nil
}

func (s *authServer) ValidateToken(_ context.Context, req *pb.ValidateTokenRequest) (*pb.ValidateTokenResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	uname, ok := s.tokens[req.Token]
	if !ok {
		return &pb.ValidateTokenResponse{Valid: false}, nil
	}
	return &pb.ValidateTokenResponse{Valid: true, UserId: "user-" + uname}, nil
}

func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	s := grpc.NewServer()
	pb.RegisterAuthServiceServer(s, newAuthServer())
	log.Println("Auth Service  ->  :50051")
	log.Fatal(s.Serve(lis))
}
'@ | Set-Content "$base\auth-service\main.go" -Encoding UTF8

# ── product-service ────────────────────────────────────────────────────────────
@'
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "example.com/grpcpb/product"
)

type productServer struct {
	pb.UnimplementedProductServiceServer
	mu      sync.RWMutex
	items   map[string]*pb.Product
	counter int
}

func newProductServer() *productServer {
	s := &productServer{items: make(map[string]*pb.Product), counter: 2}
	s.items["prod-1"] = &pb.Product{Id: "prod-1", Name: "Laptop", Price: 999.99, Description: "High-performance laptop"}
	s.items["prod-2"] = &pb.Product{Id: "prod-2", Name: "Mouse", Price: 29.99, Description: "Wireless mouse"}
	return s
}

func (s *productServer) GetProduct(_ context.Context, req *pb.GetProductRequest) (*pb.Product, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.items[req.Id]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "product %q not found", req.Id)
	}
	return p, nil
}

func (s *productServer) ListProducts(_ context.Context, _ *pb.ListProductsRequest) (*pb.ListProductsResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*pb.Product, 0, len(s.items))
	for _, p := range s.items {
		list = append(list, p)
	}
	return &pb.ListProductsResponse{Products: list}, nil
}

func (s *productServer) CreateProduct(_ context.Context, req *pb.CreateProductRequest) (*pb.Product, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.counter++
	id := fmt.Sprintf("prod-%d", s.counter)
	p := &pb.Product{Id: id, Name: req.Name, Price: req.Price, Description: req.Description}
	s.items[id] = p
	log.Printf("[product] created id=%s name=%s price=%.2f", id, req.Name, req.Price)
	return p, nil
}

func main() {
	lis, err := net.Listen("tcp", ":50052")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	s := grpc.NewServer()
	pb.RegisterProductServiceServer(s, newProductServer())
	log.Println("Product Service  ->  :50052")
	log.Fatal(s.Serve(lis))
}
'@ | Set-Content "$base\product-service\main.go" -Encoding UTF8

# ── order-service ──────────────────────────────────────────────────────────────
@'
package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	pb "example.com/grpcpb/order"
)

type orderServer struct {
	pb.UnimplementedOrderServiceServer
	mu      sync.RWMutex
	orders  map[string]*pb.Order
	counter int
}

func newOrderServer() *orderServer {
	return &orderServer{orders: make(map[string]*pb.Order)}
}

func (s *orderServer) CreateOrder(_ context.Context, req *pb.CreateOrderRequest) (*pb.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.counter++
	id := fmt.Sprintf("order-%d", s.counter)
	o := &pb.Order{
		Id:         id,
		UserId:     req.UserId,
		ProductId:  req.ProductId,
		Quantity:   req.Quantity,
		Status:     "pending",
		TotalPrice: req.UnitPrice * float64(req.Quantity),
	}
	s.orders[id] = o
	log.Printf("[order] created id=%s user=%s product=%s qty=%d", id, req.UserId, req.ProductId, req.Quantity)
	return o, nil
}

func (s *orderServer) GetOrder(_ context.Context, req *pb.GetOrderRequest) (*pb.Order, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	o, ok := s.orders[req.Id]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "order %q not found", req.Id)
	}
	return o, nil
}

func (s *orderServer) ListOrders(_ context.Context, req *pb.ListOrdersRequest) (*pb.ListOrdersResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var list []*pb.Order
	for _, o := range s.orders {
		if req.UserId == "" || o.UserId == req.UserId {
			list = append(list, o)
		}
	}
	return &pb.ListOrdersResponse{Orders: list}, nil
}

func main() {
	lis, err := net.Listen("tcp", ":50053")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	s := grpc.NewServer()
	pb.RegisterOrderServiceServer(s, newOrderServer())
	log.Println("Order Service  ->  :50053")
	log.Fatal(s.Serve(lis))
}
'@ | Set-Content "$base\order-service\main.go" -Encoding UTF8

# ── gateway ────────────────────────────────────────────────────────────────────
@'
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	authpb    "example.com/grpcpb/auth"
	orderpb   "example.com/grpcpb/order"
	productpb "example.com/grpcpb/product"
)

var pj = protojson.MarshalOptions{UseProtoNames: true, EmitUnpopulated: false}

func writeProto(w http.ResponseWriter, code int, m proto.Message) {
	b, err := pj.Marshal(m)
	if err != nil {
		http.Error(w, `{"error":"marshal error"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write(b)
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	b, _ := json.Marshal(map[string]string{"error": msg})
	_, _ = w.Write(b)
}

func newCtx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 5*time.Second)
}

// ── Auth ──────────────────────────────────────────────────────────────────────

func handleRegister(c authpb.AuthServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Email    string `json:"email"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON"); return
		}
		ctx, cancel := newCtx(); defer cancel()
		resp, err := c.Register(ctx, &authpb.RegisterRequest{Username: b.Username, Password: b.Password, Email: b.Email})
		if err != nil { writeError(w, http.StatusBadRequest, err.Error()); return }
		writeProto(w, http.StatusCreated, resp)
	}
}

func handleLogin(c authpb.AuthServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON"); return
		}
		ctx, cancel := newCtx(); defer cancel()
		resp, err := c.Login(ctx, &authpb.LoginRequest{Username: b.Username, Password: b.Password})
		if err != nil { writeError(w, http.StatusUnauthorized, err.Error()); return }
		writeProto(w, http.StatusOK, resp)
	}
}

// ── Products ──────────────────────────────────────────────────────────────────

func handleListProducts(c productpb.ProductServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := newCtx(); defer cancel()
		resp, err := c.ListProducts(ctx, &productpb.ListProductsRequest{})
		if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
		writeProto(w, http.StatusOK, resp)
	}
}

func handleGetProduct(c productpb.ProductServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := newCtx(); defer cancel()
		resp, err := c.GetProduct(ctx, &productpb.GetProductRequest{Id: r.PathValue("id")})
		if err != nil { writeError(w, http.StatusNotFound, err.Error()); return }
		writeProto(w, http.StatusOK, resp)
	}
}

func handleCreateProduct(c productpb.ProductServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			Name        string  `json:"name"`
			Price       float64 `json:"price"`
			Description string  `json:"description"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON"); return
		}
		ctx, cancel := newCtx(); defer cancel()
		resp, err := c.CreateProduct(ctx, &productpb.CreateProductRequest{Name: b.Name, Price: b.Price, Description: b.Description})
		if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
		writeProto(w, http.StatusCreated, resp)
	}
}

// ── Orders ────────────────────────────────────────────────────────────────────

func handleCreateOrder(c orderpb.OrderServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			UserId    string  `json:"user_id"`
			ProductId string  `json:"product_id"`
			Quantity  int32   `json:"quantity"`
			UnitPrice float64 `json:"unit_price"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON"); return
		}
		ctx, cancel := newCtx(); defer cancel()
		resp, err := c.CreateOrder(ctx, &orderpb.CreateOrderRequest{
			UserId: b.UserId, ProductId: b.ProductId, Quantity: b.Quantity, UnitPrice: b.UnitPrice,
		})
		if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
		writeProto(w, http.StatusCreated, resp)
	}
}

func handleGetOrder(c orderpb.OrderServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := newCtx(); defer cancel()
		resp, err := c.GetOrder(ctx, &orderpb.GetOrderRequest{Id: r.PathValue("id")})
		if err != nil { writeError(w, http.StatusNotFound, err.Error()); return }
		writeProto(w, http.StatusOK, resp)
	}
}

func handleListOrders(c orderpb.OrderServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := newCtx(); defer cancel()
		resp, err := c.ListOrders(ctx, &orderpb.ListOrdersRequest{UserId: r.PathValue("user_id")})
		if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
		writeProto(w, http.StatusOK, resp)
	}
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	dial := func(addr string) *grpc.ClientConn {
		c, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil { log.Fatalf("dial %s: %v", addr, err) }
		return c
	}

	ac := authpb.NewAuthServiceClient(dial("localhost:50051"))
	pc := productpb.NewProductServiceClient(dial("localhost:50052"))
	oc := orderpb.NewOrderServiceClient(dial("localhost:50053"))

	mux := http.NewServeMux()
	mux.HandleFunc("POST /auth/register",         handleRegister(ac))
	mux.HandleFunc("POST /auth/login",             handleLogin(ac))
	mux.HandleFunc("GET /products",                handleListProducts(pc))
	mux.HandleFunc("GET /products/{id}",           handleGetProduct(pc))
	mux.HandleFunc("POST /products",               handleCreateProduct(pc))
	mux.HandleFunc("POST /orders",                 handleCreateOrder(oc))
	mux.HandleFunc("GET /orders/{id}",             handleGetOrder(oc))
	mux.HandleFunc("GET /users/{user_id}/orders",  handleListOrders(oc))

	log.Println("API Gateway -> http://localhost:8080")
	log.Println("  POST /auth/register | POST /auth/login")
	log.Println("  GET|POST /products  | GET /products/{id}")
	log.Println("  POST /orders        | GET /orders/{id}")
	log.Println("  GET /users/{user_id}/orders")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
'@ | Set-Content "$base\gateway\main.go" -Encoding UTF8

Write-Host "Service files written." -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n[6/6] Updating go.work + tidying modules + building..." -ForegroundColor Cyan

# Tidy each service with GOWORK=off + replace directive (local path = no network fetch)
foreach ($svc in @("auth-service","product-service","order-service","gateway")) {
    Write-Host ("  Tidying " + $svc + "...")
    Set-Location "$base\$svc"
    # Fresh go.mod - remove stale grpcgateway/pb references
    Remove-Item go.mod -ErrorAction SilentlyContinue
    Remove-Item go.sum -ErrorAction SilentlyContinue
    $env:GOWORK = "off"
    & $go mod init $svc
    & $go mod edit -require "example.com/grpcpb@v0.0.0-00010101000000-000000000000"
    & $go mod edit -replace "example.com/grpcpb=../pb"
    & $go mod tidy   # replace with local path = no network for grpcpb
    $env:GOWORK = ""
}

# Update go.work to include all modules (enables workspace-aware tooling)
Set-Location $base
& $go work use ./pb ./auth-service ./product-service ./order-service ./gateway

Write-Host "`nBuilding..."
$ok = $true
foreach ($svc in @("auth-service","product-service","order-service","gateway")) {
    Set-Location "$base\$svc"
    $r = & $go build . 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host ("  " + $svc + ": OK") -ForegroundColor Green
    } else {
        Write-Host ("  " + $svc + ": FAILED") -ForegroundColor Red
        $r | ForEach-Object { Write-Host ("    " + $_) }
        $ok = $false
    }
}

if ($ok) {
    Write-Host "`n=== ALL SERVICES BUILD SUCCESSFULLY WITH protoc-gen-go ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Structure:" -ForegroundColor Yellow
    Write-Host "  grpc-gateway/pb/auth/      <- generated from auth.proto"
    Write-Host "  grpc-gateway/pb/product/   <- generated from product.proto"
    Write-Host "  grpc-gateway/pb/order/     <- generated from order.proto"
    Write-Host ""
    Write-Host "Start (4 terminals):" -ForegroundColor Yellow
    Write-Host "  cd auth-service    ; go run ."
    Write-Host "  cd product-service ; go run ."
    Write-Host "  cd order-service   ; go run ."
    Write-Host "  cd gateway         ; go run ."
} else {
    Write-Error "Some services failed to build. Check errors above."
}

