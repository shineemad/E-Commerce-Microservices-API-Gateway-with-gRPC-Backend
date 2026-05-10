package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"sync"

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

func (s *orderServer) UpdateOrderStatus(_ context.Context, req *pb.UpdateOrderStatusRequest) (*pb.Order, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	o, ok := s.orders[req.Id]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "order %q not found", req.Id)
	}
	o.Status = req.Status
	return o, nil
}

func main() {
	lis, err := net.Listen("tcp", ":50053")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	s := grpc.NewServer()
	pb.RegisterOrderServiceServer(s, newOrderServer())
	reflection.Register(s)
	log.Println("Order Service  ->  :50053")
	log.Fatal(s.Serve(lis))
}
