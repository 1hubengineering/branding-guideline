# AndHub downloadable templates

All templates use the supplied company and founder details. The SVG and HTML files are editable and self-contained, with embedded logo artwork. The letterhead includes an editable Word DOCX with native header/footer parts and live body text. PNG/JPG files are exports for placement and preview. PDF files are ready to review or print at the stated trim size.

| Template | Size | Pages / sides |
|---|---|---|
| Letterhead | A4 / 210 × 297 mm | 1; reusable header/footer SVG strips included |
| Company brochure | A4 landscape / 297 × 210 mm | 2; tri-fold outside and inside |
| Founder business cards | 85 × 55 mm | 2 each; brand front and contact back |
| Website banner | 1920 × 640 px | 1 |
| Social square | 1080 × 1080 px | 1 |
| Proposal / report cover | A4 / 210 × 297 mm | 1 |
| Founder email signatures | HTML | 1 each; selectable contact links |

Open a template HTML file to preview it and use **Print / Save as PDF**. Replace bracketed placeholders before publication. Edit SVG text and layout in a vector editor, or update the generator. Keep the logo paths intact and preserve its aspect ratio. The brochure outside is arranged flap / back / front from left to right; the inside is arranged left to right. Fold a paper proof first.

SVG artwork embeds the brand's recommended Inter variable font and its SIL Open Font License notice for portable editing and display. The native Word letterhead and email signatures use Arial for office and email compatibility. Templates are RGB, at trim size, without bleed or printer marks. Agree bleed, process-specific color conversion, minimum type sizes and a physical proof with your printer. For business cards, print at 100% scale with automatic scaling disabled. The letterhead header/footer and business card PNG/JPG exports retain the same trim proportions as the source.

For email, copy the live HTML signature block rather than pasting the preview image. If your email client removes embedded logo images, replace the image source with your approved hosted PNG URL. Test in the target client.

Regenerate with `node scripts/generate-templates.mjs`. The script uses Playwright and a local installed Chromium browser; set `PLAYWRIGHT_MODULE` (module file path) and `PLAYWRIGHT_EXECUTABLE_PATH` if the runtime is not discoverable. Font source and license are retained in the separate font library.

[Back to home](../../index.html) · [Asset library](../../assets.html)
