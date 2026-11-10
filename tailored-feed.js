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
// have picks and tap Done, the picker hides completely — the top of the
// page stays clean. The feed's status lives in the sidebar's "Your
// Feed" widget instead (picks + deal count, a Change button that
// reopens the picker, and a "Back to my feed" button while browsing).
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
        { key: 'baby',     label: 'Baby & Kids',        cats: ['kids'],      kw: ['baby', 'toddler', 'kids', 'children', 'diaper', 'stroller', 'lego', 'toy', 'infant', 'nursery', 'crayola'] },
        { key: 'beauty',   label: 'Health & Beauty',    cats: ['beauty'],    kw: ['skincare', 'makeup', 'shampoo', 'beauty', 'serum', 'lotion', 'toothbrush', 'vitamin', 'melatonin', 'supplement'] },
        { key: 'clothing', label: 'Clothing & Shoes',   cats: ['clothing'],  kw: ['shoes', 'sneakers', 'jacket', 'boots', 'hoodie', 'jeans', 'nike', 'adidas', 'sweater'] },
        { key: 'pets',     label: 'Pets',               cats: ['pets'],      kw: ['dog', 'cat', 'pet', 'litter', 'puppy', 'kitten', 'aquarium'] }
    ];
    // Collector category (verbatim) -> interest key.
    var FC2KEY = { 'Tech': 'tech', 'Tools': 'tools', 'Household': 'home', 'Groceries': 'food', 'Kids': 'baby', 'Beauty': 'beauty', 'Clothing': 'clothing', 'Pets': 'pets' };

    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function getInterests() {
        try { return JSON.parse(lsGet('ccInterests') || '[]'); }
        catch (e) { return []; }
    }
    // Drop saved picks whose section no longer exists (Gifts for Him/Her
    // were removed 2026-11-03) so stale saved feeds clean themselves up.
    (function sanitizePicks() {
        var cur = getInterests();
        var clean = cur.filter(function (k) {
            return INTERESTS.some(function (i) { return i.key === k; });
        });
        if (clean.length !== cur.length) lsSet('ccInterests', JSON.stringify(clean));
    })();
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
    // Mirrors app.js isDealExpired: only deals marked dead are
    // expired — never age alone. The tailored feed shows live deals.
    function isExpired(d) {
        return d.dead === true;
    }

    function countFor(key) {
        if (typeof deals === 'undefined') return 0;
        return deals.filter(function (d) {
            if (isExpired(d)) return false;
            return dealInterests(d)[key] === true;
        }).length;
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
        // Sidebar "Your Feed" widget text + buttons
        if (els.widgetText) {
            if (mode === 'mine' && mine.length) {
                var n = matchCount();
                els.widgetText.textContent = mine.map(labelFor).join(' + ')
                    + ' — ' + n + ' deal' + (n === 1 ? '' : 's') + ' for you';
            } else if (mine.length) {
                els.widgetText.textContent = 'Browsing everything — your picks are saved.';
            } else {
                els.widgetText.textContent = 'Pick the categories you care about and your homepage shows only those deals.';
            }
        }
        if (els.widgetChange) els.widgetChange.textContent = mine.length ? 'Change' : 'Build your feed';
        if (els.backBtn) els.backBtn.style.display = (mine.length && mode !== 'mine') ? '' : 'none';
        // expanded status line
        if (els.status) {
            if (mode === 'mine' && mine.length) {
                var c = matchCount();
                els.status.textContent = 'Your feed: ' + mine.map(labelFor).join(' + ')
                    + ' — ' + c + ' deal' + (c === 1 ? '' : 's')
                    + '. Tap "Done" to tuck this picker away.';
            } else if (mine.length) {
                els.status.textContent = 'Browsing by category. Your interests are saved — use "Back to my feed" in the sidebar to jump back.';
            } else {
                els.status.textContent = 'Pick what you care about and this page becomes your feed — only those deals, from every site we collect.';
            }
        }
        // chips
        if (els.chips) {
            els.chips.innerHTML = '';
            INTERESTS.forEach(function (it) {
                var picked = mine.indexOf(it.key) !== -1;
                // A section with no deals right now stays out of the picker;
                // it appears on its own the day a matching deal lands.
                if (!picked && countFor(it.key) === 0) return;
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'interest-chip' + (picked ? ' active' : '');
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
        els.widgetText = document.getElementById('feedWidgetText');
        els.widgetChange = document.getElementById('feedWidgetChange');
        els.backBtn = document.getElementById('feedWidgetBack');
        var doneBtn = document.getElementById('feedDoneBtn');
        if (!els.picker) return;

        if (doneBtn) doneBtn.addEventListener('click', function () {
            expanded = false;
            paintAll();
        });
        if (els.widgetChange) els.widgetChange.addEventListener('click', function () {
            expanded = true;
            paintAll();
            els.picker.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
