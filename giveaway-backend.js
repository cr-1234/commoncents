// CommonCents giveaway — real backend connection.
//
// The giveaway runs in the Gifting Butler Firebase project, in its own
// collections (cc_giveaway_entries / cc_user_visits / cc_giveaway_meta) with
// its own Sunday drawing — fully separate from Gifting Butler's giveaway.
// This web config is public by design (it identifies the Firebase project;
// all access is controlled by Firestore security rules).
//
// Rules implemented here (mirroring the backend in functions/cc-giveaway.js
// of the Gifting Butler repo):
//   - 1 base entry per email per week (doc id {week}__{email}, create-only —
//     a permission-denied on re-entry means "already entered").
//   - Visit days are recorded per week; every 2 visit days = +1 bonus entry
//     at draw time (max +5). Bonuses add chances only, never change the prize.
//   - The prize ladder counts PEOPLE entered (cc_giveaway_meta count).
(function () {
    var cfg = {
        apiKey: "AIzaSyBPvwf-ilWhc5G_jAEaRDwlom0jJY678w4",
        authDomain: "giftingbutler-74395.firebaseapp.com",
        projectId: "giftingbutler-74395",
        storageBucket: "giftingbutler-74395.firebasestorage.app",
        messagingSenderId: "37308175610",
        appId: "1:37308175610:web:547281f014be448b292543"
    };

    var db = null;
    try {
        if (window.firebase && firebase.initializeApp) {
            firebase.initializeApp(cfg);
            db = firebase.firestore();
        }
    } catch (e) { db = null; }

    // Same week formula as the backend's ccWeekKey (prefix "ccgw").
    function weekKey(d) {
        d = d || new Date();
        var y = d.getFullYear();
        var w = Math.ceil(((d - new Date(y, 0, 1)) / 86400000 + new Date(y, 0, 1).getDay() + 1) / 7);
        return 'ccgw_' + y + '_w' + w;
    }
    function todayStr() {
        var d = new Date();
        function p(n) { return (n < 10 ? '0' : '') + n; }
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function getEmail() { return lsGet('ccGiveawayEmail') || ''; }
    function visitDays() {
        try { return JSON.parse(lsGet('ccVisitDays_' + weekKey()) || '[]'); }
        catch (e) { return []; }
    }
    function bonus() { return Math.min(5, Math.floor(visitDays().length / 2)); }

    var state = { count: null };
    var cached = lsGet('ccGiveawayCount');
    if (cached !== null) state.count = parseInt(cached, 10) || 0;

    function refreshCount() {
        if (!db) return;
        db.collection('cc_giveaway_meta').doc(weekKey()).get().then(function (doc) {
            var n = (doc.exists && doc.data().count) || 0;
            state.count = n;
            lsSet('ccGiveawayCount', String(n));
            if (typeof window.updateEntryCount === 'function') window.updateEntryCount();
        }).catch(function () { /* keep the last known count */ });
    }

    function recordVisit() {
        var em = getEmail();
        if (!em) return;
        var t = todayStr();
        var days = visitDays();
        if (days.indexOf(t) === -1) {
            days.push(t);
            lsSet('ccVisitDays_' + weekKey(), JSON.stringify(days));
        }
        if (!db) return;
        var wk = weekKey();
        db.collection('cc_user_visits').doc(wk + '__' + em).set(
            { email: em, week: wk, days: firebase.firestore.FieldValue.arrayUnion(t) },
            { merge: true }
        ).catch(function () { /* local mirror already kept for display */ });
    }

    function enter(email) {
        if (!db) return Promise.resolve('unavailable');
        var wk = weekKey();
        function finish(result) {
            lsSet('ccGiveawayEmail', email);
            lsSet('ccGiveawayEnteredWeek', wk);
            recordVisit();
            refreshCount();
            return result;
        }
        return db.collection('cc_giveaway_entries').doc(wk + '__' + email).set({
            email: email,
            week: wk,
            source: 'commoncents',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () {
            return finish('entered');
        }).catch(function (err) {
            // Entries are create-only by rule: if the doc already exists the
            // write is denied — that means this email is already in.
            if (err && err.code === 'permission-denied') return finish('already');
            return 'error';
        });
    }

    function lastWinner(cb) {
        if (!db) { cb(null); return; }
        var lastWeek = weekKey(new Date(Date.now() - 7 * 86400000));
        db.collection('cc_giveaway_meta').doc(lastWeek).get().then(function (doc) {
            if (doc.exists && doc.data().winnerMasked) {
                cb({ masked: doc.data().winnerMasked, prize: doc.data().prize || '' });
            } else cb(null);
        }).catch(function () { cb(null); });
    }

    window.CC_GW = {
        ready: function () { return !!db; },
        weekKey: weekKey,
        getEmail: getEmail,
        isEntered: function () {
            return !!getEmail() && lsGet('ccGiveawayEnteredWeek') === weekKey();
        },
        count: function () { return state.count; },
        visitDays: visitDays,
        bonus: bonus,
        enter: enter,
        recordVisit: recordVisit,
        refreshCount: refreshCount,
        lastWinner: lastWinner
    };

    // Every page load: count today's visit for known entrants (bonus
    // progress) and refresh the public people-counter.
    if (getEmail()) recordVisit();
    refreshCount();
})();
