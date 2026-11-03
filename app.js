// State
let currentCategory = 'all';

// This visitor's own votes (deal id -> 'up' | 'down'), remembered on this
// device. The active button state must reflect MY vote, not the shared
// totals — otherwise a first click on a deal that already has votes
// removes one instead of adding mine.
let myVotes = {};
try { myVotes = JSON.parse(localStorage.getItem('ccMyVotes') || '{}'); } catch (e) { myVotes = {}; }
function saveMyVotes() { try { localStorage.setItem('ccMyVotes', JSON.stringify(myVotes)); } catch (e) {} }
let searchQuery = '';

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
            const category = e.target.dataset.category;
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
                        giveawaySubmitBtn.textContent = "Enter This Week's Drawing";
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
                        giveawaySubmitBtn.textContent = "Enter This Week's Drawing";
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
                giveawaySubmitBtn.textContent = "Enter This Week's Drawing";
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
    renderDeals();
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
    if (filtered.length === 0) {
        dealGrid.innerHTML = '<div class="no-results">No deals found matching your criteria.</div>';
        return;
    }
    filtered.forEach(deal => dealGrid.appendChild(createDealCard(deal)));
}

function createDealCard(deal) {
    const article = document.createElement('article');
    const expired = isDealExpired(deal);
    article.className = 'deal-card' + (expired ? ' deal-expired' : '');
    const postedDate = deal.ts ? new Date(deal.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

    article.innerHTML = `
        <div class="card-image">
            <img src="${deal.image}" alt="${deal.title}" loading="lazy">
            ${expired ? '<span class="expired-badge">EXPIRED</span>' : ((window.CC_FEED && CC_FEED.isNew(deal)) ? '<span class="new-badge">NEW FOR YOU</span>' : '')}
        </div>
        <div class="card-content">
            <div class="card-meta">
                <span class="card-category">${deal.category}</span>
                <span class="card-source">${getStoreName(deal.url)}</span>
                ${postedDate ? `<span class="card-date">Posted ${postedDate}</span>` : ''}
            </div>
            <h3 class="card-title">${deal.title}</h3>
            ${deal.description ? `<p class="card-desc">${deal.description}</p>` : ''}
            <div class="card-price">
                ${expired ? `<span class="expired-price">$${deal.price}</span>` : `$${deal.price}`}
                ${!expired && deal.originalPrice ? `<span class="original-price">$${deal.originalPrice}</span>` : ''}
                ${!expired && deal.discount ? `<span class="discount-badge">${deal.discount}% OFF</span>` : ''}
            </div>
            ${!expired && deal.code ? `<div class="deal-code-tag">✂ Promo code — tap deal to get it</div>` : ''}
            ${!expired && deal.dealNote ? `<div class="deal-note-tag">✂ Coupon to clip on Amazon — tap deal for details</div>` : ''}
            ${expired
                ? `<span class="btn btn-primary full-width view-deal-btn expired-btn" style="margin-bottom:1rem;">Deal Expired</span>`
                : `<a href="${getAffiliateUrl(deal.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary full-width view-deal-btn" style="margin-bottom:1rem;">View Deal</a>`}
            ${expired && deal.deadNote ? `<p class="dead-note">${deal.deadNote}</p>` : ''}
            <div class="vote-container" style="border-top:none; padding-top:0;">
                <button class="vote-btn upvote-btn ${myVotes[deal.id] === 'up' ? 'active' : ''}" data-id="${deal.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    <span>${deal.votes.up}</span>
                </button>
                <button class="vote-btn downvote-btn ${myVotes[deal.id] === 'down' ? 'active' : ''}" data-id="${deal.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                    <span>${deal.votes.down}</span>
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

    // Toggle MY vote (tracked per visitor, not by the shared totals)
    const mine = myVotes[deal.id];
    if (mine === type) {
        deal.votes[type]--;
        delete myVotes[deal.id];
        btn.classList.remove('active');
    } else {
        if (mine === otherType) {
            deal.votes[otherType]--;
            otherBtn.classList.remove('active');
            otherCount.textContent = deal.votes[otherType];
        }
        deal.votes[type]++;
        myVotes[deal.id] = type;
        btn.classList.add('active');
        btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
    }
    saveMyVotes();
    countSpan.textContent = deal.votes[type];
}



function openModal(deal) {
    if (!deal.comments) deal.comments = [];
    const commentsHTML = deal.comments.map(c => `
        <div style="margin-bottom:1rem; padding-bottom:1rem; border-bottom:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                <strong style="color:var(--text-primary);">${c.user}</strong>
                <span style="color:var(--text-secondary); font-size:0.85rem;">${c.time}</span>
            </div>
            <p style="color:var(--text-secondary); font-size:0.95rem; white-space:pre-wrap;">${c.text}</p>
        </div>`).join('');

    // Comments are members-only (no anonymous free-for-all). A signed-in user
    // comments under the username saved on their account — falling back to
    // their account display name, then "Member". Their email is never shown.
    // Signed-out visitors see a sign-in prompt instead of a form.
    const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ccUser = (window.CC_AUTH && typeof CC_AUTH.user === 'function') ? CC_AUTH.user() : null;
    const ccProfileName = (ccUser && typeof CC_AUTH.username === 'function') ? (CC_AUTH.username() || '') : '';
    const ccDisplayName = ccUser ? (ccProfileName || ccUser.displayName || 'Member') : null;
    const commentFormHTML = ccUser ? `
                        <p style="margin-bottom:0.5rem; color:var(--text-secondary); font-size:0.9rem;">Commenting as <strong style="color:var(--text-primary);">${escHtml(ccDisplayName)}</strong> <button type="button" id="commentNameEdit" style="background:none; border:none; color:var(--highlight); cursor:pointer; font-size:0.82rem; font-weight:600; padding:0; margin-left:0.35rem;">${ccProfileName ? 'Change name' : 'Set a comment name'}</button></p>
                        <div id="commentNameEditor" style="display:none; margin-bottom:0.6rem;">
                            <input type="text" id="commentNameInput" maxlength="24" placeholder="Pick a name for your comments" value="${escHtml(ccProfileName)}" style="width:100%; padding:0.5rem; margin-bottom:0.4rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
                            <button type="button" id="commentNameSave" class="btn btn-primary" style="font-size:0.85rem; padding:0.4rem 1rem;">Save name</button>
                            <p id="commentNameMsg" style="display:none; font-size:0.8rem; color:#ef4444; margin-top:0.35rem;"></p>
                        </div>
                        <textarea id="commentText" rows="2" placeholder="Your comment..." style="width:100%; padding:0.5rem; margin-bottom:0.5rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-family:inherit;"></textarea>
                        <button id="postCommentBtn" class="btn btn-primary full-width" style="font-size:0.9rem; padding:0.5rem;">Post Comment</button>
                        <p style="font-size:0.78rem; color:var(--text-secondary); margin-top:0.4rem;">Comments show your comment name — never your email address.</p>`
        : `
                        <div style="text-align:center; padding:0.4rem 0;">
                            <p style="color:var(--text-secondary); margin-bottom:0.75rem;">Comments are for members — sign in to join the conversation.</p>
                            <button type="button" id="commentSignInBtn" class="btn btn-primary full-width" style="font-size:0.9rem; padding:0.5rem;">Sign in to comment</button>
                        </div>`;

    modalBody.innerHTML = `
        <div class="modal-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
            <div><img src="${deal.image}" alt="${deal.title}" style="width:100%; border-radius:8px;"></div>
            <div>
                <div class="card-category">${deal.category}</div>
                <h2 style="margin:0.5rem 0 1rem;">${deal.title}</h2>
                <p style="color:var(--text-secondary); margin-bottom:1.5rem; line-height:1.7;">${deal.description}</p>
                <div class="card-price" style="font-size:2rem; margin-bottom:1.5rem;">
                    $${deal.price}
                    ${deal.originalPrice ? `<span class="original-price" style="font-size:1.2rem;">$${deal.originalPrice}</span>` : ''}
                </div>
                ${deal.dealNote ? `<div class="deal-note"><strong>How to get this price:</strong> ${deal.dealNote}</div>` : ''}
                ${deal.code ? `<div class="deal-code" role="button" tabindex="0" title="Tap to copy the code"><span class="code-clip-icon">✂</span><span class="code-main">Use code <strong>${deal.code}</strong></span><span class="code-action">TAP TO COPY</span></div><p class="code-helper">Copy the code, then tap Get This Deal and paste it at checkout.</p>` : ''}
                <a href="${getAffiliateUrl(deal.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary full-width modal-deal-btn" style="margin-bottom:1.5rem;">Get This Deal</a>
                <div class="vote-container" style="margin-bottom:1.5rem;">
                    <button class="vote-btn upvote-btn ${myVotes[deal.id] === 'up' ? 'active' : ''}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                        <span>${deal.votes.up}</span>
                    </button>
                    <button class="vote-btn downvote-btn ${myVotes[deal.id] === 'down' ? 'active' : ''}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                        <span>${deal.votes.down}</span>
                    </button>
                </div>
                <div style="border-top:1px solid var(--border-color); padding-top:1.5rem;">
                    <h3 style="margin-bottom:1rem;">Comments</h3>
                    <div id="commentsList" style="max-height:150px; overflow-y:auto; margin-bottom:1rem; padding-right:0.5rem;">${commentsHTML}</div>
                    <div style="background:var(--bg-body); padding:1rem; border-radius:8px;">
                        ${commentFormHTML}
                    </div>
                </div>
            </div>
        </div>`;

    if (window.innerWidth < 768) modalBody.querySelector('.modal-grid').style.gridTemplateColumns = '1fr';
    modal.style.display = 'flex';

    modalBody.querySelector('.upvote-btn').addEventListener('click',   (e) => handleVote(e, deal, 'up'));
    modalBody.querySelector('.downvote-btn').addEventListener('click',  (e) => handleVote(e, deal, 'down'));

    const modalCode = modalBody.querySelector('.deal-code');
    if (modalCode) {
        modalCode.addEventListener('click', () => copyDealCode(modalCode, deal.code));
        modalCode.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copyDealCode(modalCode, deal.code); } });
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
            const liveName = (typeof CC_AUTH.username === 'function' && CC_AUTH.username()) || liveUser.displayName || 'Member';
            // Chronological order: the first comment stays on top, new ones go last.
            deal.comments.push({ user: escHtml(liveName).slice(0, 40), text: escHtml(textVal), time: 'Just now' });
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

    const nameEditBtn = document.getElementById('commentNameEdit');
    if (nameEditBtn) {
        nameEditBtn.addEventListener('click', () => {
            const ed = document.getElementById('commentNameEditor');
            if (ed) ed.style.display = ed.style.display === 'none' ? '' : 'none';
        });
    }

    const nameSaveBtn = document.getElementById('commentNameSave');
    if (nameSaveBtn) {
        nameSaveBtn.addEventListener('click', () => {
            const inp = document.getElementById('commentNameInput');
            const msg = document.getElementById('commentNameMsg');
            const v = (inp && inp.value || '').trim();
            if (!/^[A-Za-z0-9_.\- ]{3,24}$/.test(v)) {
                if (msg) { msg.textContent = 'Use 3–24 characters: letters, numbers, spaces, dots, dashes or underscores.'; msg.style.display = ''; }
                return;
            }
            nameSaveBtn.disabled = true;
            CC_AUTH.setUsername(v).then(() => { openModal(deal); }).catch(() => {
                nameSaveBtn.disabled = false;
                if (msg) { msg.textContent = 'Could not save that name — try again.'; msg.style.display = ''; }
            });
        });
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
