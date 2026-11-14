<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design rules

- Follow `DESIGN.md`. Its tokens are implemented in `app/globals.css`; change both together.
- **Light mode only.** Don't add dark tokens, `dark:` classes, a `prefers-color-scheme` switch or a theme toggle (DESIGN.md, The Light-Only Rule).
- Data colors (`water`, `heat`, `drought`, `frost`, `healthy`) mean data only and always come with an icon or words.
