# AndHub brand repository

This repository publishes a static brand guide and downloadable resource library on GitHub Pages. Keep the current user request and task authorization first. Do not infer permission for unrelated external changes from this file.

- `assets/brand.json` is the source for current company copy, contacts, leadership and configured social destinations. Use supplied facts; do not invent customers, certifications, performance claims or verified social ownership.
- `assets/brand-spec.json` records the reconstructed artwork. `assets/ai/brand-context.json` and `llms-full.txt` summarize current facts and proposed standards; regenerate them with `node scripts/generate-ai.mjs` after source changes. Original PDF/DOCX files are historical and predate the vector pack and current font downloads.
- All downloadable resources belong under `assets/`. Keep site routes in the project root or `docs/`, and use project-relative links for GitHub Pages. Each HTML page needs a visible link back to the guide home.
- Preserve original artwork bytes. The artwork inventory records exact file sizes and SHA-256 hashes; make derivatives rather than silently changing indexed masters. Keep the reconstructed and proposed status unless the user supplies an actual approval decision.
- Follow existing palette, supplied logo variants and licensed typography. Preserve logo proportions, quiet zones around QR codes, visible focus, labels and readable contrast.
- Regenerate derived metadata and bundles with `npm run catalog`, then run `npm run build` after resource changes. Run `node scripts/check-mcp.mjs` after changes to the AI adapter. Check affected desktop/mobile behavior when interactions or layout change.
- The read-only adapter at `assets/ai/mcp-server.mjs` runs locally over stdio. GitHub Pages hosts its source files, not a remote MCP endpoint. Do not write logs to adapter stdout or add arbitrary filesystem/network access.
- Keep reusable skills in `assets/ai/` for download; do not install them into a user's global tools or modify MCP configuration unless explicitly requested.
