// State
let currentCategory = 'all';

// This visitor's own votes (deal id -> 'up' | 'down'), remembered on this
// device. The active button state must reflect MY vote, not the shared
// totals — otherwise a first click on a deal that already has votes
// removes one instead of adding mine.
let myVotes = {};
try { myVotes = JSON.parse(localStorage.getItem('ccMyVotes') || '{}'); } catch (e) { myVotes = {}; }
function saveMyVotes() { try { localStorage.setItem('ccMyVotes', JSON.stringify(myVotes)); } catch (e) {} }
// Displayed count = the deal's stored tally + my own vote if I cast it.
// The stored tallies reset on every page load but myVotes persists, so the
// counts must be DERIVED, never mutated — mutating them let a returning
// visitor's switch subtract a vote that wasn't in the count (totals hit -1).
function voteCount(deal, type) { return (deal.votes[type] || 0) + (myVotes[deal.id] === type ? 1 : 0); }
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
    if (count >= 5000)  return '$75';
    if (count >= 1000)  return '$50';
    if (count >= 250)   return '$25';
    if (count >= 100)   return '$10';
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
        const map = { '$5': 0, '$10': 1, '$25': 2, '$50': 3, '$75': 4, '$100': 5 };
        tiers.forEach((t, i) => t.classList.toggle('active', i === map[prize]));
    }
    const side = document.getElementById('sidebarPrize');
    if (side) side.textContent = prize + ' prize · ' + count + ' people entered · grows with entries';
    // Progress toward the next prize tier + a plain-words "how many more" line.
    const fill = document.getElementById('prizeProgressFill');
    const next = document.getElementById('prizeNext');
    const LADDER = [[0, '$5'], [100, '$10'], [250, '$25'], [1000, '$50'], [5000, '$75'], [10000, '$100']];
    let cur = LADDER[0], nxt = null;
    for (let i = 0; i < LADDER.length; i++) {
        if (count >= LADDER[i][0]) { cur = LADDER[i]; nxt = LADDER[i + 1] || null; }
    }
    if (fill) fill.style.width = nxt ? Math.min(100, Math.round(((count - cur[0]) / (nxt[0] - cur[0])) * 100)) + '%' : '100%';
    if (next) next.textContent = nxt
        ? (nxt[0] - count) + ' more ' + (nxt[0] - count === 1 ? 'person' : 'people') + ' and the prize jumps to ' + nxt[1] + '!'
        : 'Top prize reached — good luck on Sunday!';
}

// DOM Elements
const dealGrid      = document.getElementById('dealGrid');
const searchInput   = document.getElementById('searchInput');
const searchBtn     = document.getElementById('searchBtn');
const navLinks      = document.querySelectorAll('.nav-link:not(.giveaway-nav-link)'); // exclude giveaway btn
const categoryLinks = document.querySelectorAll('.category-list a');
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
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
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
    const closeGiveaway     = document.getElementById('closeGiveaway');
    const giveawaySubmitBtn = document.getElementById('giveawaySubmitBtn');

    function showGwSuccess(already) {
        document.getElementById('giveawayForm').style.display    = 'none';
        document.getElementById('giveawaySuccess').style.display = 'block';
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
        const emIn = document.getElementById('giveawayEmail');
        const note = document.getElementById('giveawayAccountNote');
        const signedIn = !!(window.CC_AUTH && CC_AUTH.user && CC_AUTH.user());
        if (emIn && note) {
            if (signedIn) {
                emIn.style.display = 'none';
                note.textContent = "You're signed in as " + CC_AUTH.email() + " — one tap enters you with that email.";
                note.style.display = 'block';
            } else {
                emIn.style.display = '';
                note.style.display = 'none';
            }
        }
        giveawayModal.style.display = 'flex';
    }

    if (openGiveaway)     openGiveaway.addEventListener('click', openGiveawayModal);
    if (openGiveawaySide) openGiveawaySide.addEventListener('click', openGiveawayModal);
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
            const email      = emailInput.value.trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(email)) {
                emailInput.style.borderColor = '#ef4444';
                emailInput.focus();
                return;
            }
            emailInput.style.borderColor = '';

            const errEl = document.getElementById('giveawayError');
            if (errEl) errEl.style.display = 'none';

            if (!window.CC_GW || !CC_GW.ready()) {
                if (errEl) {
                    errEl.textContent = "Entries can't be taken right now — please try again later.";
                    errEl.style.display = 'block';
                }
                return;
            }

            giveawaySubmitBtn.disabled = true;
            giveawaySubmitBtn.textContent = 'Entering…';
            CC_GW.enter(email).then((res) => {
                giveawaySubmitBtn.disabled = false;
                giveawaySubmitBtn.textContent = "Enter This Week's Giveaway";
                if (res === 'entered' || res === 'already') {
                    updateEntryCount();
                    showGwSuccess(res === 'already');
                } else if (errEl) {
                    errEl.textContent = 'Something went wrong entering you — please try again.';
                    errEl.style.display = 'block';
                }
            });

            
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
}

// Sidebar category counts: each Categories row shows how many LIVE
// deals it holds right now ("All Deals" shows the total), and a
// category with none is hidden entirely. Computed from the deals
// array at page load — never hard-coded — so newly posted deals
// update the counts on the next load with no code change. The top
// nav intentionally gets no counts.
function paintCategoryCounts() {
    const tally = {};
    let total = 0;
    deals.forEach(d => {
        if (isDealExpired(d)) return;
        total++;
        tally[d.category] = (tally[d.category] || 0) + 1;
    });
    categoryLinks.forEach(link => {
        const cat = link.dataset.category;
        if (!cat) return; // the "My Feed" row — painted by tailored-feed.js
        const n = cat === 'all' ? total : (tally[cat] || 0);
        const li = link.closest('li');
        let badge = link.querySelector('.cat-count');
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
    });
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

function renderDeals() {
    dealGrid.innerHTML = '';
    let filtered = deals.filter(deal => {
        const inMyFeed    = window.CC_FEED && CC_FEED.mode() === 'mine';
        const matchCat    = inMyFeed || currentCategory === 'all' || deal.category === currentCategory;
        const matchSearch = deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            deal.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchFeed   = !window.CC_FEED || CC_FEED.match(deal);
        return matchCat && matchSearch && matchFeed;
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
        : 'nofeed';
    const filterKey = [currentCategory, searchQuery, sortValue, feedKey].join('|');
    if (filterKey !== lastFilterKey) { currentPage = 1; lastFilterKey = filterKey; }
    const totalPages = Math.ceil(filtered.length / DEALS_PER_PAGE);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    if (filtered.length === 0) {
        dealGrid.innerHTML = '<div class="no-results">No deals found matching your criteria.</div>';
        renderPagination(0);
        return;
    }
    const pageStart = (currentPage - 1) * DEALS_PER_PAGE;
    filtered.slice(pageStart, pageStart + DEALS_PER_PAGE)
        .forEach(deal => dealGrid.appendChild(createDealCard(deal)));
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
            </div>
        </div>`;

    article.addEventListener('click', (e) => {
        if (e.target.closest('a') || e.target.closest('button')) return;
        openModal(deal);
    });

    article.querySelector('.upvote-btn').addEventListener('click',   (e) => handleVote(e, deal, 'up'));
    article.querySelector('.downvote-btn').addEventListener('click',  (e) => handleVote(e, deal, 'down'));
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
    } else {
        myVotes[deal.id] = type;
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



function openModal(deal) {
    if (!deal.comments) deal.comments = [];
    window._ccOpenDealId = deal.id;
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
    // Standard solid icons (the Material shapes every site uses) — the thin
    // outline versions read as scratchy at small sizes (user's complaint).
    const cmtPencil = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
    const cmtTrash = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
    const buildCommentsHTML = () => deal.comments.map((c, idx) => `
        <div ${c.pending ? 'data-pending="1" ' : ''}style="margin-bottom:1rem; padding-bottom:1rem; border-bottom:1px solid var(--border-color);${c.pending ? ' opacity:0.6;' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <strong style="color:var(--text-primary);">${c.user}</strong>
                <span style="display:inline-flex; align-items:center;">
                    <span style="color:var(--text-secondary); font-size:0.85rem;">${c.pending ? 'Posting\u2026' : c.time}</span>
                    ${c.own && !c.pending ? `<span class="cmt-actions"><button type="button" class="cmt-act-btn" data-cact="edit" data-idx="${idx}" title="Edit comment" aria-label="Edit comment">${cmtPencil}</button><button type="button" class="cmt-act-btn del" data-cact="del" data-idx="${idx}" title="Delete comment" aria-label="Delete comment">${cmtTrash}</button></span>` : ''}
                </span>
            </div>
            ${deal._editingIdx === idx ? `
                <textarea id="commentEditText" rows="2" style="width:100%; padding:0.5rem; margin-bottom:0.4rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-family:inherit;">${c.text}</textarea>
                <div style="display:flex; gap:0.4rem;">
                    <button type="button" class="btn btn-primary" data-cact="save" data-idx="${idx}" style="font-size:0.8rem; padding:0.3rem 1rem;">Save</button>
                    <button type="button" class="btn" data-cact="cancel" data-idx="${idx}" style="font-size:0.8rem; padding:0.3rem 1rem;">Cancel</button>
                </div>` : `<p style="color:var(--text-secondary); font-size:0.95rem; white-space:pre-wrap;">${c.text}</p>`}
        </div>`).join('');

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
    const ccUser = (window.CC_AUTH && typeof CC_AUTH.user === 'function') ? CC_AUTH.user() : null;
    const ccProfileName = (ccUser && typeof CC_AUTH.username === 'function') ? (CC_AUTH.username() || '') : '';
    const ccGenName = (window.CC_AUTH && CC_AUTH.fallbackName) ? CC_AUTH.fallbackName() : '';
    const ccDisplayName = ccUser ? (ccProfileName || ccUser.displayName || ccGenName || 'Member') : null;
    const cmtInfo = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    const commentFormHTML = ccUser ? `
                        <p style="margin-bottom:0.5rem; color:var(--text-secondary); font-size:0.9rem;">Commenting as <strong style="color:var(--text-primary);">${escHtml(ccDisplayName)}</strong> <button type="button" id="commentNameInfo" class="cmt-info-btn" aria-label="About your comment name">${cmtInfo}<span class="cmt-tip" role="tooltip">You can ${ccProfileName ? 'change' : 'set'} your comment name — tap your profile circle at the top right of the page.</span></button></p>
                        <textarea id="commentText" rows="2" placeholder="Your comment..." style="width:100%; padding:0.5rem; margin-bottom:0.5rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-family:inherit;"></textarea>
                        <button id="postCommentBtn" class="btn btn-primary" style="font-size:0.88rem; padding:0.45rem 1.3rem;">Post Comment</button>
                        <p id="commentError" style="display:none; font-size:0.82rem; color:#dc2626; margin-top:0.45rem;"></p>`
        : `
                        <div style="text-align:center; padding:0.4rem 0;">
                            <p style="color:var(--text-secondary); margin-bottom:0.75rem;">Comments are for members — sign in to join the conversation.</p>
                            <button type="button" id="commentSignInBtn" class="btn btn-primary" style="font-size:0.88rem; padding:0.45rem 1.3rem;">Sign in to comment</button>
                        </div>`;

    modalBody.innerHTML = `
        <div class="modal-media-banner"><img src="${deal.image}" alt="${deal.title}"></div>
        <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-secondary); font-weight:600;">${getStoreName(deal.url)} &middot; ${deal.category}${deal.sponsored ? ' &middot; <span style="color:var(--highlight); font-weight:700;">Sponsored</span>' : ''}</div>
        <h2 style="margin:0.5rem 0 1rem;">${deal.title}</h2>
        <div class="modal-buy-row">
            <div class="card-price" style="font-size:2rem;">
                $${deal.price}
                ${deal.originalPrice ? `<span class="original-price" style="font-size:1.2rem;">$${deal.originalPrice}</span>` : ''}
                ${deal.discount ? `<span class="discount-badge">${deal.discount}% OFF</span>` : ''}
            </div>
            <a href="${getAffiliateUrl(deal.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary modal-deal-btn" data-deal-id="${deal.id}">Get This Deal</a>
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
                    <div id="commentsList" style="max-height:150px; overflow-y:auto; margin-bottom:1rem; padding-right:0.5rem;">${buildCommentsHTML()}</div>
                    <div>
                        ${commentFormHTML}
                    </div>
        </div>`;

    modal.style.display = 'flex';

    modalBody.querySelector('.upvote-btn').addEventListener('click',   (e) => handleVote(e, deal, 'up'));
    modalBody.querySelector('.downvote-btn').addEventListener('click',  (e) => handleVote(e, deal, 'down'));

    const modalCode = modalBody.querySelector('.deal-code');
    if (modalCode) {
        modalCode.addEventListener('click', () => copyDealCode(modalCode, deal.code));
        modalCode.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyDealCode(modalCode, deal.code); } });
    }

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
                const optimistic = { id: null, user: escHtml(ccDisplayName || 'Member').slice(0, 40), text: escHtml(textVal), time: 'Just now', own: true, pending: true };
                deal.comments.push(optimistic);
                const ta0 = document.getElementById('commentText');
                if (ta0) ta0.value = '';
                renderCommentsList(true);
                CC_COMMENTS.post(deal.id, textVal).then(c => {
                    if (!c) throw new Error('empty');
                    const i = deal.comments.indexOf(optimistic);
                    if (i !== -1) deal.comments.splice(i, 1, { id: c.id, user: escHtml(c.user).slice(0, 40), text: escHtml(c.text), time: fmtCommentTime(c.ts) || 'Just now', own: true });
                    if (window._ccOpenDealId === deal.id && modal.style.display !== 'none') renderCommentsList(false);
                }).catch(() => {
                    const i = deal.comments.indexOf(optimistic);
                    if (i !== -1) deal.comments.splice(i, 1);
                    if (window._ccOpenDealId === deal.id && modal.style.display !== 'none') {
                        renderCommentsList(false);
                        const ta1 = document.getElementById('commentText');
                        if (ta1) ta1.value = textVal;
                        showCommentError('Couldn\u2019t post \u2014 check your connection and try again.');
                    }
                });
                return;
            }
            const liveName = (typeof CC_AUTH.username === 'function' && CC_AUTH.username()) || liveUser.displayName || (typeof CC_AUTH.fallbackName === 'function' ? CC_AUTH.fallbackName() : '') || 'Member';
            // Chronological order: the first comment stays on top, new ones go last.
            // own:true gives the poster pencil/trash controls on their comment.
            deal.comments.push({ user: escHtml(liveName).slice(0, 40), text: escHtml(textVal), time: 'Just now', own: true });
            deal._skipLoadOnce = true;
            openModal(deal);
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
                deal._editingIdx = idx;
                deal._skipLoadOnce = true;
                openModal(deal);
            } else if (act === 'cancel') {
                delete deal._editingIdx;
                deal._skipLoadOnce = true;
                openModal(deal);
            } else if (act === 'del') {
                const c = deal.comments[idx];
                if (c && c.id && window.CC_COMMENTS) {
                    CC_COMMENTS.remove(c.id).then(() => {
                        const i2 = deal.comments.indexOf(c);
                        if (i2 !== -1) deal.comments.splice(i2, 1);
                        delete deal._editingIdx;
                        deal._skipLoadOnce = true;
                        openModal(deal);
                    }).catch(() => showCommentError('Could not delete that comment — try again.'));
                    return;
                }
                deal.comments.splice(idx, 1);
                delete deal._editingIdx;
                deal._skipLoadOnce = true;
                openModal(deal);
            } else if (act === 'save') {
                const ta = document.getElementById('commentEditText');
                const v = ta ? ta.value.trim() : '';
                if (!v || !deal.comments[idx]) return;
                const c = deal.comments[idx];
                if (c.id && window.CC_COMMENTS) {
                    CC_COMMENTS.edit(c.id, v).then(saved => {
                        c.text = escHtml(saved && saved.text ? saved.text : v);
                        delete deal._editingIdx;
                        deal._skipLoadOnce = true;
                        openModal(deal);
                    }).catch(() => showCommentError('Could not save that edit — try again.'));
                    return;
                }
                c.text = escHtml(v);
                delete deal._editingIdx;
                deal._skipLoadOnce = true;
                openModal(deal);
            }
            const cl1 = document.getElementById('commentsList');
            if (cl1) cl1.scrollTop = st;
        });
    });
    };
    bindCommentActions();

    // Stored comments: fetch the saved thread for this deal and swap it in
    // (the server is the source of truth once it answers). Skipped on the
    // re-renders that post / edit / delete trigger themselves.
    if (!skipLoadOnce && window.CC_COMMENTS) {
        const myDealId = deal.id;
        CC_COMMENTS.load(myDealId).then(list => {
            if (!Array.isArray(list)) return;
            if (window._ccOpenDealId !== myDealId || modal.style.display === 'none') return;
            deal.comments = list.map(c => ({ id: c.id, user: escHtml(c.user).slice(0, 40), text: escHtml(c.text), time: fmtCommentTime(c.ts), own: !!c.mine }));
            deal._skipLoadOnce = true;
            openModal(deal);
        }).catch(() => { /* backend unreachable: keep whatever is shown */ });
    }
}


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
