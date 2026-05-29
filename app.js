// State
let currentCategory = 'all';
let searchQuery = '';

// Weekly Tracking Helpers
function getWeeklyKey(base) {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 4 - (d.getDay()||7));
    const yearStart = new Date(d.getFullYear(),0,1);
    const weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return base + '_' + d.getFullYear() + '_W' + weekNo;
}
function getGiveawayEntries() { return JSON.parse(localStorage.getItem(getWeeklyKey('giveawayEntries')) || '[]'); }
function setGiveawayEntries(entries) { localStorage.setItem(getWeeklyKey('giveawayEntries'), JSON.stringify(entries)); }
function getMyEmail() { return localStorage.getItem(getWeeklyKey('giveawayMyEmail')); }
function setMyEmail(email) { localStorage.setItem(getWeeklyKey('giveawayMyEmail'), email); }

// Prize amount scales with entries
function calculatePrize(count) {
    if (count >= 10000) return '$100';
    if (count >= 5000)  return '$75';
    if (count >= 1000)  return '$50';
    if (count >= 250)   return '$25';
    if (count >= 100)   return '$10';
    return '$5';
}

// Update giveaway entry count and prize display
function updateEntryCount() {
    const entries = getGiveawayEntries();
    const countEl = document.getElementById('entryCount');
    const prizeEl = document.getElementById('prizeAmount');
    const tiers   = document.querySelectorAll('.prize-tier');
    const prize   = calculatePrize(entries.length);
    if (countEl) countEl.textContent = entries.length;
    if (prizeEl) prizeEl.textContent = prize;
    if (tiers.length) {
        const map = { '$5': 0, '$10': 1, '$25': 2, '$50': 3, '$75': 4, '$100': 5 };
        tiers.forEach((t, i) => t.classList.toggle('active', i === map[prize]));
    }
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

    // Restore saved theme (default is dark — only apply light if explicitly saved)
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
    }
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
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
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

    function openGiveawayModal(e) {
        if (e) e.preventDefault();
        updateEntryCount();
        const myEmail = getMyEmail();
        const entries = getGiveawayEntries();
        if (myEmail && entries.includes(myEmail)) {
            document.getElementById('giveawayForm').style.display    = 'none';
            document.getElementById('giveawaySuccess').style.display = 'block';
        } else {
            document.getElementById('giveawayForm').style.display    = 'block';
            document.getElementById('giveawaySuccess').style.display = 'none';
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
            const email      = emailInput.value.trim().toLowerCase();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailRegex.test(email)) {
                emailInput.style.borderColor = '#ef4444';
                emailInput.focus();
                return;
            }
            emailInput.style.borderColor = '';

            // Save unique email
            const entries = getGiveawayEntries();
            if (!entries.includes(email)) {
                entries.push(email);
                setGiveawayEntries(entries);
            }
            setMyEmail(email);

            updateEntryCount();
            document.getElementById('giveawayForm').style.display    = 'none';
            document.getElementById('giveawaySuccess').style.display = 'block';

            
        });
    }

    // Submit Deal Button
    const submitDealBtn = document.getElementById('submitDealBtn');
    if (submitDealBtn) submitDealBtn.addEventListener('click', openSubmitDealModal);

    // Quick Post Button
    const quickPostBtn = document.getElementById('quickPostBtn');
    if (quickPostBtn) {
        quickPostBtn.addEventListener('click', () => {
            const input = document.getElementById('quickLinkInput');
            let url = input.value.trim();
            if (!url) {
                alert('⚠️ Please paste a link first!');
                return;
            }
            // Ensure affiliate tag is appended if it's an amazon link
            url = getAffiliateUrl(url);

            // Open a beautiful pre-filled simplified submit modal
            openQuickSubmitModal(url);
            input.value = ''; // clear input
        });
    }
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
                            <option value="gifts-him">Gifts for Him</option>
                            <option value="gifts-her">Gifts for Her</option>
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
function renderDeals() {
    dealGrid.innerHTML = '';
    let filtered = deals.filter(deal => {
        const matchCat    = currentCategory === 'all' || deal.category === currentCategory;
        const matchSearch = deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            deal.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
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
    if (filtered.length === 0) {
        dealGrid.innerHTML = '<div class="no-results">No deals found matching your criteria.</div>';
        return;
    }
    filtered.forEach(deal => dealGrid.appendChild(createDealCard(deal)));
}

function createDealCard(deal) {
    const article = document.createElement('article');
    article.className = 'deal-card';
    
    article.innerHTML = `
        <div class="card-image">
            <img src="${deal.image}" alt="${deal.title}" loading="lazy">
        </div>
        <div class="card-content">
            <div class="card-meta">
                <span class="card-category">${deal.category.replace('gifts-him','Gifts for Him').replace('gifts-her','Gifts for Her')}</span>
                <span class="card-source">${getStoreName(deal.url)}</span>
            </div>
            <h3 class="card-title">${deal.title}</h3>
            <div class="card-price">
                $${deal.price}
                ${deal.originalPrice ? `<span class="original-price">$${deal.originalPrice}</span>` : ''}
                ${deal.discount ? `<span class="discount-badge">${deal.discount}</span>` : ''}
            </div>
            <a href="${getAffiliateUrl(deal.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary full-width view-deal-btn" style="margin-bottom:1rem;">View Deal</a>
            <div class="vote-container" style="border-top:none; padding-top:0;">
                <button class="vote-btn upvote-btn ${deal.votes.up > 0 ? 'active' : ''}" data-id="${deal.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    <span>${deal.votes.up}</span>
                </button>
                <button class="vote-btn downvote-btn ${deal.votes.down > 0 ? 'active' : ''}" data-id="${deal.id}">
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

    // If already active, toggle off
    if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        deal.votes[type]--;
    } else {
        if (otherBtn.classList.contains('active')) {
            otherBtn.classList.remove('active');
            deal.votes[otherType]--;
            otherCount.textContent = deal.votes[otherType];
        }
        btn.classList.add('active');
        deal.votes[type]++;
    }
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

    modalBody.innerHTML = `
        <div class="modal-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
            <div><img src="${deal.image}" alt="${deal.title}" style="width:100%; border-radius:8px;"></div>
            <div>
                <div class="card-category">${deal.category.replace('gifts-him','Gifts for Him').replace('gifts-her','Gifts for Her')}</div>
                <h2 style="margin:0.5rem 0 1rem;">${deal.title}</h2>
                <p style="color:var(--text-secondary); margin-bottom:1.5rem; line-height:1.7;">${deal.description}</p>
                <div class="card-price" style="font-size:2rem; margin-bottom:1.5rem;">
                    $${deal.price}
                    ${deal.originalPrice ? `<span class="original-price" style="font-size:1.2rem;">$${deal.originalPrice}</span>` : ''}
                </div>
                <a href="${getAffiliateUrl(deal.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary full-width modal-deal-btn" style="margin-bottom:1.5rem;">Get This Deal</a>
                <div class="vote-container" style="margin-bottom:1.5rem;">
                    <button class="vote-btn upvote-btn ${deal.votes.up > 0 ? 'active' : ''}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                        <span>${deal.votes.up}</span>
                    </button>
                    <button class="vote-btn downvote-btn ${deal.votes.down > 0 ? 'active' : ''}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                        <span>${deal.votes.down}</span>
                    </button>
                </div>
                <div style="border-top:1px solid var(--border-color); padding-top:1.5rem;">
                    <h3 style="margin-bottom:1rem;">Comments</h3>
                    <div style="max-height:150px; overflow-y:auto; margin-bottom:1rem; padding-right:0.5rem;">${commentsHTML}</div>
                    <div style="background:var(--bg-body); padding:1rem; border-radius:8px;">
                        <input type="email" id="commentEmail" placeholder="Your email (required)" style="width:100%; padding:0.5rem; margin-bottom:0.5rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
                        <textarea id="commentText" rows="2" placeholder="Your comment..." style="width:100%; padding:0.5rem; margin-bottom:0.5rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-family:inherit;"></textarea>
                        <button id="postCommentBtn" class="btn btn-primary full-width" style="font-size:0.9rem; padding:0.5rem;">Post Comment</button>
                    </div>
                </div>
            </div>
        </div>`;

    if (window.innerWidth < 768) modalBody.querySelector('.modal-grid').style.gridTemplateColumns = '1fr';
    modal.style.display = 'flex';

    modalBody.querySelector('.upvote-btn').addEventListener('click',   (e) => handleVote(e, deal, 'up'));
    modalBody.querySelector('.downvote-btn').addEventListener('click',  (e) => handleVote(e, deal, 'down'));

    document.getElementById('postCommentBtn').addEventListener('click', () => {
        const emailVal = document.getElementById('commentEmail').value.trim();
        const textVal  = document.getElementById('commentText').value.trim();
        if (!emailVal || !textVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
            alert('⚠️ Please enter a valid email and comment.');
            return;
        }
        deal.comments.unshift({ user: emailVal.split('@')[0], text: textVal, time: 'Just now' });
        openModal(deal);
    });
}

function openQuickSubmitModal(url) {
    const store = getStoreName(url) || 'Store';
    modalBody.innerHTML = `
        <div style="max-width:500px; margin:0 auto; padding-bottom:1.5rem;">
            <h2 style="margin-bottom:0.5rem; text-align:center; color:var(--text-primary); font-family:var(--font-display);">Quick Generate Deal</h2>
            <p style="color:var(--text-secondary); font-size:0.9rem; text-align:center; margin-bottom:1.5rem;">We'll automatically set up the affiliate tracking link for ${store}. Just fill out the title & price below!</p>
            <form id="quickSubmissionForm">
                <div style="margin-bottom:1rem;">
                    <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary); font-size:0.9rem;">Product Title</label>
                    <input type="text" id="quickTitle" required placeholder="e.g., Echo Dot (5th Gen) Smart Speaker" style="width:100%; padding:0.75rem; border-radius:9999px !important; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary); outline:none;">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem;">
                    <div>
                        <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary); font-size:0.9rem;">Deal Price ($)</label>
                        <input type="number" step="0.01" id="quickPrice" required placeholder="39.99" style="width:100%; padding:0.75rem; border-radius:9999px !important; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary); outline:none;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary); font-size:0.9rem;">Category</label>
                        <select id="quickCategory" style="width:100%; padding:0.75rem; border-radius:9999px !important; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary); outline:none; height:45px;">
                            <option value="tech">Tech</option>
                            <option value="tools">Tools</option>
                            <option value="household">Household</option>
                            <option value="groceries">Groceries</option>
                            <option value="gifts-him">Gifts for Him</option>
                            <option value="gifts-her">Gifts for Her</option>
                        </select>
                    </div>
                </div>
                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; margin-bottom:0.5rem; color:var(--text-secondary); font-size:0.9rem;">Optional Image URL (or leave blank for generic placeholder)</label>
                    <input type="url" id="quickImage" placeholder="https://..." style="width:100%; padding:0.75rem; border-radius:9999px !important; border:1px solid var(--border-color); background:var(--bg-body); color:var(--text-primary); outline:none;">
                </div>
                <button type="submit" class="btn btn-primary full-width" style="border-radius:9999px !important; padding:0.75rem; font-weight:700;">Publish to Website</button>
            </form>
        </div>`;
    modal.style.display = 'flex';
    document.getElementById('quickSubmissionForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('quickTitle').value.trim();
        const priceVal = parseFloat(document.getElementById('quickPrice').value);
        const category = document.getElementById('quickCategory').value;
        let image = document.getElementById('quickImage').value.trim();
        
        // If image is blank, assign a beautiful high-quality generic placeholder based on the category!
        if (!image) {
            const placeholders = {
                tech: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop",
                tools: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=500&auto=format&fit=crop",
                household: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=500&auto=format&fit=crop",
                groceries: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop",
                "gifts-him": "https://images.unsplash.com/photo-1508962914676-134849a727f0?w=500&auto=format&fit=crop",
                "gifts-her": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=500&auto=format&fit=crop"
            };
            image = placeholders[category] || "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=500&auto=format&fit=crop";
        }

        const newDeal = {
            id: Date.now(),
            title,
            price: priceVal,
            originalPrice: Math.round(priceVal * 1.25),
            discount: "20% OFF",
            image,
            category,
            votes: { up: 1, down: 0 },
            url,
            description: `Great deal on ${title} at ${store}! Generated via fast Associates link submit.`,
        };

        // Add to active deals memory
        deals.unshift(newDeal);

        // Save to customDeals localStorage to persist permanently
        const customDeals = JSON.parse(localStorage.getItem('customDeals') || '[]');
        customDeals.unshift(newDeal);
        localStorage.setItem('customDeals', JSON.stringify(customDeals));

        renderDeals();
        modal.style.display = 'none';
    });
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

document.addEventListener('DOMContentLoaded', initApp);
