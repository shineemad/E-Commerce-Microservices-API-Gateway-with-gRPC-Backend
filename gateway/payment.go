package main

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

// PaymentMethod enumerates supported payment channels.
type PaymentMethod string

const (
	MethodQRIS      PaymentMethod = "qris"
	MethodShopeePay PaymentMethod = "shopeepay"
	MethodGoPay     PaymentMethod = "gopay"
	MethodOVO       PaymentMethod = "ovo"
	MethodDANA      PaymentMethod = "dana"
	MethodBCA       PaymentMethod = "bca"
	MethodMandiri   PaymentMethod = "mandiri"
	MethodBNI       PaymentMethod = "bni"
	MethodTopUp     PaymentMethod = "topup"
)

// CartItemPayload represents one product line item in a payment session.
type CartItemPayload struct {
	ProductID string  `json:"product_id"`
	Quantity  int32   `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
	Name      string  `json:"name,omitempty"`
}

// PaymentSession holds the state of a single payment transaction.
type PaymentSession struct {
	ID        string            `json:"id"`
	Method    PaymentMethod     `json:"method"`
	Amount    float64           `json:"amount"`
	Status    string            `json:"status"` // pending | success | failed | expired
	CartItems []CartItemPayload `json:"cart_items"`
	QRCode    string            `json:"qr_code,omitempty"`
	VANumber  string            `json:"va_number,omitempty"`
	PhoneHint string            `json:"phone_hint,omitempty"`
	BankName  string            `json:"bank_name,omitempty"`
	UserID    string            `json:"user_id"`
	CreatedAt time.Time         `json:"created_at"`
	ExpiresAt time.Time         `json:"expires_at"`
	OrderIDs  []string          `json:"order_ids,omitempty"`
}

// PaymentStore is an in-memory registry of active payment sessions.
type PaymentStore struct {
	mu   sync.RWMutex
	data map[string]*PaymentSession
}

func newPaymentStore() *PaymentStore {
	return &PaymentStore{data: make(map[string]*PaymentSession)}
}

// Initiate creates a new payment session for the given cart items.
func (ps *PaymentStore) Initiate(userID string, method PaymentMethod, amount float64, items []CartItemPayload) *PaymentSession {
	ps.mu.Lock()
	defer ps.mu.Unlock()

	id := fmt.Sprintf("pay-%d-%04d", time.Now().UnixMilli(), rand.Intn(9999))
	sess := &PaymentSession{
		ID:        id,
		Method:    method,
		Amount:    amount,
		Status:    "pending",
		CartItems: items,
		UserID:    userID,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}

	switch method {
	case MethodQRIS:
		// Generate a real-looking QRIS string and use QR server to render it.
		qrData := fmt.Sprintf("00020101021226570013ID.CO.SHOPGO.WWW011893600914%010d0303UMB52000005303360540%s5802ID5910ShopGo Pay6013Jakarta Pusat6105101106304ABCD",
			rand.Int63n(9999999999), fmt.Sprintf("%.0f", amount))
		sess.QRCode = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + qrURLEncode(qrData)
	case MethodShopeePay:
		sess.PhoneHint = "+62 81x-xxxx-xxxx"
	case MethodGoPay:
		sess.PhoneHint = "+62 82x-xxxx-xxxx"
	case MethodOVO:
		sess.PhoneHint = "+62 85x-xxxx-xxxx"
	case MethodDANA:
		sess.PhoneHint = "+62 87x-xxxx-xxxx"
	case MethodBCA:
		sess.VANumber = fmt.Sprintf("8277%010d", rand.Int63n(9999999999))
		sess.BankName = "BCA Virtual Account"
	case MethodMandiri:
		sess.VANumber = fmt.Sprintf("891%013d", rand.Int63n(9999999999999))
		sess.BankName = "Mandiri Virtual Account"
	case MethodBNI:
		sess.VANumber = fmt.Sprintf("988%011d", rand.Int63n(99999999999))
		sess.BankName = "BNI Virtual Account"
	case MethodTopUp:
		// Nothing extra needed for wallet top-up
	}

	ps.data[id] = sess
	return sess
}

// Get returns a copy of the session or nil if not found.
func (ps *PaymentStore) Get(id string) *PaymentSession {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	if s, ok := ps.data[id]; ok {
		c := *s
		return &c
	}
	return nil
}

// Confirm transitions a pending session to success and records the placed order IDs.
// Returns the updated session and true on success.
func (ps *PaymentStore) Confirm(id string, orderIDs []string) (*PaymentSession, bool) {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	s, ok := ps.data[id]
	if !ok {
		return nil, false
	}
	if s.Status != "pending" {
		c := *s
		return &c, false
	}
	if time.Now().After(s.ExpiresAt) {
		s.Status = "expired"
		c := *s
		return &c, false
	}
	s.Status = "success"
	s.OrderIDs = orderIDs
	c := *s
	return &c, true
}

// qrURLEncode percent-encodes a string for use in a URL query parameter.
func qrURLEncode(s string) string {
	encoded := ""
	for _, c := range s {
		switch {
		case (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'):
			encoded += string(c)
		case c == '-' || c == '_' || c == '.' || c == '~':
			encoded += string(c)
		default:
			encoded += fmt.Sprintf("%%%02X", c)
		}
	}
	return encoded
}
