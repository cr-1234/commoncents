// State
let currentCategory = 'all';

// This visitor's own votes (deal id -> 'up' | 'down'), remembered on this
// device. The active button state must reflect MY vote, not the shared
// totals — otherwise a first click on a deal that already has votes
// removes one instead of adding mine.
let myVotes = {};
try { myVotes = JSON.parse(localStorage.getItem('ccMyVotes') || '{}'); } catch (e) { myVotes = {}; }
// When each of my votes was cast, and when each removed vote was
// removed (deletion tombstones). The sign-in merge in auth.js compares
// these stamps against the account's copies: a vote whose tombstone is
// at least as new as every copy of the vote stays removed, on this
// device and every other. Without them the union merge resurrected
// un-votes (owner bug report, 2026-11-15).
let myVoteTimes = {};
try { const vt = JSON.parse(localStorage.getItem('ccMyVoteTimes') || '{}'); if (vt && typeof vt === 'object' && !Array.isArray(vt)) myVoteTimes = vt; } catch (e) { myVoteTimes = {}; }
let myVoteTombs = {};
try { const vb = JSON.parse(localStorage.getItem('ccMyVoteTombs') || '{}'); if (vb && typeof vb === 'object' && !Array.isArray(vb)) myVoteTombs = vb; } catch (e) { myVoteTombs = {}; }
function cleanStampMap(m) {
    const out = {};
    if (m && typeof m === 'object' && !Array.isArray(m)) Object.keys(m).forEach(function (k) {
        if (/^[A-Za-z0-9_-]{1,16}$/.test(k) && typeof m[k] === 'number' && isFinite(m[k]) && m[k] > 0) out[k] = m[k];
    });
    return out;
}
function saveMyVotes() {
    try { localStorage.setItem('ccMyVotes', JSON.stringify(myVotes)); } catch (e) {}
    try { localStorage.setItem('ccMyVoteTimes', JSON.stringify(myVoteTimes)); } catch (e) {}
    try { localStorage.setItem('ccMyVoteTombs', JSON.stringify(myVoteTombs)); } catch (e) {}
    // Account Guard: signed-in members also keep their votes on their
    // account (auth.js debounces and pushes them to ccSaveVotes).
    if (window.CC_AUTH && CC_AUTH.noteVotesChanged) { try { CC_AUTH.noteVotesChanged(myVotes); } catch (e) {} }
}
// Bridge for auth.js: read the local vote map, or replace it wholesale
// (sign-in union merge / Restore from backup) and repaint the counts.
// set() may also be handed the merged stamp maps; omitting them leaves
// the local stamps untouched.
window.CC_VOTES = {
    get: function () { return Object.assign({}, myVotes); },
    getTimes: function () { return Object.assign({}, myVoteTimes); },
    getTombs: function () { return Object.assign({}, myVoteTombs); },
    set: function (map, times, tombs) {
        var clean = {};
        if (map && typeof map === 'object') Object.keys(map).forEach(function (k) { if (map[k] === 'up' || map[k] === 'down') clean[k] = map[k]; });
        myVotes = clean;
        if (times !== undefined) myVoteTimes = cleanStampMap(times);
        if (tombs !== undefined) myVoteTombs = cleanStampMap(tombs);
        saveMyVotes();
        if (typeof renderDeals === 'function') renderDeals();
    }
};
// ── Saved deals (owner-approved 2026-11-14) ─────────────────────
// A visitor's bookmarked deals, kept as SNAPSHOTS captured at save
// time ({id, title, price, image, url, ts}) — so a deal that later
// leaves the feed can still be shown in the Saved view from its
// snapshot, honestly tagged "No longer live", instead of vanishing.
// Device-local in ccMySaves; signed-in members also keep the list on
// their account (auth.js debounces and pushes it to ccSaveSaves,
// protected by the same Account Guard backup as votes).
let mySaves = [];
try {
    const rawSaves = JSON.parse(localStorage.getItem('ccMySaves') || '[]');
    if (Array.isArray(rawSaves)) mySaves = rawSaves.filter(s => s && Number.isInteger(s.id) && s.id > 0);
} catch (e) { mySaves = []; }
// Deletion tombstones for saves: {key: removedAtMs}, keyed 'd<id>' for
// deals and 'f<id>' for freebies (the same namespacing freebie votes
// use). Recorded on every deliberate unsave, cleared on a re-save.
// The sign-in merge in auth.js drops any record whose tombstone is at
// least as new as the record's own save time — that is what makes an
// unsave stick instead of being undone by the union merge (owner bug
// report, 2026-11-15).
let mySaveTombs = {};
try { const st = JSON.parse(localStorage.getItem('ccSaveTombs') || '{}'); if (st && typeof st === 'object' && !Array.isArray(st)) mySaveTombs = st; } catch (e) { mySaveTombs = {}; }
function saveTombKey(s) { return (s && s.kind === 'freebie' ? 'f' : 'd') + (s && s.id); }
function cleanSaveTombs(m) {
    const out = {};
    if (m && typeof m === 'object' && !Array.isArray(m)) Object.keys(m).forEach(function (k) {
        if (/^[df]\d{1,16}$/.test(k) && typeof m[k] === 'number' && isFinite(m[k]) && m[k] > 0) out[k] = m[k];
    });
    return out;
}
function saveMySaves() {
    try { localStorage.setItem('ccMySaves', JSON.stringify(mySaves)); } catch (e) {}
    try { localStorage.setItem('ccSaveTombs', JSON.stringify(mySaveTombs)); } catch (e) {}
    if (window.CC_AUTH && CC_AUTH.noteSavesChanged) { try { CC_AUTH.noteSavesChanged(mySaves); } catch (e) {} }
    // Every saves mutation funnels through here (toggle, sign-in
    // merge, Restore) — repaint the sidebar counts so the Saved
    // row's number tracks the list with no reload (owner, 2026-11-15).
    if (typeof paintCategoryCounts === 'function') { try { paintCategoryCounts(); } catch (e) {} }
}
function hasSave(id) { return mySaves.some(s => s.id === id); }
function paintSaveButtons(id) {
    const saved = hasSave(id);
    document.querySelectorAll('[data-save-id="' + id + '"]').forEach(btn => {
        btn.classList.toggle('saved', saved);
        btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
        const lbl = btn.querySelector('.save-label');
        if (lbl) lbl.textContent = saved ? 'Saved' : 'Save';
    });
}
function toggleSave(deal) {
    if (hasSave(deal.id)) {
        mySaves = mySaves.filter(s => s.id !== deal.id);
        mySaveTombs['d' + deal.id] = Date.now();
    } else {
        mySaves.push({
            id: deal.id,
            title: deal.title || '',
            price: (typeof deal.price === 'number' ? deal.price : 0),
            image: deal.image || '',
            url: deal.url || '',
            ts: Date.now()
        });
        delete mySaveTombs['d' + deal.id];
    }
    saveMySaves();
    paintSaveButtons(deal.id);
    // In the Saved view, unsaving removes the card from the list too.
    if (currentCategory === 'saved') renderDeals();
    return hasSave(deal.id);
}
// ── Saved freebies ───────────────────────────────────────────
// Freebies can be bookmarked too (owner, 2026-11-15). Their saves
// ride the same ccMySaves list as deal saves, told apart by a
// kind:'freebie' flag on the record — freebie ids live in their own
// small-number space, so the flag (never the bare id) is what keeps
// a freebie save from ever being read as a deal save. The snapshot
// carries everything the freebie card/modal need, so a freebie that
// later leaves freebies-data.js still renders from its snapshot.
function hasFreebieSave(fid) { return mySaves.some(s => s.kind === 'freebie' && s.id === fid); }
function paintFreebieSaveButtons(fid) {
    const saved = hasFreebieSave(fid);
    document.querySelectorAll('[data-save-fid="' + fid + '"]').forEach(btn => {
        btn.classList.toggle('saved', saved);
        btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
        const lbl = btn.querySelector('.save-label');
        if (lbl) lbl.textContent = saved ? 'Saved' : 'Save';
    });
}
function toggleFreebieSave(f) {
    if (hasFreebieSave(f.id)) {
        mySaves = mySaves.filter(s => !(s.kind === 'freebie' && s.id === f.id));
        mySaveTombs['f' + f.id] = Date.now();
    } else {
        mySaves.push({
            kind: 'freebie',
            id: f.id,
            title: f.title || '',
            store: f.store || '',
            image: f.image || '',
            url: f.url || '',
            description: f.description || '',
            howTo: f.howTo || '',
            expires: (typeof f.expires === 'string' ? f.expires : null),
            ts: Date.now()
        });
        delete mySaveTombs['f' + f.id];
    }
    saveMySaves();
    paintFreebieSaveButtons(f.id);
    // In the Saved view, unsaving removes the card from the list too.
    if (currentCategory === 'saved') renderDeals();
    return hasFreebieSave(f.id);
}
// Bridge for auth.js: read the local saved list, replace it wholesale
// (sign-in union merge / Restore from backup), or toggle a deal.
// set() may also be handed the merged tombstone map; omitting it
// leaves the local tombstones untouched.
window.CC_SAVES = {
    get: function () { return mySaves.map(s => Object.assign({}, s)); },
    getTombs: function () { return Object.assign({}, mySaveTombs); },
    set: function (list, tombs) {
        const clean = [];
        const seen = {};
        if (Array.isArray(list)) list.forEach(s => {
            if (!s || !Number.isInteger(s.id) || s.id <= 0) return;
            if (s.kind === 'freebie') {
                const fk = 'f' + s.id;
                if (seen[fk]) return;
                seen[fk] = true;
                clean.push({
                    kind: 'freebie',
                    id: s.id,
                    title: s.title || '',
                    store: s.store || '',
                    image: s.image || '',
                    url: s.url || '',
                    description: s.description || '',
                    howTo: s.howTo || '',
                    expires: (typeof s.expires === 'string' ? s.expires : null),
                    ts: (typeof s.ts === 'number' ? s.ts : 0)
                });
                return;
            }
            if (seen[s.id]) return;
            seen[s.id] = true;
            clean.push({
                id: s.id,
                title: s.title || '',
                price: (typeof s.price === 'number' ? s.price : 0),
                image: s.image || '',
                url: s.url || '',
                ts: (typeof s.ts === 'number' ? s.ts : 0)
            });
        });
        mySaves = clean;
        if (tombs !== undefined) mySaveTombs = cleanSaveTombs(tombs);
        saveMySaves();
        if (typeof renderDeals === 'function') renderDeals();
    },
    has: function (id) { return hasSave(id); },
    toggle: function (deal) { return toggleSave(deal); }
};
const SAVE_BOOKMARK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>';

// Displayed count = the deal's stored tally + my own vote if I cast it.
// The stored tallies reset on every page load but myVotes persists, so the
// counts must be DERIVED, never mutated — mutating them let a returning
// visitor's switch subtract a vote that wasn't in the count (totals hit -1).
function voteCount(deal, type) { return (deal.votes[type] || 0) + (myVotes[deal.id] === type ? 1 : 0); }
// Freebie votes (owner, 2026-11-15): same derived-count rule as deals,
// but the visitor's vote is stored under a NAMESPACED key — 'f' + the
// freebie id — because freebie ids live in their own small-number
// space (1, 2, 3…) and must never collide with a deal id in the
// shared ccMyVotes map (or in the account copy it syncs to). Base
// counts come from the freebie record's own votes field (seeded 0).
function freebieVoteKey(f) { return 'f' + f.id; }
function freebieVoteCount(f, type) {
    const base = (f.votes && typeof f.votes[type] === 'number') ? f.votes[type] : 0;
    return base + (myVotes[freebieVoteKey(f)] === type ? 1 : 0);
}
let searchQuery = '';

// Pagination: 12 deals per page (3 across x 4 rows), applied AFTER
// filtering + sorting, in every view (all deals, category, search,
// My Feed). The page resets to 1 whenever the filter inputs change —
// renderDeals detects that via a filter key, so every path that funnels
// into renderDeals (nav, sidebar, search box, sort menu, feed picker,
// the Categories lists' "My Feed" row) is covered without each caller
// having to remember.
const DEALS_PER_PAGE = 12;
let currentPage = 1;
let lastFilterKey = null;

// Paste your Google Sheet published CSV URL below:
const SPREADSHEET_CSV_URL = '';

// Giveaway entries are REAL now: they live in the backend
// (see giveaway-backend.js — window.CC_GW). Nothing is stored only in
// this visitor's browser anymore.

// Prize amount scales with the number of PEOPLE entered (unique
// entrants). Bonus entries add chances only — they never move the prize.
function calculatePrize(count) {
    if (count >= 10000) return '$100';
    if (count >= 1000)  return '$30';
    if (count >= 250)   return '$15';
    return '$5';
}

// Update giveaway people count and prize display. The count comes from
// the backend (cc_giveaway_meta for this week) via CC_GW; it is the number
// of PEOPLE entered — bonus entries never inflate it.
function updateEntryCount() {
    const count   = (window.CC_GW && typeof CC_GW.count() === 'number') ? CC_GW.count() : 0;
    const countEl = document.getElementById('entryCount');
    const prizeEl = document.getElementById('prizeAmount');
    const tiers   = document.querySelectorAll('.prize-tier');
    const prize   = calculatePrize(count);
    if (countEl) countEl.textContent = count;
    if (prizeEl) prizeEl.textContent = prize;
    if (tiers.length) {
        const map = { '$5': 0, '$15': 1, '$30': 2, '$100': 3 };
        tiers.forEach((t, i) => t.classList.toggle('active', i === map[prize]));
    }
    const side = document.getElementById('sidebarPrize');
    if (side) side.textContent = prize + ' prize · ' + count + ' people entered · grows with entries';
    // Progress toward the next prize tier + a plain-words "how many more" line.
    const fill = document.getElementById('prizeProgressFill');
    const next = document.getElementById('prizeNext');
    const LADDER = [[0, '$5'], [250, '$15'], [1000, '$30'], [10000, '$100']];
    let cur = LADDER[0], nxt = null;
    for (let i = 0; i < LADDER.length; i++) {
        if (count >= LADDER[i][0]) { cur = LADDER[i]; nxt = LADDER[i + 1] || null; }
    }
    if (fill) fill.style.width = nxt ? Math.min(100, Math.round(((count - cur[0]) / (nxt[0] - cur[0])) * 100)) + '%' : '100%';
    if (next) next.textContent = nxt
        ? (nxt[0] - count) + ' more ' + (nxt[0] - count === 1 ? 'person' : 'people') + ' and the prize jumps to ' + nxt[1] + '!'
        : 'Top prize reached — good luck on Sunday!';
}

// Category completeness (owner, 2026-11-15): the nav lists are
// static HTML, so a category the collector files deals under but
// the lists never named — General is the live case (the hand
// warmers) — had NO tap target anywhere: not the sidebar, not the
// strip, not the phone menu panel, and the owner asked where the
// section went. Before the wiring below captures the lists, add a
// link for every category the live deals actually carry that a list
// is missing, in the picker's order, just before Free Stuff. The
// sidebar's count pass then paints its count like any other row,
// and a category with no live deals simply never gets a link.
(function ensureCategoryLinks() {
    try {
        const order = ['tech', 'tools', 'household', 'groceries', 'kids', 'beauty', 'clothing', 'pets', 'general'];
        const present = {};
        const label = {};
        (typeof deals !== 'undefined' ? deals : []).forEach(d => {
            if (!d || d.dead || !d.category) return;
            present[d.category] = true;
            if (!label[d.category]) label[d.category] = d.fc || d.category;
        });
        const cats = Object.keys(present).sort((a, b) => {
            const ia = order.indexOf(a), ib = order.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
        if (!cats.length) return;
        const lists = [
            { sel: '.main-nav', li: false },
            { sel: '.category-list', li: true },
            { sel: '#mobileDealsSection', li: true }
        ];
        cats.forEach(cat => {
            lists.forEach(L => {
                const host = document.querySelector(L.sel);
                if (!host || host.querySelector('a[data-category="' + cat + '"]')) return;
                const a = document.createElement('a');
                a.href = '#';
                a.dataset.category = cat;
                a.textContent = label[cat];
                let node = a;
                if (L.li) { node = document.createElement('li'); node.appendChild(a); }
                const anchor = host.querySelector('a[data-category="freebies"]');
                const anchorNode = anchor ? (L.li ? anchor.closest('li') : anchor) : null;
                if (anchorNode) host.insertBefore(node, anchorNode);
                else host.appendChild(node);
            });
        });
    } catch (e) {}
})();

// DOM Elements
const dealGrid      = document.getElementById('dealGrid');
const searchInput   = document.getElementById('searchInput');
const searchBtn     = document.getElementById('searchBtn');
const navLinks      = document.querySelectorAll('.nav-link:not(.giveaway-nav-link), .mobile-nav-panel a[data-category]'); // exclude giveaway btn; the phone menu panel's category links ride the same wiring (2026-11-15)
const categoryLinks = document.querySelectorAll('.category-list a');
// The phone panel's Deals-section links get the same count badges
// as the sidebar's (owner, 2026-11-15: "why can we have the numbers
// next to it... my feed could have the numbers next to it") —
// paintCategoryCounts paints both lists from the same tally.
const panelCategoryLinks = document.querySelectorAll('#mobileDealsSection a[data-category]');
const modal         = document.getElementById('dealModal');
const modalBody     = document.getElementById('modalBody');
const closeModal    = document.querySelector('.close-modal');

// Initialize
function initApp() {
    lucide.createIcons(); // Must be first so icons are rendered before we touch display
    
    // Load custom deals from localStorage and add them to deals array
    const customDeals = JSON.parse(localStorage.getItem('customDeals') || '[]');
    customDeals.forEach(cd => {
        if (!deals.some(d => d.id === cd.id)) {
            deals.unshift(cd);
        }
    });

    renderDeals();
    paintCategoryCounts();
    // Restore the browse category half of the saved feed view (see
    // tailored-feed.js): if the visitor left browsing a category, land
    // back on it — nav/sidebar active states painted to match — rather
    // than always starting from All Deals. A saved slug that no longer
    // matches a real link is ignored (falls back to All Deals).
    if (window.CC_FEED && typeof CC_FEED.savedCategory === 'function') {
        const sc = CC_FEED.savedCategory();
        if (sc && sc !== 'all' && [...navLinks, ...categoryLinks].some(l => l.dataset.category === sc)) {
            setCategory(sc);
        }
    }
    setupEventListeners();
    updateEntryCount();

    // Restore saved theme (the site is light by default — dark only if explicitly saved)
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // Load dynamic deals from Google Sheets if configured
    loadGoogleSheetDeals();
}

// Event Listeners
function setupEventListeners() {
    // Header logo = the front page, always (owner, 2026-11-15):
    // "when you push on the top CommonCents it always has to go back
    // to the front page." The logo's plain href reloaded the page and
    // the saved-view restore (ccFeedView) landed the visitor right
    // back in the view they left — Saved, My Feed, a search — so the
    // tap looked dead. Instead the tap resets the view in place: All
    // Deals, page 1 (the filter change resets pagination), search
    // cleared, scrolled to the top (setCategory's rule). The reset is
    // persisted by CC_FEED.goHome, so a later reload agrees.
    const logoLink = document.querySelector('.logo-link');
    if (logoLink) {
        logoLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.CC_FEED && typeof CC_FEED.goHome === 'function') CC_FEED.goHome();
            if (searchInput) searchInput.value = '';
            searchQuery = '';
            // Explicit, not via the render filter: from page 2 of All
            // Deals itself nothing in the filter changes, so the
            // pagination reset there would never fire.
            currentPage = 1;
            setCategory('all');
        });
    }

    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    // Live search (owner, 2026-11-15): results filter AS YOU TYPE —
    // no Enter, no button press needed — the way Gifting Butler's
    // search already feels. A short debounce keeps a fast typist
    // from re-rendering on every keystroke; the matching itself is
    // handleSearch's, unchanged. Clearing the box empties the
    // query, which restores the current view exactly as it was.
    let searchDebounce = null;
    searchInput.addEventListener('input', () => {
        if (searchDebounce) clearTimeout(searchDebounce);
        searchDebounce = setTimeout(handleSearch, 150);
    });

    // Category navigation (giveaway link is excluded via :not selector above)
    [...navLinks, ...categoryLinks].forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Read the category off the link itself, not e.target: a
            // sidebar link contains a count badge, and a tap on the
            // badge must still filter by the link's category.
            const category = link.dataset.category;
            if (!category) return; // safety guard
            setCategory(category);
        });
    });

    closeModal.addEventListener('click', () => { modal.style.display = 'none'; });
    // Theme toggle — icons handled entirely by CSS class, not inline style
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    // ── Custom Dropdown ─────────────────────────────────────────────────
    const sortDropdown = document.getElementById('sortDropdown');
    const dropdownSelected = document.getElementById('dropdownSelected');
    const dropdownItems = document.getElementById('dropdownItems');
    const dropdownSelectedText = document.getElementById('dropdownSelectedText');

    if (dropdownSelected) {
        dropdownSelected.addEventListener('click', (e) => {
            dropdownItems.classList.toggle('show');
            e.stopPropagation();
        });
    }

    if (dropdownItems) {
        dropdownItems.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                dropdownItems.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                dropdownSelectedText.textContent = item.textContent;
                dropdownItems.classList.remove('show');
                renderDeals();
            });
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
        if (dropdownItems && dropdownItems.classList.contains('show') && !sortDropdown.contains(e.target)) {
            dropdownItems.classList.remove('show');
        }
    });

    // ── Giveaway modal ──────────────────────────────────────────────────
    const giveawayModal     = document.getElementById('giveawayModal');
    const openGiveaway      = document.getElementById('openGiveaway');
    const openGiveawaySide  = document.getElementById('openGiveawaySidebar');
    const openGiveawayPanel = document.getElementById('openGiveawayPanel');
    const closeGiveaway     = document.getElementById('closeGiveaway');
    const giveawaySubmitBtn = document.getElementById('giveawaySubmitBtn');

    // Submitter rewards (2026-11-13): one plain line in the entered
    // state when the member's submitted deals earned bonus entries
    // this week. The number rides in on the account profile (auth.js
    // exposes CC_AUTH.submissionBonus and calls CC_PAINT_SUB_BONUS
    // when the profile lands).
    function paintSubBonus() {
        const el = document.getElementById('gwSubBonus');
        if (!el) return;
        const n = (window.CC_AUTH && CC_AUTH.submissionBonus) ? (CC_AUTH.submissionBonus() || 0) : 0;
        if (n > 0) {
            el.textContent = 'Submission bonus: +' + n + ' entries this week';
            el.style.display = '';
        } else {
            el.textContent = '';
            el.style.display = 'none';
        }
    }
    window.CC_PAINT_SUB_BONUS = paintSubBonus;

    // Coming-soon state (owner, 2026-11-14): while the giveaway is NOT
    // active — CC_GW.isActive(), driven by ccGiveawayStatus.active (the
    // site_settings/cc_giveaway doc that also gates the draw) — the
    // sidebar box and the modal show a teaser instead of the entry
    // form: the branded gift mark plus a launch-waitlist email capture
    // ("We'll email you as soon as the giveaway is on" — ccJoinWaitlist
    // on the backend), with account creation demoted to one quiet
    // secondary line. When the giveaway is active, everything behaves
    // exactly as before.
    function gwIsActive() {
        // If the backend bridge is missing entirely, keep the old
        // behaviour (entry form) rather than a dead teaser.
        if (!window.CC_GW || typeof CC_GW.isActive !== 'function') return true;
        return CC_GW.isActive();
    }

    // One coming-soon teaser's moving parts (sidebar + modal share the
    // shape): the waitlist form swaps to a "You're on the list ✓" line
    // once this device has joined (ccGwWaitlistEmail); signed-in
    // visitors get their account email prefilled and lose the
    // create-account line (they already have one). The joined line
    // follows the signed-in account (owner's call, 2026-11-16): while
    // signed in it only shows when the stored email IS the account
    // email (or was joined from this page just now) — a different
    // account sees the form, prefilled with its own email, instead of
    // somebody else's "on the list" line. Signed out, the device
    // memory applies as before.
    const GW_TEASERS = [
        { form: 'sidebarGwWaitlistForm', email: 'sidebarGwWaitlistEmail', err: 'sidebarGwWaitlistErr', btn: 'sidebarGwWaitlistBtn', done: 'sidebarGwWaitlistDone', alt: 'sidebarGwAccountLine' },
        { form: 'modalGwWaitlistForm', email: 'modalGwWaitlistEmail', err: 'modalGwWaitlistErr', btn: 'modalGwWaitlistBtn', done: 'modalGwWaitlistDone', alt: 'modalGwAccountLine' }
    ];
    function gwJoinedEmail() {
        try { return localStorage.getItem('ccGwWaitlistEmail') || ''; } catch (e) { return ''; }
    }
    let gwSessionJoined = '';
    function paintGwTeaser(ids, signedIn) {
        const form = document.getElementById(ids.form);
        const done = document.getElementById(ids.done);
        const alt = document.getElementById(ids.alt);
        const input = document.getElementById(ids.email);
        const joined = gwJoinedEmail();
        const acct = signedIn && window.CC_AUTH && CC_AUTH.email ? String(CC_AUTH.email() || '') : '';
        const joinedHere = !!joined && (
            !signedIn ||
            joined.toLowerCase() === acct.toLowerCase() ||
            joined.toLowerCase() === gwSessionJoined.toLowerCase()
        );
        if (joinedHere) {
            if (form) form.style.display = 'none';
            if (done) {
                done.textContent = "You're on the list ✓ — we'll email you at " + joined + ' when it launches.';
                done.style.display = '';
            }
        } else {
            if (form) form.style.display = '';
            if (done) done.style.display = 'none';
            if (input && signedIn && window.CC_AUTH && CC_AUTH.email) {
                const acct = CC_AUTH.email();
                if (acct && !input.value) input.value = acct;
            }
        }
        if (alt) alt.style.display = signedIn ? 'none' : '';
    }

    function paintGiveawayState() {
        const active = gwIsActive();
        const signedIn = !!(window.CC_AUTH && CC_AUTH.user && CC_AUTH.user());
        // Sidebar box: swap the enter block for the teaser (and back).
        const sAct = document.getElementById('sidebarGwActive');
        const sSoon = document.getElementById('sidebarGwSoon');
        if (sAct && sSoon) {
            sAct.style.display = active ? '' : 'none';
            sSoon.style.display = active ? 'none' : '';
            if (!active) paintGwTeaser(GW_TEASERS[0], signedIn);
        }
        // Phone panel: the small state line under the Weekly
        // Giveaway row. The account menu's own giveaway row is
        // hidden inside the drawer (it duplicated this row), so
        // this line carries the state there: "Coming soon" in
        // small type while the giveaway is off; while it's on, the
        // entered state — the same words the account menu's row
        // uses, from the same CC_GW state — or nothing at all.
        const panelGw = document.getElementById('mobileGwStatus');
        if (panelGw) {
            if (!active) {
                panelGw.textContent = 'Coming soon';
                panelGw.style.display = '';
            } else if (window.CC_GW && CC_GW.isEntered && CC_GW.isEntered()) {
                const n = 1 + (CC_GW.bonus ? CC_GW.bonus() : 0);
                panelGw.textContent = "You're in this week \u00b7 " + n + (n === 1 ? ' entry' : ' entries');
                panelGw.style.display = '';
            } else {
                panelGw.textContent = '';
                panelGw.style.display = 'none';
            }
        }
        // Modal: the teaser replaces the prize block + form + success.
        const soon = document.getElementById('giveawayComingSoon');
        const prizeBlock = document.querySelector('.giveaway-prize-block');
        const form = document.getElementById('giveawayForm');
        const success = document.getElementById('giveawaySuccess');
        const sub = document.getElementById('giveawaySubtitle');
        if (soon) {
            soon.style.display = active ? 'none' : '';
            if (!active) paintGwTeaser(GW_TEASERS[1], signedIn);
        }
        if (!active) {
            if (prizeBlock) prizeBlock.style.display = 'none';
            if (form) form.style.display = 'none';
            if (success) success.style.display = 'none';
            if (sub) sub.textContent = 'Our weekly gift card giveaway launches soon.';
        } else {
            if (prizeBlock) prizeBlock.style.display = '';
            if (sub) sub.textContent = 'One winner drawn every Sunday. Enter each week for a new chance to win!';
            // Form/success visibility is owned by openGiveawayModal /
            // showGwSuccess while active — only undo the coming-soon
            // hide if the success state isn't what's showing.
            if (form && success && form.style.display === 'none' && success.style.display !== 'block') {
                form.style.display = 'block';
            }
        }
    }
    window.CC_PAINT_GW_STATE = paintGiveawayState;

    function showGwSuccess(already) {
        document.getElementById('giveawayForm').style.display    = 'none';
        document.getElementById('giveawaySuccess').style.display = 'block';
        paintSubBonus();
        const bd = document.getElementById('gwEntriesBreakdown');
        if (bd && window.CC_GW) {
            const b = CC_GW.bonus();
            const days = (typeof CC_GW.visitCount === 'function') ? CC_GW.visitCount() : CC_GW.visitDays().length;
            const total = 1 + b;
            bd.textContent = (already ? "You're already in for this week. " : '')
                + 'You have ' + total + (total === 1 ? ' entry' : ' entries')
                + ': 1 for entering + ' + b + ' extra from your visits (' + days + ' visit day' + (days === 1 ? '' : 's') + ' so far). '
                + 'Every 2 visit days earns +1 more extra entry, up to 5.';
            // Entry circles: one gold circle for the entry itself, plum
            // circles for earned visit bonuses, dashed outlines for the
            // bonus spots still open (max 5).
            const circ = document.getElementById('gwEntryCircles');
            if (circ) {
                circ.innerHTML = '';
                for (let i = 0; i < 6; i++) {
                    const s = document.createElement('span');
                    if (i === 0) { s.className = 'ec-dot base'; s.textContent = '1'; }
                    else if (i <= b) { s.className = 'ec-dot'; s.textContent = String(i + 1); }
                    else { s.className = 'ec-dot empty'; s.textContent = '+'; }
                    circ.appendChild(s);
                }
            }
        }
    }

    function openGiveawayModal(e) {
        if (e) e.preventDefault();
        updateEntryCount();
        paintGiveawayState();
        if (!gwIsActive()) {
            // Coming soon: teaser only — no entry form to prepare.
            giveawayModal.style.display = 'flex';
            return;
        }
        if (window.CC_GW) {
            CC_GW.refreshCount();
            CC_GW.lastWinner((w) => {
                const el = document.getElementById('lastWinner');
                if (el && w) {
                    el.textContent = "Last week's winner: " + w.masked
                        + (w.prize ? ' won a ' + w.prize + ' Amazon gift card' : '');
                    el.style.display = 'block';
                }
            });
        }
        if (window.CC_GW && CC_GW.isEntered()) {
            showGwSuccess(true);
        } else {
            document.getElementById('giveawayForm').style.display    = 'block';
            document.getElementById('giveawaySuccess').style.display = 'none';
        }
        // Signed in? The drawing uses the account email — no typing.
        // Signed out? Entry requires sign-in now (gap closure,
        // 2026-11-14): no email box — the button becomes the way in.
        const emIn = document.getElementById('giveawayEmail');
        const note = document.getElementById('giveawayAccountNote');
        const signedIn = !!(window.CC_AUTH && CC_AUTH.user && CC_AUTH.user());
        if (emIn && note) {
            if (signedIn) {
                emIn.style.display = 'none';
                note.textContent = "You're signed in as " + CC_AUTH.email() + " — one tap enters you with that email.";
                note.style.display = 'block';
                if (giveawaySubmitBtn) giveawaySubmitBtn.textContent = "Enter This Week's Giveaway";
            } else {
                emIn.style.display = 'none';
                note.textContent = 'Please sign in to enter the giveaway — it only takes a few seconds, and after that entering is one tap.';
                note.style.display = 'block';
                if (giveawaySubmitBtn) giveawaySubmitBtn.textContent = 'Sign in to Enter';
            }
        }
        giveawayModal.style.display = 'flex';
    }

    if (openGiveaway)      openGiveaway.addEventListener('click', openGiveawayModal);
    if (openGiveawaySide)  openGiveawaySide.addEventListener('click', openGiveawayModal);
    if (openGiveawayPanel) openGiveawayPanel.addEventListener('click', openGiveawayModal);

    // Coming-soon CTAs (sidebar + modal): send the visitor to the
    // sign-in modal — the same path the signed-out entry button uses.
    ['sidebarGwSignin', 'modalGwSignin'].forEach((id) => {
        const b = document.getElementById(id);
        if (b) b.addEventListener('click', () => {
            giveawayModal.style.display = 'none';
            const signInBtn = document.getElementById('signInBtn');
            if (signInBtn) signInBtn.click();
        });
    });

    // Coming-soon waitlist forms (sidebar + modal): validate gently,
    // join via CC_GW.joinWaitlist, then both teasers swap to the
    // "You're on the list ✓" state (paintGiveawayState repaints).
    const GW_WAITLIST_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    GW_TEASERS.forEach((ids) => {
        const form = document.getElementById(ids.form);
        if (!form) return;
        form.addEventListener('submit', (ev) => {
            ev.preventDefault();
            const input = document.getElementById(ids.email);
            const err = document.getElementById(ids.err);
            const btn = document.getElementById(ids.btn);
            const em = input ? input.value.trim() : '';
            if (!GW_WAITLIST_RE.test(em)) {
                if (err) { err.textContent = 'Please enter a valid email address.'; err.style.display = ''; }
                return;
            }
            if (err) err.style.display = 'none';
            if (!window.CC_GW || typeof CC_GW.joinWaitlist !== 'function') {
                if (err) { err.textContent = "Couldn't save right now — please try again in a bit."; err.style.display = ''; }
                return;
            }
            if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
            CC_GW.joinWaitlist(em).then(() => {
                try { localStorage.setItem('ccGwWaitlistEmail', em); } catch (e) {}
                gwSessionJoined = em;
                if (btn) { btn.disabled = false; btn.textContent = 'Notify Me'; }
                paintGiveawayState();
            }).catch(() => {
                if (btn) { btn.disabled = false; btn.textContent = 'Notify Me'; }
                if (err) { err.textContent = "Couldn't save right now — please try again in a bit."; err.style.display = ''; }
            });
        });
    });
    paintGiveawayState();
    if (closeGiveaway)    closeGiveaway.addEventListener('click', () => { giveawayModal.style.display = 'none'; });
    window.addEventListener('click', (e) => {
        if (e.target === giveawayModal) giveawayModal.style.display = 'none';
    });

    if (giveawaySubmitBtn) {
        giveawaySubmitBtn.addEventListener('click', () => {
            const emailInput = document.getElementById('giveawayEmail');
            // Signed in: one tap — the server enters the account email.
            if (window.CC_AUTH && CC_AUTH.user && CC_AUTH.user() && window.CC_GW && CC_GW.ready()) {
                const errEl0 = document.getElementById('giveawayError');
                if (errEl0) errEl0.style.display = 'none';
                giveawaySubmitBtn.disabled = true;
                giveawaySubmitBtn.textContent = 'Entering…';
                CC_AUTH.idToken()
                    .then((tok) => CC_GW.enter(CC_AUTH.email(), tok))
                    .then((res) => {
                        giveawaySubmitBtn.disabled = false;
                        giveawaySubmitBtn.textContent = "Enter This Week's Giveaway";
                        if (res === 'entered' || res === 'already') {
                            updateEntryCount();
                            showGwSuccess(res === 'already');
                        } else if (res === 'unverified' && errEl0) {
                            // Gate: the account email isn't verified yet.
                            // Offer to (re)send the verification email —
                            // only email/password accounts can be
                            // unverified; Google accounts always are.
                            errEl0.innerHTML = 'Your email address isn\u2019t verified yet \u2014 please verify it first, then enter. '
                                + '<button type="button" id="gwSendVerifyBtn" style="background:var(--plum);color:#fff;border:none;border-radius:999px;padding:.3rem .9rem;font:inherit;font-size:.8rem;font-weight:700;cursor:pointer;margin-left:.35rem;">Send verification email</button>';
                            errEl0.style.display = 'block';
                            const vBtn = document.getElementById('gwSendVerifyBtn');
                            if (vBtn) vBtn.addEventListener('click', () => {
                                const u = window.CC_AUTH && CC_AUTH.user && CC_AUTH.user();
                                if (!u || typeof u.sendEmailVerification !== 'function') return;
                                vBtn.disabled = true;
                                u.sendEmailVerification()
                                    .then(() => { vBtn.textContent = 'Sent \u2014 check your inbox'; })
                                    .catch(() => { vBtn.disabled = false; vBtn.textContent = 'Send verification email'; });
                            });
                        } else if (res === 'conncap' && errEl0) {
                            errEl0.textContent = 'Your household has reached this week\u2019s entry limit.';
                            errEl0.style.display = 'block';
                        } else if (res === 'signin' && errEl0) {
                            errEl0.textContent = 'Please sign in to enter the giveaway.';
                            errEl0.style.display = 'block';
                        } else if (errEl0) {
                            errEl0.textContent = 'Something went wrong entering you — please try again.';
                            errEl0.style.display = 'block';
                        }
                    })
                    .catch(() => {
                        giveawaySubmitBtn.disabled = false;
                        giveawaySubmitBtn.textContent = "Enter This Week's Giveaway";
                        if (errEl0) {
                            errEl0.textContent = 'Something went wrong entering you — please try again.';
                            errEl0.style.display = 'block';
                        }
                    });
                return;
            }
            // Signed out: entry requires sign-in now (gap closure,
            // 2026-11-14) — the typed-email path is gone, and the
            // server refuses token-less entries. Send the visitor to
            // the sign-in modal instead.
            giveawayModal.style.display = 'none';
            const signInBtn = document.getElementById('signInBtn');
            if (signInBtn) signInBtn.click();

            
        });
    }

    // Submit Deal Button
    const submitDealBtn = document.getElementById('submitDealBtn');
    if (submitDealBtn) submitDealBtn.addEventListener('click', openSubmitDealModal);
}

function openSubmitDealModal() {
    modalBody.innerHTML = `
        <div style="max-width:500px; margin:0 auto; padding-bottom:2rem;">
            <h2 style="margin-bottom:1.5rem; text-align:center; color:var(--text-primary);">Submit a Deal</h2>
            <form id="dealSubmissionForm">
                <div style="margin-bottom:1rem;">
                    <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary);">Deal Title</label>
                    <input type="text" required placeholder="e.g., Sony WH-1000XM5 Headphones" style="width:100%; padding:0.75rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary);">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                    <div>
                        <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary);">Price ($)</label>
                        <input type="number" step="0.01" required placeholder="299.99" style="width:100%; padding:0.75rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary);">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary);">Category</label>
                        <select style="width:100%; padding:0.75rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary);">
                            <option value="tech">Tech</option>
                            <option value="tools">Tools</option>
                            <option value="household">Household</option>
                            <option value="groceries">Groceries</option>
                            <option value="kids">Kids</option>
                            <option value="beauty">Beauty</option>
                            <option value="clothing">Clothing</option>
                            <option value="pets">Pets</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                </div>
                <div style="margin-bottom:1rem;">
                    <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary);">Deal URL</label>
                    <input type="url" required placeholder="https://..." style="width:100%; padding:0.75rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary);">
                </div>
                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary);">Description</label>
                    <textarea rows="4" required placeholder="Why is this a good deal?" style="width:100%; padding:0.75rem; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary); font-family:inherit;"></textarea>
                </div>
                <button type="submit" class="btn btn-primary full-width">Submit Deal</button>
            </form>
        </div>`;
    modal.style.display = 'flex';
    document.getElementById('dealSubmissionForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const title = form.querySelector('input[type=text]').value.trim();
        const priceVal = parseFloat(form.querySelector('input[type=number]').value);
        const category = form.querySelector('select').value;
        const url = form.querySelector('input[type=url]').value.trim();
        const description = form.querySelector('textarea').value.trim();
        const image = 'https://via.placeholder.com/300x200?text=Deal';
        const newDeal = {
            id: Date.now(),
            title,
            price: priceVal,
            originalPrice: Math.round(priceVal * 1.2),
            discount: '',
            image,
            category,
            votes: { up: 0, down: 0 },
            url,
            description,
        };
        deals.unshift(newDeal);
        renderDeals();
        modal.style.display = 'none';
    });
}

function handleSearch() {
    searchQuery = searchInput.value;
    // Freebies never appear in search results: searching from the Free
    // Stuff view goes back to All Deals and searches the deals.
    if (currentCategory === 'freebies' || currentCategory === 'saved') { setCategory('all'); return; }
    renderDeals();
}

function setCategory(category) {
    currentCategory = category;
    [...navLinks, ...categoryLinks].forEach(link => {
        link.classList.toggle('active', link.dataset.category === category);
    });
    // Keep the Categories lists' "My Feed" rows in sync with the view
    // (in My Feed they carry the active state instead of a category).
    if (window.CC_FEED && typeof CC_FEED.refreshMyFeedNav === 'function') CC_FEED.refreshMyFeedNav();
    renderDeals();
    // Owner request 2026-11-12: switching category while scrolled down
    // must jump back to the very top — otherwise the visitor is left
    // staring at the bottom of the old list and sees nothing.
    if (window.scrollY > 0) {
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    }
}

// Sidebar category counts: each Categories row shows how many LIVE
// deals it holds right now, and a category with none is hidden
// entirely. Computed from the deals array at page load — never
// hard-coded — so newly posted deals update the counts on the next
// load with no code change. The top nav intentionally gets no
// counts. Free Stuff and Saved carry counts too (owner, 2026-11-15):
// live freebies / this device's saves — those two rows are permanent,
// so their badge shows the number even at 0 instead of the row
// hiding. The "All Deals" total counts live deals PLUS the live
// freebies (owner rule, 2026-11-15: the numbers must match what you
// see — freebies render inside All Deals, so they are in its count;
// category rows stay deals-only because freebies belong to no
// category).
function paintCategoryCounts() {
    const tally = {};
    let total = 0;
    deals.forEach(d => {
        if (isDealExpired(d)) return;
        total++;
        tally[d.category] = (tally[d.category] || 0) + 1;
    });
    // Free Stuff count: live freebies only, by the same ET-date
    // expiry rule the Free Stuff view itself renders by.
    let freeCount = 0;
    try {
        if (typeof freebies !== 'undefined' && Array.isArray(freebies)) freeCount = freebies.filter(isFreebieLive).length;
    } catch (e) {}
    // Saved count: this device's saved deals.
    let savedCount = 0;
    try {
        if (window.CC_SAVES && typeof window.CC_SAVES.get === 'function') savedCount = window.CC_SAVES.get().length;
        else { const rawSaved = JSON.parse(localStorage.getItem('ccMySaves') || '[]'); if (Array.isArray(rawSaved)) savedCount = rawSaved.length; }
    } catch (e) {}
    const paintOneCount = link => {
        const cat = link.dataset.category;
        if (!cat) return; // the "My Feed" row — painted by tailored-feed.js
        const li = link.closest('li');
        let badge = link.querySelector('.cat-count');
        if (cat === 'freebies' || cat === 'saved') {
            if (li) li.style.display = '';
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'cat-count';
                link.appendChild(badge);
            }
            badge.textContent = cat === 'freebies' ? freeCount : savedCount;
            return;
        }
        const n = cat === 'all' ? total + freeCount : (tally[cat] || 0);
        if (cat !== 'all' && n === 0) {
            if (li) li.style.display = 'none';
            if (badge) badge.remove();
            return;
        }
        if (li) li.style.display = '';
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'cat-count';
            link.appendChild(badge);
        }
        badge.textContent = n;
    };
    categoryLinks.forEach(paintOneCount);
    // The phone panel's Deals section shows the same numbers next
    // to its rows (owner, 2026-11-15) — same tally, same rules,
    // including a zero-count category tucking its row away.
    panelCategoryLinks.forEach(paintOneCount);
    // The "My Feed" row's badge/visibility is tailored-feed.js's job;
    // refresh it here too so it tracks deals loaded after first paint.
    if (window.CC_FEED && typeof CC_FEED.refreshMyFeedNav === 'function') CC_FEED.refreshMyFeedNav();
}

// Render Functions
// A deal is expired only when it's been marked dead (its posted
// price/stock verifiably ended). Deals do NOT expire by age — a good
// deal stays live until it's actually dead (user's rule, 2026-11-02).
// Cards show their posted date so visitors can judge freshness.
// Expired deals render grayed with the price struck and no buy
// button, and they leave the tailored feed.
function isDealExpired(deal) {
    return deal.dead === true;
}

// ── Free Stuff view ─────────────────────────────────────────────────
// Freebies (freebies-data.js) are their own surface: they render in
// the Free Stuff view (nav/sidebar category 'freebies') — and, since
// 2026-11-15, they ride along at the end of page 1 in My Feed for
// visitors who picked the picker's Free Stuff chip, and in All Deals
// for every visitor (renderDeals appends them in both; see
// feedFreebies below). They never render in category views or search
// results. They are not
// affiliate deals — their buttons link straight to the brand's
// official page (no getAffiliateUrl, no click/view counting). Expired
// entries hide automatically; the comparison date is today in
// Eastern Time.
function etTodayStr() {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
        return new Date().toISOString().slice(0, 10);
    }
}
function isFreebieLive(f) {
    return !f.expires || f.expires >= etTodayStr();
}
// Display order is newest first, like deals (owner, 2026-11-15:
// "the new stuff go first"). Freebie records carry no timestamp —
// ids are issued in arrival order, so newest = highest id first.
// Every surface that lists freebies (Free Stuff view, the All Deals
// and My Feed appends) goes through here; the Saved view keeps its
// own newest-save-first order and does not use this.
function liveFreebiesNewestFirst() {
    if (typeof freebies === 'undefined' || !Array.isArray(freebies)) return [];
    return freebies.filter(isFreebieLive).sort((a, b) => b.id - a.id);
}
function showFreebiesIntro(show) {
    let el = document.getElementById('freebiesIntro');
    if (!el) {
        if (!show) return;
        el = document.createElement('div');
        el.id = 'freebiesIntro';
        el.className = 'freebies-intro';
        el.textContent = 'Free offers from stores and apps — no purchase needed unless the offer says so. Offers change fast; we check them often.';
        dealGrid.parentNode.insertBefore(el, dealGrid);
    }
    el.style.display = show ? '' : 'none';
}
function freebieWhenText(f) {
    return f.expires
        ? 'Ends ' + new Date(f.expires + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Ongoing';
}
// Freebie cards are full citizens now (owner, 2026-11-15): the same
// card shape as a deal card — fixed title/description heights (the
// shared .card-title/.card-desc rules), the action button pinned to
// the bottom via margin-top:auto (the .freebie-btn rule, mirroring
// .view-deal-btn), a vote row with thumbs + Share + Save, and the
// card opens a modal. The old card's variable-height "How to get it"
// paragraph is what made buttons land at different heights; that
// text lives in the modal now, like a deal's dealNote. One builder
// serves every surface (All Deals, My Feed, Free Stuff, Saved); the
// snapshot variant renders a saved freebie whose entry has left
// freebies-data.js, from the record captured at save time.
function buildFreebieCard(f, snapshot) {
    const article = document.createElement('article');
    article.className = 'deal-card freebie-card' + (snapshot ? ' saved-freebie-card' : '');
    const key = freebieVoteKey(f);
    const isSaved = hasFreebieSave(f.id);
    const savedDate = snapshot && snapshot.ts ? new Date(snapshot.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    article.innerHTML = `
        ${f.image ? `<div class="card-image"><img src="${f.image}" alt="${f.title}" loading="lazy"><span class="free-badge">FREE</span>${!snapshot && window.CC_FEED && CC_FEED.isNewFreebie && CC_FEED.isNewFreebie(f) ? '<span class="new-badge new-badge-freebie">NEW</span>' : ''}${snapshot ? '<span class="saved-freebie-badge">SAVED FREEBIE</span>' : ''}</div>` : ''}
        <div class="card-content">
            ${f.image ? '' : `<span class="free-badge free-badge-inline">FREE</span>${!snapshot && window.CC_FEED && CC_FEED.isNewFreebie && CC_FEED.isNewFreebie(f) ? '<span class="new-badge new-badge-inline">NEW</span>' : ''}${snapshot ? '<span class="saved-freebie-badge saved-freebie-badge-inline">SAVED FREEBIE</span>' : ''}`}
            <div class="card-meta">
                <span class="card-source">${f.store}</span>
                <span class="card-category">Free Stuff</span>
            </div>
            <h3 class="card-title">${f.title}</h3>
            ${f.description ? `<p class="card-desc">${f.description}</p>` : ''}
            <div class="freebie-when">${snapshot && savedDate ? 'Saved ' + savedDate : freebieWhenText(f)}</div>
            <a href="${f.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary full-width freebie-btn">Get This Freebie</a>
            <div class="vote-container" style="border-top:none; padding-top:0;">
                <button class="vote-btn upvote-btn ${myVotes[key] === 'up' ? 'active' : ''}" data-fid="${f.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    <span>${freebieVoteCount(f, 'up')}</span>
                </button>
                <button class="vote-btn downvote-btn ${myVotes[key] === 'down' ? 'active' : ''}" data-fid="${f.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                    <span>${freebieVoteCount(f, 'down')}</span>
                </button>
                <button class="vote-btn share-btn" aria-label="Share this freebie" title="Share">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
                    <span>Share</span>
                </button>
                <button class="vote-btn save-btn ${isSaved ? 'saved' : ''}" data-save-fid="${f.id}" aria-pressed="${isSaved ? 'true' : 'false'}" aria-label="Save this freebie" title="Save this freebie">
                    ${SAVE_BOOKMARK_SVG}
                    <span class="save-label">${isSaved ? 'Saved' : 'Save'}</span>
                </button>
            </div>
        </div>`;
    article.addEventListener('click', (e) => {
        if (e.target.closest('a') || e.target.closest('button')) return;
        openFreebieModal(f);
    });
    article.querySelector('.upvote-btn').addEventListener('click', (e) => handleFreebieVote(e, f, 'up'));
    article.querySelector('.downvote-btn').addEventListener('click', (e) => handleFreebieVote(e, f, 'down'));
    article.querySelector('.share-btn').addEventListener('click', (e) => { e.stopPropagation(); openShareMenu(f, true); });
    article.querySelector('.save-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleFreebieSave(f); });
    return article;
}
function createFreebieCard(f) { return buildFreebieCard(f, null); }
function createSavedFreebieCard(save) { return buildFreebieCard(save, save); }

// The freebie modal: the deal modal's shell and styling, freebie
// content — picture banner, store line, title, full description, the
// "How to get it" box, the Ongoing/Ends line, and the Get This
// Freebie button (the brand URL verbatim, new tab). No price, no
// coupon elements. Comments included (owner, 2026-11-15): the same
// members-only thread as a deal's, wired through ccSetupComments
// under the namespaced thread key 'f' + id — freebie ids collide
// with deal ids, so the two thread spaces never mix. This still
// deliberately does not go through openModal: no ccView is counted
// for a freebie, ever (comments are a separate system and opening
// this modal fires none).
function openFreebieModal(f) {
    window._ccOpenDealId = null; // no deal thread is open; ccSetupComments sets the thread key below
    // Opening a freebie counts as seeing it, same as a deal (owner,
    // 2026-11-16): retire its NEW badge on the spot and for good.
    if (window.CC_FEED && CC_FEED.markFreebieSeen) {
        try { CC_FEED.markFreebieSeen(f); } catch (e) {}
        document.querySelectorAll('#dealGrid .freebie-card').forEach(function (card) {
            if (card.querySelector('[data-fid="' + f.id + '"]')) {
                const fb = card.querySelector('.new-badge');
                if (fb) fb.remove();
            }
        });
    }
    const skipLoadOnce = !!f._skipLoadOnce;
    delete f._skipLoadOnce;
    const key = freebieVoteKey(f);
    const isSaved = hasFreebieSave(f.id);
    modalBody.innerHTML = `
        ${f.image ? `<div class="modal-media-banner"><img src="${f.image}" alt="${f.title}"></div>` : ''}
        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-secondary); font-weight:600;">${f.store} &middot; Free Stuff</div>
        <h2 style="margin:0.5rem 0 1rem;">${f.title}</h2>
        <div class="modal-buy-row">
            <span class="freebie-when" style="font-size:1rem; margin:0;">${freebieWhenText(f)}</span>
            <div class="modal-buy-actions">
                <a href="${f.url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary freebie-modal-btn">Get This Freebie</a>
                <button type="button" class="btn share-modal-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px; margin-right:0.35rem;"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg><span>Share</span></button>
                <button type="button" class="btn save-modal-btn ${isSaved ? 'saved' : ''}" data-save-fid="${f.id}" aria-pressed="${isSaved ? 'true' : 'false'}"><span style="vertical-align:-3px; margin-right:0.35rem; display:inline-block;">${SAVE_BOOKMARK_SVG}</span><span class="save-label">${isSaved ? 'Saved' : 'Save'}</span></button>
            </div>
        </div>
        ${f.description ? `<p style="color:var(--text-secondary); margin-bottom:1.25rem; line-height:1.7;">${f.description}</p>` : ''}
        ${f.howTo ? `<div class="deal-note"><strong>How to get it:</strong> ${f.howTo}</div>` : ''}
        <div class="vote-container" style="margin-bottom:0.25rem;">
            <button class="vote-btn upvote-btn ${myVotes[key] === 'up' ? 'active' : ''}" data-fid="${f.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                <span>${freebieVoteCount(f, 'up')}</span>
            </button>
            <button class="vote-btn downvote-btn ${myVotes[key] === 'down' ? 'active' : ''}" data-fid="${f.id}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                <span>${freebieVoteCount(f, 'down')}</span>
            </button>
        </div>
        <div class="comments-section">
                    <h3 style="font-size:1.05rem; margin-bottom:0.75rem;">Comments</h3>
                    <div id="commentsList" style="max-height:150px; overflow-y:auto; margin-bottom:1rem; padding-right:0.5rem;"></div>
                    <div id="commentFormWrap"></div>
        </div>`;
    modal.style.display = 'flex';
    modalBody.querySelector('.upvote-btn').addEventListener('click', (e) => handleFreebieVote(e, f, 'up'));
    modalBody.querySelector('.downvote-btn').addEventListener('click', (e) => handleFreebieVote(e, f, 'down'));
    const fbShareBtn = modalBody.querySelector('.share-modal-btn');
    if (fbShareBtn) fbShareBtn.addEventListener('click', (e) => { e.stopPropagation(); openShareMenu(f, true); });
    const fbSaveBtn = modalBody.querySelector('.save-modal-btn');
    if (fbSaveBtn) fbSaveBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFreebieSave(f); });
    ccSetupComments(f, key, skipLoadOnce, () => openFreebieModal(f));
}
function renderFreebies() {
    showFreebiesIntro(true);
    renderPagination(0);
    const list = liveFreebiesNewestFirst();
    if (!list.length) {
        dealGrid.innerHTML = '<div class="no-results">No freebies right now — check back soon.</div>';
        return;
    }
    list.forEach(f => dealGrid.appendChild(createFreebieCard(f)));
}

// ── Saved view ──────────────────────────────────────────────────
// The visitor's bookmarked deals (nav/sidebar category 'saved').
// A save whose deal is still live renders as the deal's normal card
// (fresh data); a save whose deal has left the feed renders from
// the snapshot captured at save time, tagged "No longer live" —
// the saved price and picture show as they were, and the outbound
// link still goes to the store page (with the affiliate tag).
function createSavedSnapshotCard(save) {
    const article = document.createElement('article');
    article.className = 'deal-card saved-gone-card';
    const savedDate = save.ts ? new Date(save.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    article.innerHTML = `
        <div class="card-image">
            ${save.image ? `<img src="${save.image}" alt="${save.title}" loading="lazy">` : ''}
            <span class="gone-badge">NO LONGER LIVE</span>
        </div>
        <div class="card-content">
            <div class="card-meta">
                <span class="card-source">${getStoreName(save.url)}</span>
                <span class="card-category">Saved deal</span>
            </div>
            <h3 class="card-title">${save.title}</h3>
            <div class="card-price">
                $${save.price}
                ${savedDate ? `<span class="card-date">Saved ${savedDate}</span>` : ''}
            </div>
            <p class="dead-note">This deal is no longer on the site — the button below still goes to the store page you saved.</p>
            <a href="${getAffiliateUrl(save.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary full-width view-deal-btn" data-deal-id="${save.id}" style="margin-bottom:1rem;">View at Store</a>
            <div class="vote-container" style="border-top:none; padding-top:0;">
                <button class="vote-btn save-btn saved" data-save-id="${save.id}" aria-pressed="true" aria-label="Remove from saved deals" title="Saved — tap to remove">
                    ${SAVE_BOOKMARK_SVG}
                    <span class="save-label">Saved</span>
                </button>
            </div>
        </div>`;
    article.querySelector('.save-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleSave(save); });
    return article;
}
function renderSaved() {
    showFreebiesIntro(false);
    renderPagination(0);
    if (!mySaves.length) {
        dealGrid.innerHTML = '<div class="no-results">No saved deals yet — tap the bookmark on any deal to keep it here.</div>';
        return;
    }
    // Newest save first.
    mySaves.slice().reverse().forEach(save => {
        if (save.kind === 'freebie') {
            // A saved freebie whose entry is still live renders its
            // normal card; one that left freebies-data.js (or expired)
            // renders from its snapshot, tagged "Saved freebie".
            const liveF = (typeof freebies !== 'undefined' && Array.isArray(freebies))
                ? freebies.find(x => x.id === save.id && isFreebieLive(x)) : null;
            dealGrid.appendChild(liveF ? createFreebieCard(liveF) : createSavedFreebieCard(save));
            return;
        }
        const live = deals.find(d => d.id === save.id && !isDealExpired(d));
        dealGrid.appendChild(live ? createDealCard(live) : createSavedSnapshotCard(save));
    });
}

function renderDeals() {
    dealGrid.innerHTML = '';
    // On phones every browsing view renders compact list rows while
    // the Saved view keeps the big cards (owner, 2026-11-15);
    // style.css keys the row layout off this class.
    dealGrid.classList.toggle('saved-view', currentCategory === 'saved');
    if (currentCategory === 'freebies') { renderFreebies(); return; }
    if (currentCategory === 'saved') { renderSaved(); return; }
    showFreebiesIntro(false);
    // Freebies ride along at the end of page 1, after the deals, in
    // two views (owner, 2026-11-15): My Feed when the visitor picked
    // the picker's Free Stuff chip, and All Deals for EVERY visitor
    // (browse mode, category 'all', no active search). They are not
    // deals — no pagination math, no audience filter; category views
    // and search results never carry them. Among themselves they
    // keep the same newest-first order as everywhere else.
    const inMyFeedNow = !!(window.CC_FEED && CC_FEED.mode() === 'mine');
    const feedPickOn = inMyFeedNow
        && typeof CC_FEED.getInterests === 'function'
        && CC_FEED.getInterests().indexOf('freebies') !== -1;
    const inAllDeals = !inMyFeedNow && currentCategory === 'all' && !searchQuery;
    const feedFreebies = (feedPickOn || inAllDeals) ? liveFreebiesNewestFirst() : [];
    let filtered = deals.filter(deal => {
        const inMyFeed    = window.CC_FEED && CC_FEED.mode() === 'mine';
        const matchCat    = inMyFeed || currentCategory === 'all' || deal.category === currentCategory;
        const matchSearch = deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            deal.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchFeed   = !window.CC_FEED || CC_FEED.match(deal);
        // Audience preference (Men/Women/Everyone) applies in every
        // view; sponsored deals bypass it (see tailored-feed.js).
        const matchAud    = !window.CC_FEED || typeof CC_FEED.matchAudience !== 'function' || CC_FEED.matchAudience(deal);
        return matchCat && matchSearch && matchFeed && matchAud;
    });

    const activeSort = document.querySelector('.dropdown-item.active');
    const sortValue = activeSort ? activeSort.dataset.value : 'newest';

    if (sortValue === 'newest') {
        filtered.sort((a, b) => b.id - a.id);
    } else if (sortValue === 'popular') {
        filtered.sort((a, b) => (b.votes.up - b.votes.down) - (a.votes.up - a.votes.down));
    } else if (sortValue === 'price-low') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortValue === 'price-high') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortValue === 'discount') {
        filtered.sort((a, b) => parseInt(b.discount) - parseInt(a.discount));
    }
    // Expired deals sink below live ones (stable: keeps the chosen sort
    // order inside each group).
    filtered.sort((a, b) => (isDealExpired(a) ? 1 : 0) - (isDealExpired(b) ? 1 : 0));

    // Pagination: if the filter inputs changed since the last render,
    // go back to page 1; then render only this page's slice.
    const feedKey = window.CC_FEED
        ? CC_FEED.mode() + ':' + (typeof CC_FEED.getInterests === 'function' ? CC_FEED.getInterests().join(',') : '')
          + ':' + (typeof CC_FEED.getAudience === 'function' ? CC_FEED.getAudience() : 'everyone')
        : 'nofeed';
    const filterKey = [currentCategory, searchQuery, sortValue, feedKey].join('|');
    if (filterKey !== lastFilterKey) { currentPage = 1; lastFilterKey = filterKey; }
    const totalPages = Math.ceil(filtered.length / DEALS_PER_PAGE);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    if (filtered.length === 0) {
        // A Free-Stuff-only feed is not empty when freebies exist:
        // show them instead of the no-results message.
        if (feedFreebies.length) {
            feedFreebies.forEach(f => dealGrid.appendChild(createFreebieCard(f)));
            renderPagination(0);
            return;
        }
        dealGrid.innerHTML = '<div class="no-results">No deals found matching your criteria.</div>';
        renderPagination(0);
        return;
    }
    const pageStart = (currentPage - 1) * DEALS_PER_PAGE;
    const pageDeals = filtered.slice(pageStart, pageStart + DEALS_PER_PAGE);
    // Sister-site ad card (owner, 2026-11-15). The Gifting Butler
    // card sits inside the feed as one card among the deals — its
    // only home; the rail/strip carries the sponsor ad alone.
    // Browse views only (Saved
    // and Free Stuff return earlier; search never carries it),
    // page 1 only, closing the first row (owner: the right side
    // of the page is what people see first), and only when the
    // page shows at least 7 deals. It is NOT a deal: `filtered`
    // and the pagination math never see it, so page 1 renders its
    // 12 deals PLUS the ad card and no count anywhere changes.
    // Freebies appended below ride after the deals, so counting
    // deal cards here lands the ad in the first row regardless.
    const showFeedAd = currentPage === 1 && !searchQuery && pageDeals.length >= 7;
    let feedAdAfter = 5;
    if (showFeedAd) {
        let cols = 3;
        try { cols = (window.getComputedStyle(dealGrid).gridTemplateColumns || '').split(' ').filter(Boolean).length || 3; } catch (e) {}
        feedAdAfter = cols >= 2 ? cols - 2 : 0;
    }
    pageDeals.forEach((deal, i) => {
        dealGrid.appendChild(createDealCard(deal));
        if (showFeedAd && i === feedAdAfter) dealGrid.appendChild(createFeedAdCard());
    });
    if (currentPage === 1) {
        feedFreebies.forEach(f => dealGrid.appendChild(createFreebieCard(f)));
    }
    renderPagination(totalPages);
}

// Pagination controls live in a container app.js creates itself, right
// under the deals grid (no index.html edit needed). Hidden entirely
// when the filtered list fits on one page.
function getPaginationEl() {
    let el = document.getElementById('pagination');
    if (!el) {
        el = document.createElement('nav');
        el.id = 'pagination';
        el.className = 'pagination';
        el.setAttribute('aria-label', 'Deal pages');
        dealGrid.parentNode.insertBefore(el, dealGrid.nextSibling);
    }
    return el;
}

function renderPagination(totalPages) {
    const el = getPaginationEl();
    if (!totalPages || totalPages <= 1) {
        el.innerHTML = '';
        el.style.display = 'none';
        return;
    }
    el.style.display = '';
    el.innerHTML = '';
    const makeBtn = (label, page, opts) => {
        opts = opts || {};
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'page-btn' + (opts.nav ? ' page-nav' : '') + (opts.active ? ' active' : '');
        b.textContent = label;
        if (opts.disabled) b.disabled = true;
        if (opts.active) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', () => {
            if (page === currentPage || page < 1 || page > totalPages) return;
            currentPage = page;
            renderDeals();
            try { dealGrid.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
        });
        el.appendChild(b);
    };
    makeBtn('← Prev', currentPage - 1, { nav: true, disabled: currentPage <= 1 });
    // Sliding window of at most 3 page numbers (the user's stricter cap,
    // 2026-11-10): the window always holds the current page — in the
    // middle when it can — and slides/clamps at the ends (page 1 shows
    // 1 2 3; the last page shows last-2, last-1, last). A single "…"
    // marks hidden pages on a side, only where pages actually are
    // hidden; the first/last pages are NOT forced in as extra buttons.
    // Three or fewer pages simply show in full, with no dots.
    const winSize = Math.min(3, totalPages);
    let winStart = currentPage - 1;
    if (winStart < 1) winStart = 1;
    if (winStart > totalPages - winSize + 1) winStart = totalPages - winSize + 1;
    const winEnd = winStart + winSize - 1;
    const makeGap = () => {
        const gap = document.createElement('span');
        gap.className = 'page-gap';
        gap.textContent = '…';
        gap.setAttribute('aria-hidden', 'true');
        el.appendChild(gap);
    };
    if (winStart > 1) makeGap();
    for (let p = winStart; p <= winEnd; p++) {
        makeBtn(String(p), p, { active: p === currentPage });
    }
    if (winEnd < totalPages) makeGap();
    makeBtn('Next →', currentPage + 1, { nav: true, disabled: currentPage >= totalPages });
}

// The in-feed sister-site ad, as a designed card that fills its
// cell like a deal card (owner, 2026-11-15: the earlier picture
// version sat in a tall, mostly-empty card — "huge empty space
// before and after it, looks very funny"). The plum G is cropped
// from the house picture (img/gb-g-mark.png); the name, line and
// button are real elements, centred in the card. Deliberately NOT
// a .deal-card — no modal, no votes, no counts. This card is the
// sister promo's ONLY home: never in the side rail or the bottom
// strip (owner, 2026-11-15 — those carry the sponsor ad only).
function createFeedAdCard() {
    const article = document.createElement('article');
    article.className = 'feed-ad-card gb-feed-card';
    article.innerHTML = `
        <a class="gb-feed-link" href="https://giftingbutler-74395.web.app" target="_blank" rel="noopener noreferrer"><img class="gb-feed-mark" src="img/gb-g-mark.png" alt="Gifting Butler" loading="lazy"><span class="gb-feed-name">Gifting Butler</span><span class="gb-feed-line">Looking for a gift, not just a deal?</span><span class="gb-feed-btn">Browse gifts &#8594;</span></a>`;
    return article;
}

function createDealCard(deal) {
    const article = document.createElement('article');
    const expired = isDealExpired(deal);
    article.className = 'deal-card' + (expired ? ' deal-expired' : '');
    const postedDate = deal.ts ? new Date(deal.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

    article.innerHTML = `
        <div class="card-image">
            <img src="${deal.image}" alt="${deal.title}" loading="lazy">
            ${expired ? '<span class="expired-badge">EXPIRED</span>' : ((window.CC_FEED && CC_FEED.isNew(deal)) ? '<span class="new-badge">NEW DEAL</span>' : '')}
        </div>
        <div class="card-content">
            <div class="card-meta">
                <span class="card-source">${getStoreName(deal.url)}</span>
                <span class="card-category">${deal.category}</span>
                ${deal.sponsored ? '<span class="sponsored-tag">Sponsored</span>' : ''}
            </div>
            <h3 class="card-title">${deal.title}</h3>
            ${deal.description ? `<p class="card-desc">${deal.description}</p>` : ''}
            <div class="card-price">
                ${expired ? `<span class="expired-price">$${deal.price}</span>` : `$${deal.price}`}
                ${!expired && deal.originalPrice ? `<span class="original-price">$${deal.originalPrice}</span>` : ''}
                ${!expired && deal.discount ? `<span class="discount-badge">${deal.discount}% OFF</span>` : ''}
                ${!expired && deal.code ? `<span class="deal-code-tag">Promo code</span>` : ''}
                ${!expired && deal.dealNote ? `<span class="deal-note-tag">Coupon</span>` : ''}
                ${postedDate ? `<span class="card-date">Posted ${postedDate}</span>` : ''}
            </div>
            ${expired
                ? `<span class="btn btn-primary full-width view-deal-btn expired-btn" style="margin-bottom:1rem;">Deal Expired</span>`
                : `<a href="${getAffiliateUrl(deal.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary full-width view-deal-btn" data-deal-id="${deal.id}" style="margin-bottom:1rem;">View Deal</a>`}
            ${expired && deal.deadNote ? `<p class="dead-note">${deal.deadNote}</p>` : ''}
            <div class="vote-container" style="border-top:none; padding-top:0;">
                <button class="vote-btn upvote-btn ${myVotes[deal.id] === 'up' ? 'active' : ''}" data-id="${deal.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    <span>${voteCount(deal, 'up')}</span>
                </button>
                <button class="vote-btn downvote-btn ${myVotes[deal.id] === 'down' ? 'active' : ''}" data-id="${deal.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                    <span>${voteCount(deal, 'down')}</span>
                </button>
                <button class="vote-btn share-btn" aria-label="Share this deal" title="Share">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
                    <span>Share</span>
                </button>
                <button class="vote-btn save-btn ${hasSave(deal.id) ? 'saved' : ''}" data-save-id="${deal.id}" aria-pressed="${hasSave(deal.id) ? 'true' : 'false'}" aria-label="Save this deal" title="Save this deal">
                    ${SAVE_BOOKMARK_SVG}
                    <span class="save-label">${hasSave(deal.id) ? 'Saved' : 'Save'}</span>
                </button>
            </div>
        </div>`;

    article.addEventListener('click', (e) => {
        if (e.target.closest('a') || e.target.closest('button')) return;
        openModal(deal);
    });

    article.querySelector('.upvote-btn').addEventListener('click',   (e) => handleVote(e, deal, 'up'));
    article.querySelector('.downvote-btn').addEventListener('click',  (e) => handleVote(e, deal, 'down'));
    article.querySelector('.share-btn').addEventListener('click', (e) => { e.stopPropagation(); openShareMenu(deal); });
    article.querySelector('.save-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleSave(deal); });
    return article;
}

function handleVote(e, deal, type) {
    e.stopPropagation();
    const btn          = e.currentTarget;
    const container    = btn.closest('.vote-container');
    const otherType    = type === 'up' ? 'down' : 'up';
    const otherBtn     = container.querySelector(`.${otherType}vote-btn`);
    const countSpan    = btn.querySelector('span');
    const otherCount   = otherBtn.querySelector('span');

    // Flip MY vote only — the stored tallies are never mutated; what's shown
    // is always derived via voteCount(), so totals can never go negative.
    const mine = myVotes[deal.id];
    if (mine === type) {
        delete myVotes[deal.id];
        myVoteTombs[deal.id] = Date.now();
        delete myVoteTimes[deal.id];
    } else {
        myVotes[deal.id] = type;
        myVoteTimes[deal.id] = Date.now();
        delete myVoteTombs[deal.id];
        btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    }
    saveMyVotes();
    const upBtn = container.querySelector('.upvote-btn');
    const downBtn = container.querySelector('.downvote-btn');
    upBtn.classList.toggle('active', myVotes[deal.id] === 'up');
    downBtn.classList.toggle('active', myVotes[deal.id] === 'down');
    upBtn.querySelector('span').textContent = voteCount(deal, 'up');
    downBtn.querySelector('span').textContent = voteCount(deal, 'down');
}

// The freebie twin of handleVote: identical flip-my-vote behaviour,
// keyed by the namespaced freebie key and counted via
// freebieVoteCount. Persists through the same saveMyVotes() path, so
// freebie votes get the same device memory + account sync as deals.
function handleFreebieVote(e, f, type) {
    e.stopPropagation();
    const key = freebieVoteKey(f);
    const btn = e.currentTarget;
    const container = btn.closest('.vote-container');
    const mine = myVotes[key];
    if (mine === type) {
        delete myVotes[key];
        myVoteTombs[key] = Date.now();
        delete myVoteTimes[key];
    } else {
        myVotes[key] = type;
        myVoteTimes[key] = Date.now();
        delete myVoteTombs[key];
        btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    }
    saveMyVotes();
    const upBtn = container.querySelector('.upvote-btn');
    const downBtn = container.querySelector('.downvote-btn');
    upBtn.classList.toggle('active', myVotes[key] === 'up');
    downBtn.classList.toggle('active', myVotes[key] === 'down');
    upBtn.querySelector('span').textContent = freebieVoteCount(f, 'up');
    downBtn.querySelector('span').textContent = freebieVoteCount(f, 'down');
}



// ── Comments for whichever record the modal is showing ────────
// One machinery serves both modals (extracted from openModal,
// 2026-11-15, when freebies gained the same comments as deals):
// `record` is the object whose .comments thread is on screen (a
// deal, or a freebie), `threadKey` is the key the backend thread
// is stored under — String(deal.id) for a deal, 'f' + freebie id
// for a freebie, because freebie ids are small numbers that
// collide with deal ids — and `reopen` re-renders the owning
// modal (openModal / openFreebieModal) for the edit/delete/load
// re-render paths. window._ccThreadKey is the single 'current
// thread' marker every async guard checks, so a post or load that
// settles after the visitor switched records can never paint (or
// post) into the other record's thread.
function ccSetupComments(record, threadKey, skipLoadOnce, reopen) {
    if (!record.comments) record.comments = [];
    window._ccThreadKey = threadKey;
    // Standard solid icons (the Material shapes every site uses) — the thin
    // outline versions read as scratchy at small sizes (user's complaint).
    const cmtPencil = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    const cmtTrash = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
    const oneCommentHTML = (c, idx, isReply) => `
        <div class="cmt-row" data-cid="${c.id || ''}" ${c.pending ? 'data-pending="1" ' : ''}style="margin-bottom:1rem; padding-bottom:1rem; border-bottom:1px solid var(--border-color);${c.pending ? ' opacity:0.6;' : ''}${isReply ? ' margin-left:1.4rem; padding-left:0.8rem; border-left:2px solid var(--plum-lt);' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <strong style="color:var(--text-primary);">${c.user}</strong>
                <span style="display:inline-flex; align-items:center;">
                    <span style="color:var(--text-secondary); font-size:0.85rem;">${c.pending ? 'Posting\u2026' : c.time}</span>
                    ${c.own && !c.pending ? `<span class="cmt-actions"><button type="button" class="cmt-act-btn" data-cact="edit" data-idx="${idx}" title="Edit comment" aria-label="Edit comment">${cmtPencil}</button><button type="button" class="cmt-act-btn del" data-cact="del" data-idx="${idx}" title="Delete comment" aria-label="Delete comment">${cmtTrash}</button></span>` : ''}
                </span>
            </div>
            ${record._editingIdx === idx ? `
                <textarea id="commentEditText" rows="2" style="width:100%; padding:0.5rem; margin-bottom:0.4rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-family:inherit;">${c.text}</textarea>
                <div style="display:flex; gap:0.4rem;">
                    <button type="button" class="btn btn-primary" data-cact="save" data-idx="${idx}" style="font-size:0.8rem; padding:0.3rem 1rem;">Save</button>
                    <button type="button" class="btn" data-cact="cancel" data-idx="${idx}" style="font-size:0.8rem; padding:0.3rem 1rem;">Cancel</button>
                </div>` : `<p style="color:var(--text-secondary); font-size:0.95rem; white-space:pre-wrap;">${c.text}</p>`}
            ${!isReply && c.id && !c.pending && ccUser ? `<button type="button" class="cmt-reply-btn" data-cact="reply" data-idx="${idx}">Reply</button>` : ''}
        </div>`;
    const replyBoxHTML = (idx) => `
        <div id="commentReplyBox" style="margin:0 0 1rem 1.4rem; padding-left:0.8rem; border-left:2px solid var(--plum-lt);">
            <textarea id="commentReplyText" rows="2" placeholder="Write a reply..." style="width:100%; padding:0.5rem; margin-bottom:0.4rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-family:inherit;"></textarea>
            <div style="display:flex; gap:0.4rem;">
                <button type="button" class="btn btn-primary" data-cact="reply-post" data-idx="${idx}" style="font-size:0.8rem; padding:0.3rem 1rem;">Post reply</button>
                <button type="button" class="btn" data-cact="reply-cancel" data-idx="${idx}" style="font-size:0.8rem; padding:0.3rem 1rem;">Cancel</button>
            </div>
        </div>`;
    // Threaded render (2026-11-13): top-level comments in order, each
    // followed by its replies (one level, indented). A reply whose
    // parent is gone renders as its own block. The flat array order
    // stays chronological; indices still address the flat array.
    const buildCommentsHTML = () => {
        const ids = {};
        record.comments.forEach(c => { if (c.id) ids[c.id] = true; });
        const consumed = {};
        let html = '';
        record.comments.forEach((c, idx) => {
            if (consumed[idx]) return;
            if (c.parentId && ids[c.parentId]) return; // rendered under its parent
            html += oneCommentHTML(c, idx, false);
            record.comments.forEach((r, ridx) => {
                if (r.parentId && r.parentId === c.id && ridx !== idx) { html += oneCommentHTML(r, ridx, true); consumed[ridx] = true; }
            });
            if (record._replyingIdx === idx) html += replyBoxHTML(idx);
        });
        return html;
    };

    // Comments are members-only (no anonymous free-for-all). A signed-in user
    // comments under the username saved on their account — falling back to
    // their account display name, then "Member". Their email is never shown.
    // Signed-out visitors see a sign-in prompt instead of a form.
    const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const fmtCommentTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        if (isNaN(d)) return '';
        const now = new Date();
        if (d.toDateString() === now.toDateString()) {
            const mins = Math.max(0, Math.round((now - d) / 60000));
            if (mins < 2) return 'Just now';
            if (mins < 60) return mins + 'm ago';
            return Math.round(mins / 60) + 'h ago';
        }
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    const showCommentError = (msg) => {
        const e = document.getElementById('commentError');
        if (e) { e.textContent = msg; e.style.display = ''; }
    };
    // Re-render ONLY the comments list, leaving the rest of the modal
    // alone. Optimistic posting uses this: re-rendering the whole modal
    // on every post (plus waiting on the server first) is what made
    // posting feel so slow.
    const renderCommentsList = (toBottom) => {
        const cl = document.getElementById('commentsList');
        if (!cl) return;
        const st = cl.scrollTop;
        cl.innerHTML = buildCommentsHTML();
        bindCommentActions();
        cl.scrollTop = toBottom ? cl.scrollHeight : st;
    };
    // Bring the open reply box fully into view (owner request
    // 2026-11-15): tapping Reply re-rendered the list at its previous
    // scroll position, so the box often opened below the comments
    // list's visible band — and even when the textarea showed, the
    // Post reply / Cancel buttons under it stayed out of sight (the
    // only button on screen was the composer's "Post Comment", which
    // then scolded "Please write a comment first"). Same approach as
    // revealPicker() in tailored-feed.js: let the re-render settle
    // (double rAF), then compute the exact scrolls instead of relying
    // on a bare scrollIntoView in the render frame. First scroll the
    // comments list so the WHOLE box (input + buttons) sits inside
    // its visible band; then, if the box still sits outside the
    // viewport, scroll the modal overlay itself (it is the page-level
    // scroller while open) to land it just inside the top.
    const revealReplyBox = () => {
        const go = () => {
            const box = document.getElementById('commentReplyBox');
            if (!box) return;
            const cl = document.getElementById('commentsList');
            if (cl) {
                const br = box.getBoundingClientRect();
                const lr = cl.getBoundingClientRect();
                if (br.bottom > lr.bottom) cl.scrollTop += Math.ceil(br.bottom - lr.bottom) + 8;
                else if (br.top < lr.top) cl.scrollTop += Math.floor(br.top - lr.top) - 8;
            }
            const modalEl = document.getElementById('dealModal');
            if (modalEl) {
                const br2 = box.getBoundingClientRect();
                const vh = modalEl.clientHeight || window.innerHeight || 0;
                if (vh && br2.bottom > vh) modalEl.scrollTop += Math.ceil(br2.bottom - vh) + 16;
                else if (br2.top < 8 && br2.bottom > 0) modalEl.scrollTop += Math.floor(br2.top) - 70;
            }
        };
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(() => window.requestAnimationFrame(go));
        } else { go(); }
    };
    // The signed-in user is read LIVE, not frozen at open time: Firebase
    // delivers the session asynchronously, so a member who opens a deal
    // before auth lands would otherwise keep the signed-out snapshot
    // ("Sign in to comment", no Reply buttons) for the whole visit even
    // though they are signed in. paintCommentForm() below re-reads this
    // whenever auth.js reports a sign-in change (CC_ON_AUTH_CHANGED).
    let ccUser = null, ccProfileName = '', ccGenName = '', ccDisplayName = null;
    const refreshCcUser = () => {
        ccUser = (window.CC_AUTH && typeof CC_AUTH.user === 'function') ? CC_AUTH.user() : null;
        ccProfileName = (ccUser && typeof CC_AUTH.username === 'function') ? (CC_AUTH.username() || '') : '';
        ccGenName = (window.CC_AUTH && CC_AUTH.fallbackName) ? CC_AUTH.fallbackName() : '';
        // Comment-name chain (owner, 2026-11-15): the picked username,
        // else the generated Word+Word+Number name. The account's own
        // display name is NEVER a comment name — a Google account named
        // "Commoncents" must not post as "Commoncents".
        ccDisplayName = ccUser ? (ccProfileName || ccGenName || 'Member') : null;
    };
    refreshCcUser();
    const cmtInfo = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    const buildCommentFormHTML = () => ccUser ? `
                        <p style="margin-bottom:0.5rem; color:var(--text-secondary); font-size:0.9rem;">Commenting as <strong style="color:var(--text-primary);">${escHtml(ccDisplayName)}</strong> <button type="button" id="commentNameInfo" class="cmt-info-btn" aria-label="About your comment name">${cmtInfo}<span class="cmt-tip" role="tooltip">You can ${ccProfileName ? 'change' : 'set'} your comment name — tap your profile circle at the top right of the page.</span></button></p>
                        <textarea id="commentText" rows="2" placeholder="Your comment..." style="width:100%; padding:0.5rem; margin-bottom:0.5rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-family:inherit;"></textarea>
                        <button id="postCommentBtn" class="btn btn-primary" style="font-size:0.88rem; padding:0.45rem 1.3rem;">Post Comment</button>
                        <p id="commentError" style="display:none; font-size:0.82rem; color:#dc2626; margin-top:0.45rem;"></p>`
        : `
                        <div style="text-align:center; padding:0.4rem 0;">
                            <p style="color:var(--text-secondary); margin-bottom:0.75rem;">Comments are for members — sign in to join the conversation.</p>
                            <button type="button" id="commentSignInBtn" class="btn btn-primary" style="font-size:0.88rem; padding:0.45rem 1.3rem;">Sign in to comment</button>
                        </div>`;

    const listEl0 = document.getElementById('commentsList');
    if (listEl0) listEl0.innerHTML = buildCommentsHTML();
    const formWrap0 = document.getElementById('commentFormWrap');
    if (formWrap0) formWrap0.innerHTML = buildCommentFormHTML();
    // The composer's buttons are bound through a helper so the
    // auth-change repaint (paintCommentForm) can rebind them after
    // swapping the composer's HTML.
    const bindCommentForm = () => {
    const nameInfoBtn = document.getElementById('commentNameInfo');
    if (nameInfoBtn) {
        // Hover shows the tooltip on desktop (CSS); a tap toggles it for touch.
        nameInfoBtn.addEventListener('click', () => nameInfoBtn.classList.toggle('tip-show'));
    }

    const postBtn = document.getElementById('postCommentBtn');
    if (postBtn) {
        postBtn.addEventListener('click', () => {
            const textVal = document.getElementById('commentText').value.trim();
            if (!textVal) {
                alert('⚠️ Please write a comment first.');
                return;
            }
            const liveUser = (window.CC_AUTH && typeof CC_AUTH.user === 'function') ? CC_AUTH.user() : null;
            if (!liveUser) return; // the form only renders for members; stay safe
            if (window.CC_COMMENTS) {
                // Stored comments, posted OPTIMISTICALLY. The old flow
                // waited on the ccPostComment Cloud Function (cold starts
                // can take seconds) before showing anything — that's the
                // slowness the user felt. Now the comment renders at the
                // end of the thread (chronological: newest last) with a
                // subtle pending state and the box clears immediately;
                // the server call runs in the background. On success the
                // server record swaps in by reference — no thread refetch.
                // On failure the optimistic comment comes back out, the
                // typed text is restored, and an error shows by the form.
                const errEl0 = document.getElementById('commentError');
                if (errEl0) errEl0.style.display = 'none';
                const optimistic = { id: null, user: escHtml(ccDisplayName || 'Member').slice(0, 40), text: escHtml(textVal), time: 'Just now', own: true, pending: true, parentId: '' };
                record.comments.push(optimistic);
                const ta0 = document.getElementById('commentText');
                if (ta0) ta0.value = '';
                renderCommentsList(true);
                CC_COMMENTS.post(threadKey, textVal).then(c => {
                    if (!c) throw new Error('empty');
                    const i = record.comments.indexOf(optimistic);
                    if (i !== -1) record.comments.splice(i, 1, { id: c.id, user: escHtml(c.user).slice(0, 40), text: escHtml(c.text), time: fmtCommentTime(c.ts) || 'Just now', own: true, parentId: c.parentId || '' });
                    if (window._ccThreadKey === threadKey && modal.style.display !== 'none') renderCommentsList(false);
                }).catch(() => {
                    const i = record.comments.indexOf(optimistic);
                    if (i !== -1) record.comments.splice(i, 1);
                    if (window._ccThreadKey === threadKey && modal.style.display !== 'none') {
                        renderCommentsList(false);
                        const ta1 = document.getElementById('commentText');
                        if (ta1) ta1.value = textVal;
                        showCommentError('Couldn\u2019t post \u2014 check your connection and try again.');
                    }
                });
                return;
            }
            const liveName = (typeof CC_AUTH.username === 'function' && CC_AUTH.username()) || (typeof CC_AUTH.fallbackName === 'function' ? CC_AUTH.fallbackName() : '') || 'Member';
            // Chronological order: the first comment stays on top, new ones go last.
            // own:true gives the poster pencil/trash controls on their comment.
            record.comments.push({ user: escHtml(liveName).slice(0, 40), text: escHtml(textVal), time: 'Just now', own: true });
            record._skipLoadOnce = true;
            reopen();
            const cl = document.getElementById('commentsList');
            if (cl) cl.scrollTop = cl.scrollHeight;
        });
    }

    const signInPromptBtn = document.getElementById('commentSignInBtn');
    if (signInPromptBtn) {
        signInPromptBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            const b = document.getElementById('signInBtn');
            if (b) b.click();
        });
    }
    };
    bindCommentForm();

    // Own-comment actions: pencil edits in place, trash deletes. Bound
    // through a helper so the list-only re-renders (optimistic posting)
    // can rebind after swapping the list's HTML.
    const bindCommentActions = () => {
    modalBody.querySelectorAll('#commentsList [data-cact]').forEach(btn => {
        btn.addEventListener('click', () => {
            const act = btn.getAttribute('data-cact');
            const idx = parseInt(btn.getAttribute('data-idx'), 10);
            const cl0 = document.getElementById('commentsList');
            const st = cl0 ? cl0.scrollTop : 0;
            if (act === 'edit') {
                record._editingIdx = idx;
                record._skipLoadOnce = true;
                reopen();
            } else if (act === 'cancel') {
                delete record._editingIdx;
                record._skipLoadOnce = true;
                reopen();
            } else if (act === 'del') {
                const c = record.comments[idx];
                if (c && c.id && window.CC_COMMENTS) {
                    CC_COMMENTS.remove(c.id).then(() => {
                        const i2 = record.comments.indexOf(c);
                        if (i2 !== -1) record.comments.splice(i2, 1);
                        delete record._editingIdx;
                        record._skipLoadOnce = true;
                        reopen();
                    }).catch(() => showCommentError('Could not delete that comment — try again.'));
                    return;
                }
                record.comments.splice(idx, 1);
                delete record._editingIdx;
                record._skipLoadOnce = true;
                reopen();
            } else if (act === 'save') {
                const ta = document.getElementById('commentEditText');
                const v = ta ? ta.value.trim() : '';
                if (!v || !record.comments[idx]) return;
                const c = record.comments[idx];
                if (c.id && window.CC_COMMENTS) {
                    CC_COMMENTS.edit(c.id, v).then(saved => {
                        c.text = escHtml(saved && saved.text ? saved.text : v);
                        delete record._editingIdx;
                        record._skipLoadOnce = true;
                        reopen();
                    }).catch(() => showCommentError('Could not save that edit — try again.'));
                    return;
                }
                c.text = escHtml(v);
                delete record._editingIdx;
                record._skipLoadOnce = true;
                reopen();
            } else if (act === 'reply') {
                record._replyingIdx = idx;
                renderCommentsList(false);
                const rt = document.getElementById('commentReplyText');
                if (rt) rt.focus();
                revealReplyBox();
                return;
            } else if (act === 'reply-cancel') {
                delete record._replyingIdx;
                renderCommentsList(false);
                return;
            } else if (act === 'reply-post') {
                const parent = record.comments[idx];
                const rta = document.getElementById('commentReplyText');
                const v = rta ? rta.value.trim() : '';
                if (!parent || !parent.id || !v || !window.CC_COMMENTS) return;
                const liveUser2 = (window.CC_AUTH && typeof CC_AUTH.user === 'function') ? CC_AUTH.user() : null;
                if (!liveUser2) return;
                const liveName2 = (typeof CC_AUTH.username === 'function' && CC_AUTH.username()) || (typeof CC_AUTH.fallbackName === 'function' ? CC_AUTH.fallbackName() : '') || 'Member';
                const opt = { id: null, user: escHtml(liveName2).slice(0, 40), text: escHtml(v), time: 'Just now', own: true, pending: true, parentId: parent.id };
                record.comments.push(opt);
                delete record._replyingIdx;
                renderCommentsList(false);
                CC_COMMENTS.post(threadKey, v, parent.id).then(c => {
                    if (!c) throw new Error('empty');
                    const i = record.comments.indexOf(opt);
                    if (i !== -1) record.comments.splice(i, 1, { id: c.id, user: escHtml(c.user).slice(0, 40), text: escHtml(c.text), time: fmtCommentTime(c.ts) || 'Just now', own: true, parentId: c.parentId || parent.id });
                    if (window._ccThreadKey === threadKey && modal.style.display !== 'none') renderCommentsList(false);
                }).catch(() => {
                    const i = record.comments.indexOf(opt);
                    if (i !== -1) record.comments.splice(i, 1);
                    if (window._ccThreadKey === threadKey && modal.style.display !== 'none') {
                        record._replyingIdx = idx;
                        renderCommentsList(false);
                        const rt2 = document.getElementById('commentReplyText');
                        if (rt2) rt2.value = v;
                        showCommentError('Couldn\u2019t post that reply \u2014 try again.');
                        revealReplyBox();
                    }
                });
                return;
            }
            const cl1 = document.getElementById('commentsList');
            if (cl1) cl1.scrollTop = st;
        });
    });
    };
    bindCommentActions();

    // Track which face the composer currently shows so a sign-in change
    // can swap it (and the Reply buttons, which follow the same state)
    // without wiping text the member may have typed.
    let ccFormSignedIn = !!ccUser;
    const paintCommentForm = () => {
        refreshCcUser();
        if (!!ccUser === ccFormSignedIn) return;
        ccFormSignedIn = !!ccUser;
        const wrap = document.getElementById('commentFormWrap');
        if (wrap) { wrap.innerHTML = buildCommentFormHTML(); bindCommentForm(); }
        renderCommentsList(false);
    };
    // auth.js calls this hook on every sign-in change (same pattern as
    // CC_PAINT_GW_STATE): when auth lands after this deal was opened,
    // the comments area catches up with the signed-in header.
    window.CC_ON_AUTH_CHANGED = () => {
        if (window._ccThreadKey === threadKey && modal.style.display !== 'none') paintCommentForm();
    };
    window.CC_REVEAL_REPLY_BOX = revealReplyBox;

    // Notification click-through (owner, 2026-11-15): when this open
    // came from tapping a notification, record._focusCid names the
    // comment to land on ("I should be able to click over here to go
    // to that comment"). Attempt on every render while the flag is
    // set — the thread load below re-opens the modal with the
    // authoritative list — and the load's settle does one final
    // attempt, then clears the flag so a later manual open of this
    // deal doesn't scroll-hunt for the comment again.
    const focusCommentNow = () => {
        if (!record._focusCid) return false;
        const cl = document.getElementById('commentsList');
        if (!cl) return false;
        const el = cl.querySelector('[data-cid="' + record._focusCid + '"]');
        if (!el) return false;
        const er = el.getBoundingClientRect();
        const lr = cl.getBoundingClientRect();
        if (er.bottom > lr.bottom) cl.scrollTop += Math.ceil(er.bottom - lr.bottom) + 8;
        else if (er.top < lr.top) cl.scrollTop += Math.floor(er.top - lr.top) - 8;
        el.classList.remove('cmt-flash');
        void el.offsetWidth; // restart the flash if it was already running
        el.classList.add('cmt-flash');
        return true;
    };
    if (record._focusCid) {
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(() => window.requestAnimationFrame(focusCommentNow));
        } else { focusCommentNow(); }
    }

    // Stored comments: fetch the saved thread for this deal and swap it in
    // (the server is the source of truth once it answers). Skipped on the
    // re-renders that post / edit / delete trigger themselves.
    if (!skipLoadOnce && window.CC_COMMENTS) {
        const myKey = threadKey;
        CC_COMMENTS.load(myKey).then(list => {
            if (!Array.isArray(list)) return;
            if (window._ccThreadKey !== myKey || modal.style.display === 'none') return;
            const mapped = list.map(c => ({ id: c.id, user: escHtml(c.user).slice(0, 40), text: escHtml(c.text), time: fmtCommentTime(c.ts), own: !!c.mine, parentId: c.parentId || '' }));
            // Keep optimistic entries whose server call is still in
            // flight (a member can post in the window before this load
            // answers — the snapshot can predate their post). Swapping
            // them out here would orphan the post: its confirm would
            // find nothing to swap into and the comment would vanish
            // from the thread until the next open. Entries the
            // snapshot already contains are not duplicated.
            const stillPending = record.comments.filter(c => c.pending && !mapped.some(m => m.text === c.text && (m.parentId || '') === (c.parentId || '')));
            record.comments = mapped.concat(stillPending);
            record._skipLoadOnce = true;
            reopen();
            // The thread is authoritative now: one last focus attempt
            // (this closure reads the live DOM, so it lands on the
            // fresh render), then the click-through is spent.
            if (record._focusCid) {
                const settleFocus = focusCommentNow;
                setTimeout(() => { try { settleFocus(); } catch (e) {} delete record._focusCid; }, 450);
            }
        }).catch(() => { delete record._focusCid; /* backend unreachable: keep whatever is shown */ });
    }
}


function openModal(deal) {
    if (!deal.comments) deal.comments = [];
    window._ccOpenDealId = deal.id;
    // Count the view (owner request 2026-11-12): opening the deal
    // window is interest even when the visitor never taps through to
    // the store. Fire-and-forget to ccView; never blocks the window.
    try {
        fetch(CC_VIEW_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId: String(deal.id) }),
            keepalive: true
        }).catch(function () {});
    } catch (e) {}
    // Opening a deal counts as seeing it: clear its NEW DEAL badge
    // from the card right away, and persist the seen mark (CC_FEED owns
    // it) so the badge doesn't come back on later loads either.
    if (window.CC_FEED && CC_FEED.markSeen) {
        try { CC_FEED.markSeen(deal); } catch (e) {}
        const anyBtn = document.querySelector('#dealGrid .deal-card [data-id="' + deal.id + '"]');
        const openCard = anyBtn ? anyBtn.closest('.deal-card') : null;
        const openBadge = openCard ? openCard.querySelector('.new-badge') : null;
        if (openBadge) openBadge.remove();
    }
    const skipLoadOnce = !!deal._skipLoadOnce;
    delete deal._skipLoadOnce;
    // Picture gallery (owner, 2026-11-15): a deal with extra clean
    // product shots gets a swipeable banner — main picture first,
    // dots underneath showing position. One picture renders exactly
    // the banner it always has, no dots.
    const galleryPics = [deal.image].concat(Array.isArray(deal.gallery) ? deal.gallery.filter(u => u && u !== deal.image) : []);
    const mediaHtml = galleryPics.length > 1
        ? `<div class="modal-media-banner modal-gallery"><div class="modal-gallery-track">${galleryPics.map(u => `<img src="${u}" alt="${deal.title}">`).join('')}</div></div><div class="modal-gallery-dots">${galleryPics.map((u, i) => `<span class="modal-gallery-dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>`
        : `<div class="modal-media-banner"><img src="${deal.image}" alt="${deal.title}"></div>`;
    modalBody.innerHTML = `
        ${mediaHtml}
        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-secondary); font-weight:600;">${getStoreName(deal.url)} &middot; ${deal.category}${deal.sponsored ? ' &middot; <span style="color:var(--highlight); font-weight:700;">Sponsored</span>' : ''}</div>
        <h2 style="margin:0.5rem 0 1rem;">${deal.title}</h2>
        <div class="modal-buy-row">
            <div class="card-price" style="font-size:2rem;">
                $${deal.price}
                ${deal.originalPrice ? `<span class="original-price" style="font-size:1.2rem;">$${deal.originalPrice}</span>` : ''}
                ${deal.discount ? `<span class="discount-badge">${deal.discount}% OFF</span>` : ''}
            </div>
            <div class="modal-buy-actions">
                <a href="${getAffiliateUrl(deal.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary modal-deal-btn" data-deal-id="${deal.id}">Get This Deal</a>
                <button type="button" class="btn share-modal-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px; margin-right:0.35rem;"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg><span>Share</span></button>
                <button type="button" class="btn save-modal-btn ${hasSave(deal.id) ? 'saved' : ''}" data-save-id="${deal.id}" aria-pressed="${hasSave(deal.id) ? 'true' : 'false'}"><span style="vertical-align:-3px; margin-right:0.35rem; display:inline-block;">${SAVE_BOOKMARK_SVG}</span><span class="save-label">${hasSave(deal.id) ? 'Saved' : 'Save'}</span></button>
            </div>
        </div>
        <p style="color:var(--text-secondary); margin-bottom:1.25rem; line-height:1.7;">${deal.description}</p>
        ${deal.dealNote ? `<div class="deal-note"><strong>How to get this price:</strong> ${deal.dealNote}</div>` : ''}
        ${deal.code ? `<div class="deal-code" role="button" tabindex="0" title="Tap to copy the code"><span class="code-clip-icon">✂</span><span class="code-main">Use code <strong>${deal.code}</strong></span><span class="code-action">TAP TO COPY</span></div><p class="code-helper">Copy the code, then tap Get This Deal and paste it at checkout.</p>` : ''}
        <div class="vote-container" style="margin-bottom:0.25rem;">
            <button class="vote-btn upvote-btn ${myVotes[deal.id] === 'up' ? 'active' : ''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                <span>${voteCount(deal, 'up')}</span>
            </button>
            <button class="vote-btn downvote-btn ${myVotes[deal.id] === 'down' ? 'active' : ''}">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                <span>${voteCount(deal, 'down')}</span>
            </button>
        </div>
        <div class="comments-section">
                    <h3 style="font-size:1.05rem; margin-bottom:0.75rem;">Comments</h3>
                    <div id="commentsList" style="max-height:150px; overflow-y:auto; margin-bottom:1rem; padding-right:0.5rem;"></div>
                    <div id="commentFormWrap"></div>
        </div>`;

    modal.style.display = 'flex';

    // Gallery dots follow the swipe/scroll position.
    const galTrack = modalBody.querySelector('.modal-gallery-track');
    if (galTrack) {
        const galDots = modalBody.querySelectorAll('.modal-gallery-dot');
        galTrack.addEventListener('scroll', () => {
            const i = Math.max(0, Math.min(galDots.length - 1, Math.round(galTrack.scrollLeft / galTrack.clientWidth)));
            galDots.forEach((d, j) => d.classList.toggle('active', j === i));
        }, { passive: true });
    }

    modalBody.querySelector('.upvote-btn').addEventListener('click',   (e) => handleVote(e, deal, 'up'));
    modalBody.querySelector('.downvote-btn').addEventListener('click',  (e) => handleVote(e, deal, 'down'));
    const modalShareBtn = modalBody.querySelector('.share-modal-btn');
    if (modalShareBtn) modalShareBtn.addEventListener('click', (e) => { e.stopPropagation(); openShareMenu(deal); });
    const modalSaveBtn = modalBody.querySelector('.save-modal-btn');
    if (modalSaveBtn) modalSaveBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleSave(deal); });

    const modalCode = modalBody.querySelector('.deal-code');
    if (modalCode) {
        modalCode.addEventListener('click', () => copyDealCode(modalCode, deal.code));
        modalCode.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyDealCode(modalCode, deal.code); } });
    }

    ccSetupComments(deal, String(deal.id), skipLoadOnce, () => openModal(deal));

}


// ── Notification click-through (owner, 2026-11-15) ─────────────
// Tapping a notification in the account menu lands HERE: open the
// deal it points at and, for a reply note, scroll its thread to the
// comment and flash it. A deal that has left the feed still opens
// when the visitor saved it (the Saved view's snapshot data — its
// comment thread still loads from the backend by deal id); a deal
// that is simply gone gets a plain spoken note, never a dead click.
function ccToast(msg) {
    let t = document.getElementById('ccToast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'ccToast';
        t.className = 'cc-toast';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._ccHide);
    t._ccHide = setTimeout(() => t.classList.remove('show'), 3400);
}
window.CC_TOAST = ccToast;

window.CC_OPEN_DEAL_COMMENT = function (dealId, commentId) {
    const want = String(dealId == null ? '' : dealId);
    if (!want) return false;
    // Freebie threads (owner, 2026-11-15): a reply note on a freebie
    // carries the namespaced key 'f<id>' as its refId. Open the
    // freebie modal on that thread — the live entry when there is
    // one, else the visitor's saved snapshot (its thread still loads
    // from the backend by the same key); a freebie that is simply
    // gone gets the same plain spoken note as a gone deal, adapted.
    if (/^f[0-9]+$/.test(want)) {
        const fid = parseInt(want.slice(1), 10);
        let f = (typeof freebies !== 'undefined' && Array.isArray(freebies))
            ? freebies.find(x => x.id === fid && isFreebieLive(x)) : null;
        if (!f) {
            const save = mySaves.find(s => s.kind === 'freebie' && s.id === fid);
            if (save) f = save;
        }
        if (!f) { ccToast('That freebie is no longer live.'); return false; }
        if (commentId) f._focusCid = String(commentId);
        openFreebieModal(f);
        return true;
    }
    let deal = deals.find(d => String(d.id) === want);
    if (!deal) {
        const save = mySaves.find(s => String(s.id) === want);
        if (save) {
            deal = {
                id: save.id, title: save.title, price: save.price,
                image: save.image || '', url: save.url || '',
                category: 'Saved deal',
                description: 'This deal is no longer live on the site — this is the copy you saved. Its comments are the original thread.',
                votes: {}, comments: []
            };
        }
    }
    if (!deal) { ccToast('That deal is no longer live.'); return false; }
    if (commentId) deal._focusCid = String(commentId);
    openModal(deal);
    return true;
};

// A notification tapped somewhere the deal machinery isn't loaded
// (a subpage running auth.js alone) can't open its item there, so
// auth.js stashes the target in sessionStorage and sends the
// visitor home — open it on arrival, exactly once (owner rule,
// 2026-11-15: never a dead click).
(function () {
    let raw = null;
    try {
        raw = sessionStorage.getItem('ccOpenNote');
        if (raw) sessionStorage.removeItem('ccOpenNote');
    } catch (e) { /* storage unavailable — nothing to hand over */ }
    if (!raw) return;
    try {
        const t = JSON.parse(raw);
        if (t && t.refId) window.CC_OPEN_DEAL_COMMENT(t.refId, t.commentId || '');
    } catch (e) { /* a garbled hand-off opens nothing */ }
})();

function getStoreName(url) {
    if (!url) return '';
    try {
        const h = new URL(url).hostname;
        if (h.includes('amazon')) return 'Amazon';
        if (h.includes('dyson'))  return 'Dyson';
        if (h.includes('yeti'))   return 'YETI';
        return h.replace('www.', '').split('.')[0];
    } catch (e) { return ''; }
}

const AMAZON_TAG = 'commoncents0050-20';
function copyDealCode(el, code) {
    const done = () => {
        if (el.dataset.copying) return;
        el.dataset.copying = '1';
        const orig = el.innerHTML;
        el.innerHTML = '<span class="code-clip-icon">✓</span><span class="code-main"><strong>Code copied!</strong></span><span class="code-action">PASTE AT CHECKOUT</span>';
        el.classList.add('copied');
        setTimeout(() => { el.innerHTML = orig; el.classList.remove('copied'); delete el.dataset.copying; }, 2600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done).catch(done);
    } else {
        try {
            const ta = document.createElement('textarea');
            ta.value = code; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); document.body.removeChild(ta);
        } catch (e) {}
        done();
    }
}

// ── Per-deal click counting (2026-11-12) ────────────────────────
// Every outbound tap (card "View Deal" / modal "Get This Deal") is
// counted per deal on the backend (ccClick) so the owner can see
// which deals people actually click. Fire-and-forget: it never
// delays or blocks the visitor's trip to the store.
const CC_CLICK_ENDPOINT = 'https://us-central1-giftingbutler-74395.cloudfunctions.net/ccClick';
// Views are counted separately (ccView): a view = the deal window
// was opened (see openModal); a click = an outbound tap to the store.
const CC_VIEW_ENDPOINT = 'https://us-central1-giftingbutler-74395.cloudfunctions.net/ccView';
// Submitter rewards (2026-11-13): a signed-in member's tap ALSO
// fires the counted-click beacon with their ID token — the backend
// decides whether it is a qualified click for the deal's submitter
// (never their own deal, max 3 per person per deal per day). The
// anonymous ccClick tally above is unchanged, and signed-out taps
// send nothing here.
const CC_COUNTED_CLICK_ENDPOINT = 'https://us-central1-giftingbutler-74395.cloudfunctions.net/ccCountedClick';
document.addEventListener('click', function (e) {
    const a = e.target && e.target.closest ? e.target.closest('a.view-deal-btn, a.modal-deal-btn') : null;
    if (!a) return;
    const dealId = a.getAttribute('data-deal-id');
    if (!dealId) return;
    try {
        fetch(CC_CLICK_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId: dealId }),
            keepalive: true
        }).catch(function () {});
    } catch (err) {}
    try {
        if (window.CC_AUTH && CC_AUTH.user && CC_AUTH.user() && CC_AUTH.idToken) {
            CC_AUTH.idToken().then(function (token) {
                try {
                    fetch(CC_COUNTED_CLICK_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                        body: JSON.stringify({ dealId: dealId }),
                        keepalive: true
                    }).catch(function () {});
                } catch (err) {}
            }).catch(function () {});
        }
    } catch (err) {}
});

function getAffiliateUrl(url) {
    if (!url) return '#';
    try {
        const u = new URL(url);
        if (u.hostname.includes('amazon.com') || u.hostname.includes('amzn.to')) {
            u.searchParams.set('tag', AMAZON_TAG);
            return u.toString();
        }
        return url;
    } catch (e) { return url; }
}

// ── Share a deal (owner request 2026-11-14) ─────────────────────────────
// Menu order matches Gifting Butler: Copy link FIRST, then WhatsApp,
// Email, Pinterest, then More options (native share) when the device
// offers it (owner order call 2026-11-14: copy link is the universal
// action, so it leads). The shared link is always the affiliate URL,
// so the CommonCents tag rides along wherever the deal is forwarded.
function closeShareMenu() {
    const ov = document.getElementById('share-menu-ov');
    if (ov) ov.remove();
}

function openShareMenu(deal, isFreebie) {
    if (!deal) return;
    closeShareMenu();
    // Freebies share their own brand URL VERBATIM — there is no
    // affiliate link to apply (owner, 2026-11-15) — and the share
    // text is just the freebie's title (no price to quote).
    const url = isFreebie ? (deal.url || '') : getAffiliateUrl(deal.url);
    const text = isFreebie ? deal.title : deal.title + ' \u2014 $' + deal.price + ' at CommonCents';
    const enc = encodeURIComponent;
    const ov = document.createElement('div');
    ov.id = 'share-menu-ov';
    ov.className = 'share-menu-ov';
    ov.innerHTML = `
        <div class="share-menu" role="dialog" aria-label="Share this ${isFreebie ? 'freebie' : 'deal'}">
            <div class="share-menu-head"><strong>Share this ${isFreebie ? 'freebie' : 'deal'}</strong><button type="button" class="share-menu-close" aria-label="Close">&times;</button></div>
            <button type="button" class="share-row share-copy"><span class="share-ico">\uD83D\uDD17</span><span class="share-copy-label">Copy link</span></button>
            <a class="share-row" href="https://wa.me/?text=${enc(text + ' ' + url)}" target="_blank" rel="noopener"><span class="share-ico">\uD83D\uDCAC</span>Share on WhatsApp</a>
            <a class="share-row" href="mailto:?subject=${enc(deal.title)}&body=${enc(text + '\n' + url)}"><span class="share-ico">\u2709\uFE0F</span>Share by Email</a>
            <a class="share-row" href="https://pinterest.com/pin/create/button/?url=${enc(url)}&media=${enc(deal.image || '')}&description=${enc(text)}" target="_blank" rel="noopener"><span class="share-ico">\uD83D\uDCCC</span>Pin it on Pinterest</a>
            ${navigator.share ? '<button type="button" class="share-row share-native"><span class="share-ico share-ico-dots">\u2022\u2022\u2022</span>More options</button>' : ''}
        </div>`;
    ov.addEventListener('click', (e) => { if (e.target === ov) closeShareMenu(); });
    ov.querySelector('.share-menu-close').addEventListener('click', closeShareMenu);
    ov.querySelector('.share-copy').addEventListener('click', () => {
        const label = ov.querySelector('.share-copy-label');
        const done = () => {
            if (label) label.textContent = 'Link copied!';
            setTimeout(closeShareMenu, 900);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done).catch(done);
        } else {
            try {
                const ta = document.createElement('textarea');
                ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
            } catch (e) {}
            done();
        }
    });
    const nativeBtn = ov.querySelector('.share-native');
    if (nativeBtn) nativeBtn.addEventListener('click', () => {
        try { navigator.share({ title: deal.title, text: text, url: url }).catch(() => {}); } catch (e) {}
        closeShareMenu();
    });
    const onKey = (e) => { if (e.key === 'Escape') { closeShareMenu(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
}

async function loadGoogleSheetDeals() {
    if (!SPREADSHEET_CSV_URL) return;
    try {
        const response = await fetch(SPREADSHEET_CSV_URL);
        const csvText = await response.text();
        const sheetDeals = parseCSV(csvText);
        // Add parsed deals to the main deals array
        sheetDeals.forEach(deal => {
            // Avoid duplicates
            if (!deals.some(d => d.id === deal.id)) {
                deals.unshift(deal);
            }
        });
        renderDeals();
        paintCategoryCounts();
    } catch (error) {
        console.error('Error loading Google Sheet deals:', error);
    }
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    
    // Simple CSV parser handling quotes
    const headers = parseCSVLine(lines[0]);
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = parseCSVLine(lines[i]);
        const deal = {};
        
        headers.forEach((header, index) => {
            let val = values[index] || '';
            const key = header.trim();
            if (key === 'price' || key === 'originalPrice') {
                deal[key] = parseFloat(val) || 0;
            } else if (key === 'id') {
                deal[key] = parseInt(val) || (Date.now() + i);
            } else {
                deal[key] = val;
            }
        });
        
        // Ensure required fields exist
        if (deal.title && deal.url) {
            // Ensure ID is unique/valid
            if (!deal.id) {
                deal.id = deal.title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + (deal.price || 0);
            }
            if (!deal.votes) {
                deal.votes = { up: 0, down: 0 };
            }
            results.push(deal);
        }
    }
    return results;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result.map(val => val.replace(/^"|"$/g, '').replace(/""/g, '"'));
}

document.addEventListener('DOMContentLoaded', initApp);

// ── Ad-blocker fallback ──────────────────────────────────────────────────
// If the sponsor rail isn't actually visible (an ad blocker hid it, or its
// picture failed to load), drop the rail column so the deals take the space
// back and the page looks normal instead of squeezed next to a dead gap.
(function () {
    var main = document.querySelector('.main-content');
    var rail = document.querySelector('.ad-rail');
    if (!main) return;
    function railBroken() {
        if (!rail || !document.body.contains(rail)) return true;
        if (rail.offsetHeight === 0) return true;
        var img = rail.querySelector('img');
        if (img) {
            if (img.complete && img.naturalWidth === 0) return true;
            if (img.offsetHeight === 0) return true;
        }
        return false;
    }
    function check() { if (railBroken()) main.classList.add('no-ads'); }
    var img = rail && rail.querySelector('img');
    if (img) { img.addEventListener('error', check); if (img.complete) check(); }
    window.addEventListener('load', check);
    setTimeout(check, 1500);
    setTimeout(check, 4000);
})();

// ── Sidebar scroll hint ─────────────────────────────────────────────────
// WHAT SCROLLS: the sidebar itself — .sidebar is position:sticky with
// max-height: calc(100vh - 7rem) and overflow-y: auto, and its
// scrollbar is hidden (scrollbar-width: none). So a visitor at the
// top sees Categories and part of the Weekly Giveaway box with no
// sign that the Notify Me button and Your Feed sit further down
// (owner, 2026-11-15). The hint button (index.html, styled in
// style.css) floats at the sidebar's bottom edge only while more
// content sits below the visible part; it fades away at the bottom,
// and clicking it scrolls the sidebar down by about a screen.
// Arrow only — it launched as a "More below" pill and the owner
// asked for the words gone the same day (keep the site simple).
(function () {
    var sidebar = document.querySelector('.sidebar');
    var btn = document.getElementById('sidebarScrollHint');
    if (!sidebar || !btn) return;
    // Pure decision, kept separate for the harness: more-below means
    // at least ~24px of content still hidden under the fold.
    function shouldShow(m) {
        return (m.scrollHeight - m.clientHeight - m.scrollTop) > 24;
    }
    var shown = null;
    function update() {
        var show = shouldShow(sidebar);
        if (show === shown) return; // no DOM write when nothing changed
        shown = show;
        btn.classList.toggle('show', show);
    }
    btn.addEventListener('click', function () {
        var step = Math.round(sidebar.clientHeight * 0.85);
        try {
            sidebar.scrollBy({ top: step, behavior: 'smooth' });
        } catch (e) {
            sidebar.scrollTop += step;
        }
    });
    sidebar.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // The sidebar's height changes without any scrolling when the
    // giveaway state paints or the My Feed row appears — re-check on
    // mutation. update() writes nothing when the answer is unchanged,
    // so the observer cannot loop on its own class toggle.
    if (window.MutationObserver) {
        new MutationObserver(update).observe(sidebar, {
            childList: true, subtree: true, attributes: true,
            attributeFilter: ['style', 'class']
        });
    }
    window.CC_SIDEBAR_HINT = { shouldShow: shouldShow, update: update };
    update();
})();

// ── Phone header: hamburger + menu panel ────────────────────────────────
// Owner (2026-11-15, from his SlickDeals screenshot): on phones the
// header + nav strip ate too much of the screen. The strip is gone
// (style.css); the top row is the logo on the left and the bare
// hamburger lines on the RIGHT — since the second redesign the same
// day, the lines are the ONLY control up there: the bell and the
// avatar left the top row, and this panel (a full-height scrolling
// drawer from the right) is the one menu, holding — in the order
// the owner settled in the third pass the same day — My Feed, the
// expandable Deals section (All Deals, the categories, Free Stuff,
// Saved — each with its count), the Weekly Giveaway row (with its
// small state line), the Notifications row, the account group, the
// page links and Sign out. Category taps filter through the same setCategory
// wiring as the strip and the sidebar (the panel's links are in
// app.js's navLinks); this block owns the panel's open/close and
// the Deals section's expand/collapse. On phone widths auth.js
// moves the real account menu + notes panel INTO this panel and
// opening the panel hands over to it (CC_PHONE_MENU) so the
// account block paints itself; everywhere else, opening the panel
// closes the account menu and the notes panel (one header popover
// at a time), and auth.js closes this panel when either opens.
(function () {
    var btn = document.getElementById('mobileMenuBtn');
    var panel = document.getElementById('mobileNavPanel');
    if (!btn || !panel) return;
    function isOpen() { return panel.style.display !== 'none'; }
    function close() {
        panel.style.display = 'none';
        btn.setAttribute('aria-expanded', 'false');
    }
    function open() {
        if (window.CC_PHONE_MENU && window.CC_PHONE_MENU.active()) {
            // Phone layout: the account menu + notes live inside
            // this panel now — let auth.js paint the account block
            // (and tuck the notes away until their row is tapped).
            window.CC_PHONE_MENU.onPanelOpen();
        } else {
            var menu = document.getElementById('authMenu');
            if (menu) menu.style.display = 'none';
            var notes = document.getElementById('notesPanel');
            if (notes) notes.style.display = 'none';
        }
        panel.style.display = '';
        btn.setAttribute('aria-expanded', 'true');
    }
    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (isOpen()) close(); else open();
    });
    var closeBtn = document.getElementById('mobileNavClose');
    if (closeBtn) closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        close();
    });
    // Deals ▾: the section starts tucked away (SlickDeals-style
    // grouping, not one long flat list); the arrow row opens it.
    var dealsBtn = document.getElementById('mobileDealsToggle');
    var dealsSec = document.getElementById('mobileDealsSection');
    if (dealsBtn && dealsSec) dealsBtn.addEventListener('click', function () {
        var nowOpen = dealsSec.style.display !== 'none';
        dealsSec.style.display = nowOpen ? 'none' : '';
        dealsBtn.setAttribute('aria-expanded', nowOpen ? 'false' : 'true');
    });
    // Any tap on a panel link has done its job (a category filtered,
    // a page is loading) — the panel tucks away behind it.
    panel.addEventListener('click', function (e) {
        if (e.target.closest('a')) close();
    });
    // The panel's Weekly Giveaway row is a panel link like any
    // other, so the tap-to-close handler above already tucks the
    // panel away behind the giveaway modal it opens.
    document.addEventListener('click', function (e) {
        if (isOpen() && !e.target.closest('#mobileNavPanel') && !e.target.closest('#mobileMenuBtn')) close();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
    });
    window.CC_MOBILE_NAV = { open: open, close: close, isOpen: isOpen };
})();
