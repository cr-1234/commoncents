// CommonCents tailored feed — the site's differentiator.
//
// A visitor picks the things they care about (Tech, Tools, Baby & Kids,
// ...). Their homepage then shows ONLY deals matching their interests,
// gathered from all the deal sites we collect — one place, no wading
// through everything else. Choices are saved on the visitor's own device
// (no account needed); signed-in visitors get the same picks saved to
// their account instead (see auth.js). Changeable anytime.
//
// Layout: while you're picking, the full chip picker shows. Once you
// have picks and tap Done, the picker collapses to a slim one-line bar
// ("Your feed: Tech + Baby & Kids — 10 deals · Change") so it stays out
// of the way; "Change" brings the chips back. Browsing a category keeps
// the slim bar, with a "Back to my feed" button.
//
// Also the on-site half of deal alerts: deals collected since your last
// visit get a "NEW FOR YOU" badge. (Email alerts are a later add-on.)
//
// Matching rules (kept strict — a polluted feed kills the whole idea):
// - A collected deal's interest comes from the collector's own category
//   (deal.fc, verbatim) plus title keywords — never from a guessed
//   display category.
// - Site-native deals (no fc) match by their site category + keywords.
// - Short keywords match on word boundaries, so "toy" doesn't catch
//   "Toyota" and "tablet" (removed) can't catch melatonin "tablets".
(function () {
    var INTERESTS = [
        { key: 'tech',     label: 'Tech & Electronics', cats: ['tech'],      kw: ['tv', 'oled', 'laptop', 'headphone', 'earbud', 'airpods', 'iphone', 'ipad', 'galaxy', 'monitor', 'speaker', 'kindle', 'echo', 'alexa', 'ps5', 'xbox', 'nintendo', 'camera', 'drone', 'smartwatch', 'ssd', 'keyboard', 'soundbar', 'router', 'carplay', 'android tablet', 'galaxy tab', 'fire hd', 'usb charger', 'charging cable', 'power bank'] },
        { key: 'tools',    label: 'Tools & DIY',        cats: ['tools'],     kw: ['drill', 'dewalt', 'craftsman', 'milwaukee', 'makita', 'ryobi', 'saw', 'wrench', 'socket', 'diy'] },
        { key: 'home',     label: 'Home & Kitchen',     cats: ['household'], kw: ['vacuum', 'kitchen', 'mixer', 'blanket', 'lamp', 'chair', 'mattress', 'air fryer', 'cookware', 'towel', 'storage', 'kitchenaid', 'dyson', 'tumbler', 'mug'] },
        { key: 'food',     label: 'Groceries & Food',   cats: ['groceries'], kw: ['protein', 'snack', 'coffee', 'chocolate', 'cereal', 'nuts', 'grocery'] },
        { key: 'baby',     label: 'Baby & Kids',        cats: [],            kw: ['baby', 'toddler', 'kids', 'children', 'diaper', 'stroller', 'lego', 'toy', 'infant', 'nursery', 'crayola'] },
        { key: 'beauty',   label: 'Health & Beauty',    cats: [],            kw: ['skincare', 'makeup', 'shampoo', 'beauty', 'serum', 'lotion', 'toothbrush', 'vitamin', 'melatonin', 'supplement'] },
        { key: 'clothing', label: 'Clothing & Shoes',   cats: [],            kw: ['shoes', 'sneakers', 'jacket', 'boots', 'hoodie', 'jeans', 'nike', 'adidas', 'sweater'] },
        { key: 'him',      label: 'Gifts for Him',      cats: ['gifts-him'], kw: ["men's", 'mens '] },
        { key: 'her',      label: 'Gifts for Her',      cats: ['gifts-her'], kw: ["women's", 'womens '] }
    ];
    // Collector category (verbatim) -> interest key.
    var FC2KEY = { 'Tech': 'tech', 'Tools': 'tools', 'Household': 'home', 'Groceries': 'food' };

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
    function norm(s) { return (s || '').toLowerCase().replace(/’/g, "'"); }
    function kwHit(t, kw) {
        if (kw.indexOf(' ') !== -1 || kw.indexOf("'") !== -1) return t.indexOf(kw) !== -1;
        return new RegExp('(^|[^a-z0-9])' + kw + 's?([^a-z0-9]|$)').test(t);
    }
    function dealInterests(deal) {
        var out = {};
        if (deal.fc && FC2KEY[deal.fc]) out[FC2KEY[deal.fc]] = true;
        var t = norm(deal.title);
        INTERESTS.forEach(function (it) {
            if (!deal.fc && it.cats.indexOf(deal.category) !== -1) { out[it.key] = true; return; }
            for (var i = 0; i < it.kw.length; i++) {
                if (kwHit(t, it.kw[i])) { out[it.key] = true; break; }
            }
        });
        return out;
    }

    var mode = getInterests().length ? 'mine' : 'browse';
    var expanded = getInterests().length === 0; // picker starts open only for new visitors
    var prevVisit = parseInt(lsGet('ccLastVisit') || '0', 10) || 0;
    lsSet('ccLastVisit', String(Date.now()));

    function notifyChange() {
        if (window.CC_AUTH && CC_AUTH.noteInterestsChanged) {
            try { CC_AUTH.noteInterestsChanged(getInterests()); } catch (e) {}
        }
    }
    // Mirrors app.js isDealExpired: dead-marked or older than 72h.
    // The tailored feed only ever shows live deals.
    function isExpired(d) {
        if (d.dead) return true;
        if (d.ts) {
            var ts = Date.parse(d.ts);
            if (!isNaN(ts) && (Date.now() - ts) > 72 * 3600 * 1000) return true;
        }
        return false;
    }

    function matchCount() {
        if (typeof deals === 'undefined') return 0;
        var mine = getInterests();
        return deals.filter(function (d) {
            if (isExpired(d)) return false;
            var di = dealInterests(d);
            return mine.some(function (k) { return di[k]; });
        }).length;
    }

    // Consulted by app.js renderDeals()/createDealCard() and auth.js.
    window.CC_FEED = {
        mode: function () { return mode; },
        match: function (deal) {
            if (mode !== 'mine') return true;
            if (isExpired(deal)) return false;
            var mine = getInterests();
            var d = dealInterests(deal);
            return mine.some(function (k) { return d[k]; });
        },
        isNew: function (deal) {
            if (!deal.ts) return false;
            var ts = Date.parse(deal.ts);
            return !isNaN(ts) && ts > prevVisit;
        },
        getInterests: getInterests,
        setInterests: function (keys, fromAccount) {
            var valid = (keys || []).filter(function (k) {
                return INTERESTS.some(function (i) { return i.key === k; });
            });
            lsSet('ccInterests', JSON.stringify(valid));
            mode = valid.length ? 'mine' : 'browse';
            expanded = valid.length === 0;
            if (!fromAccount) notifyChange();
            paintAll();
            if (typeof renderDeals === 'function') renderDeals();
        }
    };

    var els = {};
    function paintAll() {
        if (!els.picker) return;
        var mine = getInterests();
        els.picker.classList.toggle('slim', !expanded && mine.length > 0);
        // slim bar text + back button visibility
        if (els.slimText) {
            if (mode === 'mine' && mine.length) {
                var n = matchCount();
                els.slimText.textContent = 'Your feed: ' + mine.map(labelFor).join(' + ')
                    + ' — ' + n + ' deal' + (n === 1 ? '' : 's');
            } else if (mine.length) {
                els.slimText.textContent = 'Browsing everything — your feed is saved.';
            } else {
                els.slimText.textContent = '';
            }
        }
        if (els.backBtn) els.backBtn.style.display = (mine.length && mode !== 'mine') ? '' : 'none';
        // expanded status line
        if (els.status) {
            if (mode === 'mine' && mine.length) {
                var c = matchCount();
                els.status.textContent = 'Your feed: ' + mine.map(labelFor).join(' + ')
                    + ' — ' + c + ' deal' + (c === 1 ? '' : 's')
                    + '. Tap "Done" to tuck this picker away.';
            } else if (mine.length) {
                els.status.textContent = 'Browsing by category. Your interests are saved — use the bar above to jump back to your feed.';
            } else {
                els.status.textContent = 'Pick what you care about and this page becomes your feed — only those deals, from every site we collect.';
            }
        }
        // chips
        if (els.chips) {
            els.chips.innerHTML = '';
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
                    notifyChange();
                    paintAll();
                    if (typeof renderDeals === 'function') renderDeals();
                });
                els.chips.appendChild(b);
            });
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        els.picker = document.getElementById('interestPicker');
        els.chips = document.getElementById('interestChips');
        els.status = document.getElementById('feedStatus');
        els.slimText = document.getElementById('feedSlimText');
        els.backBtn = document.getElementById('feedBackBtn');
        var doneBtn = document.getElementById('feedDoneBtn');
        var changeBtn = document.getElementById('feedChangeBtn');
        if (!els.picker) return;

        if (doneBtn) doneBtn.addEventListener('click', function () {
            expanded = false;
            paintAll();
        });
        if (changeBtn) changeBtn.addEventListener('click', function () {
            expanded = true;
            paintAll();
        });
        if (els.backBtn) els.backBtn.addEventListener('click', function () {
            mode = 'mine';
            paintAll();
            if (typeof renderDeals === 'function') renderDeals();
        });

        // Any category browsing switches back to "browse" mode; the saved
        // interests stay put for the slim bar's "Back to my feed".
        document.querySelectorAll('[data-category]').forEach(function (el) {
            el.addEventListener('click', function () {
                mode = 'browse';
                paintAll();
            });
        });

        paintAll();
        if (mode === 'mine' && typeof renderDeals === 'function') renderDeals();
    });
})();
