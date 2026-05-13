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
    image:
      "https://images.unsplash.com/photo-1496181091800-b9e8d6fd17a4?w=400&q=80&auto=format&fit=crop",
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
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80&auto=format&fit=crop",
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
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80&auto=format&fit=crop",
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
    image:
      "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400&q=80&auto=format&fit=crop",
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
    image:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80&auto=format&fit=crop",
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
    image:
      "https://images.unsplash.com/photo-1527443195645-1133f7f28990?w=400&q=80&auto=format&fit=crop",
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
    image:
      "https://images.unsplash.com/photo-1580910051209-67fb48958b8a?w=400&q=80&auto=format&fit=crop",
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
    image:
      "https://images.unsplash.com/photo-1590658268037-41402bb9e4d2?w=400&q=80&auto=format&fit=crop",
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
    image:
      "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400&q=80&auto=format&fit=crop",
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
    image:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80&auto=format&fit=crop",
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
    image:
      "https://images.unsplash.com/photo-1541807084-5c52e6e76cf3?w=400&q=80&auto=format&fit=crop",
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
    image:
      "https://images.unsplash.com/photo-1615750185825-7b70a9aadb1d?w=400&q=80&auto=format&fit=crop",
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

/* (FLASH_PRODUCTS defined in features.js)   */
/* (CAT_VISUAL     defined in features.js)   */
/* (ORDER_STEPS    defined in orders.js)      */
