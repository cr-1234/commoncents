const categories = [
    { id: 'all', name: 'All Deals' },
    { id: 'tech', name: 'Tech' },
    { id: 'tools', name: 'Tools' },
    { id: 'household', name: 'Household' },
    { id: 'groceries', name: 'Groceries' },
    { id: 'gifts-him', name: 'Gifts for Him' },
    { id: 'gifts-her', name: 'Gifts for Her' }
    ];

const deals = [
    {
                id: 1,
                title: "Apple AirPods Pro (2nd Generation)",
                price: 189.00,
                originalPrice: 249.00,
                discount: "24% OFF",
                image: "https://m.media-amazon.com/images/I/71zny7BTRlL._AC_SL1500_.jpg",
                category: "tech",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B0BDHWDR12?tag=commoncents0050-20",
                description: "Active Noise Cancellation, Adaptive Transparency, Personalized Spatial Audio. Up to 30 hours total listening time with MagSafe Charging Case."
    },
    {
                id: 2,
                title: "Instant Pot Duo 7-in-1 Electric Pressure Cooker, 6 Qt",
                price: 79.99,
                originalPrice: 99.99,
                discount: "20% OFF",
                image: "https://m.media-amazon.com/images/I/71V1c4e5g2L._AC_SL1500_.jpg",
                category: "household",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B00FLYWNYQ?tag=commoncents0050-20",
                description: "7-in-1 multi-use cooker: pressure cooker, slow cooker, rice cooker, steamer, saute, yogurt maker and warmer. Cooks up to 70% faster than traditional methods."
    },
    {
                id: 3,
                title: "Anker 10,000mAh Slim Portable Charger",
                price: 25.99,
                originalPrice: 35.99,
                discount: "28% OFF",
                image: "https://m.media-amazon.com/images/I/61MpMTCCzWL._AC_SL1500_.jpg",
                category: "tech",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B07QXV6N1B?tag=commoncents0050-20",
                description: "Ultra-slim 10,000mAh power bank charges iPhone 15 over twice. Two charging ports for simultaneous charging. MultiProtect safety system included."
    },
    {
                id: 4,
                title: "DEWALT 20V MAX Drill/Driver Combo Kit",
                price: 99.00,
                originalPrice: 149.00,
                discount: "34% OFF",
                image: "https://m.media-amazon.com/images/I/81fH2FXTL+L._AC_SL1500_.jpg",
                category: "tools",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B00ET5VMTU?tag=commoncents0050-20",
                description: "Compact design fits into tight areas. 2-speed transmission for optimal control. LED work light illuminates dark areas. Includes 1.3Ah battery and charger."
    },
    {
                id: 5,
                title: "iRobot Roomba i4 Self-Charging Robot Vacuum",
                price: 199.99,
                originalPrice: 349.99,
                discount: "43% OFF",
                image: "https://m.media-amazon.com/images/I/61OaFzHJPcL._AC_SL1500_.jpg",
                category: "household",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B08168TFF1?tag=commoncents0050-20",
                description: "Smart mapping learns your home in rows for efficient cleaning. Ideal for pet hair. Works with Alexa and Google. Automatically recharges and resumes."
    },
    {
                id: 6,
                title: "Jackery Explorer 300 Plus Portable Power Station",
                price: 199.99,
                originalPrice: 329.99,
                discount: "39% OFF",
                image: "https://m.media-amazon.com/images/I/61TjJl4TJVL._AC_SL1500_.jpg",
                category: "tools",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B0C3FK8YPN?tag=commoncents0050-20",
                description: "288Wh LiFePO4 battery with 10-year lifespan. 3 AC outlets, 2 USB-C, 1 USB-A. Solar compatible. Perfect for camping, RV trips, and home backup power."
    },
    {
                id: 7,
                title: "YETI Rambler 30 oz Travel Mug with Handle",
                price: 35.00,
                originalPrice: 45.00,
                discount: "22% OFF",
                image: "https://m.media-amazon.com/images/I/71RaFe4LKIL._AC_SL1500_.jpg",
                category: "gifts-him",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B073WG9WZJ?tag=commoncents0050-20",
                description: "Double-wall vacuum insulation keeps drinks cold 24 hours or hot 6 hours. Dishwasher safe. StrongHold Handle. Premium 18/8 stainless steel construction."
    },
    {
                id: 8,
                title: "Tile Pro Bluetooth Tracker 4-Pack",
                price: 59.99,
                originalPrice: 99.99,
                discount: "40% OFF",
                image: "https://m.media-amazon.com/images/I/61xFBuKKBWL._AC_SL1500_.jpg",
                category: "gifts-him",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B09BKGVHRQ?tag=commoncents0050-20",
                description: "Find your keys, wallet, remote, anything. 400ft Bluetooth range. Loud built-in alarm. Works with Alexa, Google, and Siri. Replaceable battery lasts 1 year."
    },
    {
                id: 9,
                title: "Revlon One-Step Volumizer Hair Dryer and Hot Air Brush",
                price: 34.99,
                originalPrice: 59.99,
                discount: "42% OFF",
                image: "https://m.media-amazon.com/images/I/61PXxeP1pCL._AC_SL1500_.jpg",
                category: "gifts-her",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B01LSUQSB0?tag=commoncents0050-20",
                description: "Dries and volumizes in one step. Unique oval brush design for maximum volume. Ceramic coating protects hair. Over 600,000 five-star reviews."
    },
    {
                id: 10,
                title: "Kindle Paperwhite 16 GB - Now with 3 Months Free Kindle Unlimited",
                price: 99.99,
                originalPrice: 139.99,
                discount: "29% OFF",
                image: "https://m.media-amazon.com/images/I/61su4+nkBeL._AC_SL1500_.jpg",
                category: "gifts-her",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B08KTZ8249?tag=commoncents0050-20",
                description: "Thinner, lighter design with a flush-front display. 300 ppi glare-free display reads like real paper. Adjustable warm light. Up to 10 weeks battery life."
    },
    {
                id: 11,
                title: "Weber Spirit II E-310 3-Burner Liquid Propane Grill",
                price: 499.00,
                originalPrice: 649.00,
                discount: "23% OFF",
                image: "https://m.media-amazon.com/images/I/71SFJuFTDfL._AC_SL1500_.jpg",
                category: "gifts-him",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B06XGN7GY4?tag=commoncents0050-20",
                description: "529 sq in of total cooking area. GS4 grilling system for consistent performance. Porcelain-enameled cast-iron grates. 10-year warranty on all parts."
    },
    {
                id: 12,
                title: "Olay Regenerist Micro-Sculpting Cream Face Moisturizer",
                price: 21.99,
                originalPrice: 34.99,
                discount: "37% OFF",
                image: "https://m.media-amazon.com/images/I/71zIpWFCjsL._AC_SL1500_.jpg",
                category: "gifts-her",
                votes: { up: 0, down: 0 },
                url: "https://www.amazon.com/dp/B005IHT94S?tag=commoncents0050-20",
                description: "Advanced Regenerist formula with Hyaluronic Acid and Niacinamide for visibly firmer, plumper skin. Fragrance-free. Works on all skin types."
    }
    ];
