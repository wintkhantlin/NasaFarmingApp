This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies after cloning or pulling updates, then run the development server:

```bash
npm install
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Crop rotation explorer

The [Rotation Explorer](http://localhost:3000/plan) uses the TypeScript engine in `lib/rotation/engine.ts` through the Next.js `/api/rotation` route. Run the app with `npm run dev`; no separate API server is needed. Crop profiles and regression examples are in `rotation-engine/`.

The farmer form asks for a location, previous crop, irrigation access, main priority, and an adjustable suggested planting period. Soil pH, drainage, equipment notes, and available crops are in Advanced settings. Farmers do not enter monthly climate measurements. For a real location with coordinates, the server uses the SI environmental-data service when configured, or NASA POWER complete-month historical averages through the app's existing weather loader. These are labeled as historical averages, not a forecast. If neither source supplies usable data, climate checks remain incomplete. Synthetic climate is loaded only when someone explicitly selects a demonstration farm. See [the environmental-data contract](docs/si-environment-contract.md).

The result is ecological screening with explicit cautions and missing information, not a planting prescription. See `rotation-engine/README.md` and `rotation-engine/SCIENCE_NOTES.md` for the engine's scientific contract and limitations.

Saved fields now use this same engine in the Compare and Report screens. The saved rotation supplies the most recently harvested crop, while irrigation, priorities, crop exclusions, and a farmer-entered soil pH come from the field profile. NASA POWER daily records are converted to complete-month historical averages; unavailable weather stays unknown. This engine currently screens one next crop from rice, green gram, black gram, sesame, and maize. A previous crop outside that scope is shown as unsupported, and priorities the engine cannot score are left unranked. The Conditions screen remains a view of source data and does not run a second rotation evaluator.

Farmer-facing labels and crop names are grouped in `app/plan/messages.ts`; the plain-language explanation mapping is in `lib/rotation/presentation.ts`. These are the translation points for a future Burmese locale.

Production builds include the crop profiles and demonstration fixtures from `rotation-engine/`. The recommendation API runs entirely in Node.js.

Run the API and engine regression tests with `npm run test:rotation`.


The home page is in `app/(app)/page.tsx`; the rotation explorer is in `app/plan/`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
