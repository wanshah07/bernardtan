# Bernard Tan · bernardtan.kkmhalalconsultant.com

Bernard's own app: his pictures, his Google Drive and Sheets, reminders that ring on his iPhone, games, and Koko the
night-light keeping watch. React 18 + Tailwind 3 + TypeScript, built with Vite into plain HTML/CSS/JS, served by GitHub
Pages, installable on phone, tablet and desktop. Plain CSS and plain JS are welcome: `src/theme.css` is ordinary CSS with
Tailwind layered on; `src/lib/sheet.js` and `src/lib/reminders.js` are plain JavaScript with tests.

## What is in it (v4)
- **Lock**: a PIN keypad when the app opens, and again after 5 minutes in the background. Face ID / Touch ID can be added
  on a device that has it (WebAuthn, platform authenticator). It is a lock on the app, not a server account: the PIN is a
  salted SHA-256 hash in the browser; five wrong tries wait 30 s, then 60, 120… Google sign-in is separate.
- **My Google** (the person icon at the top, or **Find my Google** on Home): one button opens Google's own account chooser, so he picks
  which of his accounts to use, and the page then finds what **that account owns**: counts of spreadsheets, documents, slides, folders,
  pictures and PDFs, his newest spreadsheets (tap one to open it in the Sheet page) and his newest Drive files. What other people shared
  with him is counted on a separate line and never mixed into "mine". Everything is read in the browser with that account's one-hour key:
  no workspace connection, no Composio, no server. Drive is read only; Sheets can add a row. The account's name and e-mail come from Drive
  itself (`about.get`), because the e-mail/profile scopes are not asked for.
- **Home**: Koko greets Bernard by name and time of day (a different line each time), the next reminder, a strip of his
  pictures, the four doors, the install card.
- **Gallery**: a card carousel (swipe, snap, dots, arrows on wide screens, tap to see big) of pictures **from his phone**
  (the photo picker; kept in this browser's IndexedDB, resized to 1200px, never uploaded) and **from his Drive**
  (image files, thumbnails fetched with his token).
- **Reminders**: title, when, repeat (once / daily / weekly / monthly), a heads-up before, a note. **Add to iPhone** hands
  Safari a calendar file with an alert (`.ics` + `VALARM`), so the iPhone's own Calendar rings whether or not the app is
  open; **All to iPhone** does the whole list. While the app is open it also nudges in-app (and with a notification if
  allowed). No server, so this is the honest route; the README is plain about it.
- **Sheet looks like the Google Sheets app** (v4): row numbers and column letters, the first rows and columns frozen exactly as
  the sheet freezes them (header and name column stay put while the rest scrolls), the sheet's own cell colours, text colours,
  bold, alignment, wrapping, merged cells, hidden rows/columns, column widths and row heights, red-corner notes, the sheet tabs along
  the bottom (hidden tabs are in the menu), zoom, a formula bar, and 150 rows at a time with "Load more". The grid is read only; the one write is **Add row**.
  It draws on a dark or light page (the sun button) because a sheet's own white cells would otherwise glare in Night mode.
- **Drive** and **Sheet** default to **his own** files: Drive has a *Mine / Shared with me* switch, and the Sheet picker lists the
  spreadsheets his account owns (a pasted link still opens any sheet the account can open). **Games**: Burger Tap.
- **Three themes**: Day (diner), Night, and **Night-light**: deep navy with a soft green glow, Koko's own theme.
- **Settings**: theme, lock (set/change PIN, add/remove Face ID, lock now, remove), Google client id, disconnect.

## Koko, and what is NOT used
Koko (`src/components/Koko.tsx`, `public/koko.svg`, the icons) is **our own character**, drawn from scratch: a soft green
glowing blob with stubby arms, round eyes and a lopsided grin. It is inspired only by the general idea of a friendly
glowing bedside toy. **No character, name, logo or artwork from Bob's Burgers or any other show is used, traced or
embedded**; there is no licence-free version of a studio's character, so the honest way to have "that mood" is to draw
our own, and that is what this is. The diner palette of v1 stays as the Day theme for the same reason: colours and mood,
nothing copied.

## Set up once (Wan, about 20 minutes)
1. **The repository.** Create `wanshah07/bernardtan` on GitHub (public, empty, no README). Upload this tree. The web
   uploader **silently drops dot-files**: after uploading, check that `.github/workflows/pages.yml`, `.gitignore` and
   `.env.example` are there (upload them in a second pass if not), and that the file count matches.
2. **Pages.** Settings → Pages → Source: *GitHub Actions*. The first push to `main` builds and deploys.
3. **The domain.** At the DNS of `kkmhalalconsultant.com` add `CNAME  bernardtan  →  wanshah07.github.io`. Then
   Settings → Pages → Custom domain: `bernardtan.kkmhalalconsultant.com` → tick *Enforce HTTPS* once the check passes.
   `public/CNAME` already carries the name. **Face ID needs https**, which Pages gives.
4. **Google sign-in (the 5-minute part).** console.cloud.google.com → a project → *APIs & Services*:
   - *Enabled APIs*: **Google Drive API** and **Google Sheets API**;
   - *OAuth consent screen*: External, app name "Bernard Tan", your e-mail; add Bernard's Gmail under **Test users**;
   - *Credentials* → Create → **OAuth client ID** → Web application; *Authorised JavaScript origins*:
     `https://bernardtan.kkmhalalconsultant.com` and `http://localhost:5173`; no redirect URI (token flow);
   - copy the **Client ID**. Paste it in the app under Settings on each device, or put it in GitHub → Settings →
     Secrets and variables → Actions → **Variables** → `VITE_GOOGLE_CLIENT_ID` and redeploy, so it is baked in.
5. On Bernard's phone: open the site, Share → **Add to Home Screen**, open it from the icon, Settings → set a PIN →
   add Face ID → Connect Google. Done.

## Running it locally
```
npm install
npm run dev        # http://localhost:5173
npm test           # the Sheets helpers, the grid model, the reminders/.ics helpers and the My Google finder
node e2e.mjs && node e2e2.mjs   # optional browser tests (need Playwright's Chromium and `npm run build` first)
npm run build      # type-check + production build into dist/
node icons.mjs     # regenerates the PNG icons from public/koko.svg (needs Playwright's Chromium)
```

## Where things are
```
index.html                      the shell: fonts, manifest, theme before first paint
public/koko.svg, icon*.png      Koko, and the icons made from it; manifest.webmanifest, sw.js, CNAME
src/theme.css                   the three themes and the cartoon card / button / field / rail / keypad classes — plain CSS
src/App.tsx                     the lock gate, hash tabs, header nav (wide), gear, the thumb bar (phone), auto-lock
src/components/Koko.tsx         the character (moods: happy, wave, sleepy)
src/components/Lock.tsx         the keypad screen
src/components/Carousel.tsx     the card carousel + lightbox
src/lib/lock.ts                 PIN hash, lockout, WebAuthn Face ID
src/lib/gallery.ts              Drive pictures with token-fetched thumbnails; phone pictures in IndexedDB
src/lib/reminders.js            reminders store, next occurrence, .ics with alarms (plain JS, tested)
src/lib/google.ts, sheet.js     sign-in, Drive list, Sheets read/append
src/lib/grid.js                 Sheets API reply -> the grid model (freeze, merges, colours, sizes), plain JS, tested
src/components/SheetGrid.tsx    the sticky-table drawing of that model
src/lib/theme.ts                theme + the phone status-bar colour
src/lib/mygoogle.js             finds what an account owns (owner-filtered queries, counts, newest), plain JS with fetch injectable, tested
src/pages/*.tsx                 Home, My Google, Gallery, Drive, Sheet, Reminders, Games, Settings
.github/workflows/pages.yml
```

## Not done, said plainly
- **Push notifications when the app is closed** need a server (Web Push + VAPID) and, on iPhone, the app installed to the
  Home Screen. This app has no server, so the iPhone's own Calendar carries the alarm instead. If Wan ever wants true
  push, a tiny Supabase function + a `push` table is the shape, and the Reminders page already has the permission button.
- The Face ID credential is checked locally (the OS verifies the face; the app does not verify a signature against a
  server), which is right for a one-person app and wrong for anything multi-user.
- Clearing Safari's site data clears the PIN, the reminders and the phone pictures. Drive pictures are not stored.
- Writing to Drive (upload) is still out: the scope is read-only on purpose.
- The three other games are placeholders.

## Changed in v4, and bugs fixed in the sweep
- **Phone pictures were never saved** (v2 and v3): the picture was shrunk *inside* the IndexedDB transaction, which closes itself while
  it waits, so the save threw. They are shrunk first and stored after; a private window now gets a message instead of a crash.
- **A 6-digit PIN counted one wrong try per digit**, so five slips locked it out after a single mistyped PIN. It now checks once, at the PIN's length.
- **Anyone holding the unlocked phone could change or remove the PIN** from Settings: the current PIN is now asked first.
- **Reminders**: "Got it" on a daily reminder finished it for ever, and an overdue one buzzed every 20 seconds. Now per occurrence, once; the time field resets after saving; the iPhone route uses the share sheet (Add to Calendar) and falls back to a download; the calendar file uses UTC times so the alarm is right in any zone.
- **A key Google refused (401) or that ran out** left pages saying "connected": the app now drops it at that moment.
- **Drive**: a slow answer for the old tab or search could overwrite the newer one.
- **Memory**: picture addresses are released when a list is replaced; a 12 MB Drive original is no longer downloaded as a thumbnail.
- **Status-bar colour** follows the theme (it was always the Day orange); Burger Tap no longer re-renders every frame.
- Removed the stale `public/icon.svg`.
