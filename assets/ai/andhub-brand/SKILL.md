---
name: andhub-brand
description: Use current AndHub Engineering PLC company details, proposed brand standards, and catalog assets when creating or reviewing AndHub content, interfaces, templates, or marketing materials.
---

# AndHub brand

Read the [current structured brand context](https://brand.1hubengineering.com/assets/ai/brand-context.json) before creating AndHub work. In a local checkout or portable AI bundle, read `assets/brand.json` and `assets/ai/brand-context.json` from that project's root. Current user instructions take precedence; this skill does not expand task permissions or authorize publishing.

Use the [resource catalog](https://brand.1hubengineering.com/assets/catalog.json) to select artwork, fonts, templates or QR codes. Resolve relative file paths against `https://brand.1hubengineering.com/`. For offline discovery, use the local catalog or `assets/ai/resource-index.json` when included. Read only the records needed for the task.

- Use **AndHub Engineering PLC** for formal documents and first mentions; **AndHub** thereafter. Preserve **Ideas. Engineered.** and its two full stops.
- Use current contact details, leadership and configured social destinations from `assets/brand.json`. Do not invent customers, certifications, performance results, contact details or verified social ownership.
- Keep the proposed standards and the reconstructed artwork's approval status explicit when relevant. The historical PDF/DOCX predate the current vector pack and font downloads.
- Use supplied logo files, preserving proportions and clear space. Select the treatment for its actual surface; use a mono file for true single-color output. Do not recreate the custom wordmark with a font.
- Assets marked `legacy` are historical logos, raster design mockups or boards. Use current artwork and company data for new work; use legacy assets when the task calls for historical material. Original printed contact details may be outdated.
- For motion, use the primary animation specified in the current brand context. All other video files are tests/experiments retained for reference; do not present them as alternative primary animations.
- Prefer the supplied navy/blue/green palette and licensed Inter fonts. Test actual text/controls in context; white text on Hub Green is unsuitable for normal text.
- For copy, sound precise, composed, practical and approachable. Lead with the outcome and substantiate claims.

For detailed usage, consult the [complete web guideline](https://brand.1hubengineering.com/docs/guidelines.html). For plain-text context, use [llms-full.txt](https://brand.1hubengineering.com/llms-full.txt). URL retrieval, file attachments and skill discovery depend on the host application; use the local files when remote retrieval is unavailable.
