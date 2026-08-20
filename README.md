# Currents

Currents is a smart EV charging platform that recommends which charger to use and explains why. It combines live availability, vehicle compatibility, expected wait, charging time, and price.

## Local setup

Requirements: Node.js 20, Docker, and npm 10.

1. Copy `apps/api/.env.example` to `apps/api/.env` and `apps/web/.env.example` to `apps/web/.env`.
2. Start PostgreSQL with `docker compose up -d`.
3. Run `npm install`, then `npm run db:generate` and `npm run db:migrate -- --name init`.
4. Run `npm run db:seed` for deterministic Bengaluru stations and local demo accounts.
5. Start both applications with `npm run dev`.

Web: `http://localhost:5173` · API: `http://localhost:4000` · PostgreSQL: `localhost:55433`

Local test accounts use password `Test1234!`:

- `driver@currents.local`
- `operator@currents.local`
- `admin@currents.local`

Seed execution is blocked in production. Fake payments are also blocked when `NODE_ENV=production`.

## External services

Without an OpenChargeMap API key, ingestion uses a checked-in Bengaluru fixture through the same normalization pipeline. `PAYMENT_PROVIDER=fake` enables deterministic local and CI payments. Production requires Stripe credentials and an S3-compatible upload store.

## Stripe test-mode setup

1. Create or sign in to a Stripe account and stay in **test mode**. Copy the publishable and secret test keys from Developers → API keys.
2. In `apps/api/.env`, set `PAYMENT_PROVIDER=stripe` and `STRIPE_SECRET_KEY=sk_test_...`.
3. In `apps/web/.env`, set `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...`.
4. Install the Stripe CLI, run `stripe login`, then forward test events:

   ```sh
   stripe listen --events payment_intent.succeeded,payment_intent.payment_failed --forward-to localhost:4000/api/payments/webhook
   ```

5. Copy the `whsec_...` value printed by the CLI into `STRIPE_WEBHOOK_SECRET` in `apps/api/.env`, then restart both development servers.

The browser receives only Stripe's publishable key and a short-lived PaymentIntent client secret. Never put `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` in a `VITE_` variable. For deployed environments, register `https://<api-host>/api/payments/webhook` in Stripe Workbench and use that endpoint's signing secret.

## Groq recommendation explanations

Station eligibility, distance, queue time, charging time, price, normalization, and ranking remain deterministic so an LLM cannot invent or reorder charging results. To have Groq turn those verified values into the short “why” explanation, add these values to `apps/api/.env` and restart the API:

```env
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.1-8b-instant
GROQ_TIMEOUT_MS=4500
```

Create the key in the GroqCloud console. If Groq times out, rejects the request, or is not configured, recommendations still return immediately with the deterministic local explanation. The response marks every card with `explanationSource: "groq"` or `"deterministic"`.

## Deployment

The web app is configured for Vercel and the API for Railway. Railway should run `npm run db:deploy -w @currents/api` during release and use `/ready` for readiness checks. Keep the API at one replica while in-process scheduled jobs are enabled.

The `main` branch deployment workflow runs CI first, then deploys the API with Railway and the web app with Vercel. It also supports manual runs from the GitHub Actions tab. Create a GitHub `production` environment and add these secrets:

- `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, and `RAILWAY_SERVICE`
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`

Configure the production `VITE_API_URL`, `VITE_SOCKET_URL`, and API secrets in the Vercel and Railway project settings. The Railway service must have the repository root as its source and use `railway.toml`; Vercel should use `apps/web` as its project root.

Rollback by redeploying the previous API image and Vercel deployment. Prisma migrations must remain forward-compatible; never roll back by deleting production data.
