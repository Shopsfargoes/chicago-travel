# AI Travel Agency Site (demo skeleton)

Static front end (`/public`) + Vercel serverless API (`/api`). No build step.

## Run locally
1. `cp .env.example .env.local` and fill in `AI_API_KEY` and `AI_MODEL` (OpenRouter model that supports tool calling: https://openrouter.ai/models).
2. `npx vercel dev`

## Deploy
Push to GitHub, import into Vercel, add the same env vars, deploy. Custom domain: Vercel > Domains. No code changes needed.

## Customize per client
- `config/brand.json`: name, tagline, contact, hero image
- `config/ai.json`: persona and rules
- `data/travel-data.json`: trips, destinations, FAQs, policies (ISO dates; past trips auto-hide)
- `public/images/`: hero.jpg, nairobi.jpg, cape-town.jpg, etc. (missing images fall back to a green gradient)
- Edit static copy and the page title/meta in `public/index.html`

## Go to OpenAI later
Set `AI_BASE_URL=https://api.openai.com/v1`, `AI_API_KEY`, `AI_MODEL`. Leave `AI_FALLBACK_MODELS` empty.

## Known demo shortcuts (fix before a real client)
- Rate limit is in-memory: replace with Upstash/Vercel KV.
- Trips render client-side: add a build step for SEO-critical HTML.
- Price guard only checks `$` amounts: extend to dates and availability claims.
- Privacy/terms pages are placeholders. Add a consent notice before collecting leads.
- Without RESEND_API_KEY + AGENCY_EMAIL, leads only print to the function logs.
- Trip prices are marked "per person" in demo data: confirm per client.
