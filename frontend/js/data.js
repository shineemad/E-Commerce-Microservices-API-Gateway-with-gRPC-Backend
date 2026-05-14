"use strict";

/* ══════════════════════════════════════════
   DATA.JS — Global state, constants & dummy data
══════════════════════════════════════════ */

/* ── API Base URL ── */
const BASE = window.location.origin;

/* ── App State ── */
const S = {
  token: sessionStorage.getItem("v_tok") || null,
  userId: sessionStorage.getItem("v_uid") || null,
  username: sessionStorage.getItem("v_user") || null,
  role: sessionStorage.getItem("v_role") || "buyer",
  products: [],
  cart: [],
};

/* ── UI State ── */
let _activeCategory = "all";
let _searchQuery = "";
let _sortMode = "default";
let _wishlist = new Set();
let _detailQty = 1;
let _countdownTimer = null;

/* ── Dummy product catalogue — Electronics (shown when API has no data) ── */
const DUMMY_PRODUCTS = [
  {
    id: "dp-001",
    name: "MacBook Air M2",
    price: 16499000,
    description:
      'Apple M2 chip · 8GB Unified Memory · 256GB SSD · 13.6" Liquid Retina Display',
    category: "laptop",
    badge: "Terlaris",
    rating: "4.9",
    reviews: "3.2k",
    sold: 2140,
    loc: "Jakarta",
    stock: 42,
    total_stock: 100,
    // MacBook Air silver — close-up shot
    image: "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
  {
    id: "dp-002",
    name: "Samsung Galaxy S24",
    price: 12999000,
    description:
      'Snapdragon 8 Gen 3 · 8GB RAM · 256GB · 6.2" Dynamic AMOLED 2X · 50MP AI Cam',
    category: "phone",
    badge: "New",
    rating: "4.8",
    reviews: "1.8k",
    sold: 980,
    loc: "Bandung",
    stock: 65,
    total_stock: 150,
    // Slim modern Android flagship — front view
    image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
  {
    id: "dp-003",
    name: "Sony WH-1000XM5",
    price: 4799000,
    description:
      "Noise Cancelling Terbaik · 30 Jam Baterai · Hi-Res Audio · Multipoint Connect",
    category: "audio",
    badge: null,
    rating: "5.0",
    reviews: "4.1k",
    sold: 3200,
    loc: "Jakarta",
    stock: 28,
    total_stock: 200,
    // Over-ear headphones on surface
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
  {
    id: "dp-004",
    name: "Logitech MX Master 3S",
    price: 1299000,
    description:
      "8K DPI MagSpeed Scroll · Quiet Click · Multi-Device Bluetooth · Ergonomis Premium",
    category: "peripheral",
    badge: null,
    rating: "4.9",
    reviews: "2.3k",
    sold: 1560,
    loc: "Surabaya",
    stock: 87,
    total_stock: 200,
    // Wireless mouse on desk
    image: "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
  {
    id: "dp-005",
    name: "Keychron K8 Pro",
    price: 1599000,
    description:
      "TKL Wireless Mechanical · Hotswap · RGB Backlight · Kompatibel Mac & Windows",
    category: "peripheral",
    badge: "Hot",
    rating: "4.8",
    reviews: "1.5k",
    sold: 890,
    loc: "Bekasi",
    stock: 4,
    total_stock: 50,
    // Mechanical keyboard with RGB
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
  {
    id: "dp-006",
    name: 'LG UltraGear 27" QHD',
    price: 5499000,
    description:
      '27" QHD IPS · 165Hz · 1ms GTG · G-SYNC Compatible · HDR600 · USB-C 90W',
    category: "laptop",
    badge: "Sale",
    rating: "4.7",
    reviews: "980",
    sold: 410,
    loc: "Depok",
    stock: 15,
    total_stock: 60,
    // Gaming monitor curved/flat
    image: "https://images.unsplash.com/photo-1547119957-637f8679db1e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
  {
    id: "dp-007",
    name: "Samsung Galaxy A55",
    price: 6999000,
    description:
      'Exynos 1480 · 8GB RAM · 256GB · 6.6" Super AMOLED · 50MP OIS · IP67',
    category: "phone",
    badge: null,
    rating: "4.6",
    reviews: "1.2k",
    sold: 740,
    loc: "Tangerang",
    stock: 53,
    total_stock: 120,
    // Samsung mid-range phone in hand
    image: "https://images.unsplash.com/photo-1580910051209-67fb48958b8a?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
  {
    id: "dp-008",
    name: "Apple AirPods Pro 2",
    price: 3999000,
    description:
      "Active Noise Cancellation · Transparency Mode · Spatial Audio · MagSafe Case",
    category: "audio",
    badge: "New",
    rating: "4.9",
    reviews: "5.6k",
    sold: 4100,
    loc: "Jakarta",
    stock: 3,
    total_stock: 80,
    // AirPods Pro in charging case
    image: "https://images.unsplash.com/photo-1590658268037-41402bb9e4d2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
  {
    id: "dp-009",
    name: "Samsung T7 Shield 1TB",
    price: 1249000,
    description:
      "NVMe SSD Eksternal · 1050 MB/s · IP65 Tahan Air & Debu · USB 3.2 Gen2",
    category: "storage",
    badge: null,
    rating: "4.8",
    reviews: "2.7k",
    sold: 1890,
    loc: "Semarang",
    stock: 120,
    total_stock: 300,
    // External SSD / portable drive
    image: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
  {
    id: "dp-010",
    name: "Apple Watch SE Gen 2",
    price: 3799000,
    description:
      "Apple S8 Chip · Heart Rate & Sleep Monitor · Crash Detection · WR50 · 18h",
    category: "wearable",
    badge: null,
    rating: "4.7",
    reviews: "1.9k",
    sold: 820,
    loc: "Medan",
    stock: 31,
    total_stock: 75,
    // Smartwatch on white background
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
  {
    id: "dp-011",
    name: "ASUS ROG Zephyrus G14",
    price: 22999000,
    description:
      'AMD Ryzen 9 7940HS · RTX 4060 · 16GB DDR5 · 1TB SSD · 14" 165Hz WQXGA',
    category: "laptop",
    badge: "Gaming",
    rating: "4.9",
    reviews: "890",
    sold: 320,
    loc: "Surabaya",
    stock: 8,
    total_stock: 30,
    // Gaming laptop — ROG style
    image: "https://images.unsplash.com/photo-1541807084-5c52e6e76cf3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
  {
    id: "dp-012",
    name: "Razer DeathAdder V3",
    price: 899000,
    description:
      "Focus Pro 30K Optical Sensor · 90g Ultra-Light · 6 Programmable Buttons · Chroma RGB",
    category: "peripheral",
    badge: "Gaming",
    rating: "4.8",
    reviews: "1.4k",
    sold: 1120,
    loc: "Jakarta",
    stock: 74,
    total_stock: 150,
    // Gaming mouse Razer style
    image: "https://images.unsplash.com/photo-1615750185825-7b70a9aadb1d?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8",
  },
];

/* ── Category meta ── */
const CATEGORIES = [
  "Laptop",
  "Phone",
  "Audio",
  "Peripheral",
  "Storage",
  "Wearable",
];
const CAT_KEY = {
  all: "all",
  laptop: "laptop",
  phone: "phone",
  audio: "audio",
  peripheral: "peripheral",
  storage: "storage",
  wearable: "wearable",
};
const RATINGS = ["4.6", "4.7", "4.8", "4.9", "5.0"];

/* ── Smart emoji lookup by keywords ── */
const KEYWORD_EMOJI = [
  [/(macbook|laptop|notebook|zephyrus)/i, "💻"],
  [/(monitor|ultragear|ultrasharp|display)/i, "🖥️"],
  [/(iphone|samsung|galaxy|smartphone|pixel)/i, "📱"],
  [/(headphone|headset|wh-|over.ear)/i, "🎧"],
  [/(airpods|earbuds?|tws|buds)/i, "🎧"],
  [/(mouse|mx master|deathadder|trackpad)/i, "🖱️"],
  [/(keyboard|keychron|mechanical)/i, "⌨️"],
  [/(ssd|t7|flash|storage|drive|nvme)/i, "💾"],
  [/(watch|se gen|apple watch|band)/i, "⌚"],
  [/(rog|gaming|razer)/i, "🎮"],
  [/(speaker|soundbar)/i, "🔊"],
  [/(camera|webcam)/i, "📷"],
];

/* ── Icon pool & location pool ── */
const ICONS = [
  "\u{1F4BB}",
  "\u{1F5B1}",
  "\u2328\uFE0F",
  "\u{1F5A5}",
  "\u{1F4F1}",
  "\u{1F3A7}",
  "\u{1F4F7}",
  "\u{1F5A8}",
  "\u231A",
  "\u{1F50B}",
  "\u{1F579}",
  "\u{1F4E1}",
  "\u{1F3AE}",
  "\u{1F58A}",
  "\u{1F4E6}",
  "\u{1F527}",
  "\u{1F392}",
  "\u{1F4DA}",
  "\u{1F3A8}",
  "\u{1F52E}",
];
const EB = ["eb-0", "eb-1", "eb-2", "eb-3", "eb-4", "eb-5"];
const LOCS = [
  "Jakarta",
  "Bandung",
  "Surabaya",
  "Bekasi",
  "Depok",
  "Tangerang",
  "Semarang",
  "Medan",
];

/* ── Keyword-based fallback product images (matches KEYWORD_EMOJI logic) ── */
const KEYWORD_IMAGE = [
  // ── Specific models first (most specific → most generic) ──────────────────
  // MacBook
  [/(macbook air)/i,             "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  [/(macbook pro)/i,             "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  [/(macbook)/i,                 "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Gaming laptops
  [/(zephyrus|rog|tuf gaming)/i, "https://images.unsplash.com/photo-1541807084-5c52e6e76cf3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  [/(raider|predator|helios)/i,  "https://images.unsplash.com/photo-1593642702821-c8da6771f0c6?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Other laptops
  [/(laptop|notebook|thinkpad|inspiron|envy|vivobook|ideapad)/i, "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Monitors
  [/(ultragear|omen monitor|predator monitor)/i, "https://images.unsplash.com/photo-1547119957-637f8679db1e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  [/(monitor|ultrasharp|ultrawide|display)/i,    "https://images.unsplash.com/photo-1547119957-637f8679db1e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Samsung Galaxy S flagship
  [/(galaxy s2[0-9]|galaxy s[0-9]+\s*ultra|galaxy s[0-9]+\s*plus)/i, "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Samsung Galaxy A mid-range
  [/(galaxy a[0-9]+|galaxy m[0-9]+)/i, "https://images.unsplash.com/photo-1580910051209-67fb48958b8a?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Samsung generic
  [/(samsung galaxy)/i,          "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // iPhone
  [/(iphone\s*1[5-9]|iphone\s*pro)/i, "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  [/(iphone)/i,                  "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Xiaomi / Redmi
  [/(xiaomi|redmi|poco|note [0-9]+)/i, "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Oppo / Realme / Vivo
  [/(oppo|realme|vivo)/i,        "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Generic phone
  [/(phone|smartphone|hp android)/i, "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // AirPods / TWS earbuds
  [/(airpods)/i,                 "https://images.unsplash.com/photo-1590658268037-41402bb9e4d2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  [/(earbuds?|tws|buds|galaxy buds)/i, "https://images.unsplash.com/photo-1590658268037-41402bb9e4d2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Over-ear headphones
  [/(wh-1000|xm[34567]|over.?ear|headphone)/i, "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Gaming headset
  [/(headset|kraken|blackshark|arctis)/i, "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Speaker
  [/(speaker|soundbar|audio system)/i, "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Razer gaming mouse
  [/(deathadder|razer naga|basilisk|viper)/i, "https://images.unsplash.com/photo-1615750185825-7b70a9aadb1d?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Logitech MX
  [/(mx master|mx anywhere|g pro|g502|g403|g305)/i, "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Generic mouse
  [/(mouse|tikus)/i,             "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Keyboard
  [/(keychron|keyboard|mechanical|klaviatur)/i, "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // SSD / Storage
  [/(ssd|nvme|t7|t5|x8|portable ssd|flash disk|flashdisk)/i, "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  [/(hard.?disk|hdd|external drive|storage)/i,               "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Smartwatch
  [/(apple watch|galaxy watch|amazfit|garmin|fitbit)/i, "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  [/(smartwatch|jam tangan pintar|wearable)/i, "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Webcam / camera
  [/(webcam|c920|brio|logitech cam)/i, "https://images.unsplash.com/photo-1616763355548-1b606f439f86?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  [/(kamera|camera|mirrorless|dslr)/i, "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Router / networking
  [/(router|wifi|modem|tp-link|asus rt)/i, "https://images.unsplash.com/photo-1606904825846-647eb07f5be2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Charger / cable / adapter
  [/(charger|pengisi daya|kabel|cable|adaptor|power bank)/i, "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Printer
  [/(printer|scanner|epson|canon printer)/i, "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // Bag / case
  [/(tas laptop|laptop bag|sleeve|case laptop)/i, "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // RAM / Memory
  [/(ram|ddr[45]|memory stick|sodimm)/i, "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
  // GPU
  [/(gpu|rtx|gtx|radeon|graphics card)/i, "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8"],
];

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1484788984921-03950022c9ef?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", // MacBook
  "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", // Samsung phone
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", // Headphones
  "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", // Mouse
  "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", // Keyboard
  "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", // SSD
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", // Smartwatch
  "https://images.unsplash.com/photo-1541807084-5c52e6e76cf3?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", // Gaming laptop
  "https://images.unsplash.com/photo-1590658268037-41402bb9e4d2?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", // AirPods
  "https://images.unsplash.com/photo-1547119957-637f8679db1e?w=400&h=400&q=80&auto=format&fit=fill&fill-color=f8f8f8", // Monitor
];

/**
 * Always returns a product image URL. Priority:
 *   1. p.image_url (from API enrichment)
 *   2. p.image (from dummy/merged data)
 *   3. keyword match on product name
 *   4. deterministic fallback from pool
 */
function productImage(p) {
  if (p.image_url) return p.image_url;
  if (p.image) return p.image;
  const name = p.name || "";
  for (const [re, url] of KEYWORD_IMAGE) {
    if (re.test(name)) return url;
  }
  return FALLBACK_IMAGES[hash(p.id || p.name) % FALLBACK_IMAGES.length];
}


