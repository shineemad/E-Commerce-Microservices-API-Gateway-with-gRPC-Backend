package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"sync"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/reflection"
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
	s := &orderServer{orders: make(map[string]*pb.Order)}

	seeds := []*pb.Order{
		{
			Id:         "order-1",
			UserId:     "user-1",
			ProductId:  "prod-1",
			Quantity:   1,
			Status:     "delivered",
			TotalPrice: 18999999,
		},
		{
			Id:         "order-2",
			UserId:     "user-1",
			ProductId:  "prod-2",
			Quantity:   2,
			Status:     "delivered",
			TotalPrice: 1798000,
		},
		{
			Id:         "order-3",
			UserId:     "user-2",
			ProductId:  "prod-9",
			Quantity:   1,
			Status:     "shipped",
			TotalPrice: 13999000,
		},
		{
			Id:         "order-4",
			UserId:     "user-2",
			ProductId:  "prod-13",
			Quantity:   1,
			Status:     "processing",
			TotalPrice: 3499000,
		},
		{
			Id:         "order-5",
			UserId:     "user-3",
			ProductId:  "prod-4",
			Quantity:   1,
			Status:     "pending",
			TotalPrice: 4200000,
		},
		{
			Id:         "order-6",
			UserId:     "user-3",
			ProductId:  "prod-17",
			Quantity:   3,
			Status:     "pending",
			TotalPrice: 1350000,
		},
		{
			Id:         "order-7",
			UserId:     "user-1",
			ProductId:  "prod-15",
			Quantity:   1,
			Status:     "cancelled",
			TotalPrice: 4999000,
		},
	}

	for _, o := range seeds {
		s.orders[o.Id] = o
	}
	s.counter = len(seeds)

	log.Printf("[order] seeded %d orders", len(seeds))
	return s
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
	log.Printf("[order] created id=%s user=%s product=%s qty=%d total=%.2f",
		id, req.UserId, req.ProductId, req.Quantity, o.TotalPrice)
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

func (s *orderServer) UpdateOrderStatus(_ context.Context, req *pb.UpdateOrderStatusRequest) (*pb.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.orders[req.Id]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "order %q not found", req.Id)
	}

	// Validasi transisi status yang diizinkan
	allowed := map[string][]string{
		"pending":    {"processing", "cancelled"},
		"processing": {"shipped", "cancelled"},
		"shipped":    {"delivered"},
		"delivered":  {},
		"cancelled":  {},
	}
	validNext, exists := allowed[o.Status]
	if !exists {
		return nil, status.Errorf(codes.InvalidArgument, "unknown current status %q", o.Status)
	}
	ok = false
	for _, next := range validNext {
		if next == req.Status {
			ok = true
			break
		}
	}
	if !ok {
		return nil, status.Errorf(codes.FailedPrecondition,
			"cannot transition order from %q to %q", o.Status, req.Status)
	}

	o.Status = req.Status
	log.Printf("[order] status updated id=%s status=%s", o.Id, o.Status)
	return o, nil
}

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

func main() {
	lis, err := net.Listen("tcp", ":50053")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	s := grpc.NewServer(grpc.UnaryInterceptor(loggingInterceptor))
	pb.RegisterOrderServiceServer(s, newOrderServer())
	reflection.Register(s)
	log.Println("Order Service  ->  :50053")
	log.Fatal(s.Serve(lis))
}