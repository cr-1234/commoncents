// State
let currentCategory = 'all';
let searchQuery = '';

// Update giveaway entry count display
function updateEntryCount() {
    const entries = JSON.parse(localStorage.getItem('giveawayEntries') || '[]');
    const el = document.getElementById('entryCount');
    if (el) el.textContent = entries.length;
}

// DOM Elements
const dealGrid = document.getElementById('dealGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const navLinks = document.querySelectorAll('.nav-link');
const categoryLinks = document.querySelectorAll('.category-list a');
const modal = document.getElementById('dealModal');
const modalBody = document.getElementById('modalBody');
const closeModal = document.querySelector('.close-modal');

// Initialize
function initApp() {
    renderDeals();
    setupEventListeners();
    lucide.createIcons();
    updateEntryCount();
}

// Event Listeners
function setupEventListeners() {
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    [...navLinks, ...categoryLinks].forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const category = e.target.dataset.category;
            setCategory(category);
        });
    });

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = themeToggle.querySelector('.sun-icon');
    const moonIcon = themeToggle.querySelector('.moon-icon');

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        sunIcon.style.display = isLight ? 'none' : 'inline';
        moonIcon.style.display = isLight ? 'inline' : 'none';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });

    // Restore saved theme
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'inline';
    }

    // Giveaway modal
    const giveawayModal = document.getElementById('giveawayModal');
    const openGiveaway = document.getElementById('openGiveaway');
    const openGiveawaySidebar = document.getElementById('openGiveawaySidebar');
    const closeGiveaway = document.getElementById('closeGiveaway');
    const giveawaySubmitBtn = document.getElementById('giveawaySubmitBtn');

    function openGiveawayModal(e) {
        if (e) e.preventDefault();
        giveawayModal.style.display = 'flex';
        const entries = JSON.parse(localStorage.getItem('giveawayEntries') || '[]');
        const myEmail = localStorage.getItem('giveawayMyEmail');
        if (myEmail && entries.includes(myEmail)) {
            document.getElementById('giveawayForm').style.display = 'none';
            document.getElementById('giveawaySuccess').style.display = 'block';
        } else {
            document.getElementById('giveawayForm').style.display = 'block';
            document.getElementById('giveawaySuccess').style.display = 'none';
        }
    }

    if (openGiveaway) openGiveaway.addEventListener('click', openGiveawayModal);
    if (openGiveawaySidebar) openGiveawaySidebar.addEventListener('click', openGiveawayModal);

    if (closeGiveaway) {
        closeGiveaway.addEventListener('click', () => {
            giveawayModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === giveawayModal) giveawayModal.style.display = 'none';
    });

    if (giveawaySubmitBtn) {
        giveawaySubmitBtn.addEventListener('click', () => {
            const emailInput = document.getElementById('giveawayEmail');
            const email = emailInput.value.trim().toLowerCase();
            const emailRegex = /^[^s@]+@[^s@]+.[^s@]+$/;
            if (!emailRegex.test(email)) {
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
            document.getElementById('giveawayForm').style.display = 'none';
            document.getElementById('giveawaySuccess').style.display = 'block';
            // Big celebration!
            for (let i = 0; i < 5; i++) {
                setTimeout(() => createConfetti(window.innerWidth / 2, window.innerHeight / 3), i * 120);
            }
        });
    }

    // Submit Deal Button
    const submitDealBtn = document.getElementById('submitDealBtn');
    if (submitDealBtn) {
        submitDealBtn.addEventListener('click', openSubmitDealModal);
    }
}

function openSubmitDealModal() {
    modalBody.innerHTML = `
        <div class="submit-deal-form" style="max-width: 500px; margin: 0 auto; padding-bottom: 2rem;">
            <h2 style="margin-bottom: 1.5rem; text-align: center; color: var(--text-primary);">Submit a Deal</h2>
            <form id="dealSubmissionForm">
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Deal Title</label>
                    <input type="text" required placeholder="e.g., Sony WH-1000XM5 Headphones" style="width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-primary);">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Price ($)</label>
                        <input type="number" step="0.01" required placeholder="299.99" style="width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-primary);">
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Category</label>
                        <select style="width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-primary);">
                            <option value="tech">Tech</option>
                            <option value="tools">Tools</option>
                            <option value="household">Household</option>
                            <option value="groceries">Groceries</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                </div>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Deal URL</label>
                    <input type="url" required placeholder="https://..." style="width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-primary);">
                </div>
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: var(--text-secondary);">Description</label>
                    <textarea rows="4" required placeholder="Why is this a good deal?" style="width: 100%; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-body); color: var(--text-primary); font-family: inherit;"></textarea>
                </div>
                <button type="submit" class="btn btn-primary full-width">Submit Deal</button>
            </form>
        </div>
    `;

    modal.style.display = 'flex';

    document.getElementById('dealSubmissionForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = 'Submitting...';
        btn.disabled = true;

        setTimeout(() => {
            alert('✅ Deal submitted successfully! We will review it shortly.');
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
        link.classList.toggle('active', link.dataset.category === category);
    });
    renderDeals();
}

// Render Functions
function renderDeals() {
    dealGrid.innerHTML = '';

    const filteredDeals = deals.filter(deal => {
        const matchesCategory = currentCategory === 'all' || deal.category === currentCategory;
        const matchesSearch = deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            deal.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    if (filteredDeals.length === 0) {
        dealGrid.innerHTML = '<div class="no-results">No deals found matching your criteria.</div>';
        return;
    }

    filteredDeals.forEach(deal => {
        const card = createDealCard(deal);
        dealGrid.appendChild(card);
    });
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
                <span class="card-category">${deal.category}</span>
                <span class="card-source">• ${getStoreName(deal.url)}</span>
            </div>
            <h3 class="card-title">${deal.title}</h3>
            <div class="card-price">
                $${deal.price}
                ${deal.originalPrice ? `<span class="original-price">$${deal.originalPrice}</span>` : ''}
            </div>
            <a href="${getAffiliateUrl(deal.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary full-width view-deal-btn" style="margin-bottom: 1rem;">View Deal</a>
            <div class="vote-container" style="border-top: none; padding-top: 0;">
                <button class="vote-btn upvote-btn ${deal.votes.up > 0 ? 'active' : ''}" data-id="${deal.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    <span>${deal.votes.up}</span>
                </button>
                <button class="vote-btn downvote-btn ${deal.votes.down > 0 ? 'active' : ''}" data-id="${deal.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                    <span>${deal.votes.down}</span>
                </button>
            </div>
        </div>
    `;

    const dealLink = article.querySelector('.view-deal-btn');
    dealLink.addEventListener('click', (e) => {
        createConfetti(e.clientX, e.clientY);
        dealLink.style.transform = 'scale(1.05)';
        setTimeout(() => dealLink.style.transform = 'scale(1)', 200);
    });

    article.addEventListener('click', (e) => {
        if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.vote-container')) return;
        openModal(deal);
    });

    const upvoteBtn = article.querySelector('.upvote-btn');
    const downvoteBtn = article.querySelector('.downvote-btn');

    upvoteBtn.addEventListener('click', (e) => handleVote(e, deal, 'up'));
    downvoteBtn.addEventListener('click', (e) => handleVote(e, deal, 'down'));

    return article;
}

function handleVote(e, deal, type) {
    e.stopPropagation();
    const btn = e.currentTarget;
    const container = btn.closest('.vote-container');
    const otherType = type === 'up' ? 'down' : 'up';
    const otherBtn = container.querySelector(`.${otherType}vote-btn`);
    const countSpan = btn.querySelector('span');
    const otherCountSpan = otherBtn.querySelector('span');

    btn.classList.add('pop');
    setTimeout(() => btn.classList.remove('pop'), 300);

    if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        deal.votes[type]--;
    } else {
        if (otherBtn.classList.contains('active')) {
            otherBtn.classList.remove('active');
            deal.votes[otherType]--;
            otherCountSpan.textContent = deal.votes[otherType];
        }

        btn.classList.add('active');
        deal.votes[type]++;

        if (type === 'up') {
            createSparks(btn);
            // Big confetti celebration on upvote!
            const rect = btn.getBoundingClientRect();
            createConfetti(rect.left + rect.width / 2, rect.top);
            createConfetti(rect.left + rect.width / 2, rect.top);
        }
    }

    countSpan.textContent = deal.votes[type];
}

function createSparks(btn) {
    const rect = btn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    for (let i = 0; i < 20; i++) {
        const spark = document.createElement('div');
        spark.className = 'spark';

        const angle = 220 + Math.random() * 100;
        const distance = 40 + Math.random() * 60;

        const tx = Math.cos(angle * Math.PI / 180) * distance;
        const ty = Math.sin(angle * Math.PI / 180) * distance;

        spark.style.setProperty('--tx', `${tx}px`);
        spark.style.setProperty('--ty', `${ty}px`);

        const size = 3 + Math.random() * 4;
        spark.style.width = `${size}px`;
        spark.style.height = `${size}px`;

        spark.style.left = `${centerX + window.scrollX}px`;
        spark.style.top = `${centerY + window.scrollY}px`;

        document.body.appendChild(spark);

        setTimeout(() => spark.remove(), 800);
    }
}

function openModal(deal) {
    if (!deal.comments) {
        deal.comments = [];
    }

    const commentsHTML = deal.comments.map(c => `
        <div class="comment" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <strong style="color: var(--text-primary);">${c.user}</strong>
                <span style="color: var(--text-secondary); font-size: 0.85rem;">${c.time}</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.95rem;">${c.text}</p>
        </div>
    `).join('');

    modalBody.innerHTML = `
        <div class="modal-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <div class="modal-image">
                <img src="${deal.image}" alt="${deal.title}" style="width: 100%; border-radius: 8px;">
            </div>
            <div class="modal-details">
                <div class="card-category">${deal.category}</div>

                <h2 style="margin-bottom: 1rem;">${deal.title}</h2>
                <div class="modal-description">
                    ${deal.description}
                </div>
                <div class="card-price" style="font-size: 2rem; margin-bottom: 1.5rem;">
                    $${deal.price}
                    ${deal.originalPrice ? `<span class="original-price" style="font-size: 1.2rem;">$${deal.originalPrice}</span>` : ''}
                </div>
                <a href="${getAffiliateUrl(deal.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary full-width modal-deal-btn" style="margin-bottom: 1.5rem;">Get This Deal</a>
                <div class="vote-container" style="margin-bottom: 1.5rem; border-top: none; padding-top: 0;">
                    <button class="vote-btn upvote-btn ${deal.votes.up > 0 ? 'active' : ''}" onclick="handleModalVote(${deal.id}, 'up')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                        <span>${deal.votes.up}</span>
                    </button>
                    <button class="vote-btn downvote-btn ${deal.votes.down > 0 ? 'active' : ''}" onclick="handleModalVote(${deal.id}, 'down')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                        <span>${deal.votes.down}</span>
                    </button>
                </div>

                <div class="comments-section" style="border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;">Comments</h3>
                    <div id="commentsList" style="max-height: 200px; overflow-y: auto; margin-bottom: 1.5rem;">
                        ${commentsHTML}
                    </div>

                    <div class="comment-form" style="background: var(--bg-body); padding: 1rem; border-radius: 8px;">
                        <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">Leave a Comment</h4>
                        <input type="email" id="commentEmail" placeholder="Enter your email (required)" required style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                            <textarea id="commentText" placeholder="Your comment..." rows="2" required style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-family: inherit;"></textarea>
                            <button id="postCommentBtn" class="btn btn-primary full-width" style="font-size: 0.9rem; padding: 0.5rem;">Post Comment</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const modalDealBtn = modalBody.querySelector('.modal-deal-btn');
    modalDealBtn.addEventListener('click', (e) => {
        createConfetti(e.clientX, e.clientY);
        modalDealBtn.style.transform = 'scale(1.05)';
        setTimeout(() => modalDealBtn.style.transform = 'scale(1)', 200);
    });

    if (window.innerWidth < 768) {
        modalBody.querySelector('.modal-grid').style.gridTemplateColumns = '1fr';
    }

    modal.style.display = 'flex';

    const postBtn = document.getElementById('postCommentBtn');
    postBtn.addEventListener('click', () => {
        const emailInput = document.getElementById('commentEmail');
        const textInput = document.getElementById('commentText');
        const email = emailInput.value.trim();
        const text = textInput.value.trim();

        emailInput.style.borderColor = '';
        textInput.style.borderColor = '';

        if (!email) {
            emailInput.style.borderColor = '#ef4444';
            emailInput.focus();
            alert('⚠️ Email address is required to comment.');
            return;
        }

        const emailRegex = /^[^s@]+@[^s@]+.[^s@]+$/;
        if (!emailRegex.test(email)) {
            emailInput.style.borderColor = '#ef4444';
            emailInput.focus();
            alert('⚠️ Please enter a valid email address (e.g., name@example.com).');
            return;
        }

        if (!text) {
            textInput.style.borderColor = '#ef4444';
            textInput.focus();
            alert('⚠️ Please enter a comment before posting.');
            return;
        }

        const newComment = { user: email.split('@')[0], text: text, time: "Just now" };
        deal.comments.unshift(newComment);

        openModal(deal);
        alert('✅ Thanks for subscribing! Your comment has been posted.');
    });

    const modalUpBtn = modalBody.querySelector('.upvote-btn');
    const modalDownBtn = modalBody.querySelector('.downvote-btn');

    modalUpBtn.addEventListener('click', (e) => handleVote(e, deal, 'up'));
    modalDownBtn.addEventListener('click', (e) => handleVote(e, deal, 'down'));
}

// Confetti celebration effect
function createConfetti(x, y) {
    const colors = ['#d4af37', '#cbd5e1', '#3b82f6', '#f8fafc'];
    const confettiCount = 25;

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = x + 'px';
        confetti.style.top = y + 'px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        const tx = (Math.random() - 0.5) * 300;
        const ty = (Math.random() - 0.5) * 300;
        const rotation = Math.random() * 720;

        confetti.style.setProperty('--tx', tx + 'px');
        confetti.style.setProperty('--ty', ty + 'px');
        confetti.style.setProperty('--rotation', rotation + 'deg');

        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 1000);
    }
}

// Helper to extract store name from URL
function getStoreName(url) {
    if (!url) return '';
    try {
        const hostname = new URL(url).hostname;
        if (hostname.includes('amazon')) return 'Amazon';
        if (hostname.includes('dyson')) return 'Dyson';
        if (hostname.includes('samsung')) return 'Samsung';
        if (hostname.includes('kitchenaid')) return 'KitchenAid';
        if (hostname.includes('dewalt')) return 'DeWalt';
        if (hostname.includes('chase')) return 'Chase';
        if (hostname.includes('google')) return 'Google Flights';
        if (hostname.includes('tide')) return 'Tide';
        return hostname.replace('www.', '').split('.')[0];
    } catch (e) {
        return '';
    }
}

// Affiliate Configuration
const AMAZON_TAG = 'commoncents0050-20';

function getAffiliateUrl(url) {
    if (!url) return '#';
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('amazon.com') || urlObj.hostname.includes('amzn.to')) {
            urlObj.searchParams.set('tag', AMAZON_TAG);
            return urlObj.toString();
        }
        return url;
    } catch (e) {
        console.error('Invalid URL:', url);
        return url;
    }
}

document.addEventListener('DOMContentLoaded', initApp);
