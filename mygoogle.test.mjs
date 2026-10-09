import assert from "node:assert/strict";
import { KINDS, SHARED_Q, aboutMe, countFiles, discover, explain, fmtBytes, fmtCount, newest, ownedQ, storageText, tileTarget } from "./src/lib/mygoogle.js";
let n = 0;
const t = async (name, fn) => { try { await fn(); n++; } catch (e) { console.error("FAIL:", name); throw e; } };
const TOKEN = { access_token: "tok" };

// a fake Google: answers by the shape of the URL and records every call
function fake({ about, pages = {}, fail = {}, recent = [], sheets = [] } = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url: String(url), auth: init?.headers?.Authorization });
    const u = new URL(url);
    const q = u.searchParams.get("q") || "";
    const resp = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
    if (u.pathname.endsWith("/about")) return about ? resp(200, about) : resp(401, { error: { message: "Invalid Credentials" } });
    for (const [needle, status] of Object.entries(fail)) if (q.includes(needle)) return resp(status, { error: { message: "nope" } });
    if (u.searchParams.get("fields").startsWith("files(id,name")) return resp(200, { files: q.includes("spreadsheet") ? sheets : recent });
    const key = q === SHARED_Q ? "shared" : (KINDS.find((k) => q.includes(k.q))?.id || "?");
    const spec = pages[key] || [0];
    const idx = u.searchParams.get("pageToken") ? Number(u.searchParams.get("pageToken")) : 0;
    const body = { files: Array.from({ length: spec[idx] }, (_, i) => ({ id: `${key}${idx}-${i}` })) };
    if (idx + 1 < spec.length) body.nextPageToken = String(idx + 1);
    return resp(200, body);
  };
  fn.calls = calls;
  return fn;
}

await t("queries: owned means 'me' in owners, shared is kept apart", () => {
  assert.equal(ownedQ(), "trashed = false and 'me' in owners");
  assert.equal(ownedQ(KINDS[0].q), "trashed = false and 'me' in owners and mimeType = 'application/vnd.google-apps.spreadsheet'");
  assert.equal(SHARED_Q, "trashed = false and sharedWithMe = true");
  assert.deepEqual(KINDS.map((k) => k.id), ["sheets", "docs", "slides", "folders", "pictures", "pdfs"]);
});

await t("aboutMe reads identity and storage; no limit means unlimited", async () => {
  const f = fake({ about: { user: { displayName: "Bernard Tan", emailAddress: "b@x.com", photoLink: "p" }, storageQuota: { usage: "3221225472", limit: "16106127360" } } });
  const me = await aboutMe(TOKEN, f);
  assert.deepEqual(me, { name: "Bernard Tan", email: "b@x.com", picture: "p", usage: 3221225472, limit: 16106127360 });
  assert.equal(storageText(me), "3.0 GB of 15 GB used");
  assert.equal(storageText({ usage: 5 * 1024 * 1024, limit: 0 }), "5.0 MB used");
  assert.equal(f.calls[0].auth, "Bearer tok");
});

await t("countFiles pages through 1000s and says when it stopped early", async () => {
  assert.deepEqual(await countFiles(TOKEN, ownedQ(KINDS[0].q), fake({ pages: { sheets: [12] } })), { n: 12, more: false });
  assert.deepEqual(await countFiles(TOKEN, ownedQ(KINDS[0].q), fake({ pages: { sheets: [1000, 400] } })), { n: 1400, more: false });
  assert.deepEqual(await countFiles(TOKEN, ownedQ(KINDS[0].q), fake({ pages: { sheets: [1000, 1000, 1000, 5] } }), 3), { n: 3000, more: true });
  assert.equal(fmtCount({ n: 3000, more: true }), "3,000+"); assert.equal(fmtCount({ n: 7, more: false }), "7"); assert.equal(fmtCount(undefined), "—");
});

await t("discover: counts owned by kind, shared apart, newest lists, nothing asked of anyone else's account", async () => {
  const f = fake({
    about: { user: { displayName: "B", emailAddress: "b@x.com" }, storageQuota: { usage: "10" } },
    pages: { sheets: [4], docs: [9], slides: [1], folders: [3], pictures: [1000, 20], pdfs: [0], shared: [57] },
    recent: [{ id: "r1", name: "Recent", mimeType: "x" }], sheets: [{ id: "s1", name: "Budget" }, { id: "s2", name: "Stock" }],
  });
  const d = await discover(TOKEN, f);
  assert.deepEqual(Object.fromEntries(Object.entries(d.counts).map(([k, v]) => [k, v.n])), { sheets: 4, docs: 9, slides: 1, folders: 3, pictures: 1020, pdfs: 0 });
  assert.equal(d.shared.n, 57);
  assert.equal(d.recent.length, 1); assert.deepEqual(d.sheets.map((s) => s.name), ["Budget", "Stock"]);
  assert.deepEqual(d.failed, []);
  // every call went to Drive with Bernard's own token, and every non-shared query is owner-filtered
  assert.ok(f.calls.every((c) => c.url.startsWith("https://www.googleapis.com/drive/v3/") && c.auth === "Bearer tok"));
  const queries = f.calls.map((c) => new URL(c.url).searchParams.get("q")).filter(Boolean);
  assert.ok(queries.filter((q) => q !== SHARED_Q).every((q) => q.includes("'me' in owners")));
  assert.equal(queries.filter((q) => q === SHARED_Q).length, 1);
});

await t("one refused part is named, the rest still show", async () => {
  const f = fake({ about: { user: { displayName: "B", emailAddress: "b@x.com" }, storageQuota: {} }, pages: { sheets: [2] }, fail: { "application/pdf": 500 } });
  const d = await discover(TOKEN, f);
  assert.deepEqual(d.failed, ["pdfs"]); assert.equal(d.counts.sheets.n, 2); assert.equal(d.counts.pdfs, undefined);
});

await t("a signed-out token fails the whole find with the human reason", async () => {
  await assert.rejects(() => discover(TOKEN, fake({})), (e) => e.status === 401 && /signed you out/.test(e.message));
});

await t("explain names the API-not-enabled case and the others", () => {
  assert.match(explain(403, { error: { message: "Google Drive API has not been used in project 123 before or it is disabled." } }), /not switched on/);
  assert.match(explain(403, { error: { message: "The caller does not have permission" } }), /would not let this account/);
  assert.match(explain(429, ""), /slow down/);
  assert.equal(explain(500, { error: { message: "backend" } }), "backend");
  assert.equal(explain(502, ""), "Google answered 502.");
});

await t("sizes and tile targets", () => {
  assert.equal(fmtBytes(0), "0 B"); assert.equal(fmtBytes(512), "512 B"); assert.equal(fmtBytes(1536), "1.5 KB"); assert.equal(fmtBytes(15 * 1024 ** 3), "15 GB");
  assert.deepEqual(["sheets", "pictures", "docs", "folders"].map(tileTarget), ["sheet", "gallery", "drive", "drive"]);
  assert.equal(typeof newest, "function");
});

console.log(`mygoogle.test.mjs: ${n} groups OK`);
