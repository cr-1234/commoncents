document.addEventListener('DOMContentLoaded', initApp);

let currentCategory = 'All';
let currentSort = 'featured';
let allDeals = [];

function initApp() {
    allDeals = deals;
    renderCategories();
    renderDeals();
    setupSearch();
    setupDropdown();
    setupThemeToggle();
}

function renderCategories() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = '';
    
    categories.forEach(category => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = category;
        if (category === currentCategory) a.classList.add('active');
        
        a.addEventListener('click', (e) => {
            e.preventDefault();
            currentCategory = category;
            document.querySelectorAll('.category-list a').forEach(link => link.classList.remove('active'));
            a.classList.add('active');
            renderDeals();
        });
        
        li.appendChild(a);
        categoryList.appendChild(li);
    });
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allDeals.filter(deal => 
            deal.title.toLowerCase().includes(query) || 
            deal.category.toLowerCase().includes(query)
        );
        renderDeals(filtered);
    });
}

function setupDropdown() {
    const selected = document.querySelector('.dropdown-selected');
    const items = document.getElementById('dropdownItems');
    const selectedText = document.getElementById('selectedSort');
    
    selected.addEventListener('click', () => {
        items.classList.toggle('show');
    });
    
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            currentSort = item.dataset.value;
            selectedText.textContent = item.textContent;
            document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            items.classList.remove('show');
            renderDeals();
        });
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown')) {
            items.classList.remove('show');
        }
    });
}

function setupThemeToggle() {
    const themeBtn = document.getElementById('themeToggle');
    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
    });
}

function sortDeals(dealsToSort) {
    const sorted = [...dealsToSort];
    switch(currentSort) {
        case 'price-low':
            return sorted.sort((a, b) => a.price - b.price);
        case 'price-high':
            return sorted.sort((a, b) => b.price - a.price);
        case 'discount':
            return sorted.sort((a, b) => {
                const discountA = (a.original_price - a.price) / a.original_price;
                const discountB = (b.original_price - b.price) / b.original_price;
                return discountB - discountA;
            });
        default:
            return sorted.sort((a, b) => b.featured - a.featured);
    }
}

function renderDeals(dealsToRender = null) {
    const grid = document.getElementById('dealGrid');
    grid.innerHTML = '';
    
    let filteredDeals = dealsToRender || allDeals;
    
    if (!dealsToRender && currentCategory !== 'All') {
        filteredDeals = filteredDeals.filter(deal => deal.category === currentCategory);
    }
    
    filteredDeals = sortDeals(filteredDeals);
    
    if (filteredDeals.length === 0) {
        grid.innerHTML = '<div class="no-results">No deals found.</div>';
        return;
    }
    
    filteredDeals.forEach(deal => {
        const card = createDealCard(deal);
        grid.appendChild(card);
    });
}

function createDealCard(deal) {
    const card = document.createElement('div');
    card.className = 'deal-card';
    
    const discount = Math.round(((deal.original_price - deal.price) / deal.original_price) * 100);
    
    card.innerHTML = `
        <div class="card-image">
            <img src="${deal.image}" alt="${deal.title}" loading="lazy">
            <span class="discount-badge">${discount}% OFF</span>
        </div>
        <div class="card-content">
            <div class="card-meta">
                <span class="card-category">${deal.category}</span>
                <span class="card-source">Amazon</span>
            </div>
            <h3 class="card-title">${deal.title}</h3>
            <div class="card-price">
                <span class="original-price">$${deal.original_price.toFixed(2)}</span>
                <span class="price">$${deal.price.toFixed(2)}</span>
            </div>
            <a href="${deal.link}" target="_blank" rel="nofollow sponsored" class="view-deal-btn">View Deal</a>
            <div class="vote-container">
                <button class="vote-btn upvote-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 9V5a3 3 0 0 0-6 0v4"></path>
                        <rect x="2" y="9" width="20" height="12" rx="2" ry="2"></rect>
                    </svg>
                    <span>0</span>
                </button>
                <button class="vote-btn downvote-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10 15v4a3 3 0 0 0 6 0v-4"></path>
                        <rect x="2" y="3" width="20" height="12" rx="2" ry="2"></rect>
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    return card;
}
