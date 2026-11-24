# megaWAN — game interest board

## context
megaWAN is a morale-day gaming event. people need one place to say "i want to play X, this badly", and see who else does, so groups form before the day.
the repo is empty (no commits). the site goes on `megawan.cazminah.me`, and `cazminah.me` is already on cloudflare DNS. caz already deploys `cazminah.com` with wrangler, so cloudflare is home turf.
mode: vibe code. commit on my own, never push (pushing = deploying).

decisions made with caz:
- game db → **IGDB**
- sign-ups → **open to anyone**, rate-limited
- all-games view → **"the arcade"**
- reset emails → **resend** free tier

## stack (all cloudflare, one worker)
- **frontend**: vite + react + typescript SPA, tailwind v4
- **api**: hono on cloudflare workers. one dev server via `@cloudflare/vite-plugin`
- **db**: D1 (sqlite) with drizzle ORM + migrations
- **files**: R2 bucket for uploaded avatars
- **auth**: written by hand, following the lucia-auth.com guide. PBKDF2-SHA256 via WebCrypto (100k iterations, the workers cap). session table + httpOnly secure cookie. *architectural call*: a library like better-auth assumes email is mandatory (inferred, not verified), and here email is optional.
- **abuse guard**: workers rate-limiting binding on register/login/reset. turnstile on sign-up is optional and can come later.
- runtimes pinned in `mise.toml` (node LTS). versions checked against current docs when scaffolding.

## layout
```
megaWAN/
├─ mise.toml, package.json, wrangler.jsonc, drizzle.config.ts
├─ migrations/              # drizzle-generated SQL for D1
├─ worker/
│  ├─ index.ts              # hono app, mounts routes, serves SPA assets
│  ├─ db/schema.ts          # users, sessions, reset_tokens, games, interests
│  ├─ auth/                 # hash.ts, session.ts, routes.ts
│  ├─ igdb/                 # token.ts, client.ts, map.ts (IGDB → our Game shape)
│  ├─ avatars.ts            # R2 upload/serve
│  └─ email.ts              # resend
└─ src/                     # react app
   ├─ pages/                # Arcade, Login, Register, Profile, ResetPassword
   ├─ components/           # GameCard, GameRow, InterestPicker, AvatarStack, AddGameDialog, Filters
   └─ lib/                  # api client, interest levels + colours
```

## data model
- `users`: id, username (unique, case-insensitive), email (nullable), password_hash, avatar (json: `{kind:"upload", key}` | `{kind:"icon", icon, color}`), created_at
- `sessions`: id (hashed token), user_id, expires_at
- `reset_tokens`: token_hash, user_id, expires_at (1h, single use)
- `games`: an IGDB cache. igdb_id (pk), name, slug, cover_image_id, release_year, platforms[], genres[], game_modes[], online_max, offline_max, coop flags, ttb_hastily/normally/completely (seconds), store_links[], fetched_at
- `interests`: (user_id, game_id) pk, level 1|2|3, updated_at

## IGDB integration
- caz makes a twitch dev app (needs 2FA) → `IGDB_CLIENT_ID` / `IGDB_CLIENT_SECRET` as secrets in the cloudflare dashboard.
- the worker fetches a client-credentials token (lasts about 60 days), caches it in D1, and refreshes it on expiry or a 401.
- `GET /api/games/search?q=`: proxies `search "q"; where version_parent = null;` and returns a few fields with a cover. it is cached with the Cache API for a day and debounced on the client. (IGDB blocks browser CORS, so it has to go through the server.)
- when someone first rates a game, the worker fetches the full record (platforms, genres, multiplayer_modes, `game_time_to_beats`, websites/external_games) and upserts it into `games`. the arcade reads only from D1, so it stays well under IGDB's 4 req/s limit.
- covers: `images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg` (template still to verify against the docs)
- store links (stretch): map `websites.type` and `external_games` to steam/epic/gog/etc. the enum values are unverified, so check them when building.
- footer credit: "game data from IGDB". IGDB is free for non-commercial use, and an internal morale tool fits that.

## interest scale
three notches, picked from a segmented slider. each notch has its own colour and label:
- 3 · **pink** `#ff4fa3`: "must play or i'll perish"
- 2 · **purple** `#a05cff`: "keen"
- 1 · **blue** `#4aa8ff`: "if nothing better's on"
- plus a "nah, remove me" action
avatars on cards get a ring in their level's colour. the same `InterestPicker` component is used in the add-game dialog and in the card popover.

## features, in build order
1. **scaffold + deploy skeleton**: mise, vite/react/hono, D1 + R2 created, a hello-world worker, custom domain `megawan.cazminah.me` in wrangler config. deploys on push to main.
2. **accounts**: register (username + password, optional email), login, logout, `/api/me`. usernames: 3–24 chars, `[a-z0-9_-]`.
3. **avatars**:
   - upload: crop and resize in the browser to 256×256 webp. the server accepts ≤ 2 MB, checks magic bytes, stores in R2, and serves from `/avatars/:key`.
   - icon presets: **game-icons.net only** (4000+ CC BY 3.0 SVGs, all in one consistent style). no dicebear.
     - build script (`scripts/icons.ts`) pulls the game-icons repo, copies the SVGs into `public/icons/<author>/<name>.svg`, and writes `public/icons/index.json` (name, author, tags if the repo has them; otherwise name words + a small hand-written synonym map).
     - picker: a search box that filters the index in the browser ("ghost" → every ghosty icon). SVGs load lazily as results scroll into view.
     - colour: **icon colour only**, picked from 18 preset colours. the icon is rendered as a CSS mask over the chosen colour. the background is a fixed dark navy that fits the site theme.
     - new users get a random icon + colour automatically, so nobody's blank.
     - credits page lists the authors from the index (CC BY 3.0 requires it).
   - "unique" here means personalised, not enforced-distinct.
4. **add game**: an "add game" button opens a search combobox with covers in the dropdown → pick a game → InterestPicker → save.
5. **the arcade**:
   - grid ↔ list toggle (remembered in localStorage)
   - grid: cards with a big cover, name, year, platform chips, player-count badge, and the avatar stack with interest rings
   - list: columns for cover thumb, name, year, platforms, players (online / local), time-to-beat (normally), genres, and interested
   - filters: platform, genre, multiplayer (online / local / co-op), max length, "not rated by me"
   - sort: hype score (3/2/1-weighted), headcount, recently added, A–Z
   - a "+" on each card/row opens the InterestPicker popover. clicking the card opens a detail drawer with store links and the full list of who's in.
6. **password reset**: if the user has an email, resend sends a single-use link. same response whether or not the account exists. caz verifies `cazminah.me` in resend's DNS and adds `RESEND_API_KEY` in the dashboard.
7. **polish**: phone layout at 16px gutters, empty states, loading skeletons, dark mode by default (gamer goblin hours).

## out of scope (for now)
day-of logistics (discord channels, schedule, calendar), comments, admin tools, notifications.

## things caz has to do (I can't)
deploys are push-to-main via cloudflare's git integration (same as ti-tracker), so no local `wrangler login`.
the one-time dashboard steps (repo, D1, R2, secrets, deploy command, custom domain) are in [DEPLOY.md](DEPLOY.md).

## verification
- vitest: password hash/verify, session expiry, IGDB → Game mapper (with a fixture), interest upsert/delete, avatar validation (rejects big or non-image files)
- local: `npm run dev` with the D1/R2 emulation, driven in the built-in browser. register 2–3 test users, add games at different levels, check that grid/list/filters/sort/popover all reflect them, upload and preset avatars, test the reset flow against resend's test address
- check at 375px width
- after deploy: smoke test on `megawan.cazminah.me`
