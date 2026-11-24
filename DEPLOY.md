# deploying megaWAN

same pattern as ti-tracker: **push to `main` → cloudflare builds + deploys**. nothing to log in to locally.
the difference: megaWAN has a database, a file bucket and secrets, so it needs a few one-time clicks first.

## one-time setup (cloudflare dashboard)

1. **github repo**: create `megaWAN` on github, add it as `origin`, push `main`.
2. **D1 database**: storage & databases → D1 → create → name it `megawan`.
   copy its **database id** into `wrangler.jsonc` → `d1_databases[0].database_id` (replacing the zeros) and push.
3. **R2 bucket**: R2 → create bucket → `megawan-avatars`. (R2 needs to be enabled on the account once; the free tier is plenty.)
4. **connect the repo**: workers & pages → create → import a repository → pick megaWAN.
   - build command: `npm run build`
   - deploy command: `npx wrangler d1 migrations apply megawan --remote && npx wrangler deploy`
     (applies any new database migrations, then ships. migrations that already ran are skipped.)
5. **custom domain**: uncomment the `routes` line in `wrangler.jsonc` (`megawan.cazminah.me`, `custom_domain: true`) and push.
   cloudflare creates the DNS record + certificate itself — make sure there's no existing `megawan` CNAME first.
6. **secrets**: the worker → settings → variables and secrets → add as **secret**:
   - `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` — from <https://dev.twitch.tv/console/apps> (register an app, type *confidential*, any redirect url like `http://localhost`; your twitch account needs 2FA)
   - `RESEND_API_KEY` — from <https://resend.com> after verifying `cazminah.me` (resend → domains → add, then paste its DNS records into cloudflare)

   without IGDB keys, game search says "not set up yet". without the resend key, reset emails are only logged, never sent.

## local dev

```bash
npm install
cp .dev.vars.example .dev.vars        # fill in IGDB keys if you want real search locally
npm run db:migrate:local
npx wrangler d1 execute megawan --local --file=scripts/seed-dev.sql   # optional: 6 fake games
npm run dev                            # http://localhost:5173
```

## when things change

- **schema change**: edit `worker/db/schema.ts` → `npm run db:generate` → commit the new file in `migrations/`. the deploy command applies it.
- **icons**: `npm run icons` rebuilds `public/icons/` from the game-icons repo (pinned commit in `public/icons/index.json`). commit the result.
- **bindings change** (`wrangler.jsonc`): `npm run cf-typegen` to refresh types.

## free-plan limits worth knowing

- 100k worker requests/day. icons, covers and the app itself are static/external, so only `/api/*` and `/avatars/*` count.
- 10 ms CPU per request. password hashing (PBKDF2, 100k rounds) is the heaviest thing we do — if login/register ever fail
  with error 1102 (CPU exceeded), the fix is workers paid ($5/mo) or lowering `ITERATIONS` in `worker/auth/hash.ts`.
