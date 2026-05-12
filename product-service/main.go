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

	pb "example.com/grpcpb/product"
)

type productServer struct {
	pb.UnimplementedProductServiceServer
	mu      sync.RWMutex
	items   map[string]*pb.Product
	counter int
}

func newProductServer() *productServer {
	s := &productServer{items: make(map[string]*pb.Product), counter: 0}

	seeds := []*pb.Product{
		// Electronics
		{Id: "prod-1", Name: "Laptop Gaming ASUS ROG", Price: 18999999, Description: "Laptop gaming high-end dengan RTX 4060, RAM 16GB, SSD 512GB"},
		{Id: "prod-2", Name: "Mouse Wireless Logitech MX Master 3", Price: 899000, Description: "Mouse wireless ergonomis dengan scrolling cepat dan presisi tinggi"},
		{Id: "prod-3", Name: "Keyboard Mechanical Keychron K2", Price: 1250000, Description: "Keyboard mechanical 75% layout dengan hot-swap switch"},
		{Id: "prod-4", Name: "Monitor IPS 27 inch LG", Price: 4200000, Description: "Monitor IPS 27 inch Full HD 144Hz, cocok untuk gaming dan desain"},
		{Id: "prod-5", Name: "Headset Gaming Razer BlackShark V2", Price: 1350000, Description: "Headset gaming dengan THX Spatial Audio dan mic cardioid"},
		{Id: "prod-6", Name: "SSD External Samsung T7 1TB", Price: 1750000, Description: "SSD eksternal NVMe 1TB, kecepatan baca 1050 MB/s"},
		{Id: "prod-7", Name: "Webcam Logitech C920 HD Pro", Price: 1100000, Description: "Webcam Full HD 1080p dengan autofocus dan stereo mic"},
		{Id: "prod-8", Name: "USB Hub 7-Port Anker", Price: 320000, Description: "USB hub 7 port dengan charging port dan transfer data cepat"},

		// Smartphone & Tablet
		{Id: "prod-9", Name: "Samsung Galaxy S24 256GB", Price: 13999000, Description: "Smartphone flagship Samsung dengan Exynos 2400 dan kamera 200MP"},
		{Id: "prod-10", Name: "iPhone 15 Pro 128GB", Price: 17499000, Description: "iPhone 15 Pro dengan chip A17 Pro dan kamera ProRAW"},
		{Id: "prod-11", Name: "Xiaomi Redmi Note 13 Pro", Price: 3899000, Description: "Smartphone mid-range dengan kamera 200MP dan baterai 5100mAh"},
		{Id: "prod-12", Name: "iPad Air M2 256GB WiFi", Price: 12999000, Description: "Tablet iPad dengan chip M2, layar Liquid Retina 11 inch"},

		// Audio
		{Id: "prod-13", Name: "TWS Sony WF-1000XM5", Price: 3499000, Description: "True wireless earbuds dengan ANC terbaik dan suara Hi-Res Audio"},
		{Id: "prod-14", Name: "Speaker Bluetooth JBL Charge 5", Price: 1999000, Description: "Speaker portable waterproof IP67 dengan bass yang powerful"},
		{Id: "prod-15", Name: "Headphone Sony WH-1000XM5", Price: 4999000, Description: "Headphone over-ear ANC premium dengan 30 jam battery life"},

		// Aksesoris
		{Id: "prod-16", Name: "Tas Laptop Thule 15 inch", Price: 850000, Description: "Tas laptop premium anti-air dengan kompartemen terorganisir"},
		{Id: "prod-17", Name: "Charger GaN 65W Anker Nano", Price: 450000, Description: "Charger GaN compact 65W dengan port USB-C dan USB-A"},
		{Id: "prod-18", Name: "Mouse Pad XL Desk Mat", Price: 175000, Description: "Mouse pad XL 90x40cm dengan permukaan smooth dan anti-slip"},
		{Id: "prod-19", Name: "Stand Laptop Aluminium Adjustable", Price: 280000, Description: "Stand laptop adjustable 6 level ketinggian, kompatibel semua ukuran"},
		{Id: "prod-20", Name: "Cable Management Velcro 10pcs", Price: 45000, Description: "Velcro cable tie untuk merapikan kabel meja kerja"},
	}

	for _, p := range seeds {
		s.items[p.Id] = p
	}
	s.counter = len(seeds)

	log.Printf("[product] seeded %d products", len(seeds))
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

func (s *productServer) UpdateProduct(_ context.Context, req *pb.UpdateProductRequest) (*pb.Product, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.items[req.Id]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "product %q not found", req.Id)
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

func (s *productServer) DeleteProduct(_ context.Context, req *pb.DeleteProductRequest) (*pb.DeleteProductResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[req.Id]; !ok {
		return nil, status.Errorf(codes.NotFound, "product %q not found", req.Id)
	}
	delete(s.items, req.Id)
	return &pb.DeleteProductResponse{Success: true}, nil
}

func (s *productServer) StreamProducts(_ *pb.ListProductsRequest, stream pb.ProductService_StreamProductsServer) error {
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
	lis, err := net.Listen("tcp", ":50052")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	s := grpc.NewServer(grpc.UnaryInterceptor(loggingInterceptor))
	pb.RegisterProductServiceServer(s, newProductServer())
	reflection.Register(s)
	log.Println("Product Service  ->  :50052")
	log.Fatal(s.Serve(lis))
}