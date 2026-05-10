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
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("listen: %v", err)
	}
	s := grpc.NewServer(grpc.UnaryInterceptor(loggingInterceptor))
	pb.RegisterAuthServiceServer(s, newAuthServer())
	reflection.Register(s)
	log.Println("Auth Service  ->  :50051")
	log.Fatal(s.Serve(lis))
}
