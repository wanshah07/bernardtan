import assert from "node:assert/strict";

let n = 0;
const t = async (name, fn) => { try { await fn(); n++; } catch (e) { console.error("FAIL:", name); throw e; } };
const { signIn } = await import("./src/lib/google.ts");

await t("signIn maps Drive about.get identity without requesting OAuth userinfo", async () => {
  const requests = [];
  const saved = new Map();
  let oauthConfig;
  let accessOptions;
  globalThis.localStorage = {
    getItem: (key) => key === "bernard.google.client_id" ? "test-client" : null,
  };
  globalThis.sessionStorage = {
    getItem: () => null,
    setItem: (key, value) => saved.set(key, value),
  };
  globalThis.window = {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config) => {
            oauthConfig = config;
            return {
              requestAccessToken: (options) => {
                accessOptions = options;
                config.callback({ access_token: "drive-token", expires_in: 3600 });
              },
            };
          },
        },
      },
    },
  };
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), auth: init?.headers?.Authorization });
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://www.googleapis.com");
    assert.equal(parsed.pathname, "/drive/v3/about");
    assert.equal(parsed.searchParams.get("fields"), "user(displayName,emailAddress,photoLink)");
    return {
      ok: true,
      json: async () => ({ user: {
        displayName: "Bernard Tan",
        emailAddress: "bernard@example.test",
        photoLink: "https://example.test/bernard.jpg",
      } }),
    };
  };

  const token = await signIn({ pick: true });
  assert.equal(token.access_token, "drive-token");
  assert.equal(token.email, "bernard@example.test");
  assert.equal(token.name, "Bernard Tan");
  assert.equal(token.picture, "https://example.test/bernard.jpg");
  assert.equal(oauthConfig.client_id, "test-client");
  assert.equal(oauthConfig.scope, "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets");
  assert.deepEqual(accessOptions, { prompt: "select_account" });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].auth, "Bearer drive-token");
  assert.ok(requests.every((request) => !request.url.includes("userinfo")));
  assert.deepEqual(JSON.parse(saved.get("bernard.google.token")), token);
});

console.log(`google-signin.test.mjs: ${n} group OK`);
