$ErrorActionPreference = "Stop"
$base = "C:\MY CODE\my codingan\tugas gRPC\grpc-gateway"

Write-Host "==> Writing proto files..."

@'
syntax = "proto3";

package auth;

option go_package = "auth-service/pb;pb";

service AuthService {
  rpc Login(LoginRequest) returns (LoginResponse);
  rpc Register(RegisterRequest) returns (RegisterResponse);
  rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);
}

message LoginRequest {
  string username = 1;
  string password = 2;
}

message LoginResponse {
  string token = 1;
  string user_id = 2;
}

message RegisterRequest {
  string username = 1;
  string password = 2;
  string email = 3;
}

message RegisterResponse {
  string user_id = 1;
  string token = 2;
}

message ValidateTokenRequest {
  string token = 1;
}

message ValidateTokenResponse {
  bool valid = 1;
  string user_id = 2;
}
'@ | Set-Content "$base\proto\auth.proto" -Encoding UTF8

@'
syntax = "proto3";

package product;

option go_package = "product-service/pb;pb";

service ProductService {
  rpc GetProduct(GetProductRequest) returns (Product);
  rpc ListProducts(ListProductsRequest) returns (ListProductsResponse);
  rpc CreateProduct(CreateProductRequest) returns (Product);
}

message GetProductRequest {
  string id = 1;
}

message ListProductsRequest {}

message ListProductsResponse {
  repeated Product products = 1;
}

message CreateProductRequest {
  string name = 1;
  double price = 2;
  string description = 3;
}

message Product {
  string id = 1;
  string name = 2;
  double price = 3;
  string description = 4;
}
'@ | Set-Content "$base\proto\product.proto" -Encoding UTF8

@'
syntax = "proto3";

package order;

option go_package = "order-service/pb;pb";

service OrderService {
  rpc CreateOrder(CreateOrderRequest) returns (Order);
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc ListOrders(ListOrdersRequest) returns (ListOrdersResponse);
}

message CreateOrderRequest {
  string user_id = 1;
  string product_id = 2;
  int32 quantity = 3;
  double unit_price = 4;
}

message GetOrderRequest {
  string id = 1;
}

message ListOrdersRequest {
  string user_id = 1;
}

message ListOrdersResponse {
  repeated Order orders = 1;
}

message Order {
  string id = 1;
  string user_id = 2;
  string product_id = 3;
  int32 quantity = 4;
  string status = 5;
  double total_price = 6;
}
'@ | Set-Content "$base\proto\order.proto" -Encoding UTF8

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "==> Writing auth-service/main.go..."

@'
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/encoding"
)

// jsonCodec replaces the default protobuf codec so services can communicate
// using JSON without requiring protoc code generation.
func init() { encoding.RegisterCodec(jsonCodec{}) }

type jsonCodec struct{}

func (jsonCodec) Marshal(v interface{}) ([]byte, error)      { return json.Marshal(v) }
func (jsonCodec) Unmarshal(data []byte, v interface{}) error { return json.Unmarshal(data, v) }
func (jsonCodec) Name() string                               { return "proto" }

// ── Message types ────────────────────────────────────────────────────────────

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token  string `json:"token"`
	UserID string `json:"user_id"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Email    string `json:"email"`
}

type RegisterResponse struct {
	UserID string `json:"user_id"`
	Token  string `json:"token"`
}

type ValidateTokenRequest struct {
	Token string `json:"token"`
}

type ValidateTokenResponse struct {
	Valid  bool   `json:"valid"`
	UserID string `json:"user_id"`
}

// ── Service interface ────────────────────────────────────────────────────────

type AuthServiceServer interface {
	Login(context.Context, *LoginRequest) (*LoginResponse, error)
	Register(context.Context, *RegisterRequest) (*RegisterResponse, error)
	ValidateToken(context.Context, *ValidateTokenRequest) (*ValidateTokenResponse, error)
}

// ── Service descriptor (equivalent to what protoc-gen-go-grpc generates) ────

var authServiceDesc = grpc.ServiceDesc{
	ServiceName: "auth.AuthService",
	HandlerType: (*AuthServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{MethodName: "Login", Handler: loginHandler},
		{MethodName: "Register", Handler: registerHandler},
		{MethodName: "ValidateToken", Handler: validateTokenHandler},
	},
	Streams: []grpc.StreamDesc{},
}

func loginHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(LoginRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(AuthServiceServer).Login(ctx, in)
	}
	return interceptor(ctx, in,
		&grpc.UnaryServerInfo{Server: srv, FullMethod: "/auth.AuthService/Login"},
		func(ctx context.Context, req interface{}) (interface{}, error) {
			return srv.(AuthServiceServer).Login(ctx, req.(*LoginRequest))
		})
}

func registerHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(RegisterRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(AuthServiceServer).Register(ctx, in)
	}
	return interceptor(ctx, in,
		&grpc.UnaryServerInfo{Server: srv, FullMethod: "/auth.AuthService/Register"},
		func(ctx context.Context, req interface{}) (interface{}, error) {
			return srv.(AuthServiceServer).Register(ctx, req.(*RegisterRequest))
		})
}

func validateTokenHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ValidateTokenRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(AuthServiceServer).ValidateToken(ctx, in)
	}
	return interceptor(ctx, in,
		&grpc.UnaryServerInfo{Server: srv, FullMethod: "/auth.AuthService/ValidateToken"},
		func(ctx context.Context, req interface{}) (interface{}, error) {
			return srv.(AuthServiceServer).ValidateToken(ctx, req.(*ValidateTokenRequest))
		})
}

// ── Implementation ───────────────────────────────────────────────────────────

type authServer struct {
	mu     sync.RWMutex
	users  map[string]string // username -> password
	tokens map[string]string // token -> username
}

func newAuthServer() *authServer {
	return &authServer{
		users:  make(map[string]string),
		tokens: make(map[string]string),
	}
}

func (s *authServer) Register(ctx context.Context, req *RegisterRequest) (*RegisterResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.users[req.Username]; exists {
		return nil, fmt.Errorf("username %q already registered", req.Username)
	}
	s.users[req.Username] = req.Password
	userID := fmt.Sprintf("user-%d", len(s.users))
	token := fmt.Sprintf("tok-%s-%s", req.Username, userID)
	s.tokens[token] = req.Username
	log.Printf("[auth] registered user=%s id=%s", req.Username, userID)
	return &RegisterResponse{UserID: userID, Token: token}, nil
}

func (s *authServer) Login(ctx context.Context, req *LoginRequest) (*LoginResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	pass, ok := s.users[req.Username]
	if !ok || pass != req.Password {
		return nil, fmt.Errorf("invalid credentials")
	}
	token := fmt.Sprintf("tok-%s", req.Username)
	s.tokens[token] = req.Username
	log.Printf("[auth] login user=%s", req.Username)
	return &LoginResponse{Token: token, UserID: fmt.Sprintf("user-%s", req.Username)}, nil
}

func (s *authServer) ValidateToken(ctx context.Context, req *ValidateTokenRequest) (*ValidateTokenResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	username, ok := s.tokens[req.Token]
	if !ok {
		return &ValidateTokenResponse{Valid: false}, nil
	}
	return &ValidateTokenResponse{Valid: true, UserID: fmt.Sprintf("user-%s", username)}, nil
}

// ── Main ─────────────────────────────────────────────────────────────────────

func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	s := grpc.NewServer()
	s.RegisterService(&authServiceDesc, newAuthServer())
	log.Println("Auth Service  ->  :50051")
	if err := s.Serve(lis); err != nil {
		log.Fatalf("serve: %v", err)
	}
}
'@ | Set-Content "$base\auth-service\main.go" -Encoding UTF8

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "==> Writing product-service/main.go..."

@'
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/encoding"
)

func init() { encoding.RegisterCodec(jsonCodec{}) }

type jsonCodec struct{}

func (jsonCodec) Marshal(v interface{}) ([]byte, error)      { return json.Marshal(v) }
func (jsonCodec) Unmarshal(data []byte, v interface{}) error { return json.Unmarshal(data, v) }
func (jsonCodec) Name() string                               { return "proto" }

// ── Message types ────────────────────────────────────────────────────────────

type Product struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	Description string  `json:"description"`
}

type GetProductRequest struct {
	ID string `json:"id"`
}

type ListProductsRequest struct{}

type ListProductsResponse struct {
	Products []*Product `json:"products"`
}

type CreateProductRequest struct {
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	Description string  `json:"description"`
}

// ── Service interface ────────────────────────────────────────────────────────

type ProductServiceServer interface {
	GetProduct(context.Context, *GetProductRequest) (*Product, error)
	ListProducts(context.Context, *ListProductsRequest) (*ListProductsResponse, error)
	CreateProduct(context.Context, *CreateProductRequest) (*Product, error)
}

var productServiceDesc = grpc.ServiceDesc{
	ServiceName: "product.ProductService",
	HandlerType: (*ProductServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{MethodName: "GetProduct", Handler: getProductHandler},
		{MethodName: "ListProducts", Handler: listProductsHandler},
		{MethodName: "CreateProduct", Handler: createProductHandler},
	},
	Streams: []grpc.StreamDesc{},
}

func getProductHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetProductRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(ProductServiceServer).GetProduct(ctx, in)
	}
	return interceptor(ctx, in,
		&grpc.UnaryServerInfo{Server: srv, FullMethod: "/product.ProductService/GetProduct"},
		func(ctx context.Context, req interface{}) (interface{}, error) {
			return srv.(ProductServiceServer).GetProduct(ctx, req.(*GetProductRequest))
		})
}

func listProductsHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ListProductsRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(ProductServiceServer).ListProducts(ctx, in)
	}
	return interceptor(ctx, in,
		&grpc.UnaryServerInfo{Server: srv, FullMethod: "/product.ProductService/ListProducts"},
		func(ctx context.Context, req interface{}) (interface{}, error) {
			return srv.(ProductServiceServer).ListProducts(ctx, req.(*ListProductsRequest))
		})
}

func createProductHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CreateProductRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(ProductServiceServer).CreateProduct(ctx, in)
	}
	return interceptor(ctx, in,
		&grpc.UnaryServerInfo{Server: srv, FullMethod: "/product.ProductService/CreateProduct"},
		func(ctx context.Context, req interface{}) (interface{}, error) {
			return srv.(ProductServiceServer).CreateProduct(ctx, req.(*CreateProductRequest))
		})
}

// ── Implementation ───────────────────────────────────────────────────────────

type productServer struct {
	mu      sync.RWMutex
	items   map[string]*Product
	counter int
}

func newProductServer() *productServer {
	s := &productServer{items: make(map[string]*Product)}
	// seed data
	s.items["prod-1"] = &Product{ID: "prod-1", Name: "Laptop", Price: 999.99, Description: "High-performance laptop"}
	s.items["prod-2"] = &Product{ID: "prod-2", Name: "Mouse", Price: 29.99, Description: "Wireless mouse"}
	s.counter = 2
	return s
}

func (s *productServer) GetProduct(ctx context.Context, req *GetProductRequest) (*Product, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.items[req.ID]
	if !ok {
		return nil, fmt.Errorf("product %q not found", req.ID)
	}
	return p, nil
}

func (s *productServer) ListProducts(ctx context.Context, _ *ListProductsRequest) (*ListProductsResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*Product, 0, len(s.items))
	for _, p := range s.items {
		list = append(list, p)
	}
	return &ListProductsResponse{Products: list}, nil
}

func (s *productServer) CreateProduct(ctx context.Context, req *CreateProductRequest) (*Product, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.counter++
	id := fmt.Sprintf("prod-%d", s.counter)
	p := &Product{ID: id, Name: req.Name, Price: req.Price, Description: req.Description}
	s.items[id] = p
	log.Printf("[product] created id=%s name=%s price=%.2f", id, req.Name, req.Price)
	return p, nil
}

// ── Main ─────────────────────────────────────────────────────────────────────

func main() {
	lis, err := net.Listen("tcp", ":50052")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	s := grpc.NewServer()
	s.RegisterService(&productServiceDesc, newProductServer())
	log.Println("Product Service  ->  :50052")
	if err := s.Serve(lis); err != nil {
		log.Fatalf("serve: %v", err)
	}
}
'@ | Set-Content "$base\product-service\main.go" -Encoding UTF8

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "==> Writing order-service/main.go..."

@'
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/grpc/encoding"
)

func init() { encoding.RegisterCodec(jsonCodec{}) }

type jsonCodec struct{}

func (jsonCodec) Marshal(v interface{}) ([]byte, error)      { return json.Marshal(v) }
func (jsonCodec) Unmarshal(data []byte, v interface{}) error { return json.Unmarshal(data, v) }
func (jsonCodec) Name() string                               { return "proto" }

// ── Message types ────────────────────────────────────────────────────────────

type Order struct {
	ID         string  `json:"id"`
	UserID     string  `json:"user_id"`
	ProductID  string  `json:"product_id"`
	Quantity   int32   `json:"quantity"`
	Status     string  `json:"status"`
	TotalPrice float64 `json:"total_price"`
}

type CreateOrderRequest struct {
	UserID    string  `json:"user_id"`
	ProductID string  `json:"product_id"`
	Quantity  int32   `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
}

type GetOrderRequest struct {
	ID string `json:"id"`
}

type ListOrdersRequest struct {
	UserID string `json:"user_id"`
}

type ListOrdersResponse struct {
	Orders []*Order `json:"orders"`
}

// ── Service interface ────────────────────────────────────────────────────────

type OrderServiceServer interface {
	CreateOrder(context.Context, *CreateOrderRequest) (*Order, error)
	GetOrder(context.Context, *GetOrderRequest) (*Order, error)
	ListOrders(context.Context, *ListOrdersRequest) (*ListOrdersResponse, error)
}

var orderServiceDesc = grpc.ServiceDesc{
	ServiceName: "order.OrderService",
	HandlerType: (*OrderServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{MethodName: "CreateOrder", Handler: createOrderHandler},
		{MethodName: "GetOrder", Handler: getOrderHandler},
		{MethodName: "ListOrders", Handler: listOrdersHandler},
	},
	Streams: []grpc.StreamDesc{},
}

func createOrderHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(CreateOrderRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(OrderServiceServer).CreateOrder(ctx, in)
	}
	return interceptor(ctx, in,
		&grpc.UnaryServerInfo{Server: srv, FullMethod: "/order.OrderService/CreateOrder"},
		func(ctx context.Context, req interface{}) (interface{}, error) {
			return srv.(OrderServiceServer).CreateOrder(ctx, req.(*CreateOrderRequest))
		})
}

func getOrderHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(GetOrderRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(OrderServiceServer).GetOrder(ctx, in)
	}
	return interceptor(ctx, in,
		&grpc.UnaryServerInfo{Server: srv, FullMethod: "/order.OrderService/GetOrder"},
		func(ctx context.Context, req interface{}) (interface{}, error) {
			return srv.(OrderServiceServer).GetOrder(ctx, req.(*GetOrderRequest))
		})
}

func listOrdersHandler(srv interface{}, ctx context.Context, dec func(interface{}) error, interceptor grpc.UnaryServerInterceptor) (interface{}, error) {
	in := new(ListOrdersRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(OrderServiceServer).ListOrders(ctx, in)
	}
	return interceptor(ctx, in,
		&grpc.UnaryServerInfo{Server: srv, FullMethod: "/order.OrderService/ListOrders"},
		func(ctx context.Context, req interface{}) (interface{}, error) {
			return srv.(OrderServiceServer).ListOrders(ctx, req.(*ListOrdersRequest))
		})
}

// ── Implementation ───────────────────────────────────────────────────────────

type orderServer struct {
	mu      sync.RWMutex
	orders  map[string]*Order
	counter int
}

func newOrderServer() *orderServer {
	return &orderServer{orders: make(map[string]*Order)}
}

func (s *orderServer) CreateOrder(ctx context.Context, req *CreateOrderRequest) (*Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.counter++
	id := fmt.Sprintf("order-%d", s.counter)
	o := &Order{
		ID:         id,
		UserID:     req.UserID,
		ProductID:  req.ProductID,
		Quantity:   req.Quantity,
		Status:     "pending",
		TotalPrice: req.UnitPrice * float64(req.Quantity),
	}
	s.orders[id] = o
	log.Printf("[order] created id=%s user=%s product=%s qty=%d", id, req.UserID, req.ProductID, req.Quantity)
	return o, nil
}

func (s *orderServer) GetOrder(ctx context.Context, req *GetOrderRequest) (*Order, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	o, ok := s.orders[req.ID]
	if !ok {
		return nil, fmt.Errorf("order %q not found", req.ID)
	}
	return o, nil
}

func (s *orderServer) ListOrders(ctx context.Context, req *ListOrdersRequest) (*ListOrdersResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var list []*Order
	for _, o := range s.orders {
		if req.UserID == "" || o.UserID == req.UserID {
			list = append(list, o)
		}
	}
	return &ListOrdersResponse{Orders: list}, nil
}

// ── Main ─────────────────────────────────────────────────────────────────────

func main() {
	lis, err := net.Listen("tcp", ":50053")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	s := grpc.NewServer()
	s.RegisterService(&orderServiceDesc, newOrderServer())
	log.Println("Order Service  ->  :50053")
	if err := s.Serve(lis); err != nil {
		log.Fatalf("serve: %v", err)
	}
}
'@ | Set-Content "$base\order-service\main.go" -Encoding UTF8

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "==> Writing gateway/main.go..."

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
	"google.golang.org/grpc/encoding"
)

// Use the same JSON codec as the services.
func init() { encoding.RegisterCodec(jsonCodec{}) }

type jsonCodec struct{}

func (jsonCodec) Marshal(v interface{}) ([]byte, error)      { return json.Marshal(v) }
func (jsonCodec) Unmarshal(data []byte, v interface{}) error { return json.Unmarshal(data, v) }
func (jsonCodec) Name() string                               { return "proto" }

// ── Auth types ───────────────────────────────────────────────────────────────

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token  string `json:"token"`
	UserID string `json:"user_id"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Email    string `json:"email"`
}

type RegisterResponse struct {
	UserID string `json:"user_id"`
	Token  string `json:"token"`
}

// ── Product types ────────────────────────────────────────────────────────────

type Product struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	Description string  `json:"description"`
}

type ListProductsRequest struct{}

type ListProductsResponse struct {
	Products []*Product `json:"products"`
}

type CreateProductRequest struct {
	Name        string  `json:"name"`
	Price       float64 `json:"price"`
	Description string  `json:"description"`
}

// ── Order types ──────────────────────────────────────────────────────────────

type Order struct {
	ID         string  `json:"id"`
	UserID     string  `json:"user_id"`
	ProductID  string  `json:"product_id"`
	Quantity   int32   `json:"quantity"`
	Status     string  `json:"status"`
	TotalPrice float64 `json:"total_price"`
}

type CreateOrderRequest struct {
	UserID    string  `json:"user_id"`
	ProductID string  `json:"product_id"`
	Quantity  int32   `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
}

type ListOrdersResponse struct {
	Orders []*Order `json:"orders"`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// invoke calls a gRPC method on conn without generated client code.
func invoke(conn *grpc.ClientConn, method string, req, resp interface{}) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return conn.Invoke(ctx, method, req, resp)
}

// ── Auth handlers ─────────────────────────────────────────────────────────────

func handleRegister(conn *grpc.ClientConn) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req RegisterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		var resp RegisterResponse
		if err := invoke(conn, "/auth.AuthService/Register", &req, &resp); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, resp)
	}
}

func handleLogin(conn *grpc.ClientConn) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		var resp LoginResponse
		if err := invoke(conn, "/auth.AuthService/Login", &req, &resp); err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// ── Product handlers ──────────────────────────────────────────────────────────

func handleListProducts(conn *grpc.ClientConn) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var resp ListProductsResponse
		if err := invoke(conn, "/product.ProductService/ListProducts", &ListProductsRequest{}, &resp); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

func handleGetProduct(conn *grpc.ClientConn) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var resp Product
		if err := invoke(conn, "/product.ProductService/GetProduct", map[string]string{"id": id}, &resp); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

func handleCreateProduct(conn *grpc.ClientConn) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateProductRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		var resp Product
		if err := invoke(conn, "/product.ProductService/CreateProduct", &req, &resp); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, resp)
	}
}

// ── Order handlers ────────────────────────────────────────────────────────────

func handleCreateOrder(conn *grpc.ClientConn) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateOrderRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
		var resp Order
		if err := invoke(conn, "/order.OrderService/CreateOrder", &req, &resp); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, resp)
	}
}

func handleGetOrder(conn *grpc.ClientConn) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		var resp Order
		if err := invoke(conn, "/order.OrderService/GetOrder", map[string]string{"id": id}, &resp); err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

func handleListOrders(conn *grpc.ClientConn) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.PathValue("user_id")
		var resp ListOrdersResponse
		if err := invoke(conn, "/order.OrderService/ListOrders", map[string]string{"user_id": userID}, &resp); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// ── Main ─────────────────────────────────────────────────────────────────────

func main() {
	newConn := func(addr string) *grpc.ClientConn {
		conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			log.Fatalf("dial %s: %v", addr, err)
		}
		return conn
	}

	authConn    := newConn("localhost:50051")
	productConn := newConn("localhost:50052")
	orderConn   := newConn("localhost:50053")
	defer authConn.Close()
	defer productConn.Close()
	defer orderConn.Close()

	mux := http.NewServeMux()

	// Auth
	mux.HandleFunc("POST /auth/register", handleRegister(authConn))
	mux.HandleFunc("POST /auth/login",    handleLogin(authConn))

	// Products
	mux.HandleFunc("GET  /products",        handleListProducts(productConn))
	mux.HandleFunc("GET  /products/{id}",   handleGetProduct(productConn))
	mux.HandleFunc("POST /products",        handleCreateProduct(productConn))

	// Orders
	mux.HandleFunc("POST /orders",                    handleCreateOrder(orderConn))
	mux.HandleFunc("GET  /orders/{id}",               handleGetOrder(orderConn))
	mux.HandleFunc("GET  /users/{user_id}/orders",    handleListOrders(orderConn))

	log.Println("API Gateway  ->  http://localhost:8080")
	log.Println("  POST /auth/register")
	log.Println("  POST /auth/login")
	log.Println("  GET  /products")
	log.Println("  GET  /products/{id}")
	log.Println("  POST /products")
	log.Println("  POST /orders")
	log.Println("  GET  /orders/{id}")
	log.Println("  GET  /users/{user_id}/orders")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
'@ | Set-Content "$base\gateway\main.go" -Encoding UTF8

# ─────────────────────────────────────────────────────────────────────────────
Write-Host "==> Initializing Go modules..."

$services = @("auth-service", "product-service", "order-service", "gateway")

foreach ($svc in $services) {
    $dir = "$base\$svc"
    Write-Host "  go mod init $svc"
    Set-Location $dir
    go mod init $svc
    if ($LASTEXITCODE -ne 0) { Write-Warning "go mod init failed for $svc" }
}

Write-Host "==> Downloading google.golang.org/grpc..."
foreach ($svc in $services) {
    $dir = "$base\$svc"
    Set-Location $dir
    Write-Host "  go get $svc"
    go get google.golang.org/grpc@latest
    go mod tidy
}

Write-Host "==> Creating go.work..."
Set-Location $base

@'
go 1.22

use (
    ./auth-service
    ./product-service
    ./order-service
    ./gateway
)
'@ | Set-Content "$base\go.work" -Encoding UTF8

Write-Host "==> Verifying build..."
Set-Location "$base\auth-service";    go build . ; Write-Host "auth-service: OK"
Set-Location "$base\product-service"; go build . ; Write-Host "product-service: OK"
Set-Location "$base\order-service";   go build . ; Write-Host "order-service: OK"
Set-Location "$base\gateway";         go build . ; Write-Host "gateway: OK"

Write-Host ""
Write-Host "All done! Start services with:"
Write-Host "  cd grpc-gateway/auth-service    ; go run ."
Write-Host "  cd grpc-gateway/product-service ; go run ."
Write-Host "  cd grpc-gateway/order-service   ; go run ."
Write-Host "  cd grpc-gateway/gateway         ; go run ."
