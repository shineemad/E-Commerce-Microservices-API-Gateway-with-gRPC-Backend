package main

// Single entrypoint — menjalankan auth-service, product-service, order-service, dan gateway
// sekaligus dalam satu proses.
//
// Cara menjalankan:
//   cd runner && go run main.go
// atau dari root project:
//   go run ./runner

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/reflection"
	grpcstatus "google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	authpb "example.com/grpcpb/auth"
	orderpb "example.com/grpcpb/order"
	productpb "example.com/grpcpb/product"
)

// ══════════════════════════════════════════════════════════════════════════════
// Shared — logging interceptor untuk semua gRPC server
// ══════════════════════════════════════════════════════════════════════════════

func loggingInterceptor(
	ctx context.Context,
	req interface{},
	info *grpc.UnaryServerInfo,
	handler grpc.UnaryHandler,
) (interface{}, error) {
	start := time.Now()
	resp, err := handler(ctx, req)
	st := "OK"
	if err != nil {
		st = "ERROR"
	}
	log.Printf("[grpc] method=%s duration=%v status=%s", info.FullMethod, time.Since(start), st)
	return resp, err
}

// ══════════════════════════════════════════════════════════════════════════════
// Auth Service — port :50051
// ══════════════════════════════════════════════════════════════════════════════

type authServer struct {
	authpb.UnimplementedAuthServiceServer
	mu     sync.RWMutex
	users  map[string]string // username -> password
	tokens map[string]string // token    -> username
}

func newAuthServer() *authServer {
	s := &authServer{
		users:  make(map[string]string),
		tokens: make(map[string]string),
	}
	// Pre-seed demo accounts
	s.users["pembeli"] = "pembeli123"
	s.users["penjual"] = "penjual123"
	s.tokens["tok-pembeli"] = "pembeli"
	s.tokens["tok-penjual"] = "penjual"
	return s
}

func (s *authServer) Register(_ context.Context, req *authpb.RegisterRequest) (*authpb.RegisterResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.users[req.Username]; ok {
		return nil, grpcstatus.Errorf(codes.AlreadyExists, "username %q already registered", req.Username)
	}
	s.users[req.Username] = req.Password
	uid := fmt.Sprintf("user-%d", len(s.users))
	tok := fmt.Sprintf("tok-%s-%s", req.Username, uid)
	s.tokens[tok] = req.Username
	log.Printf("[auth] register user=%s id=%s", req.Username, uid)
	return &authpb.RegisterResponse{UserId: uid, Token: tok}, nil
}

func (s *authServer) Login(_ context.Context, req *authpb.LoginRequest) (*authpb.LoginResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if pass, ok := s.users[req.Username]; !ok || pass != req.Password {
		return nil, grpcstatus.Error(codes.Unauthenticated, "invalid credentials")
	}
	tok := "tok-" + req.Username
	s.tokens[tok] = req.Username
	log.Printf("[auth] login user=%s", req.Username)
	return &authpb.LoginResponse{Token: tok, UserId: "user-" + req.Username}, nil
}

func (s *authServer) ValidateToken(_ context.Context, req *authpb.ValidateTokenRequest) (*authpb.ValidateTokenResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	uname, ok := s.tokens[req.Token]
	if !ok {
		return &authpb.ValidateTokenResponse{Valid: false}, nil
	}
	return &authpb.ValidateTokenResponse{Valid: true, UserId: "user-" + uname}, nil
}

func startAuthService() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("[auth] listen: %v", err)
	}
	s := grpc.NewServer(grpc.UnaryInterceptor(loggingInterceptor))
	authpb.RegisterAuthServiceServer(s, newAuthServer())
	reflection.Register(s)
	log.Println("[auth] Auth Service  ->  :50051")
	if err := s.Serve(lis); err != nil {
		log.Fatalf("[auth] serve: %v", err)
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// Product Service — port :50052
// ══════════════════════════════════════════════════════════════════════════════

type productServer struct {
	productpb.UnimplementedProductServiceServer
	mu      sync.RWMutex
	items   map[string]*productpb.Product
	counter int
}

func newProductServer() *productServer {
	s := &productServer{items: make(map[string]*productpb.Product), counter: 2}
	s.items["prod-1"] = &productpb.Product{Id: "prod-1", Name: "Laptop", Price: 999.99, Description: "High-performance laptop"}
	s.items["prod-2"] = &productpb.Product{Id: "prod-2", Name: "Mouse", Price: 29.99, Description: "Wireless mouse"}
	return s
}

func (s *productServer) GetProduct(_ context.Context, req *productpb.GetProductRequest) (*productpb.Product, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.items[req.Id]
	if !ok {
		return nil, grpcstatus.Errorf(codes.NotFound, "product %q not found", req.Id)
	}
	return p, nil
}

func (s *productServer) ListProducts(_ context.Context, _ *productpb.ListProductsRequest) (*productpb.ListProductsResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*productpb.Product, 0, len(s.items))
	for _, p := range s.items {
		list = append(list, p)
	}
	return &productpb.ListProductsResponse{Products: list}, nil
}

func (s *productServer) CreateProduct(_ context.Context, req *productpb.CreateProductRequest) (*productpb.Product, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.counter++
	id := fmt.Sprintf("prod-%d", s.counter)
	p := &productpb.Product{Id: id, Name: req.Name, Price: req.Price, Description: req.Description}
	s.items[id] = p
	log.Printf("[product] created id=%s name=%s price=%.2f", id, req.Name, req.Price)
	return p, nil
}

func (s *productServer) UpdateProduct(_ context.Context, req *productpb.UpdateProductRequest) (*productpb.Product, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.items[req.Id]
	if !ok {
		return nil, grpcstatus.Errorf(codes.NotFound, "product %q not found", req.Id)
	}
	if req.Name != "" {
		p.Name = req.Name
	}
	if req.Price != 0 {
		p.Price = req.Price
	}
	if req.Description != "" {
		p.Description = req.Description
	}
	return p, nil
}

func (s *productServer) DeleteProduct(_ context.Context, req *productpb.DeleteProductRequest) (*productpb.DeleteProductResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[req.Id]; !ok {
		return nil, grpcstatus.Errorf(codes.NotFound, "product %q not found", req.Id)
	}
	delete(s.items, req.Id)
	return &productpb.DeleteProductResponse{Success: true}, nil
}

func (s *productServer) StreamProducts(_ *productpb.ListProductsRequest, stream productpb.ProductService_StreamProductsServer) error {
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

func startProductService() {
	lis, err := net.Listen("tcp", ":50052")
	if err != nil {
		log.Fatalf("[product] listen: %v", err)
	}
	s := grpc.NewServer(grpc.UnaryInterceptor(loggingInterceptor))
	productpb.RegisterProductServiceServer(s, newProductServer())
	reflection.Register(s)
	log.Println("[product] Product Service  ->  :50052")
	if err := s.Serve(lis); err != nil {
		log.Fatalf("[product] serve: %v", err)
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// Order Service — port :50053
// ══════════════════════════════════════════════════════════════════════════════

type orderServer struct {
	orderpb.UnimplementedOrderServiceServer
	mu      sync.RWMutex
	orders  map[string]*orderpb.Order
	counter int
}

func newOrderServer() *orderServer {
	return &orderServer{orders: make(map[string]*orderpb.Order)}
}

func (s *orderServer) CreateOrder(_ context.Context, req *orderpb.CreateOrderRequest) (*orderpb.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.counter++
	id := fmt.Sprintf("order-%d", s.counter)
	o := &orderpb.Order{
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

func (s *orderServer) GetOrder(_ context.Context, req *orderpb.GetOrderRequest) (*orderpb.Order, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	o, ok := s.orders[req.Id]
	if !ok {
		return nil, grpcstatus.Errorf(codes.NotFound, "order %q not found", req.Id)
	}
	return o, nil
}

func (s *orderServer) ListOrders(_ context.Context, req *orderpb.ListOrdersRequest) (*orderpb.ListOrdersResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var list []*orderpb.Order
	for _, o := range s.orders {
		if req.UserId == "" || o.UserId == req.UserId {
			list = append(list, o)
		}
	}
	return &orderpb.ListOrdersResponse{Orders: list}, nil
}

func (s *orderServer) UpdateOrderStatus(_ context.Context, req *orderpb.UpdateOrderStatusRequest) (*orderpb.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.orders[req.Id]
	if !ok {
		return nil, grpcstatus.Errorf(codes.NotFound, "order %q not found", req.Id)
	}
	o.Status = req.Status
	return o, nil
}

func startOrderService() {
	lis, err := net.Listen("tcp", ":50053")
	if err != nil {
		log.Fatalf("[order] listen: %v", err)
	}
	s := grpc.NewServer(grpc.UnaryInterceptor(loggingInterceptor))
	orderpb.RegisterOrderServiceServer(s, newOrderServer())
	reflection.Register(s)
	log.Println("[order] Order Service  ->  :50053")
	if err := s.Serve(lis); err != nil {
		log.Fatalf("[order] serve: %v", err)
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// Gateway — port :8080
// ══════════════════════════════════════════════════════════════════════════════

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

func authMiddleware(ac authpb.AuthServiceClient, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authorization := r.Header.Get("Authorization")
		if authorization == "" {
			writeError(w, http.StatusUnauthorized, "missing token")
			return
		}
		token := strings.TrimPrefix(authorization, "Bearer ")
		if token == authorization || token == "" {
			writeError(w, http.StatusUnauthorized, "invalid token")
			return
		}
		ctx, cancel := newCtx()
		defer cancel()
		resp, err := ac.ValidateToken(ctx, &authpb.ValidateTokenRequest{Token: token})
		if err != nil || !resp.Valid {
			writeError(w, http.StatusUnauthorized, "invalid token")
			return
		}
		next(w, r)
	}
}

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

func handleUpdateProduct(c productpb.ProductServiceClient) http.HandlerFunc {
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
		resp, err := c.UpdateProduct(ctx, &productpb.UpdateProductRequest{Id: r.PathValue("id"), Name: b.Name, Price: b.Price, Description: b.Description})
		if err != nil { writeError(w, http.StatusNotFound, err.Error()); return }
		writeProto(w, http.StatusOK, resp)
	}
}

func handleDeleteProduct(c productpb.ProductServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := newCtx(); defer cancel()
		resp, err := c.DeleteProduct(ctx, &productpb.DeleteProductRequest{Id: r.PathValue("id")})
		if err != nil { writeError(w, http.StatusNotFound, err.Error()); return }
		writeProto(w, http.StatusOK, resp)
	}
}

func handleStreamProducts(c productpb.ProductServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		stream, err := c.StreamProducts(ctx, &productpb.ListProductsRequest{})
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		results := make([]json.RawMessage, 0)
		for {
			item, recvErr := stream.Recv()
			if recvErr == io.EOF {
				break
			}
			if recvErr != nil {
				writeError(w, http.StatusInternalServerError, recvErr.Error())
				return
			}
			b, marshalErr := pj.Marshal(item)
			if marshalErr != nil {
				writeError(w, http.StatusInternalServerError, marshalErr.Error())
				return
			}
			results = append(results, b)
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(results); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
	}
}

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

func handleUpdateOrderStatus(c orderpb.OrderServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var b struct {
			Status string `json:"status"`
		}
		if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON"); return
		}
		ctx, cancel := newCtx(); defer cancel()
		resp, err := c.UpdateOrderStatus(ctx, &orderpb.UpdateOrderStatusRequest{Id: r.PathValue("id"), Status: b.Status})
		if err != nil { writeError(w, http.StatusNotFound, err.Error()); return }
		writeProto(w, http.StatusOK, resp)
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

// handleListAllOrders — mengembalikan semua pesanan (tanpa filter user), dipakai seller
func handleListAllOrders(c orderpb.OrderServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := newCtx(); defer cancel()
		resp, err := c.ListOrders(ctx, &orderpb.ListOrdersRequest{UserId: ""})
		if err != nil { writeError(w, http.StatusInternalServerError, err.Error()); return }
		writeProto(w, http.StatusOK, resp)
	}
}

func handleHealth(ac authpb.AuthServiceClient, pc productpb.ProductServiceClient, oc orderpb.OrderServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		isAlive := func(err error) string {
			if err == nil {
				return "ok"
			}
			if grpcstatus.Code(err) == codes.Unavailable {
				return "unreachable"
			}
			return "ok"
		}
		checkCtx := func() (context.Context, context.CancelFunc) {
			return context.WithTimeout(context.Background(), 3*time.Second)
		}
		ctx, cancel := checkCtx()
		_, authErr := ac.ValidateToken(ctx, &authpb.ValidateTokenRequest{Token: ""})
		cancel()
		ctx, cancel = checkCtx()
		_, productErr := pc.ListProducts(ctx, &productpb.ListProductsRequest{})
		cancel()
		ctx, cancel = checkCtx()
		_, orderErr := oc.ListOrders(ctx, &orderpb.ListOrdersRequest{UserId: ""})
		cancel()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"auth":    isAlive(authErr),
			"product": isAlive(productErr),
			"order":   isAlive(orderErr),
		})
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func startGateway() {
	// Tunggu sebentar agar service gRPC siap menerima koneksi
	time.Sleep(500 * time.Millisecond)

	dial := func(addr string) *grpc.ClientConn {
		c, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
		if err != nil {
			log.Fatalf("[gateway] dial %s: %v", addr, err)
		}
		return c
	}

	ac := authpb.NewAuthServiceClient(dial("localhost:50051"))
	pc := productpb.NewProductServiceClient(dial("localhost:50052"))
	oc := orderpb.NewOrderServiceClient(dial("localhost:50053"))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health",                   handleHealth(ac, pc, oc))
	mux.HandleFunc("POST /auth/register",           handleRegister(ac))
	mux.HandleFunc("POST /auth/login",              handleLogin(ac))
	mux.HandleFunc("GET /products",                 authMiddleware(ac, handleListProducts(pc)))
	mux.HandleFunc("GET /products/stream",          authMiddleware(ac, handleStreamProducts(pc)))
	mux.HandleFunc("GET /products/{id}",            authMiddleware(ac, handleGetProduct(pc)))
	mux.HandleFunc("POST /products",                authMiddleware(ac, handleCreateProduct(pc)))
	mux.HandleFunc("PUT /products/{id}",            authMiddleware(ac, handleUpdateProduct(pc)))
	mux.HandleFunc("DELETE /products/{id}",         authMiddleware(ac, handleDeleteProduct(pc)))
	mux.HandleFunc("POST /orders",                  authMiddleware(ac, handleCreateOrder(oc)))
	mux.HandleFunc("GET /orders/{id}",              authMiddleware(ac, handleGetOrder(oc)))
	mux.HandleFunc("PATCH /orders/{id}/status",     authMiddleware(ac, handleUpdateOrderStatus(oc)))
	mux.HandleFunc("GET /orders",                   authMiddleware(ac, handleListAllOrders(oc)))
	mux.HandleFunc("GET /users/{user_id}/orders",   authMiddleware(ac, handleListOrders(oc)))

	// Serve frontend — path relatif terhadap CWD saat `go run ./runner` dijalankan
	// dari project root (C:\...\grpc-gateway) -> ./frontend
	// Fallback ke ../frontend jika dijalankan dari dalam folder runner/
	frontendDir := "./frontend"
	if _, err := os.Stat(frontendDir); err != nil {
		frontendDir = "../frontend"
	}
	if _, err := os.Stat(frontendDir); err == nil {
		// Wrap FileServer agar SPA (Single Page App) selalu kembali ke index.html
		fs := http.FileServer(http.Dir(frontendDir))
		mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Jika file fisik tidak ada, sajikan index.html
			path := frontendDir + r.URL.Path
			if _, err := os.Stat(path); os.IsNotExist(err) {
				http.ServeFile(w, r, frontendDir+"/index.html")
				return
			}
			fs.ServeHTTP(w, r)
		}))
		log.Printf("[gateway] Frontend serving from: %s", frontendDir)
	} else {
		log.Printf("[gateway] Warning: frontend directory not found (tried ./frontend and ../frontend)")
	}

	log.Println("[gateway] API Gateway  ->  http://localhost:8080")

	// Tampilkan IP jaringan agar mudah diakses dari perangkat lain
	if ifaces, err := net.Interfaces(); err == nil {
		for _, iface := range ifaces {
			if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
				continue
			}
			if addrs, err := iface.Addrs(); err == nil {
				for _, addr := range addrs {
					if ipnet, ok := addr.(*net.IPNet); ok && ipnet.IP.To4() != nil {
						log.Printf("[gateway] Network access -> http://%s:8080", ipnet.IP)
					}
				}
			}
		}
	}

	if err := http.ListenAndServe(":8080", corsMiddleware(mux)); err != nil {
		log.Fatalf("[gateway] serve: %v", err)
	}
}

// ══════════════════════════════════════════════════════════════════════════════
// Main — jalankan semua service secara concurrent
// ══════════════════════════════════════════════════════════════════════════════

// checkPortsFree memeriksa apakah semua port yang dibutuhkan tersedia.
// Jika ada yang masih dipakai proses lain, cetak pesan bantuan dan exit.
func checkPortsFree(ports []int) {
	var busy []int
	for _, port := range ports {
		addr := fmt.Sprintf(":%d", port)
		l, err := net.Listen("tcp", addr)
		if err != nil {
			busy = append(busy, port)
		} else {
			l.Close()
		}
	}
	if len(busy) == 0 {
		return
	}
	log.Printf("ERROR: Port berikut masih dipakai proses lain: %v", busy)
	log.Println("──────────────────────────────────────────────────────")
	log.Println("Jalankan perintah berikut di PowerShell untuk menghentikannya:")
	log.Println("  Get-Process -Name go,runner -ErrorAction SilentlyContinue | Stop-Process -Force")
	log.Println("Kemudian jalankan ulang:")
	log.Println("  go run ./runner")
	log.Println("──────────────────────────────────────────────────────")
	os.Exit(1)
}

func main() {
	log.Println("╔══════════════════════════════════════════╗")
	log.Println("║  gRPC Gateway — All Services Starting   ║")
	log.Println("╚══════════════════════════════════════════╝")

	checkPortsFree([]int{50051, 50052, 50053, 8080})

	go startAuthService()
	go startProductService()
	go startOrderService()
	go startGateway()

	// Tunggu sinyal Ctrl+C atau SIGTERM untuk shutdown bersih
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down all services...")
}
