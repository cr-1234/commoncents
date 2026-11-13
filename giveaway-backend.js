// CommonCents giveaway — real backend connection (HTTPS endpoints).
//
// The giveaway runs in the Gifting Butler Firebase project, in its own
// collections (cc_giveaway_entries / cc_user_visits / cc_giveaway_meta)
// with its own Sunday drawing — fully separate from Gifting Butler's
// giveaway. The site talks to three HTTPS Cloud Functions (the same
// pattern as analyzeRoom on Gifting Butler):
//
//   POST ccEnterGiveaway   {email} → enter this week's drawing
//   POST ccRecordVisit     {email} → record today's visit; returns
//                                    {visitDays, bonus} for the week
//   POST ccGiveawayStatus  {}      → {count (PEOPLE entered), prize,
//                                    lastWinner:{masked,prize}|null}
//
// Rules implemented here (mirroring the backend):
//   - 1 base entry per email per week.
//   - Visit days are recorded per week server-side; every 2 visit days
//     = +1 bonus entry at draw time (max +5). Bonuses add chances only,
//     never change the prize.
//   - The prize ladder counts PEOPLE entered (cc_giveaway_meta count).
(function () {
    var FN_BASE = 'https://us-central1-giftingbutler-74395.cloudfunctions.net/';

    function postFn(name, body, idToken) {
        var headers = { 'Content-Type': 'application/json' };
        if (idToken) headers['Authorization'] = 'Bearer ' + idToken;
        return fetch(FN_BASE + name, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body || {})
        }).then(function (r) {
            // Parse the body even on an error status — the giveaway gate
            // answers refusals with a machine-readable error code
            // (email_not_verified / connection_cap) that enter() maps
            // to a plain message. The code rides on the thrown error.
            return r.json().catch(function () { return null; }).then(function (parsed) {
                if (!r.ok) {
                    var e = new Error('HTTP ' + r.status);
                    e.code = (parsed && (parsed.error || parsed.code)) || '';
                    e.status = r.status;
                    throw e;
                }
                return parsed;
            });
        });
    }

    // Same week formula as the backend's ccWeekKey (prefix "ccgw").
    // The server is authoritative for entry weeks; this client copy is
    // only used for local display state.
    function weekKey(d) {
        d = d || new Date();
        var y = d.getFullYear();
        var w = Math.ceil(((d - new Date(y, 0, 1)) / 86400000 + new Date(y, 0, 1).getDay() + 1) / 7);
        return 'ccgw_' + y + '_w' + w;
    }
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function getEmail() { return lsGet('ccGiveawayEmail') || ''; }

    // Server-reported visit state for the current week {week, days, bonus}.
    function visitState() {
        try {
            var s = JSON.parse(lsGet('ccVisitState') || 'null');
            if (s && s.week === weekKey()) return s;
        } catch (e) {}
        return { week: weekKey(), days: 0, bonus: 0 };
    }
    function visitDays() {
        var n = visitState().days, arr = [];
        for (var i = 0; i < n; i++) arr.push(i);
        return arr; // only .length is used (display)
    }
    function visitCount() { return visitState().days; }
    function bonus() { return visitState().bonus; }

    var state = { count: null, lastWinner: undefined };
    var cached = lsGet('ccGiveawayCount');
    if (cached !== null) state.count = parseInt(cached, 10) || 0;

    function refreshCount() {
        return postFn('ccGiveawayStatus', {}).then(function (res) {
            if (res && res.ok) {
                state.count = res.count;
                state.lastWinner = res.lastWinner || null;
                lsSet('ccGiveawayCount', String(res.count));
                if (typeof window.updateEntryCount === 'function') window.updateEntryCount();
            }
        }).catch(function () { /* keep the last known count */ });
    }

    function recordVisit() {
        var em = getEmail();
        if (!em) return Promise.resolve();
        return postFn('ccRecordVisit', { email: em }).then(function (res) {
            if (res && res.ok) {
                lsSet('ccVisitState', JSON.stringify({
                    week: res.week, days: res.visitDays, bonus: res.bonus
                }));
            }
        }).catch(function () { /* display state stays as-is */ });
    }

    function enter(email, idToken) {
        // Signed-in entry: pass the account's ID token — the server uses
        // the account email and ignores the body's email field.
        // Gate refusals come back as coded errors and map to their own
        // results so the modal can explain them in plain words:
        // 'unverified' | 'conncap' (see app.js).
        return postFn('ccEnterGiveaway', { email: email }, idToken).then(function (res) {
            if (!res || !res.ok) return 'error';
            lsSet('ccGiveawayEmail', email);
            lsSet('ccGiveawayEnteredWeek', res.week);
            recordVisit();
            refreshCount();
            return res.result; // 'entered' | 'already'
        }).catch(function (err) {
            if (err && err.code === 'email_not_verified') return 'unverified';
            if (err && err.code === 'connection_cap') return 'conncap';
            return 'error';
        });
    }

    function lastWinner(cb) {
        if (state.lastWinner !== undefined) { cb(state.lastWinner); return; }
        refreshCount().then(function () { cb(state.lastWinner || null); });
    }

    window.CC_GW = {
        ready: function () { return typeof fetch === 'function'; },
        weekKey: weekKey,
        getEmail: getEmail,
        isEntered: function () {
            return !!getEmail() && lsGet('ccGiveawayEnteredWeek') === weekKey();
        },
        count: function () { return state.count; },
        visitDays: visitDays,
        visitCount: visitCount,
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
