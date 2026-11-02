# AndHub Engineering PLC — Brand Guidelines & Asset Library

[**Live brand guide**](https://1hubengineering.github.io/branding-guideline/) · [Resource library](assets.html) · [Company & contacts](docs/company.html) · [Complete web edition](docs/guidelines.html)

The static website brings the brand standards, company profile, reconstructed logo pack, images, licensed fonts, motion assets, editable templates, branded QR downloads and AI toolkit into one searchable library. Resources and website CSS/JS live under `assets/`; standard discovery entry points (`llms.txt`, `llms-full.txt`, `AGENTS.md`, robots and sitemap) remain at the root. Page routes remain at the root or under `docs/`. Paths work at the GitHub Pages project URL and on a local server. No runtime framework, external fonts, analytics or backend is required.

The [resource library](assets.html) supports category, search, file format and surface filters; grid/list views; previews; individual downloads; category ZIPs; and ZIPs of selected resources. Uploading or deleting repository files is done through Git. Selection and custom QR creation run in the browser.

## Read and download

| Resource | Link |
|---|---|
| Brand guide home | [index.html](index.html) |
| Full guide, including illustrations and references | [Web edition](docs/guidelines.html) |
| Original guide | [PDF](assets/documents/AndHub_Engineering_Brand_Guidelines_v1.pdf) · [Editable DOCX](assets/documents/AndHub_Engineering_Brand_Guidelines_v1.docx) |
| Implementation tokens | [Brand starter CSS](assets/documents/AndHub_Brand_Tokens_v1.css) |
| Source references | [Identity board](assets/images/reference/AndHub%20Engineering%20Brand%20Identity%20Board.png) · [Concept board](assets/images/reference/ANDHUB%20Engineering%20Logo%20Concept%20Board.png) |
| Motion assets | [Video downloads](docs/index.html#videos) |
| Logo and icon downloads | [Asset gallery](assets.html) · [CSV inventory](assets/asset-manifest.csv) · [JSON inventory](assets/asset-manifest.json) |
| Production context | [Reconstruction notes](assets/reference/RECONSTRUCTION-NOTES.md) · [QA report](assets/reference/QA-REPORT.json) |
| Templates | [Letterhead, brochure, business cards, banners, proposal cover and email signatures](assets.html?category=templates) |
| Fonts | [Inter desktop and web fonts, with license](assets.html?category=fonts) |
| QR downloads | [Website, company/founder contacts, phones, email and seven social destinations](assets.html?category=qr) |
| Current company data | [Profile and contacts](docs/company.html) · [Machine-readable brand data](assets/brand.json) |
| AI toolkit | [Integration guide](docs/ai.html) · [llms.txt](llms.txt) · [Full text](llms-full.txt) · [Context JSON](assets/ai/brand-context.json) · [Reusable skill](assets/ai/andhub-brand/SKILL.md) |

The original PDF and DOCX predate the reconstructed asset pack. Their references to vector masters describe the requirements at that time. The web edition retains the source text and explains that reconstructed masters now exist and still require brand-owner approval. This website does not change the proposed status of the brand standards.

## Develop and validate

Use Node.js 22 or newer. No dependency installation is needed.

```powershell
npm run build
npm run preview
```

Open `http://127.0.0.1:4173/branding-guideline/`. The preview serves the packaged `_site/` directory under the same project path as GitHub Pages. Rebuild after edits.

`npm run check` verifies local links and anchors, filename case, CSS imports, web manifest paths, image alternatives, home navigation on every HTML page, resource discoverability, catalog and ZIP hashes, JSON/CSV inventory agreement, and all 494 original artwork SHA-256 hashes. It fails on missing downloads or project-breaking root-relative links. External source URLs are listed but not network-checked by this command.

After adding or changing resources, run `npm run refresh` to regenerate the AI context, `assets/catalog.json` and the nine category ZIPs, then `npm run build`. The 494-file artwork inventory is retained separately from the expanded resource catalog. Resource and vendor licenses stay with their download bundles. `npm run catalog` only refreshes the catalog and ZIPs.

AI tools can read the public text/JSON files or use the downloadable brand skill. The working read-only MCP adapter runs locally with `npm run mcp` (or `node` with the absolute path to `assets/ai/mcp-server.mjs`). Register that stdio command in a compatible client using the example configuration. It exposes current brand context, original guideline text, asset search and exact resource lookup. Run `npm run check:mcp` for protocol and portable-bundle checks. GitHub Pages serves the toolkit files; it does not run a remote MCP service. Client support for URL retrieval, attachments, skills and MCP varies; choose the method supported by the tool. See [the AI integration guide](docs/ai.html).

Company details are in `assets/brand.json`. Social destinations use the supplied **1hubengineering** handle on LinkedIn, Facebook, Instagram, X, YouTube, TikTok and GitHub. Profile ownership and availability have not been independently verified. Contact vCards use international Ethiopian dialing codes while templates retain the supplied local display numbers.

Templates include self-contained editable HTML/SVG, PNG/JPG and printable PDF exports; letterhead also has an editable Word DOCX. Template placeholders are intentional editing fields. Check copy, final dimensions, crop, bleed and physical proofs with your printer. Instructions: [template README](assets/templates/README.md).

QR codes have an embedded AndHub symbol, navy modules, blue finder patterns and a white quiet zone. PNG and JPG exports have been decoded against their complete intended payloads. Test the final placed/printed output on phones before production. The custom HTTPS QR creator exports PNG/JPG locally. Instructions and build requirements: [QR README](assets/qr/README.md). QR codes store their supplied destinations directly and do not provide tracking or remotely editable redirects.

To refresh the full web guide after editing the DOCX, run the converter in PowerShell, then review its output and rebuild:

```powershell
pwsh -File scripts/export-guidelines.ps1
npm run build
```

The converter preserves the document's text, tables, illustrations and external hyperlinks. Generated `docs/guidelines.html` and `assets/images/guide/` are tracked so normal builds work on any platform without PowerShell. Keep the original PDF in step with approved document changes. Update the home-page summary and token CSS when standards change. The original documents are historical; the web edition links to the current expanded resource library.

## GitHub Pages

The repository is [1hubengineering/branding-guideline](https://github.com/1hubengineering/branding-guideline). Pages publishes directly from **`main` / repository root**. The root `.nojekyll` file enables ordinary static-file hosting. GitHub republishes the site after pushes to `main`; run `npm run check` before pushing because branch publishing does not run the local validator.

The authenticated GitHub CLI token has `repo` access but lacks the `workflow` scope required to upload active Actions workflows. Branch publishing works with its existing access. An inactive [Actions workflow example](https://github.com/1hubengineering/branding-guideline/blob/main/.github/pages-workflow.example.yml) is retained for a future switch: with an appropriately scoped credential, move it into `.github/workflows/pages.yml` and set the Pages publishing source to GitHub Actions. That alternative validates pull requests and deploys the explicit public-file bundle defined in [the build script](https://github.com/1hubengineering/branding-guideline/blob/main/scripts/build-site.mjs). `_site/` is a local preview/package directory and is ignored by Git.

Site URL: [https://1hubengineering.github.io/branding-guideline/](https://1hubengineering.github.io/branding-guideline/).

The web manifest resolves `id`, `start_url` and `scope` from `assets/web-kit/` to the project root using `../../`. Copying the web kit into another project requires reviewing these paths, icon locations and site metadata. See [GitHub's publishing-source documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Logo Asset Pack v1

Reconstructed from the supplied brand identity board · 2 November 2026

## Start here
Open the [brand guide](index.html) or go directly to the [asset gallery](assets.html) to view and download individual assets. Both work locally with no external services. The [preview sheet](assets/reference/AndHub_Asset_Preview.png) provides an overview. Ready-to-use default files are in **assets/logos/start-here/**.

This is a clean vector reconstruction, not the recovery of the original designer's vector file. The primary symbol and custom ANDHUB lettering were manually rebuilt from the board. Supporting text was rebuilt with outlined Inter Display lettering. Curves, spacing, gradients, and alternate layouts were normalized to make a consistent asset family. Review these details before adopting the reconstruction as the approved master.

## What is included

| Folder | Contents |
|---|---|
| assets/logos/start-here | Common primary, horizontal, compact and icon files |
| assets/logos/svg | 56 fixed-theme vector configurations: 8 layouts × 7 treatments |
| assets/logos/png | Transparent PNGs at 512, 1024 and 2048 px; five main layouts also at 4096 px |
| assets/logos/jpg | 2048 px JPGs with white or navy backgrounds |
| assets/icons | Transparent icons, multi-size ICO and ICNS files, square app icons and avatars |
| assets/web-kit | Auto-theme SVGs, favicon files, Apple touch icon, manifest template and integration example |
| assets/reference | Preview sheet, source board and reconstruction notes |
| assets/documents, images, videos | Original PDF/DOCX, CSS tokens, identity boards, illustrations and all brand films |
| assets/styles, scripts, vendor | Shared website styling and local browser interactions |
| assets/asset-manifest.csv / .json | Machine-readable list of generated artwork files and dimensions |
| assets/brand-spec.json | Palette, layouts, theme definitions and export conventions |
| assets/templates | Editable layouts and print/raster exports |
| assets/qr | Branded QR images and contact vCards |
| assets/fonts | Licensed Inter desktop and web font files |
| assets/catalog.json, downloads | Searchable resource catalog and category ZIP bundles |
| assets/ai | Structured context, full guideline text, schemas, skill and read-only MCP adapter |

Raster labels denote the **longest artboard edge**, including built-in margins; horizontal assets are not square. JPG cannot preserve transparency, so its background is deliberately flattened. The ordinary SVG and PNG logo sets have no background, including the versions named “dark.” The words light/dark describe the **intended surface**, not an opaque canvas.

## Logo layouts

- **symbol:** square artboard containing the angular symbol only.
- **horizontal:** symbol, subtle separator, ANDHUB and ENGINEERING PLC.
- **horizontal-tagline:** horizontal full-name layout plus IDEAS. ENGINEERED.
- **stacked:** symbol above ANDHUB and ENGINEERING PLC.
- **stacked-tagline:** the primary stacked composition plus the tagline.
- **wordmark:** ANDHUB and ENGINEERING PLC, without the symbol.
- **wordmark-tagline:** company name and tagline, without the symbol.
- **compact:** symbol plus ANDHUB only; intended for small navigation headers and constrained spaces. The legal descriptor is intentionally omitted.

Use the full company name “AndHub Engineering PLC” in contracts, registration details and ordinary written references. The uppercase treatment in these artwork files is a logo styling choice.

## Theme selection

| File suffix | Intended use |
|---|---|
| gradient-light | Primary gradient treatment on white or a very light surface |
| gradient-dark | Brighter symbol and white AND/descriptor on navy or a dark surface |
| flat-light | Brand-palette flat color on light surfaces |
| flat-dark | Brand-palette flat color with white center/AND/descriptor on dark surfaces |
| mono-navy | Single-color #0B1F3B on a light surface |
| mono-black | Single-color #111111 on a light surface |
| mono-white | Reversed all-white artwork on a dark surface |

The light and dark variants deliberately use different symbol/wordmark fills; do not invert the light file or rely on CSS filters. The gradient colors are visual approximations of the board, not original measured brand gradient specifications. The flat variants use the printed brand palette. For a strict single-ink process choose a mono file; “flat” color is still multicolor.

## Color values

Core palette from the supplied board: navy **#0B1F3B**, blue **#2563EB**, green **#10B981**, cloud gray **#E5E7EB**. Supporting colors include white #FFFFFF, near-black #111111 and neutral tagline/divider colors. All exports are RGB artwork. No press-specific CMYK, Pantone, embroidery or screen-print separations are claimed. Ask the production supplier to prepare and proof the appropriate process-specific artwork.

## Sizes and clear space

Each file includes a practical artboard margin. Do not crop against the visible artwork, stretch it, rotate it, add shadows, or recolor individual parts. Keep aspect ratio locked when resizing. Preserve additional surrounding clearance when placing the logo near other content.

These reconstructed layouts have different proportions from some of the board's smaller examples. Recheck the provisional size and clear-space guidance from the brand guide against the chosen final master. There is no single universal minimum width: use the symbol or compact version when the descriptor or tagline becomes unreadable. Evaluate the actual output, especially embroidered items and small printed material.

Recommended starting display widths for the supplied digital assets (not a legibility guarantee): full-name horizontal 480 CSS px; horizontal with tagline 560 px; stacked full-name 360 px; stacked with tagline 420 px; compact 180 px. At smaller sizes, simplify to compact or symbol-only. Raster exports are supplied larger than these display sizes for high-density screens.

## Icons, favicons and avatars

Transparent icons are supplied for all seven themes at 16, 24, 32, 48, 64, 96, 128, 180, 192, 256, 384, 512 and 1024 px. Each ICO contains 16, 24, 32, 48, 64, 128 and 256 px images.

Square opaque app icons and avatars are supplied on navy, white, black and green. The symbol fits within a centered circle whose diameter is 80% of the canvas, leaving room for platform masks. No rounded corners are baked into the export. ICNS containers are included for all four app-icon backgrounds. App-icon PNG sizes are 180, 192, 256, 384, 512 and 1024 px. These are general-purpose source assets, not a claim that every store submission package or device scale is included. Check the actual target platform's current requirements and preview the final mask.

At 16 px the narrow negative spaces are necessarily delicate. Review the tiny version in context; use 32 px or higher where available. The same core silhouette is preserved rather than introducing an unapproved alternative symbol.

## Web integration and theme support

Open the [web integration demo](assets/web-kit/integration.html) for working theme switching. It uses fixed-theme SVGs with CSS and an explicit light/dark override.

The **auto-theme/** SVGs use an internal prefers-color-scheme media query. They default to light-surface artwork when the renderer does not support that feature. Use fixed-theme files in design applications, office documents, email and print. Automatic theme selection alone cannot infer the actual background of every component; ensure the surrounding surface matches the chosen artwork.

The web kit contains favicon.svg, a navy-tile favicon.ico, apple-touch-icon.png, 192/512 px icons, maskable equivalents and site.webmanifest. Update deployment paths, id, start_url and scope to your real site. The manifest is a template, not a complete installable app. No company URL or contact details have been invented.

Use alt="AndHub Engineering PLC" for a meaningful logo image. If a visible adjacent text label already supplies the same name and the logo is purely decorative, avoid redundant announcement. For an icon-only home link, provide an accessible name on the link.

## Editing and production

All fixed-theme SVG logos contain selectable vector paths, outlined lettering, solid fills or gradients; there are no embedded raster images or external font references. The custom wordmark, supporting descriptor and tagline can be edited as paths in a vector editor. They are intentionally not live text. Keep an untouched master and make production derivatives from a duplicate.

Licensed supporting Inter font files are included separately in the Fonts category. This pack does not perform trademark clearance, establish ownership of the supplied artwork, or replace a printer's proof. Approve the reconstruction, then use the same master consistently across channels.
