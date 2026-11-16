// CommonCents accounts — sign in with Google or email/password.
//
// Accounts run on Firebase Auth in the same project as the giveaway
// backend (the one Gifting Butler uses). Signing in gets you:
//   - Your feed interests saved to your account (ccGetProfile /
//     ccSaveInterests) — they follow you across devices.
//   - One-tap giveaway entry: the drawing uses your account email,
//     no typing (ccEnterGiveaway accepts the sign-in token).
// Guests are untouched: picks stay saved in the browser, as before.
(function () {
    var FN_BASE = 'https://us-central1-giftingbutler-74395.cloudfunctions.net/';
    var firebaseConfig = {
    apiKey:"AIzaSyBPvwf-ilWhc5G_jAEaRDwlom0jJY678w4",
    authDomain:"giftingbutler-74395.firebaseapp.com",
    projectId:"giftingbutler-74395",
    storageBucket:"giftingbutler-74395.firebasestorage.app",
    messagingSenderId:"37308175610",
    appId:"1:37308175610:web:547281f014be448b292543",
    measurementId:"G-KTPDVDSNWV"
  };

    var auth = null;
    var currentUser = null;
    var profileUsername = '';
    var profileSubBonus = 0;
    var saveTimer = null;
    try {
        if (window.firebase) {
            if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
            auth = firebase.auth();
        }
    } catch (e) { auth = null; }

    function postFn(name, body, token) {
        var headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        return fetch(FN_BASE + name, {
            method: 'POST', headers: headers, body: JSON.stringify(body || {})
        }).then(function (r) { return r.json(); });
    }

    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

    function saveNow(user, keys) {
        return user.getIdToken().then(function (token) {
            return postFn('ccSaveInterests', { interests: keys }, token);
        }).catch(function () { /* saving retries on the next change */ });
    }

    var voteSaveTimer = null;
    function saveVotesNow(user, map) {
        // The vote stamp maps (cast times + deletion tombstones) ride
        // along, read at fire time so they always match the map being
        // sent — they are what lets a deliberate un-vote survive the
        // sign-in union merge on every device.
        var body = { votes: map };
        if (window.CC_VOTES && typeof CC_VOTES.getTimes === 'function') body.voteTimes = CC_VOTES.getTimes();
        if (window.CC_VOTES && typeof CC_VOTES.getTombs === 'function') body.voteTombstones = CC_VOTES.getTombs();
        return user.getIdToken().then(function (token) {
            return postFn('ccSaveVotes', body, token);
        }).catch(function () { /* saving retries on the next change */ });
    }
    // Called by app.js whenever the local vote map changes.
    function noteVotesChanged(map) {
        if (!currentUser) return;
        clearTimeout(voteSaveTimer);
        var user = currentUser;
        var copy = Object.assign({}, map || {});
        voteSaveTimer = setTimeout(function () { saveVotesNow(user, copy); }, 600);
    }

    var savesSaveTimer = null;
    function saveSavesNow(user, list) {
        // The deletion tombstones ride along, read at fire time so
        // they always match the list being sent.
        var body = { saves: list };
        if (window.CC_SAVES && typeof CC_SAVES.getTombs === 'function') body.saveTombstones = CC_SAVES.getTombs();
        return user.getIdToken().then(function (token) {
            return postFn('ccSaveSaves', body, token);
        }).catch(function () { /* saving retries on the next change */ });
    }
    // Called by app.js whenever the local saved-deal list changes.
    function noteSavesChanged(list) {
        if (!currentUser) return;
        clearTimeout(savesSaveTimer);
        var user = currentUser;
        var copy = (list || []).map(function (s) { return Object.assign({}, s); });
        savesSaveTimer = setTimeout(function () { saveSavesNow(user, copy); }, 600);
    }

    // Called by tailored-feed.js whenever the picks change locally.
    function noteInterestsChanged(keys) {
        if (!currentUser) return;
        clearTimeout(saveTimer);
        var user = currentUser;
        saveTimer = setTimeout(function () { saveNow(user, keys); }, 600);
    }

    // ── Notifications (engagement plan, 2026-11-13) ──
    // One inbox serves both sites. The notes live behind the bell
    // next to the avatar (owner, 2026-11-15 — like Gifting Butler;
    // they used to sit inside the account menu). A red count badge
    // rides the bell; opening the bell's panel marks the notes read
    // and clears the badge. On phones the bell leaves the top row:
    // the badge rides the three-lines button instead, and the notes
    // panel itself moves into the hamburger drawer (see the phone
    // menu layout section below).
    var notesCache = null;
    var notesUnread = 0;
    // Mute switch (owner request 2026-11-14): stored server-side on
    // the account (notifications/{uid}.muted) so it follows the member
    // across devices. While muted the server creates nothing, and
    // here the badge stays off and the menu shows the quiet off state.
    var notesMuted = false;
    function escNote(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function noteWhen(ts) {
        if (!ts) return '';
        var d = new Date(ts); if (isNaN(d)) return '';
        var mins = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
        if (mins < 2) return 'just now';
        if (mins < 60) return mins + 'm ago';
        if (mins < 1440) return Math.round(mins / 60) + 'h ago';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    function paintNoteBadge() {
        var show = !!(currentUser && notesUnread && !notesMuted);
        var txt = notesUnread > 9 ? '9+' : String(notesUnread);
        // Desktop (owner, 2026-11-15, later): no header bell — the
        // unread count rides the Notifications row inside the
        // avatar menu. Same show/hide rule as the bell's badge had.
        var menuCount = document.getElementById('authMenuNotesCount');
        if (menuCount) menuCount.textContent = show ? txt : '';
        // Phone menu (owner, 2026-11-15): the bell is gone from the
        // phone top row, so the same unread count rides the three
        // lines button instead, and the panel's Notifications row
        // shows the number next to its label. Same show/hide rule
        // as the bell's badge — signed in, unread, not muted — and
        // the badge element is created/removed the same way, so a
        // signed-out page carries no badge anywhere.
        var burger = document.getElementById('mobileMenuBtn');
        if (burger) {
            var mb = burger.querySelector('.cc-note-badge');
            if (!show) { if (mb) mb.remove(); }
            else {
                if (!mb) { mb = document.createElement('span'); mb.className = 'cc-note-badge'; mb.id = 'mobileMenuBadge'; burger.appendChild(mb); }
                mb.textContent = txt;
            }
        }
        var nc = document.getElementById('mobileNotesCount');
        if (nc) nc.textContent = show ? txt : '';
    }
    function paintNotesList() {
        var wrap = document.getElementById('notesPanel');
        var list = document.getElementById('notesPanelList');
        if (!wrap || !list) return;
        var toggle = document.getElementById('notesPanelToggle');
        if (notesMuted) {
            // Off state: the panel collapses to ONE pill row, like
            // the empty state — tapping it turns notes back on. (The
            // panel's own visibility belongs to the bell, so unlike
            // the old in-menu block this painter never touches the
            // wrap's display.)
            wrap.classList.add('is-empty');
            if (toggle) toggle.style.display = 'none';
            list.innerHTML = '<button type="button" class="auth-menu-note auth-menu-notes-empty auth-menu-notes-off" id="notesPanelTurnOn">Notifications are off — Turn on</button>';
            var onBtn = document.getElementById('notesPanelTurnOn');
            if (onBtn) onBtn.addEventListener('click', function () { setNotesMuted(false); });
            return;
        }
        if (toggle) toggle.style.display = '';
        if (!notesCache || !notesCache.length) {
            // Always show the block (owner, 2026-11-13: he went looking for
            // where notifications come out and found nothing — the block
            // used to stay hidden until the first reply arrived). Empty, it
            // renders as ONE pill row like the other menu bars (his note
            // the same day: a heading + grey sentence in the middle looked
            // messy); with real notes it expands into the list below.
            wrap.classList.add('is-empty');
            list.innerHTML = '<div class="auth-menu-note auth-menu-notes-empty">Notifications — nothing yet</div>';
            return;
        }
        wrap.classList.remove('is-empty');
        list.innerHTML = notesCache.slice(0, 8).map(function (n, i) {
            var site = n.site === 'gb' ? 'Gifting Butler' : 'CommonCents';
            var what = n.type === 'reply'
                ? '<strong>' + escNote(n.fromName || 'Someone') + '</strong> replied to your comment'
                : '<strong>Your submission is live</strong>';
            var txt = n.text ? ' <span class="an-text">&ldquo;' + escNote(n.text) + '&rdquo;</span>' : '';
            var when = n.ts ? ' <span class="an-when">&middot; ' + noteWhen(n.ts) + '</span>' : '';
            var inner = '<span class="an-site">' + site + '</span> ' + what + txt + when;
            // Click-through (owner, 2026-11-15): a note that points at
            // something is a button. A CommonCents note opens its deal
            // (and scrolls to its comment) right here; a Gifting
            // Butler note opens that site, where its own inbox does
            // the same job.
            if (n.site === 'gb' || n.refId) {
                return '<button type="button" class="auth-menu-note an-click" data-nidx="' + i + '">' + inner + '</button>';
            }
            return '<div class="auth-menu-note">' + inner + '</div>';
        }).join('');
        list.querySelectorAll('.an-click').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var n = (notesCache || [])[parseInt(btn.getAttribute('data-nidx'), 10)];
                if (!n) return;
                // A clicked note goes away (owner, 2026-11-15): the row
                // leaves the panel at once and the dismissal fires in
                // the background — navigation never waits on it. If the
                // call fails the note simply comes back on the next load.
                dismissNote(n);
                if (n.site === 'gb') {
                    window.open('https://giftingbutler-74395.web.app', '_blank', 'noopener');
                    return;
                }
                var panel = document.getElementById('notesPanel');
                if (panel) panel.style.display = 'none';
                // On phones the notes live inside the menu drawer —
                // heading to the deal closes the drawer too.
                if (window.CC_MOBILE_NAV) window.CC_MOBILE_NAV.close();
                if (typeof window.CC_OPEN_DEAL_COMMENT === 'function') {
                    window.CC_OPEN_DEAL_COMMENT(n.refId, n.commentId || '');
                } else if (n.refId) {
                    // No deal machinery on this page (a subpage running
                    // auth.js alone): stash the target and go home,
                    // where app.js opens the item on arrival — never a
                    // dead click.
                    try {
                        sessionStorage.setItem('ccOpenNote', JSON.stringify({
                            refId: String(n.refId), commentId: n.commentId || ''
                        }));
                    } catch (e) { /* storage unavailable — still go home */ }
                    window.location.href = 'index.html';
                }
            });
        });
    }
    function loadNotes(user) {
        if (!user) return;
        user.getIdToken().then(function (token) {
            return postFn('getNotifications', {}, token);
        }).then(function (res) {
            if (!res || res.error) return;
            notesCache = Array.isArray(res.items) ? res.items : [];
            notesUnread = res.unread || 0;
            notesMuted = !!res.muted;
            paintNoteBadge();
            paintNotesList();
        }).catch(function () { /* notes retry on the next sign-in */ });
    }
    function setNotesMuted(muted) {
        notesMuted = !!muted;
        if (notesMuted) notesUnread = 0;
        paintNoteBadge();
        paintNotesList();
        if (!currentUser) return;
        var user = currentUser;
        user.getIdToken().then(function (token) {
            return postFn('setNotificationsMuted', { muted: notesMuted }, token);
        }).catch(function () { /* the switch re-syncs on next sign-in */ });
    }
    // Dismiss ONE note for good (owner, 2026-11-15: "once you click
    // it, it just goes away — otherwise you'll have 500 replies stack
    // up"). Optimistic: the note leaves the local list and the panel
    // repaints immediately (falling back to the empty state when it
    // was the last one); the server delete follows in the background.
    function dismissNote(n) {
        if (!n || !n.id) return;
        if (notesCache) notesCache = notesCache.filter(function (x) { return x.id !== n.id; });
        // Repaint on the next tick, not mid-click: replacing the list
        // HTML during the tap would detach the clicked button, and the
        // document's outside-click closer would then read the tap as
        // a click outside the panel and close it.
        setTimeout(paintNotesList, 0);
        if (!currentUser) return;
        var user = currentUser;
        user.getIdToken().then(function (token) {
            return postFn('dismissNotification', { id: n.id }, token);
        }).catch(function () { /* the note may reappear next visit */ });
    }
    function markNotesRead() {
        if (!currentUser || !notesUnread) return;
        var user = currentUser;
        notesUnread = 0;
        paintNoteBadge();
        user.getIdToken().then(function (token) {
            return postFn('markNotificationsRead', {}, token);
        }).catch(function () { /* the badge may reappear next visit */ });
    }

    // ── Phone menu layout (owner, 2026-11-15, second redesign) ──
    // On phones the bell + avatar leave the header's top row and
    // the hamburger panel becomes the one menu. The account block
    // and the notes inside that panel are NOT copies: at phone
    // widths the real #authMenu and #notesPanel elements move into
    // the panel's slots (and the menu's own Sign out button moves
    // to the panel's bottom slot), so every handler wired in
    // wireUi keeps working on the same elements. At desktop widths
    // everything moves back to the auth area and the bell + avatar
    // menu behave exactly as before. Pages without the panel (the
    // subpages run auth.js alone) simply never relocate.
    var phoneMq = null;
    try { phoneMq = window.matchMedia ? window.matchMedia('(max-width: 900px)') : null; } catch (e) { phoneMq = null; }
    var phoneLayout = false;
    var movedEls = [];
    function moveEl(el, target) {
        if (!el || !target || el.parentNode === target) return;
        movedEls.push({ el: el, parent: el.parentNode, next: el.nextSibling });
        target.appendChild(el);
    }
    // Inside the drawer, two of the account menu's rows duplicate
    // panel rows (owner, 2026-11-15, third pass — he counted two
    // giveaways and two Saveds in the panel and called it chaotic):
    // its Giveaway row duplicates the panel's Weekly Giveaway row
    // (whose small state line carries the giveaway state there),
    // and its Saved deals row duplicates the Deals section's Saved
    // link. They hide while the menu lives in the drawer and come
    // back when it returns to the desktop auth area — the desktop
    // menu keeps both rows exactly as before.
    function setDrawerDupRows(show) {
        var gw = document.getElementById('authMenuGiveaway');
        if (gw) gw.style.display = show ? '' : 'none';
        var sv = document.getElementById('authMenuSaved');
        if (sv) sv.style.display = show ? '' : 'none';
    }
    function applyPhoneLayout() {
        if (phoneLayout) return;
        var slot = document.getElementById('mobileAccountSlot');
        var menu = document.getElementById('authMenu');
        if (!slot || !menu) return; // no phone panel on this page
        phoneLayout = true;
        moveEl(menu, slot);
        moveEl(document.getElementById('notesPanel'), document.getElementById('mobileNotesSlot'));
        moveEl(document.getElementById('authMenuSignOut'), document.getElementById('mobileSignOutSlot'));
        setDrawerDupRows(false);
        document.body.classList.add('cc-phone-layout');
        syncPhoneChrome();
    }
    function applyDesktopLayout() {
        if (!phoneLayout) return;
        phoneLayout = false;
        for (var i = movedEls.length - 1; i >= 0; i--) {
            var m = movedEls[i];
            if (!m.parent) continue;
            if (m.next && m.next.parentNode === m.parent) m.parent.insertBefore(m.el, m.next);
            else m.parent.appendChild(m.el);
        }
        movedEls = [];
        setDrawerDupRows(true);
        var menu = document.getElementById('authMenu');
        if (menu) menu.style.display = 'none';
        var notes = document.getElementById('notesPanel');
        if (notes) notes.style.display = 'none';
        document.body.classList.remove('cc-phone-layout');
        paintNoteBadge();
    }
    function applyPhoneMq() {
        if (!phoneMq) return;
        if (phoneMq.matches) applyPhoneLayout(); else applyDesktopLayout();
    }
    // The panel-only rows follow the sign-in state: signed out, the
    // account slot shows just its Sign in row; signed in, the
    // Notifications row and the Sign out slot appear.
    function syncPhoneChrome() {
        var signIn = document.getElementById('mobileSignInBtn');
        if (signIn) signIn.style.display = currentUser ? 'none' : '';
        var notesRow = document.getElementById('mobileNotesRow');
        if (notesRow) notesRow.style.display = currentUser ? '' : 'none';
        var outSlot = document.getElementById('mobileSignOutSlot');
        if (outSlot) outSlot.style.display = currentUser ? '' : 'none';
        paintNoteBadge();
    }
    // app.js's panel controller hands over to this on phone widths:
    // opening the panel paints the account block in place (the
    // notes stay tucked away until their row is tapped).
    window.CC_PHONE_MENU = {
        active: function () { return phoneLayout; },
        onPanelOpen: function () {
            var notes = document.getElementById('notesPanel');
            if (notes) notes.style.display = 'none';
            if (currentUser && typeof window.CC_PAINT_ACCOUNT_MENU === 'function') {
                window.CC_PAINT_ACCOUNT_MENU();
            } else {
                var menu = document.getElementById('authMenu');
                if (menu) menu.style.display = 'none';
            }
            syncPhoneChrome();
        }
    };
    if (phoneMq) {
        if (typeof phoneMq.addEventListener === 'function') phoneMq.addEventListener('change', applyPhoneMq);
        else if (typeof phoneMq.addListener === 'function') phoneMq.addListener(applyPhoneMq);
    }

    function syncFromAccount(user, tries) {
        if (!window.CC_FEED || !CC_FEED.getInterests) {
            if ((tries || 0) < 10) setTimeout(function () { syncFromAccount(user, (tries || 0) + 1); }, 300);
            return;
        }
        loadNotes(user);
        user.getIdToken().then(function (token) {
            return postFn('ccGetProfile', {}, token);
        }).then(function (res) {
            if (!res || res.error) return;
            profileUsername = typeof res.username === 'string' ? res.username : '';
            // Submitter rewards (engagement plan B): this week's
            // submission bonus from the profile, painted into the
            // giveaway modal by app.js when it's positive.
            profileSubBonus = (typeof res.submissionBonus === 'number' && res.submissionBonus > 0)
                ? Math.floor(res.submissionBonus) : 0;
            if (typeof window.CC_PAINT_SUB_BONUS === 'function') window.CC_PAINT_SUB_BONUS();
            var acct = Array.isArray(res.interests) ? res.interests : [];
            var local = CC_FEED.getInterests();
            if (acct.length) {
                // The account wins — these picks follow the person.
                CC_FEED.setInterests(acct, true);
            } else if (local.length) {
                // First sign-in with picks already made on this device:
                // lift them into the account.
                saveNow(user, local);
            }
            // Votes merge the never-lose way — union of the account's
            // map and this device's — EXCEPT where a deletion
            // tombstone says the member removed the vote on purpose:
            // a tombstone at least as new as every stamped copy of
            // the vote wins, so an un-vote sticks on every device
            // (owner bug report, 2026-11-15). Votes nobody stamped
            // (everything saved before tombstones existed) count as
            // time 0 and still union exactly as before, so a stale or
            // empty device can never shrink the account by signing in.
            if (window.CC_VOTES) {
                var acctVotes = (res.votes && typeof res.votes === 'object' && !Array.isArray(res.votes)) ? res.votes : {};
                var localVotes = CC_VOTES.get();
                var acctVTimes = (res.voteTimes && typeof res.voteTimes === 'object' && !Array.isArray(res.voteTimes)) ? res.voteTimes : {};
                var localVTimes = (typeof CC_VOTES.getTimes === 'function') ? CC_VOTES.getTimes() : {};
                var acctVTombs = (res.voteTombstones && typeof res.voteTombstones === 'object' && !Array.isArray(res.voteTombstones)) ? res.voteTombstones : {};
                var localVTombs = (typeof CC_VOTES.getTombs === 'function') ? CC_VOTES.getTombs() : {};
                var vKeys = {};
                [acctVotes, localVotes, acctVTimes, localVTimes, acctVTombs, localVTombs].forEach(function (m) {
                    Object.keys(m).forEach(function (k) { vKeys[k] = true; });
                });
                var mergedVotes = {}, mergedVTimes = {}, mergedVTombs = {};
                Object.keys(vKeys).forEach(function (k) {
                    var tomb = Math.max(acctVTombs[k] || 0, localVTombs[k] || 0);
                    var aHas = Object.prototype.hasOwnProperty.call(acctVotes, k);
                    var lHas = Object.prototype.hasOwnProperty.call(localVotes, k);
                    var aT = aHas ? (acctVTimes[k] || 0) : -1;
                    var lT = lHas ? (localVTimes[k] || 0) : -1;
                    var bestT = Math.max(aT, lT);
                    if (bestT < 0) { if (tomb) mergedVTombs[k] = tomb; return; }
                    if (tomb && tomb >= bestT) { mergedVTombs[k] = tomb; return; }
                    if (lHas && lT >= aT) { mergedVotes[k] = localVotes[k]; if (lT > 0) mergedVTimes[k] = lT; }
                    else { mergedVotes[k] = acctVotes[k]; if (aT > 0) mergedVTimes[k] = aT; }
                });
                var vDiffers = JSON.stringify(mergedVotes) !== JSON.stringify(localVotes)
                    || JSON.stringify(mergedVTimes) !== JSON.stringify(localVTimes)
                    || JSON.stringify(mergedVTombs) !== JSON.stringify(localVTombs);
                var acctStale = JSON.stringify(mergedVotes) !== JSON.stringify(acctVotes)
                    || JSON.stringify(mergedVTimes) !== JSON.stringify(acctVTimes)
                    || JSON.stringify(mergedVTombs) !== JSON.stringify(acctVTombs);
                if (vDiffers) CC_VOTES.set(mergedVotes, mergedVTimes, mergedVTombs); // set() also pushes the merge back up
                else if (acctStale) saveVotesNow(user, mergedVotes);
            }
            // Saves merge the same never-lose way — union by item —
            // with the same tombstone exception: a record whose
            // tombstone is at least as new as the record's own save
            // time was removed on purpose and stays out. Records are
            // keyed by kind + id (a deal and a freebie can share a
            // number); when both sides hold a record, the newer save
            // wins, ties go to the account's copy as before.
            if (window.CC_SAVES) {
                var acctSaves = Array.isArray(res.saves) ? res.saves : [];
                var localSaves = CC_SAVES.get();
                var acctSTombs = (res.saveTombstones && typeof res.saveTombstones === 'object' && !Array.isArray(res.saveTombstones)) ? res.saveTombstones : {};
                var localSTombs = (typeof CC_SAVES.getTombs === 'function') ? CC_SAVES.getTombs() : {};
                var sTombs = {};
                Object.keys(acctSTombs).forEach(function (k) { if (typeof acctSTombs[k] === 'number') sTombs[k] = acctSTombs[k]; });
                Object.keys(localSTombs).forEach(function (k) { if (typeof localSTombs[k] === 'number') sTombs[k] = Math.max(sTombs[k] || 0, localSTombs[k]); });
                var sKeyOf = function (s) { return (s.kind === 'freebie' ? 'f' : 'd') + s.id; };
                var sWin = {}, sOrder = [];
                var sConsider = function (s, isAcct) {
                    if (!s || !Number.isInteger(s.id) || s.id <= 0) return;
                    var k = sKeyOf(s);
                    var ts = (typeof s.ts === 'number' && isFinite(s.ts)) ? s.ts : 0;
                    var cur = sWin[k];
                    if (!cur) { sWin[k] = { rec: s, ts: ts }; sOrder.push(k); return; }
                    if (ts > cur.ts || (ts === cur.ts && isAcct)) sWin[k] = { rec: s, ts: ts };
                };
                localSaves.forEach(function (s) { sConsider(s, false); });
                acctSaves.forEach(function (s) { sConsider(s, true); });
                var mergedSaves = [], mergedSTombs = {};
                sOrder.forEach(function (k) {
                    var w = sWin[k];
                    var tomb = sTombs[k] || 0;
                    if (tomb && tomb >= w.ts) { mergedSTombs[k] = tomb; return; }
                    mergedSaves.push(w.rec);
                });
                // Tombstones for items neither side currently holds
                // still matter — a third device may hold the item.
                Object.keys(sTombs).forEach(function (k) { if (!sWin[k] && !(k in mergedSTombs)) mergedSTombs[k] = sTombs[k]; });
                var sDiffers = JSON.stringify(mergedSaves) !== JSON.stringify(localSaves)
                    || JSON.stringify(mergedSTombs) !== JSON.stringify(localSTombs);
                var acctSKeys = {};
                acctSaves.forEach(function (s) { acctSKeys[sKeyOf(s)] = JSON.stringify(s); });
                var acctSStale = mergedSaves.some(function (s) { return acctSKeys[sKeyOf(s)] !== JSON.stringify(s); })
                    || JSON.stringify(mergedSTombs) !== JSON.stringify(acctSTombs);
                if (sDiffers) CC_SAVES.set(mergedSaves, mergedSTombs); // set() also pushes the merge back up
                else if (acctSStale) saveSavesNow(user, mergedSaves);
            }
        }).catch(function () { /* guest picks remain in effect */ });
    }

    function friendlyError(err) {
        var code = (err && err.code) || '';
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found')
            return "That email and password combo didn't work. Check them and try again.";
        if (code === 'auth/email-already-in-use')
            return 'That email already has an account — sign in instead.';
        if (code === 'auth/weak-password')
            return 'Password needs at least 6 characters.';
        if (code === 'auth/invalid-email')
            return "That email address doesn't look right.";
        if (code === 'auth/too-many-requests')
            return 'Too many tries — wait a minute and try again.';
        if (code === 'auth/popup-closed-by-user')
            return '';
        return 'Something went wrong — please try again.';
    }

    function paintHeader() {
        var inBtn = document.getElementById('signInBtn');
        var emailEl = document.getElementById('authEmail');
        if (!inBtn || !emailEl) return;
        // The bell exists only for members (owner, 2026-11-15):
        // signed-out visitors have no notifications, so no bell.
        var bellEl = document.getElementById('notesBell');
        if (bellEl) bellEl.style.display = currentUser ? '' : 'none';
        if (currentUser) {
            inBtn.style.display = 'none';
            emailEl.style.display = '';
            // No raw email in the header (the user disliked it). If the
            // account has a picture (Google sign-ins do), show it in the
            // circle; otherwise the email's first letter — the pattern
            // most sites use. Full email stays on hover.
            emailEl.title = currentUser.email || '';
            emailEl.classList.add('as-avatar');
            if (currentUser.photoURL) {
                emailEl.innerHTML = '';
                var avImg = document.createElement('img');
                avImg.src = currentUser.photoURL;
                avImg.alt = '';
                avImg.referrerPolicy = 'no-referrer';
                avImg.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;';
                avImg.onerror = function () {
                    emailEl.textContent = (currentUser.email || '?').charAt(0).toUpperCase();
                };
                emailEl.appendChild(avImg);
            } else {
                emailEl.textContent = (currentUser.email || '?').charAt(0).toUpperCase();
            }
        } else {
            inBtn.style.display = '';
            emailEl.style.display = 'none';
            emailEl.textContent = '';
            emailEl.title = '';
            emailEl.classList.remove('as-avatar');
            var menuEl0 = document.getElementById('authMenu');
            if (menuEl0) menuEl0.style.display = 'none';
            var panelEl0 = document.getElementById('notesPanel');
            if (panelEl0) panelEl0.style.display = 'none';
        }
        // Re-apply the unread badge after every repaint (it hangs on
        // the bell now; paintHeader owns the bell's visibility).
        paintNoteBadge();
        // The phone panel's own rows (Sign in / Notifications /
        // Sign out slot) follow the same sign-in state.
        syncPhoneChrome();
    }

    function wireUi() {
        var modal = document.getElementById('authModal');
        var inBtn = document.getElementById('signInBtn');
        var closeBtn = document.getElementById('authClose');
        var form = document.getElementById('authForm');
        var emailIn = document.getElementById('authEmailInput');
        var pwIn = document.getElementById('authPasswordInput');
        var submitBtn = document.getElementById('authSubmitBtn');
        var toggle = document.getElementById('authToggleMode');
        var title = document.getElementById('authTitle');
        var errEl = document.getElementById('authError');
        var googleBtn = document.getElementById('authGoogleBtn');
        if (!modal || !inBtn || !form) return;

        // ── Avatar menu: the comment-name setting lives here (moved out of
        // the comment form at the user's direction — the form was carrying
        // too much machinery). Clicking the avatar opens it.
        var menu = document.getElementById('authMenu');
        var avatarEl = document.getElementById('authEmail');
        var menuEmail = document.getElementById('authMenuEmail');
        var nameInput = document.getElementById('authMenuNameInput');
        var nameSave = document.getElementById('authMenuNameSave');
        var nameMsg = document.getElementById('authMenuNameMsg');
        var nameRow = document.getElementById('authMenuNameRow');
        var nameLabel = document.getElementById('authMenuNameLabel');
        var nameEditor = document.getElementById('authMenuNameEditor');
        var nameCancel = document.getElementById('authMenuNameCancel');
        function closeMenu() { if (menu) menu.style.display = 'none'; }
        // ── Notifications panel (owner, 2026-11-15): the
        // Notifications row inside the avatar menu opens the panel;
        // opening it does
        // what opening the account menu used to do — paint the list
        // and mark the notes read. Bell and menu never show at once.
        var bellEl = document.getElementById('notesBell');
        var panelEl = document.getElementById('notesPanel');
        function closePanel() { if (panelEl) panelEl.style.display = 'none'; }
        // The phone menu panel (app.js) is the third header popover:
        // one at a time, so opening the menu or the notes closes it.
        function closeMobileNav() {
            var p = document.getElementById('mobileNavPanel');
            if (p) p.style.display = 'none';
            var b = document.getElementById('mobileMenuBtn');
            if (b) b.setAttribute('aria-expanded', 'false');
        }
        function openPanel() {
            if (!panelEl || !currentUser) return;
            closeMenu();
            closeMobileNav();
            paintNotesList();
            markNotesRead();
            panelEl.style.display = '';
        }
        // The comment-name setting lives behind a closed row ("Comment
        // name: X" + Change): the editor opens only when asked and
        // collapses back after a save or a Cancel. Every fresh menu open
        // starts from the closed row.
        function shownCommentName() {
            // Picked username, else the generated name — the account
            // display name is never shown as a comment name (2026-11-15).
            var gen = (!profileUsername && window.CC_AUTH.fallbackName) ? window.CC_AUTH.fallbackName() : '';
            return profileUsername || gen || '';
        }
        function paintNameRow() {
            if (!nameLabel) return;
            var shown = shownCommentName();
            nameLabel.textContent = shown ? 'Comment name: ' + shown : 'Comment name';
        }
        function collapseNameEditor() {
            if (nameEditor) nameEditor.style.display = 'none';
            if (nameRow) nameRow.style.display = '';
            if (nameMsg) nameMsg.style.display = 'none';
            var cur = document.getElementById('authMenuCurrent');
            if (cur) cur.style.display = 'none';
        }
        function openNameEditor() {
            if (nameInput) nameInput.value = profileUsername || '';
            if (nameMsg) nameMsg.style.display = 'none';
            var cur = document.getElementById('authMenuCurrent');
            if (cur) {
                var shown = shownCommentName();
                if (!profileUsername && shown) {
                    cur.textContent = 'Right now your comments show as ' + shown + '.';
                    cur.style.display = '';
                } else {
                    cur.style.display = 'none';
                }
            }
            if (nameRow) nameRow.style.display = 'none';
            if (nameEditor) nameEditor.style.display = '';
            if (nameInput && nameInput.focus) nameInput.focus();
        }
        // The menu shows a masked email only: first 3 characters of the
        // local part + "•••" + "@" + full domain (first character + "•••"
        // when the local part is 3 chars or fewer). The full address is
        // never rendered in the menu.
        function maskEmail(email) {
            var s = String(email || '');
            var at = s.indexOf('@');
            if (at < 0) return s ? s.charAt(0) + '\u2022\u2022\u2022' : '';
            var local = s.slice(0, at);
            var head = local.length > 3 ? local.slice(0, 3) : local.charAt(0);
            return head + '\u2022\u2022\u2022' + s.slice(at);
        }
        // The menu's contents, painted fresh at every open: masked
        // email, the comment-name row (editor collapsed), the
        // giveaway row's state and the Saved count. Shared by the
        // desktop avatar menu and the phone panel's account block —
        // the same element, moved into the panel on phone widths.
        function paintAccountMenu() {
            if (!menu || !currentUser) return;
            if (menuEmail) menuEmail.textContent = maskEmail(currentUser.email || '');
            if (nameInput) nameInput.value = profileUsername || '';
            // Fresh open = the comment-name editor starts collapsed.
            collapseNameEditor();
            paintNameRow();
            var gwRow = document.getElementById('authMenuGiveaway');
            if (gwRow) {
                var gwLabel = document.getElementById('authMenuGiveawayLabel');
                var gwCount = document.getElementById('authMenuGiveawayCount');
                var gw = window.CC_GW;
                if (gw && gw.isActive && !gw.isActive()) {
                    // Giveaway not launched yet — coming-soon state.
                    if (gwLabel) gwLabel.textContent = 'Giveaway: coming soon';
                    if (gwCount) gwCount.textContent = '';
                } else if (gw && gw.isEntered && gw.isEntered()) {
                    var n = 1 + (gw.bonus ? gw.bonus() : 0);
                    if (gwLabel) gwLabel.textContent = 'Giveaway: you\u2019re in this week';
                    if (gwCount) gwCount.textContent = n + (n === 1 ? ' entry' : ' entries');
                } else {
                    if (gwLabel) gwLabel.textContent = 'Giveaway: not entered yet \u2014 enter';
                    if (gwCount) gwCount.textContent = '';
                }
            }
            var svCount = document.getElementById('authMenuSavedCount');
            if (svCount) svCount.textContent = (window.CC_SAVES && CC_SAVES.get().length) ? String(CC_SAVES.get().length) : '';
        }
        function openMenu() {
            if (!menu || !currentUser) return;
            closeMobileNav();
            paintAccountMenu();
            menu.style.display = '';
        }
        // The phone panel's account block paints through the same
        // path (app.js → CC_PHONE_MENU.onPanelOpen → here).
        window.CC_PAINT_ACCOUNT_MENU = function () {
            paintAccountMenu();
            if (menu && currentUser) menu.style.display = '';
        };
        if (avatarEl) avatarEl.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!currentUser) return;
            closePanel();
            if (menu && menu.style.display !== 'none') closeMenu(); else openMenu();
        });
        var menuNotesRow = document.getElementById('authMenuNotesRow');
        if (menuNotesRow) menuNotesRow.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!currentUser) return;
            if (panelEl && panelEl.style.display !== 'none') closePanel(); else openPanel();
        });
        // ── Phone panel rows (owner, 2026-11-15): inside the
        // hamburger drawer, the Notifications row opens the notes
        // in their slot right under it — same painting and
        // mark-read as the bell, without closing the drawer — and
        // the account block's Sign in row clicks the header's own
        // Sign in button, so the one auth modal opens as always.
        var mNotesRow = document.getElementById('mobileNotesRow');
        if (mNotesRow) mNotesRow.addEventListener('click', function () {
            if (!currentUser || !panelEl) return;
            if (panelEl.style.display !== 'none') { closePanel(); return; }
            paintNotesList();
            markNotesRead();
            panelEl.style.display = '';
        });
        var mSignInBtn = document.getElementById('mobileSignInBtn');
        if (mSignInBtn) mSignInBtn.addEventListener('click', function () {
            if (window.CC_MOBILE_NAV) window.CC_MOBILE_NAV.close();
            inBtn.click();
        });
        document.addEventListener('click', function (e) {
            // On phone widths the menu lives inside the hamburger
            // panel, not the auth area — taps in there are inside
            // the menu, not outside it.
            if (menu && menu.style.display !== 'none' && !e.target.closest('.auth-area') && !e.target.closest('#mobileNavPanel')) closeMenu();
        });
        document.addEventListener('click', function (e) {
            // The phone panel's Notifications row is an opener too
            // (the notes live in the drawer there) — its tap must
            // not read as an outside click and close what it opened.
            if (panelEl && panelEl.style.display !== 'none'
                && !e.target.closest('#notesPanel') && !e.target.closest('#authMenuNotesRow')
                && !e.target.closest('#mobileNotesRow')) closePanel();
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenu(); closePanel(); } });
        var menuCloseBtn = document.getElementById('authMenuClose');
        if (menuCloseBtn) menuCloseBtn.addEventListener('click', function (e) { e.stopPropagation(); closeMenu(); });
        if (nameSave) nameSave.addEventListener('click', function () {
            var v = (nameInput && nameInput.value || '').trim();
            function show(txt, ok) {
                if (!nameMsg) return;
                nameMsg.textContent = txt;
                nameMsg.style.display = '';
                nameMsg.style.color = ok ? '#15803d' : '#ef4444';
            }
            if (!/^[A-Za-z0-9_.\- ]{3,24}$/.test(v)) {
                show('Use 3–24 characters: letters, numbers, spaces, dots, dashes or underscores.', false);
                return;
            }
            nameSave.disabled = true;
            window.CC_AUTH.setUsername(v).then(function () {
                nameSave.disabled = false;
                show('Saved — your comments will show this name.', true);
                // Show the confirmation briefly, then collapse the editor
                // back to the closed row (which now shows the new name).
                // The menu itself stays open.
                setTimeout(function () { collapseNameEditor(); paintNameRow(); }, 1100);
            }).catch(function () {
                nameSave.disabled = false;
                show('Could not save that name — try again.', false);
            });
        });
        if (nameRow) nameRow.addEventListener('click', function () { openNameEditor(); });
        if (nameCancel) nameCancel.addEventListener('click', function () {
            if (nameInput) nameInput.value = profileUsername || '';
            collapseNameEditor();
        });
        var feedRow = document.getElementById('authMenuFeed');
        if (feedRow) feedRow.addEventListener('click', function () {
            closeMenu();
            if (window.CC_MOBILE_NAV) window.CC_MOBILE_NAV.close();
            var b = document.getElementById('feedWidgetChange');
            if (b) b.click();
        });
        var gwRowBtn = document.getElementById('authMenuGiveaway');
        if (gwRowBtn) gwRowBtn.addEventListener('click', function () {
            closeMenu();
            if (window.CC_MOBILE_NAV) window.CC_MOBILE_NAV.close();
            var g = document.getElementById('openGiveaway');
            if (g) g.click();
        });
        var savedRowBtn = document.getElementById('authMenuSaved');
        if (savedRowBtn) savedRowBtn.addEventListener('click', function () {
            closeMenu();
            if (window.CC_MOBILE_NAV) window.CC_MOBILE_NAV.close();
            var link = document.querySelector('.main-nav a[data-category="saved"]') || document.querySelector('.category-list a[data-category="saved"]');
            if (link) link.click();
        });
        var mode = 'signin'; // or 'signup'

        function setMode(m) {
            mode = m;
            title.textContent = m === 'signin' ? 'Sign in' : 'Create your account';
            submitBtn.textContent = m === 'signin' ? 'Sign in' : 'Create account';
            toggle.textContent = m === 'signin'
                ? "New here? Create an account"
                : 'Already have an account? Sign in';
            errEl.style.display = 'none';
        }
        function showErr(msg) {
            if (!msg) { errEl.style.display = 'none'; return; }
            errEl.textContent = msg;
            errEl.style.display = 'block';
        }
        function openModal() { setMode('signin'); modal.style.display = 'flex'; }
        function closeModal() { modal.style.display = 'none'; }

        inBtn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
        // Restore (Account Guard): two-tap, like Gifting Butler's —
        // first tap arms the row, second pulls the backup snapshot and
        // applies votes + picks + comment name from it.
        var notesToggleBtn = document.getElementById('notesPanelToggle');
        if (notesToggleBtn) notesToggleBtn.addEventListener('click', function () { setNotesMuted(true); });
        var restoreBtn = document.getElementById('authMenuRestore');
        var restoreMsg = document.getElementById('authMenuRestoreMsg');
        var restoreArmed = false, restoreArmTimer = null;
        function showRestoreMsg(txt) {
            if (!restoreMsg) return;
            restoreMsg.textContent = txt;
            restoreMsg.style.display = txt ? '' : 'none';
        }
        if (restoreBtn) restoreBtn.addEventListener('click', function () {
            if (!currentUser) return;
            if (!restoreArmed) {
                restoreArmed = true;
                restoreBtn.textContent = 'Tap again to restore';
                clearTimeout(restoreArmTimer);
                restoreArmTimer = setTimeout(function () {
                    restoreArmed = false;
                    restoreBtn.textContent = 'Restore my account';
                }, 4000);
                return;
            }
            restoreArmed = false;
            restoreBtn.textContent = 'Restore my account';
            showRestoreMsg('Restoring…');
            var user = currentUser;
            user.getIdToken().then(function (token) {
                return postFn('ccRestoreBackup', {}, token);
            }).then(function (res) {
                if (!res || res.error) { showRestoreMsg('Restore failed — try again.'); return; }
                if (res.empty) { showRestoreMsg('No backup yet — one is saved automatically if your votes or picks ever shrink.'); return; }
                // Restore is the member explicitly asking for the
                // backup's state back, so tombstones for the restored
                // items are dropped — otherwise a removal recorded
                // after the backup would kill the restore at the next
                // sign-in merge. Other items' tombstones stand.
                if (window.CC_VOTES && res.votes) {
                    var rTombs = (res.voteTombstones && typeof res.voteTombstones === 'object' && !Array.isArray(res.voteTombstones))
                        ? Object.assign({}, res.voteTombstones)
                        : (typeof CC_VOTES.getTombs === 'function' ? CC_VOTES.getTombs() : {});
                    Object.keys(res.votes).forEach(function (k) { delete rTombs[k]; });
                    var rTimes = (res.voteTimes && typeof res.voteTimes === 'object' && !Array.isArray(res.voteTimes)) ? res.voteTimes : undefined;
                    CC_VOTES.set(res.votes, rTimes, rTombs);
                }
                if (window.CC_SAVES && Array.isArray(res.saves)) {
                    var rSTombs = (res.saveTombstones && typeof res.saveTombstones === 'object' && !Array.isArray(res.saveTombstones))
                        ? Object.assign({}, res.saveTombstones)
                        : (typeof CC_SAVES.getTombs === 'function' ? CC_SAVES.getTombs() : {});
                    res.saves.forEach(function (s) { delete rSTombs[(s.kind === 'freebie' ? 'f' : 'd') + s.id]; });
                    CC_SAVES.set(res.saves, rSTombs);
                }
                if (window.CC_FEED && Array.isArray(res.interests) && res.interests.length) CC_FEED.setInterests(res.interests, true);
                if (res.username) { profileUsername = res.username; paintNameRow(); }
                var when = res.savedAt ? new Date(res.savedAt).toLocaleDateString() : '';
                var n = res.votes ? Object.keys(res.votes).length : 0;
                var ns = Array.isArray(res.saves) ? res.saves.length : 0;
                showRestoreMsg('Restored ' + n + ' vote' + (n === 1 ? '' : 's') + (ns ? ' and ' + ns + ' saved deal' + (ns === 1 ? '' : 's') : '') + (res.interests && res.interests.length ? ' and your feed picks' : '') + (when ? ' from ' + when : '') + '.');
            }).catch(function () { showRestoreMsg('Restore failed — try again.'); });
        });

        var menuOutBtn = document.getElementById('authMenuSignOut');
        if (menuOutBtn) menuOutBtn.addEventListener('click', function () {
            closeMenu();
            // On phones the button sits at the drawer bottom —
            // signing out tucks the drawer away too.
            if (window.CC_MOBILE_NAV) window.CC_MOBILE_NAV.close();
            if (auth) auth.signOut();
        });
        toggle.addEventListener('click', function () { setMode(mode === 'signin' ? 'signup' : 'signin'); });

        if (googleBtn) googleBtn.addEventListener('click', function () {
            if (!auth) return;
            showErr('');
            auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
                .then(closeModal)
                .catch(function (err) { showErr(friendlyError(err)); });
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!auth) { showErr('Sign-in is unavailable right now — please try again later.'); return; }
            var email = (emailIn.value || '').trim().toLowerCase();
            var pw = pwIn.value || '';
            showErr('');
            submitBtn.disabled = true;
            var p = mode === 'signin'
                ? auth.signInWithEmailAndPassword(email, pw)
                : auth.createUserWithEmailAndPassword(email, pw);
            p.then(function () { closeModal(); })
             .catch(function (err) { showErr(friendlyError(err)); })
             .then(function () { submitBtn.disabled = false; });
        });
    }

    window.CC_AUTH = {
        ready: function () { return !!auth; },
        user: function () { return currentUser; },
        email: function () { return currentUser ? (currentUser.email || '') : ''; },
        idToken: function () {
            return currentUser ? currentUser.getIdToken() : Promise.reject(new Error('not signed in'));
        },
        noteInterestsChanged: noteInterestsChanged,
        noteVotesChanged: noteVotesChanged,
        noteSavesChanged: noteSavesChanged,
        username: function () { return profileUsername; },
        submissionBonus: function () { return profileSubBonus; },
        // Deterministic generated username from the account id, in the
        // Word+Word+Number style (owner, 2026-11-15 — like SlickDeals'
        // OrangeWriter104): a member who never picks a comment name
        // posts under this generated name — NEVER under their account
        // display name — and the same account gets the same generated
        // name on every device and session without anything being
        // saved. The number runs 10–999. MUST match ccFallbackName in
        // the backend's cc-comments.js exactly (same lists, same hash).
        fallbackName: function () {
            if (!currentUser || !currentUser.uid) return '';
            var ADJ = ['Ace', 'Pro', 'Keen', 'Wise', 'Bold', 'Swift', 'Smart', 'Prime'];
            var NOUN = ['Saver', 'Scout', 'Seeker', 'Hunter', 'Finder', 'Buyer'];
            var h = 0, uid = String(currentUser.uid);
            for (var i = 0; i < uid.length; i++) h = ((h * 31) + uid.charCodeAt(i)) >>> 0;
            return ADJ[h % ADJ.length] + NOUN[(h >>> 4) % NOUN.length] + (10 + (h % 990));
        },
        setUsername: function (name) {
            if (!currentUser) return Promise.reject(new Error('not signed in'));
            return currentUser.getIdToken().then(function (token) {
                return postFn('ccSaveUsername', { username: name }, token);
            }).then(function (res) {
                if (res && res.username) profileUsername = res.username;
                return res;
            });
        },
        signOut: function () { if (auth) auth.signOut(); }
    };

    if (auth) {
        auth.onAuthStateChanged(function (user) {
            currentUser = user || null;
            if (!currentUser) profileUsername = '';
            paintHeader();
            // The giveaway teaser swaps its account CTA for a "ready"
            // note on sign-in (and back on sign-out).
            if (typeof window.CC_PAINT_GW_STATE === 'function') window.CC_PAINT_GW_STATE();
            // An open deal window re-reads its comments area on a
            // sign-in change: auth resolves asynchronously, so a member
            // who opened a deal before it landed must not stay stuck
            // with the signed-out snapshot (app.js owns the hook).
            if (typeof window.CC_ON_AUTH_CHANGED === 'function') window.CC_ON_AUTH_CHANGED();
            if (currentUser) {
                // The giveaway treats the account email as "your email"
                // everywhere (entry state, visit-day bonuses).
                lsSet('ccGiveawayEmail', currentUser.email || '');
                syncFromAccount(currentUser, 0);
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        wireUi();
        paintHeader();
        // Phone widths: the account menu + notes move into the
        // hamburger panel (and back out if the window grows).
        applyPhoneMq();
    });
})();
