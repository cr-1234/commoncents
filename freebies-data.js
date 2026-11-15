// CommonCents Free Stuff — freebies and free-program offers (birthday
// rewards, free samples, free-with-app offers). These are NOT affiliate
// deals: no commission, no Amazon links — they exist because readers
// love free stuff and come back for it.
//
// Seeded 2026-11-14 with standing birthday-reward programs, each one
// verified that day against the brand's own page (Starbucks Rewards
// terms, MyPanera benefits terms, Krispy Kreme Rewards, Baskin-Robbins
// FAQ, Denny's Rewards announcement). OFFERS CHANGE: every entry here
// must be re-verified against the brand's official page before it is
// trusted, and expired entries (expires < today) hide automatically.
//
// Entry shape: { id, title, store, image (optional — omit when there
// is no clean product picture; the card renders fine without one),
// description (original wording only), url (the brand's official
// offer/rewards page), expires ('YYYY-MM-DD' or null for ongoing),
// howTo (short, original) }.
const freebies = [
    {
        id: 1,
        title: "Free Birthday Drink Or Treat At Starbucks",
        store: "Starbucks",
        image: "img/freebie-starbucks.jpg",
        description: "Starbucks Rewards members get a free handcrafted drink on their birthday — or swap it for a food item or a bottled drink instead. It is the program's easiest freebie, but only if you set it up ahead of time.",
        url: "https://www.starbucks.com/rewards",
        expires: null,
        howTo: "Join Starbucks Rewards free at least 7 days before your birthday, add your birthday to your account, and make at least one Star-earning purchase before your birthday each year. The reward lands in your account on the day itself."
    },
    {
        id: 2,
        title: "Free Birthday Bakery Treat At Panera",
        store: "Panera Bread",
        image: "img/freebie-panera.jpg",
        description: "MyPanera members get a free bakery treat for their birthday — a bagel, cookie, brownie, muffin, scone or pastry — with no purchase required.",
        url: "https://www.panerabread.com/en-us/mypanera/points.html",
        expires: null,
        howTo: "Join MyPanera free and add your birthday (month and day) to your account. The reward loads around your birthday and stays valid for 7 days — just select it when you order."
    },
    {
        id: 3,
        title: "Free Birthday Sweet Treat At Krispy Kreme",
        store: "Krispy Kreme",
        image: "img/freebie-krispykreme.jpg",
        description: "Krispy Kreme Rewards members get a free sweet treat on their birthday — on top of the free doughnut that comes just for joining.",
        url: "https://www.krispykreme.com/rewards",
        expires: null,
        howTo: "Join Krispy Kreme Rewards free in the app or online and add your birthday to your profile, so your birthday treat can be added to your account when the day comes."
    },
    {
        id: 4,
        title: "Free Birthday Scoop At Baskin-Robbins",
        store: "Baskin-Robbins",
        image: "img/freebie-baskinrobbins.jpg",
        description: "The Baskin-Robbins Birthday Club sends members a free scoop for their birthday. It is separate from the regular rewards program, free to join, and open to anyone 13 or older.",
        url: "https://www.baskinrobbins.com/en/faqs",
        expires: null,
        howTo: "Create a free Baskin-Robbins account in the BR App or online and complete your profile to join the Birthday Club — members get their free-scoop birthday reward every year."
    },
    {
        id: 5,
        title: "Free Birthday Everyday Value Slam At Denny's",
        store: "Denny's",
        image: "img/freebie-dennys.jpg",
        description: "Denny's Rewards members get a free Everyday Value Slam breakfast as their birthday reward — the birthday freebie regulars have loved for years, now inside the new rewards program.",
        url: "https://www.dennys.com/rewards",
        expires: null,
        howTo: "Join Denny's Rewards free and add your birthday to your account; the free Everyday Value Slam birthday reward is added for members to use around their birthday."
    }
];
