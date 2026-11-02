# AndHub branded QR codes

Ready-to-download PNG, JPG and editable vector SVG codes for the website, company and founder contact cards, email, phones and social destinations. Contact sets include a `.vcf` file. The QR artwork uses Anchor Navy modules, Signal Blue finder patterns, a small navy AndHub symbol, a white background and a four-module quiet zone. All use high error correction (`H`).

The phone payloads use international Ethiopian numbers: `0913231123` → `+251913231123`, and `0922964576` → `+251922964576`. Contact cards use vCard 3.0 with CRLF line endings.

Social links are derived from the supplied **1hubengineering** handle. Their profile availability and ownership have not been independently verified. Use the asset library's custom QR creator for another confirmed HTTPS destination. The creator works locally in the browser and exports PNG/JPG without sending entered URLs to a remote service.

Keep the full white margin when placing codes. Preserve square proportions. Test the final physical size, material and destination with the phones that will scan it before production. A software decoder check does not replace testing the printed output.

`qr-codes.json` records the exact destination or vCard payload. `QR-VALIDATION.json` records exact-payload decoding checks for every exported PNG/JPG. The static QR files are self-contained and need no network service to render.

To rebuild, run `node scripts/generate-qr.mjs` from the repository root in a development environment with `sharp` available. Set `ANDHUB_SHARP_MODULE` to its absolute module entry path if it is installed outside the project. Add `--verify` and set `ANDHUB_JSQR_MODULE` to an installed `jsQR` entry to repeat decoding validation. These build tools are not needed to use or download the website assets.

The QR encoder is **qrcode-generator 2.0.4**, copyright Kazuhiko Arase, distributed under MIT. Its full license accompanies the locally vendored encoder in `assets/vendor/`. The logo is the reconstructed AndHub symbol and retains its existing approval status.
