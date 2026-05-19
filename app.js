let currentCategory = 'all';
let searchQuery = '';

function calculatePrize(count) {
    if (count >= 200) return '$100';
    if (count >= 100) return '$75';
    if (count >= 50)  return '$50';
    if (count >= 25)  return '$25';
    return '$10';
}

function updateEntryCount() {
    const entries  = JSON.parse(localStorage.getItem('giveawayEntries') || '[]');
    const countEl  = document.getElementById('entryCount');
    const prizeEl  = document.getElementById('prizeAmount');
    const tiers    = document.querySelectorAll('.prize-tier');
    const prize    = calculatePrize(entries.length);
    if (countEl) countEl.textContent = entries.length;
    if (prizeEl) prizeEl.textContent = prize;
    if (tiers.length) {
        const map = { '$10': 0, '$25': 1, '$50': 2, '$75': 3, '$100': 4 };
        tiers.forEach((t, i) => t.classList.toggle('active', i === map[prize]));
    }
}

const dealGrid      = document.getElementById('dealGrid');
const searchInput   = document.getElementById('searchInput');
const searchBtn     = document.getElementById('searchBtn');
const navLinks      = document.querySelectorAll('.nav-link:not(.giveaway-nav-link)');
const categoryLinks = document.querySelectorAll('.category-list a');
const modal         = document.getElementById('dealModal');
const modalBody     = document.getElementById('modalBody');
const closeModal    = document.querySelector('#dealModal .close-modal');

function initApp() {
    lucide.createIcons();
    renderDeals();
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleSearch(); });

    [...navLinks, ...categoryLinks].forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = e.target.dataset.category;
            if (!category) return;
            setCategory(category);
        });
    });

    closeModal.addEventListener('click', () => { modal.style.display = 'none'; });
    window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    });

    const giveawayModal    = document.getElementById('giveawayModal');
    const openGiveaway     = document.getElementById('openGiveaway');
    const openGiveawaySide = document.getElementById('openGiveawaySidebar');
    const closeGiveaway    = document.getElementById('closeGiveaway');
    const submitBtn        = document.getElementById('giveawaySubmitBtn');

    function openGiveawayModal(e) {
        if (e) e.preventDefault();
        updateEntryCount();
        const myEmail = localStorage.getItem('giveawayMyEmail');
        const entries = JSON.parse(localStorage.getItem('giveawayEntries') || '[]');
        const entered = myEmail && entries.includes(myEmail);
        document.getElementById('giveawayForm').style.display    = entered ? 'none'  : 'block';
        document.getElementById('giveawaySuccess').style.display = entered ? 'block' : 'none';
        giveawayModal.style.display = 'flex';
    }

    if (openGiveaway)     openGiveaway.addEventListener('click', openGiveawayModal);
    if (openGiveawaySide) openGiveawaySide.addEventListener('click', openGiveawayModal);
    if (closeGiveaway)    closeGiveaway.addEventListener('click', () => { giveawayModal.style.display = 'none'; });
    window.addEventListener('click', (e) => { if (e.target === giveawayModal) giveawayModal.style.display = 'none'; });

    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            const emailInput = document.getElementById('giveawayEmail');
            const email      = emailInput.value.trim().toLowerCase();
            if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(email)) {
                emailInput.style.borderColor = '#ef4444';
                emailInput.focus();
                return;
            }
            emailInput.style.borderColor = '';
            const entries = JSON.parse(localStorage.getItem('giveawayEntries') || '[]');
            if (!entries.includes(email)) {
                entries.push(email);
                localStorage.setItem('giveawayEntries', JSON.stringify(entries));
            }
            localStorage.setItem('giveawayMyEmail', email);
            updateEntryCount();
            document.getElementById('giveawayForm').style.display    = 'none';
            document.getElementById('giveawaySuccess').style.display = 'block';
            for (let i = 0; i < 6; i++) {
                setTimeout(() => createConfetti(window.innerWidth / 2, window.innerHeight / 3), i * 100);
            }
        });
    }
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
        const btn = e.target.querySelector('button');
        btn.textContent = 'Submitting...';
        btn.disabled = true;
        setTimeout(() => {
            alert('Deal submitted! We will review it shortly.');
            modal.style.display = 'none';
        }, 1500);
    });
}

function handleSearch() {
    searchQuery = searchInput.value;
    renderDeals();
}

function setCategory(category) {
    currentCategory = category;
    [...navLinks, ...categoryLinks].forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = e.target.dataset.category;
            if (!category) return;
            setCategory(category);
        });
    });
    renderDeals();
}

function renderDeals() {
    dealGrid.innerHTML = '';
    const filtered = deals.filter(deal => {
        const matchCat    = currentCategory === 'all' || deal.category === currentCategory;
        const matchSearch = deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            deal.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });
    if (filtered.length === 0) {
        dealGrid.innerHTML = '<div class="no-results">No deals found matching your criteria.</div>';
        return;
    }
    filtered.forEach(deal => dealGrid.appendChild(createDealCard(deal)));
}

function friendlyCategory(cat) {
    const map = { 'gifts-him': 'Gifts for Him', 'gifts-her': 'Gifts for Her' };
    return map[cat] || cat;
}

function createDealCard(deal) {
    const article = document.createElement('article');
    article.className = 'deal-card';
    article.innerHTML = `
        <div class="card-image"><img src="${encodeURI(deal.image)}" alt="${deal.title}" loading="lazy"></div>
        <div class="card-content">
            <div class="card-meta">
                <span class="card-category">${friendlyCategory(deal.category)}</span>
                <span class="card-source">&#8226; ${getStoreName(deal.url)}</span>
            </div>
            <h3 class="card-title">${deal.title}</h3>
            <div class="card-price">
                $${deal.price}
                ${deal.originalPrice ? `<span class="original-price">$${deal.originalPrice}</span>` : ''}
                ${deal.discount ? `<span class="discount-badge">${deal.discount}</span>` : ''}
            </div>
            <a href="${getAffiliateUrl(deal.url)}" target="_blank" rel="noopener noreferrer" class="view-deal-btn full-width" style="margin-bottom:0.85rem; display:block;">View Deal</a>
            <div class="vote-container">
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
    article.querySelector('.view-deal-btn').addEventListener('click', (e) => { createConfetti(e.clientX, e.clientY); });
    article.addEventListener('click', (e) => { if (e.target.closest('a') || e.target.closest('button')) return; openModal(deal); });
    article.querySelector('.upvote-btn').addEventListener('click', (e) => handleVote(e, deal, 'up'));
    article.querySelector('.downvote-btn').addEventListener('click', (e) => handleVote(e, deal, 'down'));
    return article;
}

function handleVote(e, deal, type) {
    e.stopPropagation();
    const btn       = e.currentTarget;
    const container = btn.closest('.vote-container');
    const otherType = type === 'up' ? 'down' : 'up';
    const otherBtn  = container.querySelector(`.${otherType}vote-btn`);
    const countSpan = btn.querySelector('span');
    const otherCount = otherBtn.querySelector('span');
    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 300);
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
        if (type === 'up') {
            createSparks(btn);
            const rect = btn.getBoundingClientRect();
            createConfetti(rect.left + rect.width / 2, rect.top);
            createConfetti(rect.left + rect.width / 2, rect.top);
        }
    }
    countSpan.textContent = deal.votes[type];
}

function createSparks(btn) {
    const rect    = btn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    for (let i = 0; i < 20; i++) {
        const spark = document.createElement('div');
        spark.className = 'spark';
        const angle = 220 + Math.random() * 100, dist = 40 + Math.random() * 60;
        spark.style.setProperty('--tx', `${Math.cos(angle * Math.PI / 180) * dist}px`);
        spark.style.setProperty('--ty', `${-1 * Math.sin(angle * Math.PI / 180) * dist}px`);
        const size = 3 + Math.random() * 4;
        spark.style.width  = `${size}px`;
        spark.style.height = `${size}px`;
        spark.style.left   = `${centerX + window.scrollX}px`;
        spark.style.top    = `${centerY + window.scrollY}px`;
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 800);
    }
}

function openModal(deal) {
    if (!deal.comments) deal.comments = [];
    const commentsHTML = deal.comments.map(c => `
        <div style="max-width:500px; margin:0 auto; padding-bottom:1rem; border-bottom:1px solid var(--border-color);">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                <strong style="color:var(--text-primary);">${c.user}</strong>
                <span style="color:var(--text-secondary); font-size:0.85rem;">${c.time}</span>
            </div>
            <p style="color:var(--text-secondary); font-size:0.95rem;">${c.text}</p>
        </div>`).join('');
    modalBody.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;" id="modalGrid">
            <div><img src="${encodeURI(deal.image)}" alt="${deal.title}" style="width:100%; border-radius:8px;"></div>
            <div>
                <div class="card-category" style="display:inline-block; margin-bottom:0.5rem;">${friendlyCategory(deal.category)}</div>
                <h2 style="margin-bottom:0.75rem; font-size:1.4rem;">${deal.title}</h2>
                <p style="color:var(--text-secondary); margin-bottom:1.25rem; line-height:1.7; font-size:0.93rem;">${deal.description}</p>
                <div class="card-price" style="font-size:1.8rem; margin-bottom:1.25rem;">
                    $${deal.price}
                    ${deal.originalPrice ? `<span class="original-price" style="font-size:1rem;">$${deal.originalPrice}</span>` : ''}
                </div>
                <a href="${getAffiliateUrl(deal.url)}" target="_blank" rel="noopener noreferrer" class="view-deal-btn full-width modal-deal-btn" style="margin-bottom:1.25rem; display:block;">Get This Deal</a>
                <div class="vote-container" style="margin-bottom:1.25rem;">
                    <button class="vote-btn upvote-btn ${deal.votes.up > 0 ? 'active' : ''}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                        <span>${deal.votes.up}</span>
                    </button>
                    <button class="vote-btn downvote-btn ${deal.votes.down > 0 ? 'active' : ''}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                        <span>${deal.votes.down}</span>
                    </button>
                </div>
                <div style="border-top:1px solid var(--border-color); padding-top:1rem;">
                    <h3 style="margin-bottom:0.75rem; font-size:1rem;">Comments</h3>
                    <div id="commentsList" style="max-height:130px; overflow-y:auto; margin-bottom:0.75rem;">${commentsHTML || '<p style="color:var(--text-secondary); font-size:0.85rem;">No comments yet.</p>'}</div>
                    <div style="background:var(--bg-body); padding:0.75rem; border-radius:8px;">
                        <input type="email" id="commentEmail" placeholder="Email (required)" style="width:100%; padding:0.5rem; margin-bottom:0.5rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary);">
                        <textarea id="commentText" rows="2" placeholder="Comment text" style="width:100%; padding:0.5rem; margin-bottom:0.5rem; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-card); color:var(--text-primary); font-family:inherit;"></textarea>
                        <button id="postComment&submit" class="btn btn-primary full-width" style="font-size:0.85rem; padding:0.5rem;">Post Comment</button>
                    </div>
                </div>
            </div>
        </div>`;
    body = modalBody;
    body.querySelector('.modal-deal-btn').addEventListener('click', (e) => createConfetti(e.clientX, e.clientY));
    body.querySelector('.upvote-btn').addEventListener('click', (e) => handleVote(e, deal, 'up'));
    body.querySelector('.downvote-btn').addEventListener('click', (e) => handleVote(e, deal, 'down'));
    if (window.innerWidth < 768) document.getElementById('modalGrid').style.gridTemplateColumns = '1fr';
    modal.style.display = 'flex';
    document.getElementById('postComment&submit').addEventListener('click', () => {
        const emailVal = document.getElementById('commentEmail').value.trim();
        const textVal  = document.getElementById('commentText').value.trim();
        if (!emailVal || !textVal || !/^[^s@]+@[^s@]+.[^s@]+$/.test(emailVal)) { alert('Please enter a valid email and comment.'); return; }
        deal.comments.unshift({ user: emailVal.split('@')[0], text: textVal, time: 'Just now' });
        openModal(deal);
    });
}

function createConfetti(x, y) {
    const colors = ['#d4af37', '#cbd5e1', '#3b82f6', '#f8fafc', '#f472b6', '#34d399'];
    for (let i = 0; i < 30; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = x + 'px';
        c.style.top  = y + 'px';
        c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        c.style.setProperty('--tx', `${(Math.random() - 0.5) * 350}px`);
        c.style.setProperty('--ty', `${(Math.random() - 0.5) * 350}px`);
        c.style.setProperty('--rotation', `${Math.random() * 720}deg`);
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 1000);
    }
}

function getStoreName(url) {
    if (!url) return '';
    try {
        const h = new URL(url).hostname;
        if (h.includes('amazon')) return 'Amazon';
        if (h.includes('yeti'))   return 'YETI';
        if (h.includes('dyson'))  return 'Dyson';
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
