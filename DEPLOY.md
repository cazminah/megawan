# deploying megaWAN

same pattern as ti-tracker: **push to `main` → cloudflare builds + deploys**. nothing to log in to locally.
megaWAN also has a database (D1), a file bucket (R2) and secrets, so it needs some one-time setup first.

## one-time setup

### 1. github
1. create an empty repo on github (no readme / licence — the repo already has them), e.g. `megaWAN`.
2. point the local repo at it and push:
   ```bash
   git remote add origin git@github.com:<you>/megaWAN.git
   git push -u origin main
   ```

### 2. cloudflare: database + bucket
1. dashboard → **storage & databases → D1 → create database** → name it `megawan` (any location).
2. copy its **database id** into `wrangler.jsonc` → `d1_databases[0].database_id` (replacing the zeros).
3. dashboard → **R2 → create bucket** → `megawan-avatars`. (first time: R2 asks you to enable it on the account — the free tier is plenty.)

### 3. cloudflare: connect the repo
dashboard → **workers & pages → create → import a repository** → pick megaWAN, then:
- **project name**: `megawan` (must match `name` in `wrangler.jsonc`)
- **build command**: `npm run build`
- **deploy command**: `npm run deploy:ci`
  (applies any new database migrations, then deploys. migrations that already ran are skipped; in CI they don't ask for confirmation.)
- branch: `main`

### 4. secrets
the worker → **settings → variables and secrets** → add each as type **secret**:
- `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` — <https://dev.twitch.tv/console/apps> (confidential app, redirect `http://localhost`, needs twitch 2FA)
- `RESEND_API_KEY` — <https://resend.com> → api keys (after the domain step below)

without IGDB keys, game search says "not set up yet". without the resend key, reset emails are only logged, never sent.

### 5. email (resend)
1. resend → **domains → add domain** → `cazminah.me` (or a subdomain like `mail.cazminah.me` if you'd rather keep the root clean).
2. resend shows a few DNS records (SPF/DKIM, maybe MX for bounces). add each in cloudflare → `cazminah.me` → **DNS → records**. set the proxy toggle to **DNS only** (grey cloud).
3. wait for resend to say **verified**, then create the api key (step 4).
4. if you used a subdomain, change `MAIL_FROM` in `wrangler.jsonc` to match (e.g. `megaWAN <noreply@mail.cazminah.me>`).

### 6. custom domain + go
1. in `wrangler.jsonc`, uncomment the `routes` line (`megawan.cazminah.me`, `custom_domain: true`). make sure there's no existing `megawan` DNS record first — cloudflare creates it.
2. commit + push → cloudflare builds and deploys. watch it under the worker → **deployments**.

### 7. make yourself admin
1. open the live site and **register your account first** (before sharing the link).
2. dashboard → D1 → `megawan` → **console**, run:
   ```sql
   UPDATE users SET is_admin = 1 WHERE username = 'caz';
   ```
3. reload the site → your avatar menu now has **admin**.

### 8. smoke test
- register / log in (if it fails with **error 1102**, it's the free plan's 10 ms CPU limit vs passphrase hashing → workers paid at $5/mo, or lower `ITERATIONS` in `worker/auth/hash.ts`)
- add a real game (search works = IGDB keys ok)
- vote + set a duration; open the game's detail view
- upload an avatar (R2 ok)
- log out → "forgot your passphrase?" with an account that has an email → the email arrives (resend ok)
- paste the link in slack → the preview card shows

## running it

### moderation
everything's on the **admin** page: delete a person (their votes, sessions and uploaded picture go too), swap a dodgy avatar back to a random icon, remove a game and its votes.
other admins: same SQL as step 7 with their username. to remove: `UPDATE users SET is_admin = 0 WHERE username = '…';`

### logs
the worker → **observability / logs**. errors and `console.log` land there (free plan keeps 3 days).

## local dev

```bash
npm install
cp .dev.vars.example .dev.vars        # fill in IGDB keys for real search locally
npm run db:migrate:local
npx wrangler d1 execute megawan --local --file=scripts/seed-dev.sql   # optional: 6 fake games
npm run dev                            # http://localhost:5173
```
make yourself admin locally the same way, with `npx wrangler d1 execute megawan --local --command "UPDATE users SET is_admin = 1 WHERE username = 'caz'"`.

## when things change

- **schema change**: edit `worker/db/schema.ts` → `npm run db:generate` → commit the new file in `migrations/`. the deploy applies it.
- **data migration** (no schema change): `npx drizzle-kit generate --custom --name <what>` and write the SQL by hand.
- **cached game format** (`worker/routes/games.ts` → `GAME_DATA_VERSION`): bump it and old games re-fetch from IGDB a few at a time as the arcade loads.
- **search query** (`worker/igdb/client.ts`): bump `SEARCH_VERSION` so day-old cached results stop being served.
- **icons**: `npm run icons` rebuilds `public/icons/` from the game-icons repo. commit the result.
- **link preview image**: `npm run og` re-renders `public/og.png` (needs chrome). commit it.
- **bindings** (`wrangler.jsonc`): `npm run cf-typegen` to refresh types.

## free-plan limits worth knowing

- 100k worker requests/day. icons, covers and the app itself are static/external; only `/api/*` and `/avatars/*` count.
- 10 ms CPU per request — see error 1102 above.
- workers logs: 200k events/day.
