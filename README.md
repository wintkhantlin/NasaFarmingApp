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

## Crop rotation explorer & Farmer-Centered System

The [Rotation Planner](http://localhost:3000/fields/[fieldId]/rotation) and [Rotation Explorer](http://localhost:3000/plan) use the verified TypeScript engine in `lib/rotation/engine.ts` and `lib/engine/`. Run the app with `npm run dev`; no separate API server is needed.

The crop rotation system includes:
- **Dual-View Experience:** A mobile-first 5-step **Guided Farmer View** (Field $\rightarrow$ Constraints $\rightarrow$ Priorities $\rightarrow$ Compare $\rightarrow$ My Plan) and an **Advanced Timeline View** with multi-month calendar visual ribbons.
- **Relay Broadcast (*Ye-pyan*) Support:** Legitimate pre-harvest sowing (up to -12d gap) for eligible lowland rice $\rightarrow$ pulse pairings, with 1-click snap repairs.
- **Honest Moisture Clock:** Transparent post-paddy seedbed workable window reporting "Check topsoil moisture and drainage before sowing" when unconfirmed (never a fake calendar countdown).
- **Physical Hydrology & Mass Conservation:** Non-overlapping 3-zone hydrology ledger ($Z_1, Z_2, Z_3$) adhering strictly to mass conservation ($\le 10^{-9}\text{ mm/d}$ residual).
- **Water-Sensitive Economics:** Sourced FAO 33/66 $K_y$ factors; uncalibrated pulses marked `UNQUANTIFIED`; break-even yield returns null and viable: false when $P \le c_{\text{var}}$; cash-at-risk exposed.
- **Data Truthfulness & Provenance:** Full documentation in [`docs/rotation-data-provenance.md`](docs/rotation-data-provenance.md). Coarse satellite data (SMAP 9 km, NASA POWER ~50 km) is strictly labeled as regional context and never claimed as measured in the farmer's field.

See [`docs/rotation-upgrade-handoff.md`](docs/rotation-upgrade-handoff.md) and [`docs/rotation-upgrade-audit.md`](docs/rotation-upgrade-audit.md) for full architecture and test reports. Run the test suites with `npm test` and `npm run test:rotation`.


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
