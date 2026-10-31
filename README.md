# carValue

An explainable, manual-entry new-vs-used vehicle value calculator, designed for GitHub Pages.

## Running

The site uses plain HTML, CSS and JavaScript with no build step. Open `index.html` locally, or enable GitHub Pages from **Settings → Pages → Build and deployment → Deploy from a branch → main / (root)**.

## Principles

- No fabricated market prices, resale forecasts, or hidden scoring weights.
- Resale estimates are optional; when unknown, net ownership cost is **not calculated**. A separate pre-resale spend metric remains available.
- Warranty end is the earlier of its original age or odometer cap and is limited to time owned.
- Compare payment-free years, covered years, financing, and modeled costs independently.
- Scenario data stays in browser localStorage; JSON export and import are provided.

For current assumptions, calculation details, and limitations see the in-app methodology.
