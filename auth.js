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
        return user.getIdToken().then(function (token) {
            return postFn('ccSaveVotes', { votes: map }, token);
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

    // Called by tailored-feed.js whenever the picks change locally.
    function noteInterestsChanged(keys) {
        if (!currentUser) return;
        clearTimeout(saveTimer);
        var user = currentUser;
        saveTimer = setTimeout(function () { saveNow(user, keys); }, 600);
    }

    // ── Notifications (engagement plan, 2026-11-13) ──
    // One inbox serves both sites. A red count badge sits on the
    // avatar; the account menu lists the latest notes; opening the
    // menu marks them read and clears the badge.
    var notesCache = null;
    var notesUnread = 0;
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
        var av = document.getElementById('authEmail');
        if (!av) return;
        var b = av.querySelector('.cc-note-badge');
        if (!currentUser || !notesUnread) { if (b) b.remove(); return; }
        if (!b) { b = document.createElement('span'); b.className = 'cc-note-badge'; av.appendChild(b); }
        b.textContent = notesUnread > 9 ? '9+' : String(notesUnread);
    }
    function paintNotesList() {
        var wrap = document.getElementById('authMenuNotes');
        var list = document.getElementById('authMenuNotesList');
        if (!wrap || !list) return;
        if (!notesCache || !notesCache.length) {
            // Always show the block (owner, 2026-11-13: he went looking for
            // where notifications come out and found nothing — the block
            // used to stay hidden until the first reply arrived). An empty
            // state tells him where they will land.
            list.innerHTML = '<div class="auth-menu-note auth-menu-notes-empty">Nothing yet — replies to your comments will show up here.</div>';
            wrap.style.display = '';
            return;
        }
        list.innerHTML = notesCache.slice(0, 8).map(function (n) {
            var site = n.site === 'gb' ? 'Gifting Butler' : 'CommonCents';
            var what = n.type === 'reply'
                ? '<strong>' + escNote(n.fromName || 'Someone') + '</strong> replied to your comment'
                : '<strong>Your submission is live</strong>';
            var txt = n.text ? ' <span class="an-text">&ldquo;' + escNote(n.text) + '&rdquo;</span>' : '';
            var when = n.ts ? ' <span class="an-when">&middot; ' + noteWhen(n.ts) + '</span>' : '';
            return '<div class="auth-menu-note"><span class="an-site">' + site + '</span> ' + what + txt + when + '</div>';
        }).join('');
        wrap.style.display = '';
    }
    function loadNotes(user) {
        if (!user) return;
        user.getIdToken().then(function (token) {
            return postFn('getNotifications', {}, token);
        }).then(function (res) {
            if (!res || res.error) return;
            notesCache = Array.isArray(res.items) ? res.items : [];
            notesUnread = res.unread || 0;
            paintNoteBadge();
            paintNotesList();
        }).catch(function () { /* notes retry on the next sign-in */ });
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
            // Votes merge the same never-lose way: union of the
            // account's map and this device's — the account fills gaps,
            // the device keeps its own, and the union goes back up.
            if (window.CC_VOTES) {
                var acctVotes = (res.votes && typeof res.votes === 'object' && !Array.isArray(res.votes)) ? res.votes : {};
                var localVotes = CC_VOTES.get();
                var merged = Object.assign({}, acctVotes, localVotes);
                if (Object.keys(merged).length > Object.keys(localVotes).length) CC_VOTES.set(merged);
                else if (Object.keys(localVotes).length > Object.keys(acctVotes).length) saveVotesNow(user, localVotes);
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
        }
        // paintHeader rebuilds the avatar's insides, which would wipe
        // the notification badge — re-apply it after every repaint.
        paintNoteBadge();
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
        // The comment-name setting lives behind a closed row ("Comment
        // name: X" + Change): the editor opens only when asked and
        // collapses back after a save or a Cancel. Every fresh menu open
        // starts from the closed row.
        function shownCommentName() {
            var gen = (!profileUsername && window.CC_AUTH.fallbackName) ? window.CC_AUTH.fallbackName() : '';
            return profileUsername || (currentUser && currentUser.displayName) || gen || '';
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
        function openMenu() {
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
                if (gw && gw.isEntered && gw.isEntered()) {
                    var n = 1 + (gw.bonus ? gw.bonus() : 0);
                    if (gwLabel) gwLabel.textContent = 'Giveaway: you\u2019re in this week';
                    if (gwCount) gwCount.textContent = n + (n === 1 ? ' entry' : ' entries');
                } else {
                    if (gwLabel) gwLabel.textContent = 'Giveaway: not entered yet \u2014 enter';
                    if (gwCount) gwCount.textContent = '';
                }
            }
            paintNotesList();
            markNotesRead();
            menu.style.display = '';
        }
        if (avatarEl) avatarEl.addEventListener('click', function (e) {
            e.stopPropagation();
            if (!currentUser) return;
            if (menu && menu.style.display !== 'none') closeMenu(); else openMenu();
        });
        document.addEventListener('click', function (e) {
            if (menu && menu.style.display !== 'none' && !e.target.closest('.auth-area')) closeMenu();
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
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
            var b = document.getElementById('feedWidgetChange');
            if (b) b.click();
        });
        var gwRowBtn = document.getElementById('authMenuGiveaway');
        if (gwRowBtn) gwRowBtn.addEventListener('click', function () {
            closeMenu();
            var g = document.getElementById('openGiveaway');
            if (g) g.click();
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
                    restoreBtn.textContent = 'Restore my votes & picks';
                }, 4000);
                return;
            }
            restoreArmed = false;
            restoreBtn.textContent = 'Restore my votes & picks';
            showRestoreMsg('Restoring…');
            var user = currentUser;
            user.getIdToken().then(function (token) {
                return postFn('ccRestoreBackup', {}, token);
            }).then(function (res) {
                if (!res || res.error) { showRestoreMsg('Restore failed — try again.'); return; }
                if (res.empty) { showRestoreMsg('No backup yet — one is saved automatically if your votes or picks ever shrink.'); return; }
                if (window.CC_VOTES && res.votes) CC_VOTES.set(res.votes);
                if (window.CC_FEED && Array.isArray(res.interests) && res.interests.length) CC_FEED.setInterests(res.interests, true);
                if (res.username) { profileUsername = res.username; paintNameRow(); }
                var when = res.savedAt ? new Date(res.savedAt).toLocaleDateString() : '';
                var n = res.votes ? Object.keys(res.votes).length : 0;
                showRestoreMsg('Restored ' + n + ' vote' + (n === 1 ? '' : 's') + (res.interests && res.interests.length ? ' and your feed picks' : '') + (when ? ' from ' + when : '') + '.');
            }).catch(function () { showRestoreMsg('Restore failed — try again.'); });
        });

        var menuOutBtn = document.getElementById('authMenuSignOut');
        if (menuOutBtn) menuOutBtn.addEventListener('click', function () { closeMenu(); if (auth) auth.signOut(); });
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
        username: function () { return profileUsername; },
        submissionBonus: function () { return profileSubBonus; },
        // Deterministic friendly default name from the account id — so a
        // member who never picks a comment name still shows as SOMEONE
        // distinct (never a generic "Member"), and the same account gets
        // the same name on every device without anything being saved.
        fallbackName: function () {
            if (!currentUser || !currentUser.uid) return '';
            var ADJ = ['Ace', 'Pro', 'Keen', 'Wise', 'Bold', 'Swift', 'Smart', 'Prime'];
            var NOUN = ['Saver', 'Scout', 'Seeker', 'Hunter', 'Finder', 'Buyer'];
            var h = 0, uid = String(currentUser.uid);
            for (var i = 0; i < uid.length; i++) h = ((h * 31) + uid.charCodeAt(i)) >>> 0;
            return ADJ[h % ADJ.length] + NOUN[(h >>> 4) % NOUN.length] + (10 + (h % 90));
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
