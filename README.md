# Green Ally

Green Ally helps farmers in Myanmar map a field, record what they grow, and compare crop plans. It brings field records together with weather, soil, satellite, and local crop information, and explains where the data is uncertain. It supports farmer judgment; it does not make the decision for them.

Repository: <https://github.com/wintkhantlin/green-ally>

## What it does

- Add a field by searching for a Myanmar place, selecting a map location, or entering coordinates.
- Record crops and farm details, then compare the current plan with alternatives.
- Review the environmental data, sources, and limitations behind each comparison.
- Keep field records in the browser on the farmer's device. The field location is sent to external data services to retrieve map, weather, and soil information.

## Requirements

- [Bun](https://bun.sh/) 1.4.3 or compatible
- Node.js supported by Next.js 16
- A public Mapbox token for map tiles and place search. Without it, fields can still be entered with coordinates.
- Optional NASA Earthdata credentials for services that require authentication. See `.env.example`.

## Run locally

```bash
bun install
cp .env.example .env.local
```

Set `NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local` to enable the map and place search. Other data-provider settings are optional; unavailable providers are reported by the app rather than silently replaced.

Start the development server:

```bash
bun run dev
```

Open <http://localhost:3000>.

## Checks

```bash
bun run test
bun run typecheck
bun run build
```

## Project layout

- `app/` - Next.js routes and API handlers
- `components/` - user interface
- `lib/` - geospatial, data-provider, and crop-planning logic
- `tests/` - unit and component tests
