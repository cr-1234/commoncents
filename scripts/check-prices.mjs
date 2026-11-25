#!/usr/bin/env node
// CommonCents script-first price checker (built 2026-11-22, owner-approved).
//
// Deterministic replacement for the old agent-run price check. A plain
// script does the ENTIRE check — git pull, Bright Data scrape, all policy
// rules from the old cron body, file rewrites, commit/push to preview,
// landing on live main, byte-for-byte served verification, BD usage
// tally, daily-log line — with no AI in the loop. It writes:
//   ~/workspace/goals/commoncents-deals-site/hidden_files/price-check-result.json
//   ~/workspace/goals/commoncents-deals-site/hidden_files/price-check-report.txt
// The cron agent's only job is now: run this script once, read the
// result, stay silent when nothing changed, otherwise relay the report.
//
// Usage: node scripts/check-prices.mjs [--dry-run]
//   --dry-run: full check + decisions on in-memory copies; does NOT
//   modify feed-data.js / shelved-deals.json on disk, does NOT commit,
//   push, publish, or write the daily memory log. (Bright Data records
//   are really pulled and ARE counted in the usage tally — they cost
//   the same whether the run is dry or not.)
//
// Exit codes: 0 = check completed (changed or not). 1 = failure —
// the failure is described in the result file's `failure` field.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const DRY = process.argv.includes('--dry-run');

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = os.homedir();
const HIDDEN = path.join(HOME, 'workspace/goals/commoncents-deals-site/hidden_files');
const RESULT_FILE = path.join(HIDDEN, 'price-check-result.json');
const REPORT_FILE = path.join(HIDDEN, 'price-check-report.txt');
const TALLY_FILE = path.join(HIDDEN, 'bd-usage-cc2.json');
const LOCK_FILE = path.join(HIDDEN, 'price-check.lock');
const FEED_FILE = path.join(REPO, 'feed-data.js');
const SHELVED_FILE = path.join(REPO, 'shelved-deals.json');
const HELPER_CC2 = path.join(HOME, 'workspace/custom-connectors/custom.brightdata-cc2/bin/bd_amazon.py');
const HELPER_ORIG = path.join(HOME, 'workspace/custom-connectors/custom.brightdata/bin/bd_amazon.py');
const EXEMPT_ID = 1099;
const SPLIT_DATE = '2026-12-01'; // before this ET date: all checks via cc2
const API = 'https://us-central1-commoncents-f8f77.cloudfunctions.net';
const PREVIEW_FEED = 'https://cr-1234.github.io/commoncents-preview/feed-data.js';
const PREVIEW_SHELVED = 'https://cr-1234.github.io/commoncents-preview/shelved-deals.json';
// Live site: the https certificate has issued (found 2026-11-22 — http
// now 301-redirects to https, and https serves the file correctly), so
// verify over https directly. fetch() follows redirects either way.
const LIVE_FEED = 'https://commoncentsdeals.com/feed-data.js';
const LIVE_SHELVED = 'https://commoncentsdeals.com/shelved-deals.json';
const COUNTING_START = new Date('2026-11-12T21:00:00-05:00').getTime();

// ---------- time helpers (America/New_York) ----------
const etFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});
function etParts(d = new Date()) {
  const p = {};
  for (const part of etFmt.formatToParts(d)) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    month: `${p.year}-${p.month}`,
    hour: parseInt(p.hour, 10) % 24,
    hhmm: `${p.hour}:${p.minute}`,
  };
}

// ---------- small utilities ----------
const round2 = (n) => Math.round(n * 100) / 100;
const cents = (n) => Math.round(n * 100);
function fmtPrice(n) {
  if (n == null) return 'null';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}
function replacePriceToken(text, oldN, newN) {
  if (!text || oldN == null || newN == null || cents(oldN) === cents(newN)) return text;
  const variants = [...new Set([fmtPrice(oldN), oldN.toFixed(2), String(oldN)])]
    .sort((a, b) => b.length - a.length);
  let out = text;
  for (const v of variants) {
    const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp('\\$' + esc + '(?![0-9.])', 'g'), '$' + fmtPrice(newN));
  }
  return out;
}
async function sh(cmd, args, opts = {}) {
  const { stdout } = await run(cmd, args, { maxBuffer: 64 * 1024 * 1024, timeout: opts.timeout || 600000, cwd: opts.cwd || REPO });
  return stdout;
}
async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.json();
}
async function fetchText(url) {
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now(), { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- title-mismatch heuristic ----------
const STOP = new Set(('amazon shipped shipping from for with and the a an of to in on by pack set free deal price just only get this that your you new off save now via coupon code sold returns prime day pack count ounce ounces oz lb lbs inch inches pack of').split(' '));
function tokens(t) {
  return new Set((t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)));
}
function titleOverlap(dealTitle, recTitle) {
  const rt = tokens(recTitle);
  if (rt.size === 0) return null; // cannot judge
  const dt = tokens(dealTitle);
  let shared = 0;
  for (const w of rt) if (dt.has(w)) shared++;
  // Core = the product-name part of the deal title, before the
  // "For $X From Amazon" tail. Amazon's own titles are verbose, so the
  // full-title ratio flags good deals constantly (6 false flags in the
  // first dry run, all the same product on eyeball). The core ratio is
  // the sharper signal: a link that leads to a different product scores
  // near zero on both measures.
  const corePart = (dealTitle || '').split(/ For (Just )?\$| Shipped From/i)[0];
  const ct = tokens(corePart);
  let coreShared = 0;
  for (const w of ct) if (rt.has(w)) coreShared++;
  return {
    ratio: shared / rt.size, shared, recTokens: rt.size,
    coreRatio: ct.size ? coreShared / ct.size : null, coreTokens: ct.size,
  };
}

// ---------- result / report plumbing ----------
const result = {
  ok: false, dryRun: DRY, gated: false, changed: false,
  runAtET: null, checkedCount: 0, liveCountBefore: 0, liveCountAfter: 0,
  changedDeals: [], shelved: [], rotated: [], noInterest: [], purged: [], synced: [],
  needsReview: [], notes: [],
  bdCc2UsedThisRun: 0, bdOrigUsedThisRun: 0, tallyUsed: null, tallyWarning: false,
  bothHelpersFailed: false, previewVerified: false, liveVerified: false,
  failure: null,
};
function writeOutputs() {
  fs.mkdirSync(HIDDEN, { recursive: true });
  fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 2) + '\n');
  const L = [];
  L.push(`CommonCents price check ${result.runAtET || ''}${DRY ? ' (DRY RUN — nothing published)' : ''}`);
  if (result.gated) L.push('Overnight gate: no check ran on this run.');
  if (result.failure) L.push(`FAILED: ${result.failure}`);
  if (!result.gated && !result.failure) {
    L.push(`Checked ${result.checkedCount} deals (${result.liveCountBefore} live incl. exempt 1099, ${result.liveCountAfter} live after).`);
    for (const c of result.changedDeals) {
      let s = `Price change: deal ${c.id} (${c.title}) $${fmtPrice(c.from)} -> $${fmtPrice(c.to)}`;
      if (c.wasFrom != null && c.wasTo != null && cents(c.wasFrom) !== cents(c.wasTo)) s += `; was-price $${fmtPrice(c.wasFrom)} -> $${fmtPrice(c.wasTo)}`;
      if (c.discountTo != null) s += `; now ${c.discountTo}% off`;
      L.push(s + '.');
    }
    for (const s of result.shelved) L.push(`Shelved: deal ${s.id} (${s.title}) — ${s.reason}${s.lastSeenPrice != null ? ` (last seen $${fmtPrice(s.lastSeenPrice)})` : ''}.`);
    for (const p of result.purged) L.push(`Removed for good (owner purge): deal ${p.id} (${p.title}).`);
    for (const s of result.synced) L.push(`Landed on the live site: deal ${s.id} (${s.title}) — it was posted earlier and had been waiting on the preview only.`);
    for (const n of result.needsReview) L.push(`NEEDS EYES: deal ${n.id} (${n.title}) — Amazon's page title looks different: "${n.recordTitle}" (word overlap ${n.overlap}). ${n.action}`);
    if (!result.changedDeals.length && !result.shelved.length && !result.purged.length && !result.synced.length) L.push('No price changes, no shelvings, no purges.');
    if (result.previewVerified) L.push('Verified on the preview site.');
    if (result.liveVerified) L.push('Verified on the live site (commoncentsdeals.com).');
    if (result.changed && !result.liveVerified && !DRY) L.push('WARNING: the change did NOT reach the live site — it is on the preview only.');
  }
  if (result.tallyWarning) L.push(`Heads-up: the new Bright Data account (the commoncents.help one) has used about ${result.tallyUsed} of its 5,000 free checks this month, so at the current pace it will run out soon and it is time to open the next account.`);
  for (const n of result.notes) L.push(`Note: ${n}`);
  fs.writeFileSync(REPORT_FILE, L.join('\n') + '\n');
  return L.join('\n');
}
function appendDailyLog(lines) {
  if (DRY || !lines.length) return;
  const f = path.join(HOME, 'memory', `${etParts().date}.md`);
  fs.appendFileSync(f, lines.map((l) => l + '\n').join(''));
}

// ---------- feed-data.js parse / serialize ----------
function parseFeed(text) {
  // Header = everything through the 'deals.push(' line. Deal objects are
  // then extracted by brace-depth scanning (string aware) because the
  // file is not strictly one-object-per-line: revived deals 1102/1103
  // have their separator comma on its own line.
  const lines = text.split('\n');
  const pushIdx = lines.findIndex((l) => l.startsWith('deals.push('));
  if (pushIdx < 0) throw new Error('feed-data.js: could not find deals.push(...) block');
  const header = lines.slice(0, pushIdx + 1);
  const block = lines.slice(pushIdx + 1).join('\n');
  const deals = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < block.length; i++) {
    const ch = block[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        const raw = block.slice(start, i + 1);
        deals.push({ obj: JSON.parse(raw), raw });
        start = -1;
      }
    } else if (ch === ')' && depth === 0) break;
  }
  if (!deals.length) throw new Error('feed-data.js: no deal objects parsed');
  return { header, deals };
}
function serializeFeed(header, entries) {
  const body = entries.map((e, i) => (e.changed ? JSON.stringify(e.obj) : e.raw) + (i < entries.length - 1 ? ',' : ''));
  return header.join('\n') + '\n' + body.join('\n') + '\n);\n';
}
function asinOf(url) {
  const m = (url || '').match(/\/dp\/([A-Z0-9]{10})/) || (url || '').match(/\/gp\/product\/([A-Z0-9]{10})/);
  return m ? m[1] : null;
}
function tsMillis(ts) {
  if (typeof ts === 'number') return ts;
  const t = Date.parse(ts);
  return Number.isNaN(t) ? 0 : t;
}
function isCouponBased(deal) {
  if (deal.code) return true;
  const text = `${deal.description || ''} ${deal.dealNote || ''}`;
  return /coupon|subscribe\s*&\s*save|subscribe and save/i.test(text);
}
function effectiveDiscount(deal) {
  if (deal.price != null && deal.originalPrice != null && deal.originalPrice > 0) {
    return Math.round(100 * (1 - deal.price / deal.originalPrice));
  }
  return deal.discount != null ? deal.discount : null;
}
function isGlitch(deal) {
  const d = effectiveDiscount(deal);
  return d != null && d >= 70;
}

// ---------- Bright Data ----------
async function scrapeWith(helper, urls, label) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-bd-'));
  const file = path.join(tmp, 'urls.txt');
  fs.writeFileSync(file, urls.join('\n') + '\n');
  try {
    const out = await sh('python3', [helper, '--raw', '--file', file], { timeout: 420000 });
    const parsed = JSON.parse(out);
    return parsed.slim || [];
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
function isCreditsError(e) {
  return /credit|balance|insufficient|quota|payment/i.test(String(e && e.message || e));
}
async function scrapeAll(checkDeals) {
  const today = etParts().date;
  let groups; // [{helper:'cc2'|'orig', deals:[...]}]
  if (today < SPLIT_DATE) {
    groups = [{ helper: 'cc2', deals: checkDeals }];
  } else {
    const half = Math.ceil(checkDeals.length / 2);
    groups = [
      { helper: 'cc2', deals: checkDeals.slice(0, half) },
      { helper: 'orig', deals: checkDeals.slice(half) },
    ];
  }
  const records = [];
  const helperPath = { cc2: HELPER_CC2, orig: HELPER_ORIG };
  const helperName = { cc2: 'cc2 (commoncents.help)', orig: 'original' };
  let bothFailed = false;
  for (const g of groups) {
    if (!g.deals.length) continue;
    const urls = g.deals.map((d) => d.url.split('?')[0]);
    const batches = [];
    for (let i = 0; i < urls.length; i += 20) batches.push(urls.slice(i, i + 20));
    for (const batch of batches) {
      let slim = null; let primaryErr = null;
      try {
        slim = await scrapeWith(helperPath[g.helper], batch);
        if (g.helper === 'cc2') result.bdCc2UsedThisRun += slim.length; else result.bdOrigUsedThisRun += slim.length;
      } catch (e) {
        primaryErr = e;
      }
      if (slim === null) {
        const other = g.helper === 'cc2' ? 'orig' : 'cc2';
        result.notes.push(`Bright Data ${helperName[g.helper]} failed on a batch of ${batch.length} (${String(primaryErr.message || primaryErr).slice(0, 160)}); fell back to the ${helperName[other]} account.`);
        try {
          slim = await scrapeWith(helperPath[other], batch);
          if (other === 'cc2') result.bdCc2UsedThisRun += slim.length; else result.bdOrigUsedThisRun += slim.length;
        } catch (e2) {
          bothFailed = bothFailed || (isCreditsError(primaryErr) && isCreditsError(e2));
          throw new Error(`Bright Data failed on both helpers for a batch of ${batch.length}. ${helperName[g.helper]}: ${String(primaryErr.message || primaryErr).slice(0, 200)} | ${helperName[other]}: ${String(e2.message || e2).slice(0, 200)}`);
        }
      }
      records.push(...slim);
    }
  }
  result.bothHelpersFailed = bothFailed;
  return records;
}

// ---------- main ----------
async function main() {
  const et = etParts();
  result.runAtET = `${et.date} ${et.hhmm} ET`;

  // lock against overlapping runs
  try {
    const st = fs.statSync(LOCK_FILE);
    if (Date.now() - st.mtimeMs < 60 * 60 * 1000) throw new Error('another price check appears to be running (lock file under 1h old) — aborting to avoid overlap');
    fs.rmSync(LOCK_FILE);
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  fs.mkdirSync(HIDDEN, { recursive: true });
  fs.writeFileSync(LOCK_FILE, String(process.pid));
  process.on('exit', () => { try { fs.rmSync(LOCK_FILE); } catch {} });

  // overnight gate: hour 1 or 4 ET — no check, no Bright Data
  if (et.hour === 1 || et.hour === 4) {
    result.ok = true; result.gated = true;
    appendDailyLog([`CommonCents price check ${et.hhmm} ET: overnight gate (hour ${et.hour}) — skipped, no Bright Data used. (script)`]);
    writeOutputs();
    console.log('GATED');
    return;
  }

  // 1. git pull (real + dry both start from freshest tailored-feed)
  const status = await sh('git', ['status', '--porcelain', '--', 'feed-data.js', 'shelved-deals.json']);
  if (status.trim()) throw new Error('feed-data.js / shelved-deals.json not clean on tailored-feed — aborting before any change: ' + status.trim().slice(0, 200));
  await sh('git', ['pull', 'origin', 'tailored-feed']);

  // 2. read current data
  const feedText = fs.readFileSync(FEED_FILE, 'utf8');
  const { header, deals: entries } = parseFeed(feedText);
  let shelved = JSON.parse(fs.readFileSync(SHELVED_FILE, 'utf8'));
  result.liveCountBefore = entries.length;
  const byId = new Map(entries.map((e) => [e.obj.id, e]));
  const checkDeals = entries.filter((e) => e.obj.id !== EXEMPT_ID).map((e) => e.obj);

  // 2b. stranded-post sync (owner fix, 2026-11-25): collector batches
  // post to tailored-feed (the preview) first and copy to main
  // themselves; when that copy step fails, new deals sit on the preview
  // only — and this script's cherry-pick landing never carries them,
  // because it moves only this run's own diff (14 deals, 1123-1136,
  // stranded 2026-11-24/25 until the owner spotted them). Detect any
  // live deal present here but missing from origin/main, and any
  // shelved record missing there, and force the full-file landing
  // path below so they reach the live site on this run. New deals
  // must never wait on a human noticing.
  let shelvedStranded = 0;
  try {
    await sh('git', ['fetch', 'origin', 'main']);
    const mainFeedText = await sh('git', ['show', 'origin/main:feed-data.js']);
    const mainIds = new Set(parseFeed(mainFeedText).deals.map((e) => e.obj.id));
    for (const e of entries) if (!mainIds.has(e.obj.id)) result.synced.push({ id: e.obj.id, title: e.obj.title });
    const mainShelved = JSON.parse(await sh('git', ['show', 'origin/main:shelved-deals.json']));
    const mainShelvedIds = new Set(mainShelved.map((s) => s.id));
    shelvedStranded = shelved.filter((s) => !mainShelvedIds.has(s.id)).length;
    // A rescued deal must also be re-stamped to now (owner complaint,
    // 2026-11-25): the NEW DEAL badge and the Newest sort key off ts,
    // and a deal that sat on the preview for hours carries its old
    // preview-posting time — visitors who checked the site meanwhile
    // (the owner did, looking for the new deals) have a last-visit
    // clock newer than that ts, so the badge never shows. From the
    // live site's side the deal IS new today; stamp it so.
    if (result.synced.length) {
      const syncedIds = new Set(result.synced.map((s) => s.id));
      for (const e of entries) {
        if (syncedIds.has(e.obj.id)) { e.obj.ts = Date.now(); e.changed = true; }
      }
    }
  } catch (e) {
    result.notes.push(`Stranded-post sync check failed (${String(e.message || e).slice(0, 120)}) — sync skipped this run.`);
  }

  // 3. Bright Data scrape
  const records = await scrapeAll(checkDeals);
  result.checkedCount = checkDeals.length;
  const recByAsin = new Map();
  for (const r of records) {
    const a = r.asin || asinOf(r.url);
    if (a && !recByAsin.has(a)) recByAsin.set(a, r);
  }

  // 4. per-deal policy
  const logLines = [];
  const shelve = (entry, reason, lastSeenPrice) => {
    const rec = { ...entry.obj, shelvedAt: et.date, shelvedReason: reason, lastSeenPrice: lastSeenPrice ?? null };
    shelved.push(rec);
    result.shelved.push({ id: entry.obj.id, title: entry.obj.title, reason, lastSeenPrice: lastSeenPrice ?? null });
    logLines.push(`CommonCents price check: SHELVED deal ${entry.obj.id} (${entry.obj.title}) — ${reason}; lastSeenPrice=${lastSeenPrice ?? 'null'}. (script)`);
    byId.delete(entry.obj.id);
  };

  for (const deal of checkDeals) {
    const entry = byId.get(deal.id);
    if (!entry) continue;
    const rec = recByAsin.get(asinOf(deal.url));
    if (!rec) { result.notes.push(`Deal ${deal.id}: no Bright Data record returned — left as posted.`); continue; }
    if (rec.error) { result.notes.push(`Deal ${deal.id}: Bright Data record error (${String(rec.error).slice(0, 120)}) — left as posted.`); continue; }

    const couponBased = isCouponBased(deal);
    const live = rec.final_price;
    const listLive = rec.initial_price;

    // title mismatch
    const ov = titleOverlap(deal.title, rec.title);
    if (ov && ov.shared === 0) {
      shelve(entry, 'Link leads to a different product on Amazon', live ?? null);
      result.needsReview.push({ id: deal.id, title: deal.title, recordTitle: rec.title, overlap: '0 shared words', action: 'Shelved as a clear mismatch — please eyeball it.' });
      continue;
    }
    if (ov && ov.coreRatio != null && ov.coreTokens >= 3 && ov.coreRatio < 0.25) {
      result.needsReview.push({ id: deal.id, title: deal.title, recordTitle: rec.title, overlap: `${Math.round(ov.coreRatio * 100)}% of product-name words`, action: 'Left live — not a clear mismatch, please eyeball it.' });
    }

    // availability
    const availText = String(rec.availability || '');
    if (rec.is_available === false || (live == null && /not available|unavailable|out of stock/i.test(availText))) {
      shelve(entry, live == null ? 'Unavailable on Amazon — no price and no buy box' : 'Unavailable on Amazon', live ?? null);
      continue;
    }
    if (live == null) { result.notes.push(`Deal ${deal.id}: price null but item appears available — left as posted.`); continue; }

    if (couponBased) {
      // 7-day life for typed promo codes (owner, 2026-11-23): a code
      // typed at checkout can't be re-tested automatically — the
      // KIDMI clogs code (deal 1080) died around day 11 while an
      // unrelated page coupon checkbox kept every check passing it,
      // and a visitor + the owner hit the dead code. Deals whose
      // price depends on a typed code (deal.code) shelve at 7 days
      // old, before the code can quietly die. Subscribe & Save deals
      // carry no typed code and are exempt — that discount is
      // visible on the product page, where the checks below see it.
      if (deal.code && tsMillis(deal.ts) > 0 && Date.now() - tsMillis(deal.ts) >= 7 * 24 * 3600 * 1000) {
        shelve(entry, `Promo code deal over 7 days old — checkout codes can't be re-tested automatically, so code deals come down at 7 days (posted $${fmtPrice(deal.price)} with code ${deal.code})`, live);
        continue;
      }
      const couponPresent = !!(rec.coupon && String(rec.coupon).trim());
      if (!couponPresent && deal.originalPrice != null && live >= deal.originalPrice) {
        shelve(entry, `Coupon gone — no coupon on the page and live base price $${fmtPrice(live)} is at or above the $${fmtPrice(deal.originalPrice)} list price`, live);
        continue;
      }
      // was-price re-check against the POSTED price only; never price from base.
      // Same >5-cent / discount-change noise tolerance as regular deals.
      const couponWasChanged = listLive != null && listLive > deal.price && deal.originalPrice != null
        && cents(listLive) !== cents(deal.originalPrice)
        && (Math.abs(cents(listLive) - cents(deal.originalPrice)) > 5
          || Math.round(100 * (1 - deal.price / listLive)) !== Math.round(100 * (1 - deal.price / deal.originalPrice)));
      if (couponWasChanged || (listLive != null && listLive > deal.price && deal.originalPrice == null)) {
        const old = { ...entry.obj };
        entry.obj.originalPrice = round2(listLive);
        entry.obj.discount = Math.round(100 * (1 - entry.obj.price / entry.obj.originalPrice));
        entry.obj.description = replacePriceToken(entry.obj.description, old.originalPrice, entry.obj.originalPrice);
        if (old.discount != null && entry.obj.description) entry.obj.description = entry.obj.description.split(`${old.discount}% off`).join(`${entry.obj.discount}% off`);
        entry.changed = true;
        result.changedDeals.push({ id: deal.id, title: deal.title, from: deal.price, to: deal.price, wasFrom: old.originalPrice ?? null, wasTo: entry.obj.originalPrice, discountTo: entry.obj.discount });
      }
    } else {
      // regular deal
      const posted = deal.price;
      let newOriginal = deal.originalPrice ?? null;
      if (listLive != null && listLive > live) newOriginal = round2(listLive);
      const effList = newOriginal != null && newOriginal > live ? newOriginal : null;
      const rose = cents(live) > cents(posted) + 5;
      if (rose) {
        const disc = effList ? Math.round(100 * (1 - live / effList)) : null;
        if ((disc != null && disc < 12) || (effList == null && (live - posted) / posted > 0.25)) {
          shelve(entry, disc != null
            ? `Price rose to $${fmtPrice(live)} — only about ${disc}% off the $${fmtPrice(effList)} list (posted $${fmtPrice(posted)})`
            : `Price rose to $${fmtPrice(live)} from $${fmtPrice(posted)} with no list price — jump over 25%`, live);
          continue;
        }
      }
      // price + was-price updates. Was-price noise tolerance: Amazon list
      // prices jitter by a few cents between scrapes (first dry run:
      // $139.08 -> $139.11, discount unchanged at 43%). Only treat the
      // was-price as changed when it moved by more than 5 cents or the
      // recomputed discount percent actually changes — otherwise every
      // run would publish a meaningless correction.
      const priceChanged = cents(live) !== cents(posted);
      let wasChanged = false;
      if (newOriginal != null && deal.originalPrice != null && listLive != null && listLive > live && cents(newOriginal) !== cents(deal.originalPrice)) {
        const discOld = Math.round(100 * (1 - live / deal.originalPrice));
        const discNew = Math.round(100 * (1 - live / newOriginal));
        wasChanged = Math.abs(cents(newOriginal) - cents(deal.originalPrice)) > 5 || discNew !== discOld;
      } else if (newOriginal != null && deal.originalPrice == null && listLive != null && listLive > live) {
        wasChanged = true; // no stored was-price, Amazon now shows one above the price
      }
      if (priceChanged || wasChanged) {
        const old = { ...entry.obj };
        if (priceChanged) {
          entry.obj.price = round2(live);
          entry.obj.title = replacePriceToken(entry.obj.title, posted, entry.obj.price);
          if (entry.obj.dealNote) entry.obj.dealNote = replacePriceToken(entry.obj.dealNote, posted, entry.obj.price);
          if (entry.obj.description) entry.obj.description = replacePriceToken(entry.obj.description, posted, entry.obj.price);
        }
        if (wasChanged) {
          entry.obj.originalPrice = newOriginal;
          if (entry.obj.description) entry.obj.description = replacePriceToken(entry.obj.description, old.originalPrice, newOriginal);
        }
        if (entry.obj.originalPrice != null && entry.obj.originalPrice > entry.obj.price) {
          entry.obj.discount = Math.round(100 * (1 - entry.obj.price / entry.obj.originalPrice));
          if (old.discount != null && entry.obj.discount !== old.discount && entry.obj.description) {
            entry.obj.description = entry.obj.description.split(`${old.discount}% off`).join(`${entry.obj.discount}% off`);
          }
        }
        entry.changed = true;
        result.changedDeals.push({ id: deal.id, title: entry.obj.title, from: posted, to: entry.obj.price, wasFrom: old.originalPrice ?? null, wasTo: entry.obj.originalPrice ?? null, discountTo: entry.obj.discount ?? null });
      }
    }
  }

  // 5. discount floor (all remaining live deals)
  for (const deal of [...byId.values()].map((e) => e.obj)) {
    if (deal.id === EXEMPT_ID || deal.sponsored) continue;
    const entry = byId.get(deal.id);
    const current = entry.obj;
    const disc = effectiveDiscount(current);
    if (disc != null && current.originalPrice != null && disc < 12) {
      shelve(entry, 'Discount under 12%', current.price ?? null);
    }
  }

  // 6. Daily make-room steps, on the FIRST morning check (hour 7,
  // ~07:24 ET): rotation first, then no-interest. Moved from hour 10
  // to hour 7 on 2026-11-23 on the owner's order: fresh deals going
  // up EVERY day is priority one, so the day's ~6 slots must stand
  // open BEFORE the collector's daytime batches run — at hour 10 the
  // morning batch had already found a full feed and posted nothing
  // (exactly what happened on 2026-11-23).
  if (et.hour === 7) {
    let clicks = null, views = null;
    try {
      const c = await fetchJson(`${API}/ccGetClicks`); clicks = c.clicks || {};
      const v = await fetchJson(`${API}/ccGetViews`); views = v.views || {};
    } catch (e) {
      result.notes.push(`Morning counters fetch failed (${String(e.message || e).slice(0, 120)}) — rotation and no-interest shelving skipped this run.`);
    }
    if (clicks && views) {
      const total = (m, id) => (m[String(id)] && m[String(id)].total) || 0;
      // no-interest first for ranking stability? Policy: rotation BEFORE revival; no-interest is step 4b after 4. Do no-interest, then rotation on what remains.
      for (const entry of [...byId.values()]) {
        const d = entry.obj;
        if (d.id === EXEMPT_ID || d.sponsored || isGlitch(d)) continue;
        const start = Math.max(tsMillis(d.ts), COUNTING_START);
        if (Date.now() - start >= 7 * 24 * 3600 * 1000 && total(clicks, d.id) === 0 && total(views, d.id) === 0) {
          result.noInterest.push(d.id);
          shelve(entry, 'No views or clicks in 7 days', d.price ?? null);
        }
      }
      const liveCount = [...byId.keys()].filter((id) => id !== EXEMPT_ID).length;
      if (liveCount > 54) {
        const candidates = [...byId.values()]
          .filter((e) => e.obj.id !== EXEMPT_ID && !e.obj.sponsored && !isGlitch(e.obj) && Date.now() - tsMillis(e.obj.ts) >= 7 * 24 * 3600 * 1000)
          .sort((a, b) => (total(clicks, a.obj.id) + total(views, a.obj.id)) - (total(clicks, b.obj.id) + total(views, b.obj.id)) || tsMillis(a.obj.ts) - tsMillis(b.obj.ts));
        let need = liveCount - 54;
        for (const entry of candidates) {
          if (need <= 0) break;
          result.rotated.push(entry.obj.id);
          shelve(entry, 'Rotated out for fresh deals', entry.obj.price ?? null);
          need--;
        }
      }
    }
  }

  // 7. owner purge list (every run, no Bright Data)
  try {
    const p = await fetchJson(`${API}/ccGetShelfPurges`);
    const purges = p.purges || [];
    if (purges.length) {
      const before = shelved.length;
      shelved = shelved.filter((s) => {
        const hit = purges.find((x) => x.id === s.id && x.title === s.title);
        if (hit) {
          result.purged.push({ id: s.id, title: s.title });
          logLines.push(`CommonCents price check: PURGED deal ${s.id} (${s.title}) — owner deletion from admin purge list. (script)`);
        }
        return !hit;
      });
      if (shelved.length === before && result.purged.length) throw new Error('purge bookkeeping mismatch');
    }
  } catch (e) {
    result.notes.push(`Purge-list fetch failed (${String(e.message || e).slice(0, 120)}) — purge step skipped this run.`);
  }

  // 8. BD tally (records were really pulled, dry-run included)
  try {
    let tally = { month: et.month, used: 0, warned: false };
    try { const t = JSON.parse(fs.readFileSync(TALLY_FILE, 'utf8')); if (t && t.month === et.month) tally = t; } catch {}
    const beforeWarned = !!tally.warned;
    tally.used += result.bdCc2UsedThisRun;
    if (tally.used >= 4000 && !tally.warned) { tally.warned = true; result.tallyWarning = true; }
    result.tallyUsed = tally.used;
    if (!DRY || true) fs.writeFileSync(TALLY_FILE, JSON.stringify(tally));
    if (beforeWarned) result.tallyWarning = false;
  } catch (e) {
    result.notes.push(`BD tally update failed: ${String(e.message || e).slice(0, 120)}`);
  }

  // 9. assemble outputs
  const survivors = entries.filter((e) => byId.has(e.obj.id));
  result.liveCountAfter = survivors.length;
  result.changed = result.changedDeals.length > 0 || result.shelved.length > 0 || result.purged.length > 0 || result.synced.length > 0;
  const newFeed = serializeFeed(header, survivors);
  const shelvedChanged = result.shelved.length > 0 || result.purged.length > 0 || shelvedStranded > 0;
  const newShelved = shelvedChanged ? JSON.stringify(shelved, null, 1) + '\n' : null;

  const runNote = `CommonCents price check ${et.date} ${et.hhmm} ET (script${DRY ? ', dry run' : ''}): checked ${result.checkedCount} deals; changed=[${result.changedDeals.map((c) => c.id).join(',')}] shelved=[${result.shelved.map((s) => s.id).join(',')}] purged=[${result.purged.map((p) => p.id).join(',')}]; cc2 tally ${result.tallyUsed}.`;

  if (DRY) {
    // validate the would-be files without touching disk copies in the repo
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-dry-'));
    fs.writeFileSync(path.join(tmp, 'feed-data.js'), newFeed);
    await sh('node', ['--check', path.join(tmp, 'feed-data.js')], { cwd: tmp });
    if (newShelved) JSON.parse(newShelved);
    const check = []; const stub = { push: (...a) => check.push(...a) };
    new Function('deals', newFeed)(stub);
    if (check.length !== survivors.length) throw new Error(`dry-run count mismatch: ${check.length} vs ${survivors.length}`);
    result.notes.push(`Dry run validated: would-be feed parses with ${check.length} deals; repo files untouched.`);
    fs.rmSync(tmp, { recursive: true, force: true });
    result.ok = true;
    writeOutputs();
    console.log(writeOutputs());
    return;
  }

  appendDailyLog([...logLines, runNote]);

  if (!result.changed) {
    result.ok = true;
    writeOutputs();
    console.log('NO_CHANGES');
    return;
  }

  // 10. write files, validate, publish
  fs.writeFileSync(FEED_FILE, newFeed);
  if (newShelved) fs.writeFileSync(SHELVED_FILE, newShelved);
  await sh('node', ['--check', FEED_FILE]);
  const recount = await sh('node', ['-e', 'const deals=[];const stub={push:(...a)=>deals.push(...a)};const fs=require("fs");eval(fs.readFileSync("feed-data.js","utf8").replace("deals.push","stub.push"));console.log(deals.length)']);
  if (parseInt(recount.trim(), 10) !== survivors.length) throw new Error(`post-write count mismatch: ${recount.trim()} vs ${survivors.length}`);

  const summaryParts = [];
  for (const c of result.changedDeals) summaryParts.push(`deal ${c.id} price $${fmtPrice(c.from)} -> $${fmtPrice(c.to)}`);
  if (result.shelved.length) summaryParts.push(`shelved ${result.shelved.map((s) => s.id).join(', ')}`);
  if (result.purged.length) summaryParts.push(`purged ${result.purged.map((p) => p.id).join(', ')}`);
  if (result.synced.length) summaryParts.push(`landed preview-only deals ${result.synced.map((s) => s.id).join(', ')}`);
  const commitMsg = `Price check ${et.date} (script): ${summaryParts.join('; ')}; no revivals`;

  const changedFiles = ['feed-data.js'];
  if (newShelved) changedFiles.push('shelved-deals.json');
  await sh('git', ['add', ...changedFiles]);
  try {
    await sh('git', ['commit', '-m', commitMsg]);
  } catch (e) {
    // Sync-only run: the files on tailored-feed are already correct
    // (the stranded deals came from there) — nothing new to commit.
    // HEAD's file contents below are exactly what main needs.
    result.notes.push('No new commit on tailored-feed (sync-only run — files there were already correct); landing the current files on main directly.');
  }
  const headFeed = await sh('git', ['show', 'HEAD:feed-data.js']);
  const headShelved = newShelved ? await sh('git', ['show', 'HEAD:shelved-deals.json']) : null;

  // push tailored-feed (one rebase retry if the collector landed meanwhile)
  try {
    await sh('git', ['push', 'origin', 'tailored-feed']);
  } catch (e) {
    await sh('git', ['pull', '--rebase', 'origin', 'tailored-feed']);
    await sh('git', ['push', 'origin', 'tailored-feed']);
  }
  await sh('git', ['push', 'preview', 'tailored-feed:main']);

  // verify preview served bytes
  const pollMatch = async (url, expected, label) => {
    for (let i = 0; i < 18; i++) {
      try { const t = await fetchText(url); if (t === expected) return true; } catch {}
      await sleep(10000);
    }
    return false;
  };
  result.previewVerified = await pollMatch(PREVIEW_FEED, headFeed, 'preview feed');
  if (!result.previewVerified) throw new Error('preview site did not serve the new feed-data.js within ~3 minutes');
  if (headShelved) await pollMatch(PREVIEW_SHELVED, headShelved, 'preview shelved');

  // land on main via a clean temp worktree, based on the LIVE list
  // itself (origin/main), never the local main branch (owner fix,
  // 2026-11-23): local main falls behind whenever a change reaches
  // live any other way (e.g. a hand-landing), and the 13:24 run's
  // push was refused non-fast-forward, stranding its shelve on the
  // preview only. Fetch fresh and build on origin/main every run.
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-main-'));
  fs.rmSync(wt, { recursive: true, force: true }); // git worktree add needs a non-existent path
  try {
    await sh('git', ['fetch', 'origin', 'main']);
    await sh('git', ['worktree', 'add', wt, 'origin/main']);
    const headCommit = (await sh('git', ['rev-parse', 'HEAD'])).trim();
    // When stranded preview-only deals are being synced, a cherry-pick
    // of this run's commit can never carry them (they are not in its
    // diff) — go straight to copying the full data files.
    const forceCopy = result.synced.length > 0 || shelvedStranded > 0;
    let cherryOk = false;
    if (!forceCopy) {
      try {
        await sh('git', ['cherry-pick', headCommit], { cwd: wt });
        cherryOk = true;
      } catch (e) {
        try { await sh('git', ['cherry-pick', '--abort'], { cwd: wt }); } catch {}
      }
    }
    if (!cherryOk) {
      for (const f of changedFiles) {
        const content = await sh('git', ['show', `HEAD:${f}`]);
        fs.writeFileSync(path.join(wt, f), content);
      }
      await sh('git', ['add', ...changedFiles], { cwd: wt });
      await sh('git', ['commit', '-m', commitMsg], { cwd: wt });
    }
    await sh('git', ['push', 'origin', 'HEAD:main'], { cwd: wt });
  } finally {
    try { await sh('git', ['worktree', 'remove', '--force', wt]); } catch {}
  }
  await sh('git', ['fetch', 'origin', 'main']);
  const mainFeed = await sh('git', ['show', 'origin/main:feed-data.js']);
  result.liveVerified = await pollMatch(LIVE_FEED, mainFeed, 'live feed');
  if (headShelved) {
    const mainShelved = await sh('git', ['show', 'origin/main:shelved-deals.json']);
    await pollMatch(LIVE_SHELVED, mainShelved, 'live shelved');
  }
  if (!result.liveVerified) {
    result.failure = 'Change verified on the preview but did NOT reach the live site (commoncentsdeals.com) within ~3 minutes of polling.';
    writeOutputs();
    console.log('LIVE_LANDING_FAILED');
    process.exitCode = 1;
    return;
  }
  result.ok = true;
  writeOutputs();
  console.log('CHANGED_AND_LIVE');
}

main().catch((e) => {
  result.ok = false;
  result.failure = String((e && e.message) || e).slice(0, 600);
  try { writeOutputs(); } catch {}
  console.error('FAILED:', result.failure);
  process.exit(1);
});
