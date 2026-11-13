// CommonCents tailored feed — the site's differentiator.
//
// A visitor picks the things they care about (Tech, Tools, Baby & Kids,
// ...). Their homepage then shows ONLY deals matching their interests,
// gathered from all the deal sites we collect — one place, no wading
// through everything else. Choices are saved on the visitor's own device
// (no account needed); signed-in visitors get the same picks saved to
// their account instead (see auth.js). Changeable anytime.
//
// Layout: the chip picker invites ONCE — it starts open only for a
// first-time visitor (no saved picks, never dismissed). Pressing Done
// records the dismissal (localStorage ccPickerDone); from then on —
// and whenever picks exist — the picker stays tucked away on every
// load, and category clicks never reopen it. The feed's status lives
// in the sidebar's "Your Feed" widget instead (picks + deal count and
// a Change button that reopens the picker). Jumping back to My Feed
// lives in the Categories lists: a "My Feed" row tops both the sidebar
// list and the top nav whenever the visitor has picks (user's design,
// 2026-11-10 — it sits where people already go to filter, instead of
// a button in the widget that read as clutter). Every interest
// renders a chip in the picker
// at all times — including sections with no deals right now — because
// the picker is where a visitor makes a standing choice, deals or
// no deals.
//
// Also the on-site half of deal alerts: deals collected since your last
// visit get a "NEW DEAL" badge. (Email alerts are a later add-on.)
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
        { key: 'pets',     label: 'Pets',               cats: ['pets'],      kw: ['dog', 'cat', 'pet', 'litter', 'puppy', 'kitten', 'aquarium'] },
        // General is pickable too (user ruling, 2026-11-10): deals the
        // collector files as General matched NO interest, so they could
        // never appear in any My Feed — even for a visitor who picked
        // everything. It matches by filing only (fc/cats), deliberately
        // no keywords, so it stays exactly the General pile, no more.
        { key: 'general',  label: 'General',            cats: ['general'],   kw: [] }
    ];
    // Collector category (verbatim) -> interest key.
    var FC2KEY = { 'Tech': 'tech', 'Tools': 'tools', 'Household': 'home', 'Groceries': 'food', 'Kids': 'baby', 'Beauty': 'beauty', 'Clothing': 'clothing', 'Pets': 'pets', 'General': 'general' };

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

    // Feed-view memory: the visitor's chosen view — My Feed ('mine') or
    // a browse category — persists on this device (ccFeedView). Without
    // it, every reload re-derived the view from "has picks = My Feed",
    // so someone who clicked All Deals was thrown back into My Feed on
    // the next visit and had to flip back with "Back to my feed" every
    // time. The saved view wins when it exists; only a first-time
    // visitor (nothing saved) gets the derived default. Signed-in
    // visitors use the same local persistence — the view is NOT part of
    // the account.
    var VIEW_KEY = 'ccFeedView';
    function loadSavedView() {
        try {
            var v = JSON.parse(lsGet(VIEW_KEY) || 'null');
            if (!v || (v.mode !== 'mine' && v.mode !== 'browse')) return null;
            if (typeof v.category !== 'string' || !v.category) v.category = 'all';
            return v;
        } catch (e) { return null; }
    }
    var savedView = loadSavedView();
    var viewCategory = savedView ? savedView.category : 'all';
    function saveView() {
        lsSet(VIEW_KEY, JSON.stringify({ mode: mode, category: viewCategory }));
    }

    // 'mine' with zero picks is not a real view — it sanitizes to browse.
    var mode = savedView
        ? (savedView.mode === 'mine' && getInterests().length ? 'mine' : 'browse')
        : (getInterests().length ? 'mine' : 'browse');
    // The picker invites once: it starts open only when the visitor has
    // no saved picks AND has never pressed Done (ccPickerDone). After
    // that it stays tucked away — only the explicit Change buttons
    // (sidebar widget / avatar menu) ever reopen it.
    var expanded = getInterests().length === 0 && lsGet('ccPickerDone') !== '1';
    var prevVisit = parseInt(lsGet('ccLastVisit') || '0', 10) || 0;
    lsSet('ccLastVisit', String(Date.now()));

    // Deals the visitor has actually opened. Opening a deal clears its
    // NEW DEAL badge immediately and for good (persisted here) —
    // app.js calls CC_FEED.markSeen() from openModal().
    var seenDeals = new Set();
    try {
        (JSON.parse(lsGet('ccSeenDeals') || '[]') || []).forEach(function (id) { seenDeals.add(id); });
    } catch (e) {}
    // Prune ids whose deals have left the inventory, so the stored set
    // stays small as deals come and go.
    if (typeof deals !== 'undefined' && Array.isArray(deals)) {
        var liveIds = new Set(deals.map(function (d) { return d.id; }));
        var keptSeen = [...seenDeals].filter(function (id) { return liveIds.has(id); });
        if (keptSeen.length !== seenDeals.size) {
            seenDeals = new Set(keptSeen);
            lsSet('ccSeenDeals', JSON.stringify(keptSeen));
        }
    }

    // The deals currently carrying a NEW DEAL badge. A deal joins
    // this set when it arrives (posted after the pre-advance last-visit
    // snapshot above) and leaves it ONLY when the visitor opens that
    // deal — never just because a page loaded. Badges used to be
    // computed straight from the visit clock, which advances on every
    // load, so all unopened badges vanished at once on the next visit
    // (user's complaint, 2026-11-10): he wants each card's badge to go
    // away only when he opens THAT card. Persisted, so a badge survives
    // reloads indefinitely until its own deal is opened.
    var newBadges = new Set();
    try {
        (JSON.parse(lsGet('ccNewBadges') || '[]') || []).forEach(function (id) { newBadges.add(id); });
    } catch (e) {}
    if (typeof deals !== 'undefined' && Array.isArray(deals)) {
        var liveBadgeIds = new Set(deals.map(function (d) { return d.id; }));
        // Union in this visit's new arrivals — the same rule as before:
        // posted after the last-visit snapshot taken at the top.
        deals.forEach(function (d) {
            if (!d.ts) return;
            var ts = Date.parse(d.ts);
            if (!isNaN(ts) && ts > prevVisit) newBadges.add(d.id);
        });
        // Prune: only deals still in the inventory and not yet opened
        // keep their badge.
        var keptBadges = [...newBadges].filter(function (id) {
            return liveBadgeIds.has(id) && !seenDeals.has(id);
        });
        newBadges = new Set(keptBadges);
        lsSet('ccNewBadges', JSON.stringify(keptBadges));
    }

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
            if (d.sponsored === true) return true;
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
            // Sponsored posts appear in every feed, picks or not —
            // disclosed in the feed picker and the Terms.
            if (deal.sponsored === true) return true;
            var mine = getInterests();
            var d = dealInterests(deal);
            return mine.some(function (k) { return d[k]; });
        },
        isNew: function (deal) {
            if (seenDeals.has(deal.id)) return false;
            return newBadges.has(deal.id);
        },
        markSeen: function (deal) {
            if (!deal || deal.id == null) return;
            if (!seenDeals.has(deal.id)) {
                seenDeals.add(deal.id);
                lsSet('ccSeenDeals', JSON.stringify([...seenDeals]));
            }
            // Opening the deal retires its badge for good.
            if (newBadges.delete(deal.id)) {
                lsSet('ccNewBadges', JSON.stringify([...newBadges]));
            }
        },
        getInterests: getInterests,
        // app.js calls this after it (re)paints the sidebar category
        // counts, so the My Feed row's badge/visibility track deals
        // loaded after the first paint too.
        refreshMyFeedNav: function () { paintMyFeedNav(); },
        // The browse category half of the saved view; app.js restores it
        // at startup (and validates it against the actual nav links).
        savedCategory: function () { return viewCategory; },
        setInterests: function (keys, fromAccount) {
            var valid = (keys || []).filter(function (k) {
                return INTERESTS.some(function (i) { return i.key === k; });
            });
            lsSet('ccInterests', JSON.stringify(valid));
            mode = valid.length ? 'mine' : 'browse';
            if (fromAccount) {
                // An account sync is not a view choice: a saved view on
                // this device still wins over the picks-derived mode.
                var sv = loadSavedView();
                if (sv) mode = (sv.mode === 'mine' && valid.length) ? 'mine' : 'browse';
            } else {
                // An explicit local apply of picks IS entering (or
                // leaving) My Feed — it becomes the saved view.
                saveView();
            }
            // Applying picks (e.g. an account sync) must never pop the
            // picker open for someone who has picks or already dismissed
            // the invite.
            expanded = valid.length === 0 && lsGet('ccPickerDone') !== '1';
            if (!fromAccount) notifyChange();
            paintAll();
            if (typeof renderDeals === 'function') renderDeals();
        }
    };

    var els = {};
    // The "My Feed" rows in the Categories lists (sidebar + top nav,
    // marked data-myfeed). They exist only while the visitor has picks:
    // no picks, no row anywhere. The sidebar row also carries the
    // .cat-count badge with the number of live deals matching the
    // picks — matchCount(), the same matching the My Feed view itself
    // uses — shown even when that number is 0. Active painting agrees
    // with the view on screen: in My Feed the rows are active and the
    // category links are not; browsing, the selected category is.
    // app.js setCategory paints the category half of that too — this
    // keeps both halves consistent on the paths that never call
    // setCategory (entering/leaving My Feed from the picker, and the
    // saved-view restore at startup).
    function paintMyFeedNav() {
        if (!els.myFeedRows || !els.myFeedRows.length) return;
        var mine = getInterests();
        var has = mine.length > 0;
        var inMine = has && mode === 'mine';
        els.myFeedRows.forEach(function (row) {
            var wrap = row.closest('li') || row;
            wrap.style.display = has ? '' : 'none';
            row.classList.toggle('active', inMine);
        });
        var cc = 'all';
        try { if (typeof currentCategory !== 'undefined' && currentCategory) cc = currentCategory; } catch (e) {}
        document.querySelectorAll('.main-nav a[data-category], .category-list a[data-category]').forEach(function (l) {
            l.classList.toggle('active', !inMine && l.getAttribute('data-category') === cc);
        });
        if (els.myFeedBadgeHost) {
            var badge = els.myFeedBadgeHost.querySelector('.cat-count');
            if (has) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'cat-count';
                    els.myFeedBadgeHost.appendChild(badge);
                }
                badge.textContent = matchCount();
            } else if (badge) {
                badge.remove();
            }
        }
    }

    function paintAll() {
        if (!els.picker) return;
        var mine = getInterests();
        els.picker.classList.toggle('slim', !expanded);
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
        paintMyFeedNav();
        // expanded status line
        if (els.status) {
            if (mode === 'mine' && mine.length) {
                var c = matchCount();
                els.status.textContent = 'Your feed: ' + mine.map(labelFor).join(' + ')
                    + ' — ' + c + ' deal' + (c === 1 ? '' : 's')
                    + '. Tap "Done" to tuck this picker away.';
            } else if (mine.length) {
                els.status.textContent = 'Browsing by category. Your interests are saved — use "My Feed" in the Categories list to jump back.';
            } else {
                els.status.textContent = 'Pick what you care about and this page becomes your feed — only those deals, from every site we collect.';
            }
        }
        // chips
        if (els.chips) {
            els.chips.innerHTML = '';
            INTERESTS.forEach(function (it) {
                var picked = mine.indexOf(it.key) !== -1;
                // Every interest always gets a chip — even with zero
                // deals right now. The picker is a standing choice, not
                // a snapshot of today's stock (user ruling, 2026-11-09).
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
                    saveView();
                    notifyChange();
                    paintAll();
                    if (typeof renderDeals === 'function') renderDeals();
                });
                els.chips.appendChild(b);
            });
        }
    }

    // Bring the picker to the reader. The old code used a bare
    // scrollIntoView({ block: 'start' }) fired in the same frame as the
    // display:none -> open flip: it parked the picker's top edge flush
    // with the viewport top — hidden under the sticky site header — and
    // the smooth scroll often never landed at all, so the picker opened
    // at the top of the deals column, far above wherever the reader was,
    // and they never saw it. Instead: wait for the expanded layout to
    // settle (double rAF), then compute the exact window scroll that
    // lands the picker's top just below the sticky header. The picker
    // has no scrollable ancestor (the sidebar is a sibling, not an
    // ancestor), so the window scroll is the only scroll needed.
    function revealPicker() {
        if (!els.picker) return;
        var go = function () {
            var header = document.querySelector('.site-header');
            var offset = (header && header.offsetHeight ? header.offsetHeight : 96) + 10;
            var y = els.picker.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: y > 0 ? y : 0, behavior: 'smooth' });
        };
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(function () { window.requestAnimationFrame(go); });
        } else {
            go();
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        els.picker = document.getElementById('interestPicker');
        els.chips = document.getElementById('interestChips');
        els.status = document.getElementById('feedStatus');
        els.widgetText = document.getElementById('feedWidgetText');
        els.widgetChange = document.getElementById('feedWidgetChange');
        els.myFeedRows = document.querySelectorAll('[data-myfeed]');
        els.myFeedBadgeHost = document.querySelector('.category-list a[data-myfeed]');
        var doneBtn = document.getElementById('feedDoneBtn');
        if (!els.picker) return;

        if (doneBtn) doneBtn.addEventListener('click', function () {
            expanded = false;
            // Done is forever: remember the dismissal so the picker
            // never auto-opens again on later loads.
            lsSet('ccPickerDone', '1');
            // Done also confirms the current view (My Feed when picks
            // exist — the chip clicks already derived the mode).
            saveView();
            paintAll();
        });
        if (els.widgetChange) els.widgetChange.addEventListener('click', function () {
            expanded = true;
            paintAll();
            revealPicker();
        });
        // The "My Feed" rows in the Categories lists are the way back
        // into My Feed (the sidebar widget's old "Back to my feed"
        // button moved here). Exactly the old button's behavior: enter
        // My Feed and remember the choice.
        els.myFeedRows.forEach(function (row) {
            row.addEventListener('click', function (e) {
                e.preventDefault();
                mode = 'mine';
                saveView();
                paintAll();
                if (typeof renderDeals === 'function') renderDeals();
                // Same rule as category clicks (owner, 2026-11-12):
                // switching feed while scrolled down jumps to the top.
                if (window.scrollY > 0) {
                    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) { window.scrollTo(0, 0); }
                }
            });
        });

        // Any category browsing switches back to "browse" mode; the saved
        // interests stay put for the Categories lists' "My Feed" row. This
        // deliberately never touches `expanded`: category clicks (All
        // Deals included) must never reopen a tucked picker — the
        // Change buttons are the only way back in.
        document.querySelectorAll('[data-category]').forEach(function (el) {
            el.addEventListener('click', function () {
                mode = 'browse';
                viewCategory = el.getAttribute('data-category') || 'all';
                saveView();
                paintAll();
            });
        });

        paintAll();
        if (mode === 'mine' && typeof renderDeals === 'function') renderDeals();
    });
})();
