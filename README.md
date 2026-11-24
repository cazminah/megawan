# megaWAN

pick the games. find your squad. touch no grass.

a little site for the megaWAN morale day: everyone adds the games they want to play, says how keen they are
(💙 if nothing better's on → 💜 keen → 🩷 must play or i'll perish), and **the arcade** shows who's up for what.

live at <https://megawan.cazminah.me> · deploys on push to `main` (see [DEPLOY.md](DEPLOY.md)) · the original plan is in [PLAN.md](PLAN.md).

## how it's put together

```
browser (react SPA)  ──/api/*──►  cloudflare worker (hono)  ──►  D1 (sqlite): users, sessions, games cache, interests
        │                              │                     ──►  R2: uploaded avatars
        │                              └──────────────────────►  IGDB (search + game details, server-side only)
        └── static: /icons/* (game-icons.net svgs), covers straight from images.igdb.com
```

```
worker/          the api
  index.ts       entry: session middleware, routes, /avatars/:key, nightly cleanup cron
  routes/        auth (register/login/logout/forgot/reset), me (profile/avatar/password), games (search/arcade/interest)
  auth/          pbkdf2 hashing, session tokens (only sha-256 of tokens hit the db)
  igdb/          token caching + queries (client.ts), raw → our shape (map.ts)
  db/schema.ts   drizzle schema → migrations/
src/             the react app
  pages/         Arcade, Auth (login/register/forgot/reset), Profile, Credits
  components/    InterestPicker, Avatar(+Stack), GameViews (grid/table/detail), AddGameDialog, ui bits
  lib/           api client, tiny router, filters (pure), icon search
shared/types.ts  shapes + constants used on both sides (interest levels/colours, icon colours, Game)
scripts/icons.ts rebuilds public/icons/ from github.com/game-icons/icons
```

## commands

```bash
npm run dev      # vite + local worker/D1/R2 on :5173
npm test         # vitest unit tests
npm run check    # typecheck worker + app + scripts
npm run icons    # rebuild the icon set
```
