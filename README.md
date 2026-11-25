# megaWAN

pick the games. find your squad. get hyped.

a little site for the megaWAN morale day: everyone adds the games they want to play, says how keen they are
(eh, sure → i'm down → keen → hyped → LET'S GO) and, optionally, how long they're up for
(a bit · few hours · all day). **the arcade** shows who's up for what.

live at <https://megawan.cazminah.me> · deploys on push to `main` (see [DEPLOY.md](DEPLOY.md)) · the original plan is in [PLAN.md](PLAN.md).

## what's in it

- **accounts**: username + passphrase, optional email for resets. avatars are a game-icons.net icon in one of 18 colours, or an uploaded picture.
- **colour-blind mode**: a toggle (register screen + profile) that swaps the tier colours for a blue → sky → amber → yellow ramp that stays distinct under protan/deutan/tritan colour blindness. saved per device and on the account.
- **add game**: searches IGDB (main games, remakes, remasters, ports — no DLC/seasons/bundles), defaults to "keen".
- **the arcade**: square cards with game artwork, grid or list, a smart search box (`2020 shooter pc`), filters (platform, genre, theme, mode, "works for N players", who's in, duration, headcount, voted / not, free-to-play), sort, and group by genre / group size / keenness. voting freezes the order until you close the picker, then cards glide into place. hover an avatar for who it is, how keen and for how long.
- **past events**: after the day, an admin archives the arcade into a season (e.g. "2026"). past games show faded under a divider; tap one to bring it back with your old vote (or pick one if you didn't vote).
- **game detail**: platforms, players + game modes, themes, a 2-line blurb, a folded trailer, and who's in as tier columns.
- **admin**: delete people, reset avatars, remove games, archive / restore seasons.

## how it's put together

```
browser (react SPA)  ──/api/*──►  cloudflare worker (hono)  ──►  D1 (sqlite): users, sessions, games cache, interests
        │                              │                     ──►  R2: uploaded avatars
        │                              └──────────────────────►  IGDB (search + game details, server-side only)
        └── static: /icons/* (game-icons.net svgs), og.png; artwork + covers straight from images.igdb.com
```

```
worker/            the api
  index.ts         entry: session middleware, routes, /avatars/:key, nightly cleanup cron
  routes/          auth (register/login/logout/forgot/reset), me (profile/avatar/passphrase),
                   games (search/arcade/interest + background refresh), admin
  auth/            pbkdf2 hashing, session tokens (only sha-256 of tokens hit the db)
  igdb/            token caching + queries (client.ts), raw → our shape (map.ts)
  db/schema.ts     drizzle schema → migrations/
src/               the react app
  pages/           Arcade, Auth (login/register/forgot/reset), Profile, Admin, Credits
  components/      InterestPicker (+ duration), GameViews (grid/table/detail), Avatar(+Stack), AddGameDialog, TierIcon, ui bits
  lib/             api client, arcade data hook, filters/grouping (pure), format, icon search, FLIP animation, tiny router
shared/types.ts    shapes + constants used on both sides (interest tiers + colours, durations, Game)
scripts/icons.ts   rebuilds public/icons/ from github.com/game-icons/icons
scripts/og.ts      renders public/og.png (link preview) with headless chrome
```

## commands

```bash
npm run dev          # vite + local worker/D1/R2 on :5173
npm test             # vitest unit tests
npm run check        # typecheck worker + app + scripts
npm run build        # production build into dist/
npm run icons        # rebuild the icon set
npm run og           # re-render the link preview image
npm run db:generate  # new migration from worker/db/schema.ts
```

## credits

game data from [IGDB](https://www.igdb.com) · avatar icons from [game-icons.net](https://game-icons.net) (CC BY 3.0) ·
interface icons are [Material Symbols](https://fonts.google.com/icons) (Apache 2.0). full list on the site's credits page.
