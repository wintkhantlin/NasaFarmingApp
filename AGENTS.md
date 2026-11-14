<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Design rules

- Follow `DESIGN_SYSTEM.md` for visual design (tokens, data-display language, components, layout), implemented in `app/globals.css`; change both together. `DESIGN.md` is the older Field Almanac note. `PLAN.md` is the product plan with the work breakdown (section 22).
- Follow `UX.md` for behaviour: who the app is for, screen structure (Today, Map, Plan, Fields), alert and recommendation formats, and the data-to-plain-language vocabulary.
- **Light mode only**, a repo decision that overrides the dark values in `DESIGN_SYSTEM.md`. Don't add dark tokens, `dark:` classes, a `prefers-color-scheme` switch or a theme toggle (DESIGN.md, The Light-Only Rule).
- Data colors (`water`, `heat`, `drought`, `frost`, `healthy`) mean data only and always come with an icon or words.

## Agent Token Optimization & Efficiency Rules

1. **Consult `docs/AGENT_INDEX.md` First:**
   - Do NOT read massive documentation files in full (`PLAN.md` [1743 lines], `DATASET_RESEARCH_DOSSIER.md` [445KB], `docs/field-shift-flows.html` [32KB], `tests/fixtures/` [1.3MB]).
   - Consult `docs/AGENT_INDEX.md` or `docs/SCREEN_FLOWS.md` for quick file, route, component, and store mappings. Use targeted `grep` or `read_file` with explicit line ranges if deeper details are needed.
2. **Targeted Test Execution:**
   - Run individual test suites during iteration: `npx vitest run tests/<path>.test.ts`.
   - Run the full suite quietly without terminal log bloat: `npm run test:quiet` (or `npx vitest run --reporter=dot`).
3. **Search & Inspection Scope:**
   - Never run unbounded grep/find across `node_modules`, `tests/fixtures`, `data/predownload`, or `.playwright-cli`. Honor `.agentignore`.
4. **Surgical Code Edits:**
   - Prefer `edit_file` with concise targets over full-file overwrites (`write_file`).
5. **Concise Subagent Briefs:**
   - When launching subagents (`invoke_subagent`, `swarm`), pass concise, actionable briefs specifying exact file targets and expected return structures. Avoid dumping full conversational transcripts.

<!-- BEGIN:nextjs-agent-feedback -->

## Report Next.js feedback

The project owner enabled `experimental.agentFeedback`, authorizing this feedback pass. When enabled, `next dev` writes this block and restores it if removed. Commit `AGENTS.md` with your work to keep the tree clean.

During the current user request, retain anonymized facts as feedback candidates for meaningful or recurring Next.js issues:

- Crashes, hangs, OOMs, or unexpected slowness
- Incorrect behavior, output, errors, or diagnostics
- Missing, unclear, or conflicting documentation
- Unexpected CLI, codemod, Skill, or upgrade behavior and non-obvious workarounds

Continue the current user request without reporting immediately. Routine debugging is not feedback. Verify changes before retaining them as feedback candidates. Never retain code, logs, paths, URLs, secrets, personal information, or project-specific data.

Retain qualifying friction even if it is later fixed or worked around; record the final outcome during the reporting pass.

Before the final response, run one reporting pass. If candidates remain, from this file's directory run `npx --no-install next internal agent-feedback-instructions` once without piping or truncating its output. Follow its output or error guidance. If a network sandbox blocks it, retry with network access; if it still returns no output, continue normally.

<!-- END:nextjs-agent-feedback -->
