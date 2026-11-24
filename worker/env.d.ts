// secrets aren't in wrangler.jsonc, so `wrangler types` can't see them.
// set them in the cloudflare dashboard (prod) or .dev.vars (local).
export {};

interface MegawanSecrets {
  IGDB_CLIENT_ID?: string;
  IGDB_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
}

declare global {
  interface Env extends MegawanSecrets {}
  namespace Cloudflare {
    interface Env extends MegawanSecrets {}
  }
}
