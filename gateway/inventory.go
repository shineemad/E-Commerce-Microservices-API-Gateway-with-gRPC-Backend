package main

import (
	"encoding/json"
	"log"
	"os"
	"strings"
	"sync"
)

// keywordImageMap maps lowercase name keywords to a curated Unsplash image URL.
// Ordered most-specific → most-generic so the first match wins.
var keywordImageMap = []struct {
	keyword string
	url     string
}{
	// Laptops (specific first)
	{"macbook air",  "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"macbook pro",  "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"macbook",      "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"zephyrus",     "https://images.unsplash.com/photo-1541807084-5c52e6e76cf3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"rog",          "https://images.unsplash.com/photo-1541807084-5c52e6e76cf3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"raider",       "https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"predator",     "https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"laptop",       "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"notebook",     "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	// Monitors
	{"ultragear",    "https://images.unsplash.com/photo-1547119957-637f8679db1e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"ultrasharp",   "https://images.unsplash.com/photo-1547119957-637f8679db1e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"monitor",      "https://images.unsplash.com/photo-1547119957-637f8679db1e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"display",      "https://images.unsplash.com/photo-1547119957-637f8679db1e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	// Phones (specific first)
	{"galaxy s",     "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"galaxy a",     "https://images.unsplash.com/photo-1580910051209-67fb48958b8a?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"samsung galaxy","https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"iphone",       "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"xiaomi",       "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"redmi",        "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"poco",         "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"oppo",         "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"realme",       "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"vivo",         "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"pixel",        "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"smartphone",   "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"phone",        "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	// Audio
	{"airpods",      "https://images.unsplash.com/photo-1590658268037-41402bb9e4d2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"galaxy buds",  "https://images.unsplash.com/photo-1590658268037-41402bb9e4d2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"earbuds",      "https://images.unsplash.com/photo-1590658268037-41402bb9e4d2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"tws",          "https://images.unsplash.com/photo-1590658268037-41402bb9e4d2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"wh-1000",      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"headphone",    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"headset",      "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"speaker",      "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"soundbar",     "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	// Peripherals
	{"deathadder",   "https://images.unsplash.com/photo-1615750185825-7b70a9aadb1d?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"razer",        "https://images.unsplash.com/photo-1615750185825-7b70a9aadb1d?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"mx master",    "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"logitech",     "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"mouse",        "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"keychron",     "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"keyboard",     "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"mechanical",   "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	// Storage
	{"ssd",          "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"nvme",         "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"flash",        "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"hard disk",    "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"storage",      "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	// Wearables
	{"apple watch",  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"galaxy watch", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"smartwatch",   "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"watch",        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	// Other
	{"webcam",       "https://images.unsplash.com/photo-1616763355548-1b606f439f86?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"camera",       "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"router",       "https://images.unsplash.com/photo-1606904825846-647eb07f5be2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"wifi",         "https://images.unsplash.com/photo-1606904825846-647eb07f5be2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"charger",      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"kabel",        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"cable",        "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"printer",      "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"tas",          "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"case",         "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"ram",          "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"gpu",          "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
	{"rtx",          "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"},
}

// fallbackImageURLs is used when no keyword matches — cycling by product ID hash.
var fallbackImageURLs = []string{
	"https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
	"https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
	"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
	"https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
	"https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
	"https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
	"https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
	"https://images.unsplash.com/photo-1541807084-5c52e6e76cf3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
	"https://images.unsplash.com/photo-1590658268037-41402bb9e4d2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
	"https://images.unsplash.com/photo-1547119957-637f8679db1e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
}

// GuessImageURL returns an image URL for a product based on its name, falling back to a hash-based pick.
func GuessImageURL(id, name string) string {
	lower := strings.ToLower(name)
	for _, kw := range keywordImageMap {
		if strings.Contains(lower, kw.keyword) {
			return kw.url
		}
	}
	// Deterministic fallback based on id+name hash
	h := 0
	for _, c := range id + name {
		h = h*31 + int(c)
	}
	if h < 0 {
		h = -h
	}
	return fallbackImageURLs[h%len(fallbackImageURLs)]
}

// ProductMeta stores additional product metadata not held in the gRPC proto.
type ProductMeta struct {
	ImageURL   string `json:"image_url"`
	Stock      int32  `json:"stock"`
	TotalStock int32  `json:"total_stock"`
	Category   string `json:"category"`
	Badge      string `json:"badge,omitempty"`
	Rating     string `json:"rating,omitempty"`
	Reviews    string `json:"reviews,omitempty"`
	Sold       int32  `json:"sold"`
	Loc        string `json:"loc,omitempty"`
}

// MetaStore is a thread-safe, JSON-file-backed store for product metadata.
type MetaStore struct {
	mu   sync.RWMutex
	data map[string]*ProductMeta
	path string
}

func newMetaStore(path string) *MetaStore {
	ms := &MetaStore{
		data: make(map[string]*ProductMeta),
		path: path,
	}
	ms.load()
	ms.seed()
	return ms
}

func (ms *MetaStore) load() {
	b, err := os.ReadFile(ms.path)
	if err != nil {
		return
	}
	var data map[string]*ProductMeta
	if err := json.Unmarshal(b, &data); err != nil {
		log.Printf("[meta] load error: %v", err)
		return
	}
	ms.data = data
	log.Printf("[meta] loaded %d metadata entries from %s", len(ms.data), ms.path)
}

func (ms *MetaStore) save() {
	ms.mu.RLock()
	b, err := json.MarshalIndent(ms.data, "", "  ")
	ms.mu.RUnlock()
	if err != nil {
		return
	}
	if err := os.WriteFile(ms.path, b, 0644); err != nil {
		log.Printf("[meta] save error: %v", err)
	}
}

// seed populates default metadata for the 20 pre-seeded products if they don't exist yet.
func (ms *MetaStore) seed() {
	seeds := map[string]*ProductMeta{
		// Gaming laptop (ROG / Zephyrus style)
		"prod-1":  {ImageURL: "https://images.unsplash.com/photo-1541807084-5c52e6e76cf3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 15, TotalStock: 50, Category: "laptop", Badge: "Gaming", Rating: "4.9", Reviews: "2.1k", Sold: 320, Loc: "Jakarta"},
		// Logitech / gaming mouse
		"prod-2":  {ImageURL: "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 42, TotalStock: 100, Category: "peripheral", Badge: "", Rating: "4.8", Reviews: "1.4k", Sold: 580, Loc: "Jakarta"},
		// Mechanical keyboard (RGB)
		"prod-3":  {ImageURL: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 28, TotalStock: 80, Category: "peripheral", Badge: "Hot", Rating: "4.8", Reviews: "1.5k", Sold: 890, Loc: "Bekasi"},
		// Gaming monitor
		"prod-4":  {ImageURL: "https://images.unsplash.com/photo-1547119957-637f8679db1e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 9, TotalStock: 30, Category: "laptop", Badge: "", Rating: "4.7", Reviews: "980", Sold: 410, Loc: "Depok"},
		// Gaming headset
		"prod-5":  {ImageURL: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 20, TotalStock: 60, Category: "audio", Badge: "Gaming", Rating: "4.8", Reviews: "2.3k", Sold: 760, Loc: "Surabaya"},
		// External SSD / portable storage
		"prod-6":  {ImageURL: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 35, TotalStock: 100, Category: "storage", Badge: "", Rating: "4.8", Reviews: "2.7k", Sold: 1890, Loc: "Semarang"},
		// Webcam
		"prod-7":  {ImageURL: "https://images.unsplash.com/photo-1616763355548-1b606f439f86?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 18, TotalStock: 50, Category: "peripheral", Badge: "", Rating: "4.6", Reviews: "720", Sold: 280, Loc: "Bandung"},
		// USB hub / peripheral accessories
		"prod-8":  {ImageURL: "https://images.unsplash.com/photo-1625842268584-8f3296236761?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 60, TotalStock: 150, Category: "peripheral", Badge: "", Rating: "4.5", Reviews: "430", Sold: 1200, Loc: "Jakarta"},
		// Samsung Galaxy S-series (flagship phone)
		"prod-9":  {ImageURL: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 22, TotalStock: 80, Category: "phone", Badge: "New", Rating: "4.8", Reviews: "1.8k", Sold: 980, Loc: "Bandung"},
		// Xiaomi / mid-range phone
		"prod-10": {ImageURL: "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 11, TotalStock: 40, Category: "phone", Badge: "Hot", Rating: "4.9", Reviews: "3.4k", Sold: 1250, Loc: "Jakarta"},
		// Samsung A-series phone
		"prod-11": {ImageURL: "https://images.unsplash.com/photo-1580910051209-67fb48958b8a?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 45, TotalStock: 120, Category: "phone", Badge: "", Rating: "4.6", Reviews: "1.2k", Sold: 740, Loc: "Tangerang"},
		// iPhone
		"prod-12": {ImageURL: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 8, TotalStock: 25, Category: "phone", Badge: "", Rating: "4.9", Reviews: "2.1k", Sold: 380, Loc: "Jakarta"},
		// AirPods / TWS earbuds in case
		"prod-13": {ImageURL: "https://images.unsplash.com/photo-1590658268037-41402bb9e4d2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 30, TotalStock: 90, Category: "audio", Badge: "Terlaris", Rating: "4.9", Reviews: "3.8k", Sold: 2100, Loc: "Jakarta"},
		// Bluetooth speaker
		"prod-14": {ImageURL: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 25, TotalStock: 70, Category: "audio", Badge: "", Rating: "4.7", Reviews: "1.9k", Sold: 920, Loc: "Surabaya"},
		// Over-ear headphones (Sony WH style)
		"prod-15": {ImageURL: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 14, TotalStock: 45, Category: "audio", Badge: "", Rating: "5.0", Reviews: "4.1k", Sold: 3200, Loc: "Jakarta"},
		// Laptop bag / sleeve
		"prod-16": {ImageURL: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 55, TotalStock: 120, Category: "other", Badge: "", Rating: "4.6", Reviews: "540", Sold: 320, Loc: "Bekasi"},
		// Charger / cable / power adapter
		"prod-17": {ImageURL: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 80, TotalStock: 200, Category: "other", Badge: "", Rating: "4.7", Reviews: "890", Sold: 1500, Loc: "Jakarta"},
		// Wireless router / networking
		"prod-18": {ImageURL: "https://images.unsplash.com/photo-1606904825846-647eb07f5be2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 100, TotalStock: 300, Category: "peripheral", Badge: "", Rating: "4.5", Reviews: "320", Sold: 800, Loc: "Bandung"},
		// MacBook / ultrabook laptop
		"prod-19": {ImageURL: "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 40, TotalStock: 100, Category: "other", Badge: "", Rating: "4.6", Reviews: "210", Sold: 450, Loc: "Semarang"},
		// Smartwatch
		"prod-20": {ImageURL: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", Stock: 200, TotalStock: 500, Category: "other", Badge: "", Rating: "4.4", Reviews: "150", Sold: 600, Loc: "Jakarta"},
	}

	ms.mu.Lock()
	defer ms.mu.Unlock()
	changed := false
	for id, meta := range seeds {
		if _, exists := ms.data[id]; !exists {
			ms.data[id] = meta
			changed = true
		}
	}
	if changed {
		go ms.save()
		log.Printf("[meta] seeded default metadata for product catalogue")
	}
}

// Get returns a copy of the metadata for a product (never nil).
func (ms *MetaStore) Get(id string) *ProductMeta {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	if m, ok := ms.data[id]; ok {
		c := *m
		return &c
	}
	return &ProductMeta{}
}

// Set stores (or overwrites) metadata for a product and persists asynchronously.
func (ms *MetaStore) Set(id string, meta *ProductMeta) {
	ms.mu.Lock()
	ms.data[id] = meta
	ms.mu.Unlock()
	go ms.save()
}

// Delete removes metadata for a product and persists asynchronously.
func (ms *MetaStore) Delete(id string) {
	ms.mu.Lock()
	delete(ms.data, id)
	ms.mu.Unlock()
	go ms.save()
}

// DeductStock decrements stock by qty and increments sold counter.
// Returns false (insufficient stock) without modifying if stock < qty.
func (ms *MetaStore) DeductStock(id string, qty int32) bool {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	m, ok := ms.data[id]
	if !ok {
		return true // no metadata tracked, allow order
	}
	if m.Stock < qty {
		return false
	}
	m.Stock -= qty
	m.Sold += qty
	go ms.save()
	return true
}

// All returns a shallow copy of the entire metadata map.
func (ms *MetaStore) All() map[string]*ProductMeta {
	ms.mu.RLock()
	defer ms.mu.RUnlock()
	result := make(map[string]*ProductMeta, len(ms.data))
	for k, v := range ms.data {
		c := *v
		result[k] = &c
	}
	return result
}
