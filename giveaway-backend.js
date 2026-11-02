// CommonCents giveaway — real backend connection.
//
// The giveaway runs in the Gifting Butler Firebase project (its own
// cc_giveaway_* collections, its own Sunday drawing) — fully separate
// from Gifting Butler's giveaway. This page talks to it through three
// HTTPS endpoints (the same pattern the Gifting Butler room-AI uses):
//
//   ccEnterGiveaway   POST {email}  → enter this week's drawing
//   ccRecordVisit     POST {email}  → record today's visit (bonus tracking)
//   ccGiveawayStatus  POST {}       → people count, prize, last winner
//
// Rules (mirrored by the backend):
//   - 1 base entry per email per week.
//   - Every 2 visit days in the week = +1 bonus entry at draw time
//     (max +5). Bonuses add chances only — they never change the prize.
//   - The prize ladder counts PEOPLE entered, never bonus entries.
(function () {
    var FN = 'https://us-central1-giftingbutler-74395.cloudfunctions.net/';

    function post(name, body) {
        return fetch(FN + name, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {})
        }).then(function (r) { return r.json(); })
          .catch(function () { return null; });
    }

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

    // Local mirror of this week's visit days (display + offline fallback).
    // The server keeps the copy that actually counts at draw time.
    function visitDays() {
        try { return JSON.parse(lsGet('ccVisitDays_' + weekKey()) || '[]'); }
        catch (e) { return []; }
    }
    function visitCount() {
        var server = parseInt(lsGet('ccVisitDaysCount_' + weekKey()) || '', 10);
        var local = visitDays().length;
        return isNaN(server) ? local : Math.max(server, local);
    }
    function bonus() { return Math.min(5, Math.floor(visitCount() / 2)); }

    var state = { count: null, lastWinner: undefined };
    var cached = lsGet('ccGiveawayCount');
    if (cached !== null) state.count = parseInt(cached, 10) || 0;

    function refreshStatus() {
        return post('ccGiveawayStatus', {}).then(function (data) {
            if (!data || !data.ok) return;
            state.count = data.count || 0;
            state.lastWinner = data.lastWinner || null;
            lsSet('ccGiveawayCount', String(state.count));
            if (typeof window.updateEntryCount === 'function') window.updateEntryCount();
        });
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
        post('ccRecordVisit', { email: em }).then(function (data) {
            if (data && data.ok && typeof data.visitDays === 'number') {
                lsSet('ccVisitDaysCount_' + weekKey(), String(data.visitDays));
            }
        });
    }

    function enter(email) {
        return post('ccEnterGiveaway', { email: email }).then(function (data) {
            if (!data) return 'error';
            if (data.ok && (data.result === 'entered' || data.result === 'already')) {
                lsSet('ccGiveawayEmail', email);
                lsSet('ccGiveawayEnteredWeek', weekKey());
                recordVisit();
                refreshStatus();
                return data.result;
            }
            return 'error';
        });
    }

    function lastWinner(cb) {
        if (state.lastWinner !== undefined) { cb(state.lastWinner); return; }
        refreshStatus().then(function () { cb(state.lastWinner || null); });
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
        refreshCount: refreshStatus,
        lastWinner: lastWinner
    };

    // Every page load: count today's visit for known entrants (bonus
    // progress) and refresh the public people-counter.
    if (getEmail()) recordVisit();
    refreshStatus();
})();
