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
