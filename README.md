# Legend Maker (working name)

The Goodwookie Productions portrait app for iPhone and Android. A customer
uploads a photo of one adult (themselves, a gift, or someone who has passed),
picks a persona (the Monarch, the Rock Star, the Movie Star...), and orders the
artwork through the goodwookie.com store and Printful.

Copied from the Design Your Pet app (`createyourpetappo`, commit 0aa4802,
16 Nov 2026) and shares its backend, limits, store and checkout.

- Product rules and what is still to do: [`docs/app-spec.md`](docs/app-spec.md)
- Backend API, with what the website must add: [`docs/backend-api.md`](docs/backend-api.md)
- The name lives in `src/brand.ts` and `app.json`.

## Run it

```sh
npm install
npx expo start
```

Without configuration the app runs on the built-in mock backend
(`src/api/mock.ts`). **The live website does not know this app yet**: do not
point it at goodwookie.com until the backend work in `docs/backend-api.md` is
published.

## Checks

```sh
npm test
npm run typecheck
npm run lint
```

## Before the first store build

- Settle the name, then set it in `src/brand.ts` and `app.json` (name, slug,
  scheme, bundle ID, package, permission text). The bundle ID cannot change
  after release.
- Run `npx eas-cli@latest init` to create this app's OWN EAS project. The
  Design Your Pet project ID and update URL were removed on purpose, so an
  update for this app can never be sent to Design Your Pet phones.
- Replace the placeholder art (see the spec).
