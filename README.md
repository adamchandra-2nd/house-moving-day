# HMD Event Companion

Web app (mobile, no install) for guests of Potara's House Moving Day — Potara Hackathon, Team A.

Guests get a character that lives in the Potara office. The main area shows the character in the middle of a room, with every action floating on top; swipe left/right to move between the 5 rooms.

## Run

```bash
npm install
npm run dev      # http://localhost:5173, plus a Network URL for phones on the same wifi
npm run build    # production build in dist/
npm run preview  # serve dist/ — use this to test the service worker
```

`server.host` is on, so `npm run dev` also prints a Network URL you can open on a
phone. Windows may ask to allow Node through the firewall on a private network.

## Guest flow (user view)

RSVP → (Tidak → Terima kasih, can switch back) → Countdown → Mulai masuk Potara → Check-in (QR / kode pintu / panitia) → Pintu keycard → Cerita Potara (Stories-style chapters; real history still to fill in `src/data/story.ts`) → Buat karakter (outfit only; the name comes from the invitation; confirming = hadir) → App: Ruangan · Agenda · Kenalan · Feedback (after the event) → Memory card.

Each step is a real URL: `/`, `/terima-kasih`, `/countdown`, `/mulai`, `/check-in`,
`/pintu`, `/cerita`, `/karakter`, then `/app/ruangan` · `/app/agenda` · `/app/kenalan`
· `/app/feedback`.

Open `/review` for a hub that links every screen and case (136 of them). A case is a
*state fixture*, not a route — it sets up the data the case needs — so it rides on a
query param: `/app/ruangan?demo=ruangan-hadiah`, `/check-in?demo=check-in-kamera`,
`/app/kenalan?demo=voucher`. The fixtures live in `src/routing/scenarios.ts`.

Old `#token` links still work: `ScenarioGate` rewrites them to the new form, so
anything shared earlier opens the same case. A review scenario never overwrites real
progress — once a `?demo=` case is opened, that tab stops saving until a reload.

Prototype codes (replace with backend checks): door code `1108`, committee PIN `2026`, Nanda's kenalan code `1357`. Progress is saved in localStorage so reopening resumes where the guest left off.

Set `COUNTDOWN_ENABLED = false` in `src/config.ts` for Test Day ("Ya" goes straight to "Mulai masuk Potara").

## MC & Performance sides (phone + tablet)

For the people on stage, who may come from outside Potara. The admin sends each one a
personal WhatsApp link (Admin → Pengisi acara); the first open is confirmed with a
6-digit code sent to the same number (demo code `246810`).

- **MC** (`/mc`): Panggung (now/next, big timer, PIC, Claude-assisted script, cues to
  the speaker, call the committee, read-only rundown), Pertanyaan (guest questions
  grouped by Claude, swipe to pick/skip, full-screen read mode), Sorotan (greeting
  lines, who just arrived, rewards), Umumkan (one-tap templates or write your own).
- **Performance / speaker** (`/pembicara`): Sesiku (Saya siap, timer, Butuh bantuan,
  Kembali ke MC), MC cues take over the screen, questions picked by the MC, and the
  session's feedback afterwards.
- Layout follows the guest app (one column, floating bottom nav) on phones and
  tablets; tablets are portrait-only, with a 24px gutter, full-width toasts and
  floating dialogs.
- In the prototype both sides share state through localStorage, so `/mc` and
  `/pembicara` open in two tabs talk to each other.

Each tab is a real path — `/mc/panggung` · `/mc/pertanyaan` · `/mc/sorotan` ·
`/mc/umumkan`, and `/pembicara/sesi` · `/pembicara/pertanyaan` · `/pembicara/hasil`.
Both sides are **one lazy chunk** (`src/stage/StageRoute.tsx`), so neither a guest's
phone nor the admin's desktop downloads them. Cases that are not a tab of their own
ride on `?demo=` exactly like admin: `/mc?demo=mc-bantuan`,
`/pembicara?demo=pembicara-5-menit`. Old `#mc-…` and `#pembicara-…` links still work.

## Admin side (desktop)

Open `/admin/login` (email `admin@potara.id`, PIN `123456`) or `/admin` to skip
sign-in; `/admin/rundown`, `/admin/tamu`, `/admin/undangan` and the rest go straight
to a page. Admin is a separate lazy chunk, so a guest's phone never downloads it. Same design system as the guest app; layout is an Ink sidebar + top bar + panels for 1440×900. Screens: Dashboard, Rundown (5 room columns, drag to move, drag the bottom edge to resize, click to edit), Pengumuman (with phone preview), Undangan WA (send RSVP links one by one or in bulk, CSV import with a review step before anything is added, editable message template; delivery is simulated here and goes through the WhatsApp Business API in production), Daftar tamu (manual check-in), Hadiah (committee PIN), Pengisi acara (send each MC / speaker their WhatsApp link, revoke access, edit the MC script), Feedback (per event + final, anonymous), Pengaturan. Panels fill the screen and scroll inside; the bell opens notifications, and items that need action also pop up as a toast — including the stage calling for help, which arrives from `/mc` or `/pembicara` through the shared state. Every admin case is listed under "Admin (desktop)" in `/review`, and exact cases
(`?demo=admin-rundown-bentrok`, `?demo=admin-sesi-habis`) pin a single state. CSV export lives in `src/admin/csv.ts` so it's easy to remove.

## Buttons

Primary = Orange Splash (main action) · Secondary = Ink · Tertiary = white (back / cancel) · Danger = red. No text-only buttons.

## Structure

```
src/
  App.tsx             # route tree only; admin, stage and /review are lazy chunks
  main.tsx            # providers: BrowserRouter + persisted react-query
  config.ts           # event info, countdown toggle, kenalan target
  routing/
    paths.ts          # the flow as paths, tab paths, admin pages, stage sides
    scenarios.ts      # the guest review fixtures + the URL for every token
    ScenarioGate.tsx  # old #hash links, ?demo= correction, resume-where-you-left-off
  guest/
    state.ts          # GuestState, defaults, debounced localStorage
    guestContext.ts   # context + useGuest
    GuestProvider.tsx # owns the state, applies review fixtures
    routes.tsx        # one component per screen route + the in-app tabs
  admin/
    AdminRoute.tsx    # lazy entry; path picks the page, ?demo= pins a case
    Pengisi.tsx       # MC & speaker access: WA links, revoke, edit the script
    …                 # the other admin screens
  stage/
    StageRoute.tsx    # lazy entry for both sides; path picks side + tab
    McApp.tsx         # MC: rundown, questions, cues to the speaker
    PerformerApp.tsx  # speaker: own session, MC cues, picked questions
    links.ts          # every MC / Performance review case
    store.ts          # state the two sides share (localStorage in the prototype)
  character/
    CharacterStage.tsx     # ONE shared Spline instance for all guest screens
    characterStageContext.ts
    capture.ts             # canvas -> cropped webp sprite
    sprite.ts              # captured sprite, cached in IndexedDB
  data/
    adapters.ts       # THE BACKEND SWAP POINT — every call lives here
    queries.ts        # useQuery / useMutation hooks
    queryClient.ts    # offline-first defaults + IndexedDB persister
    …                 # rooms, sample rundown, sample guests, character colours
  styles/tokens.css   # design tokens, mirrored 1:1 from the Figma variables (file "Adam")
  styles/global.css   # fonts (latin subset only), text styles, clay + glass effects
  styles/layout.css   # shared screen layouts (flow screens, tab pages, panels)
  components/         # one component per Figma component page
  screens/            # one file per screen
```

`stage` and `tab` are no longer state: the URL is the single source of truth for
where the guest is. Everything else (name, outfit, cards, questions) stays in
`GuestState` and is persisted.

## The 3D character (Spline)

The character is on nearly every guest screen, so Spline runs as **one shared
instance for the whole guest app**, not one per screen.

`CharacterStage` (mounted in `GuestShell`) owns a single canvas and a single
`Application` for the session. `<Character>` renders an empty slot and asks for
that canvas; the stage re-parents it into whichever slot is on screen. Moving a
canvas in the DOM keeps its WebGL context, so the scene's 459 meshes are parsed
exactly **once** — mounting Spline per screen would re-parse them on every
navigation. The newest slot wins, so navigating hands the 3D character to the
screen the guest just arrived on.

**Nothing ever waits for it.** Every screen paints the 2D character first:

1. the live 3D character, once the scene is ready and this slot holds the canvas;
2. the sprite captured on `/karakter`, so the guest's own outfit still shows;
3. the bundled art.

The scene loads in the background on an idle callback, and swaps in when ready.
If it fails, every screen keeps rendering 2D. Rendering stops when the tab is
hidden or no slot is on screen.

Admin sits outside `CharacterStage`, where the context is a no-op — `<Character>`
there renders the bundled art and Spline is never pulled in.

What it costs, measured:

| | Over the wire |
| --- | --- |
| Guest shell (JS + CSS, gzip) | 137 kB |
| Spline runtime | 59 lazy chunks, about 4.6 MB raw |
| Scene `pota.splinecode` | 1.05 MB, self-hosted |

None of it is in the entry chunk and none of it is precached — the service
worker runtime-caches it, and the scene is `CacheFirst`, so a returning guest
never downloads it twice. The scene is fetched by hand first to drive a real
progress bar.

On `saveData` or a 2g-class connection the stage **does not autoload**: the guest
gets the full app in 2D, and `/karakter` offers a button to load it anyway.

### The scene

`src/assets/characters/pota.splinecode` is served from this app, not from
prod.spline.design. Same-origin matters: a cross-origin texture taints the WebGL
canvas, and a tainted canvas makes `toDataURL()` throw, which would silently kill
the sprite capture. Self-hosting also puts the file under this app's cache rules.

To update it, re-export from Spline and replace that file.

It holds the character alone — one Pota (94 objects, with `Head Pivot`,
`Tail 1-4 Pivot` and the rest of the rig), one `Directional Light`, and its own
`Pota Camera` for framing.

### Outfits are not wired to the scene yet

**This scene carries no wardrobe.** Picking an outfit is recorded in guest state
and read back in the UI, but nothing changes on the 3D character. `scene.ts` has
`wardrobe: false`, which skips the toggling and logs one line saying so.

An earlier scene (`yPXiij…`, 5.35 MB) did have the full wardrobe, but as a
*display grid*: the clothes were loose props standing in rows, not parented to
the character, so toggling them made items appear in mid-air rather than on the
body. Only three outfits existed as worn copies, suffixed `(Try On)`. That scene
also carried 4-5 character presets and 109 lights.

To make outfits work, the clothes need adding to the current scene:

1. For each item, place a copy on the character, parented to the right pivot
   (hats to `Head Pivot`, tops to the torso), and set it invisible.
2. Name each copy exactly as the `node` values in `src/data/outfits.ts`:
   `Puffy Top - Hoodie 2`, `Puffy Hat - Navy Cap`, `Glasses - Aviator`, and so on.
3. Set `wardrobe: true` in `src/character/scene.ts`.

No code change beyond that flag — `CharacterStage` already hides the whole
wardrobe and shows only what was chosen, and warns in the console about any
`node` it cannot find. `splineObjects()` and `splineEvents()` in the browser
console list what the loaded scene actually has.

Parenting is the part that matters: the character is rigged, so an item placed
by coordinates alone would not follow the head or the idle motion.

The **"Built with Spline" badge** is the free plan's watermark — a licensing
thing, not a setting.

## Slow connections and offline

The event wifi is the constraint the front end is built around.

- **Admin, the stage sides, the review hub and Spline are separate chunks**, all
  excluded from the service worker precache, so a guest's first visit never downloads
  them. Each is runtime-cached the first time someone actually opens it. The precache
  is an explicit allowlist (`assets/index-*`), not "every .js", so a new lazy entry
  stays out of it by default.
- **Service worker** (`vite-plugin-pwa`) precaches the guest shell, fonts and room
  art. After the first visit the app opens from disk and runs with no network.
  Test it with `npm run preview`, not `npm run dev` — it is off in dev on purpose.
- **Reads** go through react-query with `networkMode: "offlineFirst"` and a cache
  persisted to IndexedDB, so the last known data paints instantly instead of a spinner.
- **Writes** (questions, feedback, cards) are mutations with stable keys. Offline they
  pause, persist, and replay in order once the connection is back; the UI shows them
  as done straight away.
- **Room art loads one room either side** of the current one. All five panels stay in
  the swipe track, but painting all five meant downloading every room on entry.
- **Fonts are the latin subset only** — latin-ext, cyrillic and vietnamese were about
  130 kB that no Indonesian guest would ever render.
- **Progress is written debounced** (400 ms, flushed on `pagehide`), instead of a
  synchronous `JSON.stringify` on every keystroke.

Guest first paint, gzipped: **CSS 20.3 kB → 8.2 kB**; JS stayed flat at about
127 kB, because react-router and react-query cost roughly what pulling admin
out of the entry chunk saved. The win is not byte count — it is that the second
visit needs no network at all, and that admin, the review hub and Spline are no
longer in the guest's first request.

## Deploy

Real paths need an SPA fallback, or a cold load of `/app/ruangan` returns 404.

- Netlify: `public/_redirects` is already in the repo.
- Vercel: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.
- nginx: `try_files $uri $uri/ /index.html;`
- Apache: `FallbackResource /index.html`

Serve over HTTPS (or localhost) — a service worker will not register otherwise.

## Layout rules (from the main area)

- Three layers: full-bleed illustration, the character standing in the middle, floating UI grouped at the top and bottom.
- The middle stays clear for the character; only temporary toasts grow out from under the top card.
- Cards: tag row first (status, place), then one content row. 8px inside a group, 12px between groups, 16px card padding.
- One orange accent per area; Ink for primary actions and "now"; red only for LIVE.
- Never move the guest without warning; locked features look normal and explain themselves on tap.

## Design system rules

- Colors, radius, spacing, padding: use the CSS variables in `tokens.css`, never raw values.
- Text and icons on Orange Splash or Amber are white (`--text-on-accent`).
- Depth comes from clay effects (`.clay` + `.clay-accent | .clay-dark | .clay-grey | .clay-light`) and glass (`.glass`) for floating elements. No drop shadows.
- Icons: Remix Icon (line), see `components/iconPaths.ts`.
- Illustrations are placeholders (`Character`, room backgrounds) until Nanda's assets are in.
