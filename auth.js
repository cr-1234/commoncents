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

    // Called by tailored-feed.js whenever the picks change locally.
    function noteInterestsChanged(keys) {
        if (!currentUser) return;
        clearTimeout(saveTimer);
        var user = currentUser;
        saveTimer = setTimeout(function () { saveNow(user, keys); }, 600);
    }

    function syncFromAccount(user, tries) {
        if (!window.CC_FEED || !CC_FEED.getInterests) {
            if ((tries || 0) < 10) setTimeout(function () { syncFromAccount(user, (tries || 0) + 1); }, 300);
            return;
        }
        user.getIdToken().then(function (token) {
            return postFn('ccGetProfile', {}, token);
        }).then(function (res) {
            if (!res || res.error) return;
            profileUsername = typeof res.username === 'string' ? res.username : '';
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
        var outBtn = document.getElementById('signOutBtn');
        var emailEl = document.getElementById('authEmail');
        if (!inBtn || !outBtn || !emailEl) return;
        if (currentUser) {
            inBtn.style.display = 'none';
            outBtn.style.display = '';
            emailEl.style.display = '';
            emailEl.textContent = currentUser.email || '';
        } else {
            inBtn.style.display = '';
            outBtn.style.display = 'none';
            emailEl.style.display = 'none';
            emailEl.textContent = '';
        }
    }

    function wireUi() {
        var modal = document.getElementById('authModal');
        var inBtn = document.getElementById('signInBtn');
        var outBtn = document.getElementById('signOutBtn');
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
        if (outBtn) outBtn.addEventListener('click', function () { if (auth) auth.signOut(); });
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
        username: function () { return profileUsername; },
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
    });
})();
