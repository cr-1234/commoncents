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
// Entry shape: { id, title, store, image (REQUIRED — owner rule,
// 2026-11-15: no freebie is added without a clean picture of the
// item itself, self-hosted in img/; if no clean picture can be
// gotten, the freebie is not added at all), description (original
// wording only), url (the brand's official offer/rewards page),
// expires ('YYYY-MM-DD' or null for ongoing), howTo (short,
// original), votes: { up, down } (base tallies the site's thumbs
// start from — plain numbers, 0 for a new entry; entries without
// the field are read as 0) }.
//
// ORDER: freebies display newest first, like deals (owner,
// 2026-11-15). Records carry no timestamp — ids are issued in
// arrival order, so the site sorts by id, highest first. A new
// entry MUST take the next id above the current maximum, or it
// will not appear first.
//
// Added 2026-11-15: Lowe's Holiday Trolley Car workshop (verified
// against Lowe's own Oct 8, 2026 holiday press release) and the Good
// News Radio 2027 wall calendar (verified against the station's own
// calendar-request page). The calendar was REMOVED later the same
// day: its request page went 404 (the station's homepage still
// linked to it) — a dead link comes down (owner rule, 2026-11-15:
// a freebie's stored url must be click-verified live, not just
// listed somewhere). All five standing entries re-verified the
// same day against their brand pages (Starbucks Rewards terms,
// Panera Benefits Terms, Krispy Kreme Rewards, Baskin-Robbins FAQ,
// Denny's FAQ + Jan 2026 press release).
//
// Added 2026-11-16: Fancy Feast 2026 Feastivities Ornament (verified
// against Purina's own feastivities page; ornaments restock daily
// Nov 9-20 in the myPurina app). Walgreens 6 free photo cards
// (code 6PREM, through Nov 17) was checked the same day and NOT
// added: both aggregator pictures show real people's family photos,
// not a clean shot of the item — no clean picture, no freebie.
// All five standing entries re-verified live again this day
// (Starbucks, Panera, Krispy Kreme, Baskin-Robbins, Denny's).
//
// Added 2026-11-18: JCPenney free LEGO Snowman Ornament kids build
// (Sat Dec 12, 11am-noon, verified against JCPenney's own Kids Zone
// page, which carries the event; picture is the brand's own snowman
// shot cropped to the two ornaments, promo frame removed). Same day:
// all 7 existing entries re-verified live against their brand pages
// (Starbucks/Panera/Krispy Kreme/Baskin-Robbins/Denny's birthday
// programs, Lowe's workshops page, Purina feastivities page — the
// ornament offer still live, expires Nov 20). No expiries to prune.
//
// Added 2026-11-19: Michaels free Kids Club holiday crafts (Dec 5/12/19
// Saturdays 10am-noon, verified against Michaels' own winter-workshop
// page, which carries the Seasonal Slider Card and Holly Jolly Ornaments
// projects; picture is the brand's own ornaments shot) and Smoothie King
// free 12 oz Vanilla Peppermint D-Lite on Tue Dec 1 (verified against
// Smoothie King's own Nov 19 press release; picture is the brand's own
// menu shot of the vanilla peppermint cup). Same day: all 8 existing
// entries checked — Starbucks/Krispy Kreme/Baskin-Robbins/Lowe's/JCPenney
// pages answer 200; Panera/Denny's/Purina answer 403 to curl (bot
// protection, not a 404 — kept, all three were verified live Nov 16-18).
// Nothing past expiry to prune (Fancy Feast ornament expires Nov 20).
const freebies = [
    {
        id: 1,
        title: "Free Birthday Drink Or Treat At Starbucks",
        store: "Starbucks",
        image: "img/freebie-starbucks.jpg",
        description: "Starbucks Rewards members get a free handcrafted drink on their birthday — or swap it for a food item or a bottled drink instead. It is the program's easiest freebie, but only if you set it up ahead of time.",
        url: "https://www.starbucks.com/rewards",
        expires: null,
        votes: { up: 0, down: 0 },
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
        votes: { up: 0, down: 0 },
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
        votes: { up: 0, down: 0 },
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
        votes: { up: 0, down: 0 },
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
        votes: { up: 0, down: 0 },
        howTo: "Join Denny's Rewards free and add your birthday to your account; the free Everyday Value Slam birthday reward is added for members to use around their birthday."
    },
    {
        id: 6,
        title: "Free Holiday Trolley Car Kids Workshop At Lowe's",
        store: "Lowe's",
        image: "img/freebie-lowes-trolley.jpg",
        description: "Lowe's free monthly kids workshop turns festive in December: little builders assemble and decorate a classic holiday trolley car, with all supplies included, and take their finished trolley home.",
        url: "https://www.lowes.com/diy-projects-and-ideas/workshops",
        expires: "2026-12-12",
        votes: { up: 0, down: 0 },
        howTo: "Join MyLowe's Rewards free, create a Kids Profile, then reserve a spot for Saturday, December 12, 2026 (10 a.m. to 1 p.m., in-store) on Lowe's workshops page — registration opened November 14 and spots go fast. Built for kids ages 4 to 11, with a parent or guardian along."
    },
    {
        id: 7,
        title: "Free 2026 Fancy Feast Feastivities Ornament",
        store: "Fancy Feast",
        image: "img/freebie-fancyfeast-ornament.png",
        description: "Fancy Feast is giving away a complimentary 2026 Feastivities ornament — a festive keepsake for cat lovers, with a floral gift box and ribbon to hang it by. It is claimed through the myPurina app, one per person, while the daily supply lasts.",
        url: "https://www.purina.com/fancy-feast/feastivities",
        expires: "2026-11-20",
        votes: { up: 0, down: 0 },
        howTo: "Download the free myPurina app and sign up, then open the ornament offer in the app between 11 a.m. and 5:30 p.m. ET — ornaments restock daily through November 20 and go fast, so check early in the window."
    },
    {
        id: 8,
        title: "Free LEGO Snowman Ornament Build At JCPenney",
        store: "JCPenney",
        image: "img/freebie-jcpenney-snowman.jpg",
        description: "JCPenney's free Kids Zone event on Saturday, December 12 lets kids build their own LEGO snowman ornament from real LEGO bricks and take it home — plus a craft ID badge with lanyard and a collector's pin, all free while supplies last.",
        url: "https://www.jcpenney.com/m/kids-club",
        expires: "2026-12-12",
        votes: { up: 0, down: 0 },
        howTo: "Just visit a participating JCPenney store on Saturday, December 12, 2026, between 11 a.m. and noon local time. Kids must be there in person with a parent or guardian, and crafts are first come, first served while supplies last."
    },
    {
        id: 9,
        title: "Free Kids Club Holiday Crafts At Michaels In December",
        store: "Michaels",
        image: "img/freebie-michaels-ornaments.jpg",
        description: "Michaels is running free Kids Club holiday craft mornings every Saturday in December — kids make a seasonal slider card, paint wooden Christmas ornaments, and decorate cookies, with all supplies included and nothing to pay.",
        url: "https://www.michaels.com/winter-workshop",
        expires: "2026-12-19",
        votes: { up: 0, down: 0 },
        howTo: "Just stop by a participating Michaels store on Saturday, December 5, 12 or 19 between 10 a.m. and noon — no registration needed. December 5 makes a sliding holiday card, December 12 paints wooden ornaments, and December 19 decorates cookies; supplies are included and kids should be there with a parent or guardian."
    },
    {
        id: 10,
        title: "Free Vanilla Peppermint Smoothie At Smoothie King On December 1",
        store: "Smoothie King",
        image: "img/freebie-smoothieking-peppermint.jpg",
        description: "Smoothie King is handing out a free 12-ounce Vanilla Peppermint D-Lite smoothie on Tuesday, December 1 — banana, vanilla frozen yogurt and peppermint, with 12 grams of protein — to Healthy Rewards members, no purchase needed.",
        url: "https://www.smoothieking.com/healthy-rewards",
        expires: "2026-12-01",
        votes: { up: 0, down: 0 },
        howTo: "Download the Smoothie King app and join Healthy Rewards free before December 1, then stop by a participating Smoothie King on Tuesday, December 1 and claim your free 12 oz. Vanilla Peppermint D-Lite smoothie — new and existing members both qualify, while supplies last."
    }
];
