const categories = [
    { id: 'all', name: 'All Deals' },
    { id: 'tech', name: 'Tech' },
    { id: 'tools', name: 'Tools' },
    { id: 'household', name: 'Household' },
    { id: 'groceries', name: 'Groceries' },
    { id: 'credit-cards', name: 'Credit Cards' }
];

const deals = [
    {
        id: 1,
        title: "Apple Watch Ultra 2 (GPS + Cellular)",
        price: 599.00,
        originalPrice: 799.00,
        discount: "$200 OFF",
        image: "/images/apple_watch.png",
        category: "tech",
        votes: { up: 0, down: 0 },
        url: "https://www.amazon.com/Apple-Watch-Ultra-Smartwatch-Titanium/dp/B0CHX35D8X",
        description: "The most rugged and capable Apple Watch. Features a titanium case, precision dual-frequency GPS, and up to 36 hours of battery life."
    },
    {
        id: 2,
        title: "Ninja 12-in-1 Smart Double Oven",
        price: 249.99,
        originalPrice: 329.99,
        discount: "42% OFF",
        image: "/images/ninja_oven.png",
        category: "household",
        votes: { up: 0, down: 0 },
        url: "https://www.amazon.com/Ninja-DCT451-Double-Oven-FlexDoor/dp/B0B5H6X8T6",
        description: "FlexDoor creates two separate ovens. Access just the top for quick meals and snacks, or open the full door to cook 2 meals, 2 ways."
    },
    {
        id: 3,
        title: "Bose QuietComfort Ultra Earbuds",
        price: 199.00,
        originalPrice: 299.00,
        discount: "$100 OFF",
        image: "/images/bose_earbuds.png",
        category: "tech",
        votes: { up: 0, down: 0 },
        url: "https://www.amazon.com/Bose-QuietComfort-Ultra-Wireless-Cancelling/dp/B0CCZ26B5V",
        description: "World-class noise cancellation, quieter than ever before. Breakthrough spatial audio for more immersive listening."
    },
    {
        id: 4,
        title: "Eufy BoostIQ RoboVac 11S MAX",
        price: 139.99,
        originalPrice: 249.99,
        discount: "SAVE $110",
        image: "/images/eufy_vacuum.png",
        category: "household",
        votes: { up: 0, down: 0 },
        url: "https://www.amazon.com/eufy-RoboVac-Super-Thin-Self-Charging-Medium-Pile/dp/B07R2DY1L6",
        description: "Super-thin, strong suction robot vacuum. Cleans hard floors to medium-pile carpets. Quiet operation and self-charging."
    },
    {
        id: 5,
        title: "Craftsman 256-Piece Mechanics Tool Set",
        price: 99.00,
        originalPrice: 169.00,
        discount: "41% OFF",
        image: "/images/craftsman_tools.png",
        category: "tools",
        votes: { up: 0, down: 0 },
        url: "https://www.amazon.com/CRAFTSMAN-Mechanics-Tools-Piece-CMMT45305/dp/B09M8L8X8X",
        description: "Comprehensive mechanics tool set with 3-drawer storage box. Includes wrenches, ratchets, and sockets for any job."
    },
    {
        id: 6,
        title: "Jackery Solar Generator 3000 Pro",
        price: 1499.00,
        originalPrice: 2999.00,
        discount: "50% OFF",
        image: "/images/jackery_generator.png",
        category: "tools",
        votes: { up: 0, down: 0 },
        url: "https://www.amazon.com/Jackery-Generator-Explorer-Portable-Emergency/dp/B0BLGXV75W",
        description: "Massive 3024Wh capacity power station with solar panels. Powers 99% of appliances. Perfect for home backup or RV living."
    }
];
