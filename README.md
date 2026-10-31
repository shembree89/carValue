# carValue

An explainable, manual-entry **new vs. used car value calculator** hosted as a static GitHub Pages site.

## Launch GitHub Pages (one-time setup)

1. Open [Settings → Pages](https://github.com/shembree89/carValue/settings/pages).
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open [Actions](https://github.com/shembree89/carValue/actions/workflows/deploy.yml) and click **Run workflow** (choose `main`), or re-run the most recent failed deployment.
4. When the workflow succeeds, open **https://shembree89.github.io/carValue/**.

All future pushes to `main` automatically run the regression tests and deploy the static site. No npm dependencies or paid hosting services are required.

## Usage

- Start with the hypothetical new ($30k) and five-year-old used ($10k) example; edit or add vehicles.
- Enter your annual miles and replacement rule (vehicle age, years owned, or optional odometer cutoff).
- Compare fixed loan lengths or a fixed monthly payment budget.
- Enter original warranty time/mileage limits and whether coverage remains valid for this purchase.
- Set resale to **historical segment estimate**, **manual future sale value**, or **unknown**.
- Choose what matters to you, from net annual ownership cost to payment-free driving and warranty coverage.
- Expand *Show me the math* and *Calculation audit* to verify all numbers.
- Saved scenarios stay in browser localStorage, with JSON export/import.

## Resale model

The category mode uses five-year depreciation benchmarks from the [2026 iSeeCars study](https://www.iseecars.com/cars-that-hold-their-value-study): all vehicles 41.8%, trucks 34.2%, hybrids 35.4%, SUVs 44.9%, electric vehicles 57.2%. We derive a constant annual loss factor from the five-year benchmark, apply a user-selected speed multiplier, and extrapolate from **today's entered purchase price**, whether new or used. The low/high band assumes 25% slower/faster annual depreciation than the chosen baseline; it is **not** a statistical interval. There is no model-specific valuation or odometer adjustment, and extrapolating far beyond five years is highly uncertain. The [BLS paper on vehicle depreciation](https://www.bls.gov/opub/mlr/2024/article/a-consumption-measure-for-automobiles.htm) shows why age-sensitive models can improve later versions.

If resale is **unknown**, the app deliberately does not compute net ownership cost; spending before resale is still available. This avoids silently treating unknown resale as zero.

## Financial and warranty assumptions

- Resale-adjusted net ownership cost = price + purchase tax + fees + accrued loan interest until replacement + running expenses − resale value.
- No double counting of loan principal or down payment.
- Original warranty age and odometer limits both apply; the first to expire ends modeled coverage. It does not reset when purchased used.
- Payment-free years are counted only from payoff to the end of your projected ownership.
- If the loan is not fully paid at sale, remaining principal is assumed settled at sale. No fee, investment opportunity cost, inflation, unexpected repairs, or model-specific depreciation is inferred.
- Values are scenario estimates, **not** financial advice, a car appraisal, or a reliability forecast.

## Tests

Use Node.js 20+:

```sh
node --test engine.test.mjs
```

The GitHub Actions workflow runs these tests before publication.

## Files

- `index.html` — layout and inputs
- `styles.css` — responsive styling
- `app.js` — browser UI and local persistence
- `engine.mjs` — pure finance, warranty and resale calculations
- `engine.test.mjs` — regression tests
- `.github/workflows/deploy.yml` — automated test and deploy workflow
