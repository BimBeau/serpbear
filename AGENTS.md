# AGENTS instructions for SerpBear

## Project overview
- SerpBear is a Next.js 12 application written in TypeScript. Pages under `pages/` include both the UI routes and API route handlers (e.g. `pages/api/domains.ts`).
- Client-side data fetching and mutations are handled through React Query hooks that live under `services/`. The React Query provider is initialised in `pages/_app.tsx`.
- Persistence is powered by Sequelize with a SQLite database stored at `data/database.sqlite`. Models live in `database/models/` and migrations in `database/migrations/`.
- Background keyword refreshes are orchestrated by `cron.js`, and integrations with third-party SERP providers are under `scrapers/`.

## Environment & tooling
- Develop with Node.js >= 18 (the Docker image uses Node 22.11) and npm (a `package-lock.json` is present; do not switch to yarn or pnpm).
- Install dependencies with `npm install` and start the local dev server with `npm run dev`.
- Copy `.env.example` to `.env.local` (or `.env`) when running locally. Keep every required variable documented in `.env.example` whenever you introduce a new one.
- Database migrations can be executed with `npm run db:migrate` and rolled back with `npm run db:revert`.

## Directory notes
- `components/` contains reusable UI building blocks. Prefer colocating feature-specific helpers inside the relevant route directory under `pages/` when possible.
- `services/` houses React Query hooks and network helpers that wrap the REST API exposed under `pages/api/`.
- `utils/` contains cross-cutting helpers such as authentication (`verifyUser`), Google Search Console helpers, and formatting utilities. Update or extend these utilities instead of duplicating logic.
- `email/` stores notification templates rendered by the cron job.
- `__tests__/` mirrors the app structure. Unit/integration tests rely on Jest, Testing Library, and `jest-fetch-mock`. Shared fixtures live in `__mocks__/`.

## Implementation guidelines
- Use TypeScript for new code. Keep shared types in `types.d.ts` so both the API layer and React components remain in sync.
- API route handlers must call `await db.sync()` and `verifyUser()` (when authentication is required) before executing their main logic. Maintain consistent JSON response shapes with the existing handlers.
- When persisting sensitive Search Console credentials, continue encrypting them with Cryptr as demonstrated in `pages/api/domains.ts`.
- If you change the database schema, update the Sequelize models, add the corresponding migration, and adjust related TypeScript types and mocks.
- React Query hooks should return `useQuery`/`useMutation` instances rather than raw `fetch` promises to keep cache invalidation consistent. Invalidate or refetch the relevant queries after mutations.
- Prefer Tailwind utility classes for styling. Only extend the global CSS files in `styles/` when a utility class cannot express the requirement. If you touch CSS, run `npm run lint:css`.

## Quality checks
- Run `npm run lint` after any code change (this repo extends `next/core-web-vitals` and `airbnb-base`).
- Run `npm run lint:css` whenever you modify files in `styles/`.
- Run Jest in CI mode (`npm run test:ci`) before committing code changes. Tests mock `fetch` globally via `jest-fetch-mock`; prefer stubbing network calls instead of hitting live services.
- When you add or modify behaviour, update or add tests under the mirrored path in `__tests__/` so coverage remains meaningful.

## Versioning & release hygiene
- Bump the `version` field in `package.json` (usually a patch increment) whenever you change application behaviour or API responses.
- Update `CHANGELOG.md` when the release notes should reflect your change (the project uses `standard-version` via `npm run release`).

