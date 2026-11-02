// CommonCents tailored feed — the site's differentiator.
//
// A visitor picks the things they care about (Tech, Tools, Baby & Kids,
// ...). Their homepage then shows ONLY deals matching their interests,
// gathered from all the deal sites we collect — one place, no wading
// through everything else. Choices are saved on the visitor's own device
// (no account, no signup) and can be changed anytime.
//
// Also the on-site half of deal alerts: deals collected since your last
// visit get a "NEW FOR YOU" badge. (Email alerts are a later add-on.)
(function () {
    var INTERESTS = [
        { key: 'tech',     label: 'Tech & Electronics', cats: ['tech'],      kw: ['tv', 'oled', 'laptop', 'headphone', 'earbud', 'airpods', 'iphone', 'ipad', 'galaxy', 'monitor', 'speaker', 'kindle', 'echo', 'alexa', 'ps5', 'xbox', 'nintendo', 'camera', 'drone', 'tablet', 'smartwatch', 'ssd', 'keyboard', 'charger', 'soundbar', 'router'] },
        { key: 'tools',    label: 'Tools & DIY',        cats: ['tools'],     kw: ['drill', 'dewalt', 'craftsman', 'milwaukee', 'makita', 'ryobi', 'saw', 'wrench', 'socket'] },
        { key: 'home',     label: 'Home & Kitchen',     cats: ['household'], kw: ['vacuum', 'kitchen', 'mixer', 'blanket', 'lamp', 'chair', 'mattress', 'air fryer', 'cookware', 'towel', 'storage', 'kitchenaid', 'dyson'] },
        { key: 'food',     label: 'Groceries & Food',   cats: ['groceries'], kw: ['protein', 'snack', 'coffee', 'chocolate', 'cereal', 'nuts', 'grocery'] },
        { key: 'baby',     label: 'Baby & Kids',        cats: [],            kw: ['baby', 'toddler', 'kids', 'children', 'diaper', 'stroller', 'lego', 'toy', 'infant', 'nursery'] },
        { key: 'beauty',   label: 'Health & Beauty',    cats: [],            kw: ['skincare', 'makeup', 'shampoo', 'beauty', 'serum', 'lotion', 'toothbrush', 'vitamin'] },
        { key: 'clothing', label: 'Clothing & Shoes',   cats: [],            kw: ['shoes', 'sneakers', 'jacket', 'boots', 'hoodie', 'jeans', 'nike', 'adidas'] },
        { key: 'him',      label: 'Gifts for Him',      cats: ['gifts-him'], kw: ["men's", 'mens '] },
        { key: 'her',      label: 'Gifts for Her',      cats: ['gifts-her'], kw: ["women's", 'womens '] }
    ];

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function getInterests() {
        try { return JSON.parse(lsGet('ccInterests') || '[]'); }
        catch (e) { return []; }
    }
    function labelFor(key) {
        for (var i = 0; i < INTERESTS.length; i++) if (INTERESTS[i].key === key) return INTERESTS[i].label;
        return key;
    }
    function dealInterests(deal) {
        var t = (deal.title || '').toLowerCase();
        var out = {};
        INTERESTS.forEach(function (it) {
            if (it.cats.indexOf(deal.category) !== -1) { out[it.key] = true; return; }
            for (var i = 0; i < it.kw.length; i++) {
                if (t.indexOf(it.kw[i]) !== -1) { out[it.key] = true; break; }
            }
        });
        return out;
    }

    var mode = getInterests().length ? 'mine' : 'browse';
    var prevVisit = parseInt(lsGet('ccLastVisit') || '0', 10) || 0;
    lsSet('ccLastVisit', String(Date.now()));

    // Consulted by app.js renderDeals()/createDealCard().
    window.CC_FEED = {
        mode: function () { return mode; },
        match: function (deal) {
            if (mode !== 'mine') return true;
            var mine = getInterests();
            var d = dealInterests(deal);
            return mine.some(function (k) { return d[k]; });
        },
        isNew: function (deal) {
            if (!deal.ts) return false;
            var ts = Date.parse(deal.ts);
            return !isNaN(ts) && ts > prevVisit;
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        var chipsEl = document.getElementById('interestChips');
        var statusEl = document.getElementById('feedStatus');
        var myFeedBtn = document.getElementById('myFeedBtn');
        if (!chipsEl) return;

        function updateStatus() {
            if (!statusEl) return;
            var mine = getInterests();
            if (mode === 'mine' && mine.length) {
                var n = 0;
                if (typeof deals !== 'undefined') {
                    n = deals.filter(function (d) { return CC_FEED.match(d); }).length;
                }
                statusEl.textContent = 'Your feed: ' + mine.map(labelFor).join(' + ')
                    + ' — ' + n + ' deal' + (n === 1 ? '' : 's')
                    + '. Tap a category any time to browse everything.';
            } else if (mine.length) {
                statusEl.textContent = 'Browsing everything. Your interests are saved — tap "My Feed" to see only your deals.';
            } else {
                statusEl.textContent = 'Pick what you care about and this page becomes your feed — only those deals, from every site we collect.';
            }
        }

        function paintChips() {
            var mine = getInterests();
            chipsEl.innerHTML = '';
            INTERESTS.forEach(function (it) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'interest-chip' + (mine.indexOf(it.key) !== -1 ? ' active' : '');
                b.textContent = it.label;
                b.addEventListener('click', function () {
                    var cur = getInterests();
                    var i = cur.indexOf(it.key);
                    if (i === -1) cur.push(it.key); else cur.splice(i, 1);
                    lsSet('ccInterests', JSON.stringify(cur));
                    mode = cur.length ? 'mine' : 'browse';
                    paintChips();
                    updateStatus();
                    if (typeof renderDeals === 'function') renderDeals();
                });
                chipsEl.appendChild(b);
            });
        }

        if (myFeedBtn) {
            myFeedBtn.addEventListener('click', function () {
                if (!getInterests().length) {
                    if (statusEl) statusEl.textContent = 'First pick at least one interest above — then My Feed shows only those deals.';
                    return;
                }
                mode = 'mine';
                updateStatus();
                if (typeof renderDeals === 'function') renderDeals();
            });
        }

        // Any category browsing switches back to "browse everything" mode;
        // the saved interests stay put for My Feed.
        document.querySelectorAll('[data-category]').forEach(function (el) {
            el.addEventListener('click', function () {
                mode = 'browse';
                updateStatus();
            });
        });

        paintChips();
        updateStatus();
        if (mode === 'mine' && typeof renderDeals === 'function') renderDeals();
    });
})();
