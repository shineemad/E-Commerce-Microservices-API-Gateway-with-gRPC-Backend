package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	authpb "example.com/grpcpb/auth"
	orderpb "example.com/grpcpb/order"
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

func handleHealth(ac authpb.AuthServiceClient, pc productpb.ProductServiceClient, oc orderpb.OrderServiceClient) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		isAlive := func(err error) string {
			if err == nil {
				return "ok"
			}
			if status.Code(err) == codes.Unavailable {
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
			"auth":   isAlive(authErr),
			"product": isAlive(productErr),
			"order":  isAlive(orderErr),
		})
	}
}

// ── CORS middleware ───────────────────────────────────────────────────────────

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
	mux.HandleFunc("GET /health", handleHealth(ac, pc, oc))
	mux.HandleFunc("POST /auth/register",         handleRegister(ac))
	mux.HandleFunc("POST /auth/login",             handleLogin(ac))
	mux.HandleFunc("GET /products",                authMiddleware(ac, handleListProducts(pc)))
	mux.HandleFunc("GET /products/stream",         authMiddleware(ac, handleStreamProducts(pc)))
	mux.HandleFunc("GET /products/{id}",           authMiddleware(ac, handleGetProduct(pc)))
	mux.HandleFunc("POST /products",               authMiddleware(ac, handleCreateProduct(pc)))
	mux.HandleFunc("PUT /products/{id}",            authMiddleware(ac, handleUpdateProduct(pc)))
	mux.HandleFunc("DELETE /products/{id}",         authMiddleware(ac, handleDeleteProduct(pc)))
	mux.HandleFunc("POST /orders",                 authMiddleware(ac, handleCreateOrder(oc)))
	mux.HandleFunc("GET /orders/{id}",             authMiddleware(ac, handleGetOrder(oc)))
	mux.HandleFunc("PATCH /orders/{id}/status",    authMiddleware(ac, handleUpdateOrderStatus(oc)))
	mux.HandleFunc("GET /users/{user_id}/orders",  authMiddleware(ac, handleListOrders(oc)))

	// Serve frontend static files from ../frontend/
	frontendDir := "../frontend"
	if _, err := os.Stat(frontendDir); err == nil {
		mux.Handle("GET /", http.FileServer(http.Dir(frontendDir)))
		log.Printf("Frontend serving from: %s", frontendDir)
	} else {
		log.Printf("Warning: frontend directory not found at %s", frontendDir)
	}

	log.Println("API Gateway  ->  :8080")
	log.Fatal(http.ListenAndServe(":8080", corsMiddleware(mux)))
}
