document.addEventListener('DOMContentLoaded', initApp);

let currentCategory = 'All';

function initApp() {
    renderCategories();
    renderDeals();
}

function renderCategories() {
    const filtersContainer = document.getElementById('categoryFilters');
    filtersContainer.innerHTML = '';
    
    categories.forEach(category => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.textContent = category;
        if (category === currentCategory) btn.classList.add('active');
        
        btn.addEventListener('click', () => {
            currentCategory = category;
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderDeals();
        });
        
        filtersContainer.appendChild(btn);
    });
}

function renderDeals() {
    const grid = document.getElementById('dealsGrid');
    grid.innerHTML = '';
    
    const filteredDeals = currentCategory === 'All' 
        ? deals 
        : deals.filter(deal => deal.category === currentCategory);
    
    filteredDeals.forEach(deal => {
        const card = createDealCard(deal);
        grid.appendChild(card);
    });
}

function createDealCard(deal) {
    const card = document.createElement('div');
    card.className = 'deal-card';
    if (deal.featured) card.classList.add('featured');
    
    card.innerHTML = `
        <div class="deal-image">
            <img src="${deal.image}" alt="${deal.title}" loading="lazy">
            <span class="discount-badge">${deal.discount} OFF</span>
        </div>
        <div class="deal-content">
            <span class="deal-category">${deal.category}</span>
            <h3 class="deal-title">${deal.title}</h3>
            <div class="deal-prices">
                <span class="price">$${deal.price}</span>
                <span class="original-price">$${deal.original_price}</span>
            </div>
            <a href="${deal.link}" target="_blank" rel="nofollow sponsored" class="deal-btn">View Deal</a>
        </div>
    `;
    
    return card;
}
