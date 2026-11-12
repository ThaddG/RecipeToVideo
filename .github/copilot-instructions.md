# RecipeToVideo Copilot Instructions

## Project

- Simmer is a React 19 / Vinext application deployed to Cloudflare Workers.
- Keep provider keys in browser memory only. Do not add them to local storage, source files, fixtures, logs, or error messages.
- Preserve the existing paid-generation safeguards: user confirmation, saved task IDs, spending reservations, and no automatic paid retries.

## Working Locally

- Use Node 22.13 or newer.
- Start the app with `npm run dev`. The normal local preview uses port 5173.
- Use `npm run lint`, `npx tsc --noEmit`, and `node --test tests/*.test.mjs` for focused validation. Run `npm run build` when changing build or Vite configuration.
- Set `VITE_USE_POLLING=true` only when the environment does not provide file-system events for hot reload.

## Code Conventions

- TypeScript source uses compact formatting. Preserve the surrounding style and keep changes scoped.
- Route handlers validate request input before any provider request and return actionable, key-safe errors.
- Tests use Node's built-in test runner and mock provider boundaries; do not make real paid provider calls in automated tests.
- Avoid changing generated UI components under `components/ui` unless the task directly requires it.