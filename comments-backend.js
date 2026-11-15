/* CommonCents comment storage — talks to the comment endpoints on the
 * Gifting Butler backend (ccGetComments / ccPostComment / ccEditComment /
 * ccDeleteComment). Comments persist in Firestore via those endpoints;
 * the pages never touch Firestore directly. Reads are public; writes
 * carry the signed-in user's Firebase ID token, and the server derives
 * the display name (saved username → account name → generated name) —
 * the client never sends a name.
 */
(function () {
    'use strict';
    var FN = 'https://us-central1-giftingbutler-74395.cloudfunctions.net/';

    function call(name, body) {
        var u = (window.CC_AUTH && typeof CC_AUTH.user === 'function') ? CC_AUTH.user() : null;
        var tokenP = u ? u.getIdToken().catch(function () { return null; }) : Promise.resolve(null);
        var work = tokenP.then(function (t) {
            var headers = { 'Content-Type': 'application/json' };
            if (t) headers['Authorization'] = 'Bearer ' + t;
            return fetch(FN + name, { method: 'POST', headers: headers, body: JSON.stringify(body || {}) });
        }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) {
                if (!r.ok) throw new Error(j.error || ('http_' + r.status));
                return j;
            });
        });
        // No step of this chain may hang forever (owner report
        // 2026-11-15): the token fetch, the request (a cold function
        // that also awaits a notification write before answering a
        // reply), or a half-open phone connection can each stall
        // without ever settling — and the caller's optimistic comment
        // then sits at "Posting…" for good, with no error and no way
        // to retry, and later posts pile into the same stall. Bound
        // the whole call: on timeout the promise rejects and the
        // caller's existing failure path runs (optimistic entry
        // removed, typed text restored, error shown), so the posting
        // state ALWAYS clears. 20s is generous next to the seconds a
        // cold start actually takes; tests may shrink it via
        // window.CC_COMMENTS_TIMEOUT_MS.
        var limit = (typeof window.CC_COMMENTS_TIMEOUT_MS === 'number' && window.CC_COMMENTS_TIMEOUT_MS > 0)
            ? window.CC_COMMENTS_TIMEOUT_MS : 20000;
        var timer = null;
        var timeout = new Promise(function (resolve, reject) {
            timer = setTimeout(function () { reject(new Error('timeout')); }, limit);
            if (timer && typeof timer.unref === 'function') timer.unref();
        });
        return Promise.race([work, timeout]).then(function (v) {
            clearTimeout(timer);
            return v;
        }, function (e) {
            clearTimeout(timer);
            throw e;
        });
    }

    window.CC_COMMENTS = {
        load: function (dealId) {
            return call('ccGetComments', { dealId: String(dealId) }).then(function (j) { return j.comments || []; });
        },
        post: function (dealId, text, parentId) {
            var body = { dealId: String(dealId), text: text };
            if (parentId) body.parentId = String(parentId);
            return call('ccPostComment', body).then(function (j) { return j.comment; });
        },
        edit: function (id, text) {
            return call('ccEditComment', { commentId: id, text: text }).then(function (j) { return j.comment; });
        },
        remove: function (id) {
            return call('ccDeleteComment', { commentId: id });
        }
    };
})();
