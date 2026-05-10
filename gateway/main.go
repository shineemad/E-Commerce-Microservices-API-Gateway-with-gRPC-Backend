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

// ── CORS middleware ───────────────────────────────────────────────────────────

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
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
	mux.HandleFunc("POST /auth/register",         handleRegister(ac))
	mux.HandleFunc("POST /auth/login",             handleLogin(ac))
	mux.HandleFunc("GET /products",                handleListProducts(pc))
	mux.HandleFunc("GET /products/{id}",           handleGetProduct(pc))
	mux.HandleFunc("POST /products",               handleCreateProduct(pc))
	mux.HandleFunc("POST /orders",                 handleCreateOrder(oc))
	mux.HandleFunc("GET /orders/{id}",             handleGetOrder(oc))
	mux.HandleFunc("GET /users/{user_id}/orders",  handleListOrders(oc))

	// Serve frontend static files from ../frontend/
	frontendDir := "../frontend"
	mux.Handle("GET /", http.FileServer(http.Dir(frontendDir)))

	log.Println("API Gateway -> http://localhost:8080")
	log.Println("  Frontend  -> http://localhost:8080  (open in browser)")
	log.Println("  POST /auth/register | POST /auth/login")
	log.Println("  GET|POST /products  | GET /products/{id}")
	log.Println("  POST /orders        | GET /orders/{id}")
	log.Println("  GET /users/{user_id}/orders")
	log.Fatal(http.ListenAndServe(":8080", corsMiddleware(mux)))
}
