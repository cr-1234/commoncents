const categories = [
    { id: 'all', name: 'All Deals' },
    { id: 'tech', name: 'Tech' },
    { id: 'tools', name: 'Tools' },
    { id: 'household', name: 'Household' },
    { id: 'groceries', name: 'Groceries' },
    { id: 'gifts-him', name: 'Gifts for Him' },
    { id: 'gifts-her', name: 'Gifts for Her' }
];

/* ==============================================================================
   HOW TO ADD A NEW DEAL
   ==============================================================================
   To add your own deal to the site, follow these steps:
   
   1. Find the `const deals = [` line just below this comment.
   2. Copy one of the existing deal blocks (from the `{` to the `},`).
   3. Paste it right under `const deals = [`.
   4. Change the "id" to a unique number (like 999).
   5. Update the "title", "price", "originalPrice", "discount", "image", "url", 
      and "description" to match your new product!
   
   It will instantly show up on the website as the newest deal!
============================================================================== */

const deals = [
    {
        id: 101,
        title: "Sony WH-1000XM4 Wireless Premium Noise Canceling Headphones",
        price: 248.00,
        originalPrice: 348.00,
        discount: "29% OFF",
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop",
        category: "tech",
        votes: { up: 5, down: 0 },
        url: "https://www.amazon.com/dp/B0863TXGM3?tag=commoncents0050-20",
        description: "Industry leading noise canceling with Dual Noise Sensor technology. Next-level music with Edge-AI, co-developed with Sony Music Studios Tokyo. Up to 30-hour battery life."
    },
    {
        id: 102,
        title: "Dyson V8 Cordless Vacuum Cleaner",
        price: 349.99,
        originalPrice: 469.99,
        discount: "25% OFF",
        image: "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=500&auto=format&fit=crop",
        category: "household",
        votes: { up: 3, down: 0 },
        url: "https://www.amazon.com/dp/B0B39T6Q2J?tag=commoncents0050-20",
        description: "Lightweight cordless vacuum with powerful suction. Engineered for homes with pets. Up to 40 minutes of run time. Converts to a handheld vacuum for stairs, cars, and upholstery."
    },
    {
        id: 103,
        title: "Apple Watch Series 9 (GPS 41mm, Midnight Alu)",
        price: 329.00,
        originalPrice: 399.00,
        discount: "18% OFF",
        image: "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=500&auto=format&fit=crop",
        category: "tech",
        votes: { up: 4, down: 0 },
        url: "https://www.amazon.com/dp/B0CHX3WNW8?tag=commoncents0050-20",
        description: "Features advanced health monitoring including blood oxygen, ECG, and sleep tracking. S9 chip enables super-bright display and double-tap gesture interaction."
    },
    {
        id: 104,
        title: "Logitech MX Master 3S Wireless Performance Mouse",
        price: 99.99,
        originalPrice: 109.99,
        discount: "9% OFF",
        image: "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=500&auto=format&fit=crop",
        category: "tech",
        votes: { up: 8, down: 1 },
        url: "https://www.amazon.com/dp/B09HMK1L7B?tag=commoncents0050-20",
        description: "8K DPI optical tracking works on any surface - even glass. Quiet Click buttons offer a satisfying feel with 90% less click noise. Ergonomic design."
    },
    {
        id: 105,
        title: "Breville Barista Express Espresso Machine",
        price: 549.95,
        originalPrice: 749.95,
        discount: "27% OFF",
        image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=500&auto=format&fit=crop",
        category: "household",
        votes: { up: 6, down: 0 },
        url: "https://www.amazon.com/dp/B00CH9QWOU?tag=commoncents0050-20",
        description: "Create third wave specialty coffee at home. Integrated conical burr grinder with dose control. Powerful steam wand for milk texturing and latte art."
    },
    {
        id: 106,
        title: "Lodge 10.25 Inch Pre-Seasoned Cast Iron Skillet",
        price: 19.90,
        originalPrice: 34.25,
        discount: "42% OFF",
        image: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=500&auto=format&fit=crop",
        category: "household",
        votes: { up: 12, down: 0 },
        url: "https://www.amazon.com/dp/B00006JSUB?tag=commoncents0050-20",
        description: "Pre-seasoned with 100% natural vegetable oil. Unparalleled heat retention and even heating. Use to sear, sauté, bake, broil, braise, or fry. Made in the USA."
    },
    {
        id: 107,
        title: "Anker Soundcore Motion Boom Outdoor Speaker",
        price: 79.99,
        originalPrice: 109.99,
        discount: "27% OFF",
        image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&auto=format&fit=crop",
        category: "tech",
        votes: { up: 5, down: 0 },
        url: "https://www.amazon.com/dp/B08LQ39HGK?tag=commoncents0050-20",
        description: "Huge outdoor sound with titanium drivers. IPX7 waterproof and floats on water. 24-hour playtime for non-stop tunes. USB-C charging."
    },
    {
        id: 108,
        title: "Stanley Quencher H2.0 FlowState Tumbler 40 oz",
        price: 45.00,
        originalPrice: 55.00,
        discount: "18% OFF",
        image: "https://images.unsplash.com/photo-1592861956120-e524fc739696?w=500&auto=format&fit=crop",
        category: "gifts-her",
        votes: { up: 10, down: 2 },
        url: "https://www.amazon.com/dp/B0B84D3WNW?tag=commoncents0050-20",
        description: "Double-wall vacuum insulation keeps drinks cold for hours. FlowState lid features rotating cover with three positions. Fits comfort-grip handles."
    },
    {
        id: 109,
        title: "DeWalt 20V MAX Cordless Drill / Driver Combo Kit",
        price: 99.00,
        originalPrice: 159.00,
        discount: "38% OFF",
        image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&auto=format&fit=crop",
        category: "tools",
        votes: { up: 7, down: 0 },
        url: "https://www.amazon.com/dp/B00ET5VMTU?tag=commoncents0050-20",
        description: "High-performance motor delivers 300 unit watts out of power ability. Compact, lightweight design fits into tight areas. 3-year limited warranty."
    },
    {
        id: 110,
        title: "Keurig K-Mini Single Serve Coffee Maker",
        price: 59.99,
        originalPrice: 99.99,
        discount: "40% OFF",
        image: "https://images.unsplash.com/photo-1517256064527-09c53b2d0bc6?w=500&auto=format&fit=crop",
        category: "gifts-her",
        votes: { up: 9, down: 0 },
        url: "https://www.amazon.com/dp/B07D147Q7G?tag=commoncents0050-20",
        description: "Fits anywhere: less than 5 inches wide. Brew any cup size between 6-12oz with Keurig K-Cup pods. Cord storage for easy transport."
    },
    {
        id: 111,
        title: "Kindle Scribe (16 GB) with Basic Pen",
        price: 239.99,
        originalPrice: 339.99,
        discount: "29% OFF",
        image: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop",
        category: "gifts-him",
        votes: { up: 3, down: 0 },
        url: "https://www.amazon.com/dp/B09S4RBY6G?tag=commoncents0050-20",
        description: "The only Kindle that includes a digital notebook and pen. Read and write thoughts in books, PDFs, or write journals, lists, and notes. Glare-free paper-like screen."
    },
    {
        id: 112,
        title: "YETI Rambler 30 oz Stainless Steel Vacuum Insulated Travel Mug",
        price: 35.00,
        originalPrice: 42.00,
        discount: "17% OFF",
        image: "https://images.unsplash.com/photo-1577937927133-66ef06acdf18?w=500&auto=format&fit=crop",
        category: "gifts-him",
        votes: { up: 6, down: 0 },
        url: "https://www.amazon.com/dp/B073WG9WZJ?tag=commoncents0050-20",
        description: "Features double-wall vacuum insulation to keep cold drinks cold and hot drinks hot. Made from kitchen-grade 18/8 stainless steel. Dishwasher safe."
    }
];
