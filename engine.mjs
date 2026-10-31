// Pure calculation module: no browser dependencies.
export const FIVE_YEAR_DEPRECIATION = Object.freeze({
  overall: { label: 'All vehicles', loss: 0.418 },
  truck: { label: 'Trucks', loss: 0.342 },
  hybrid: { label: 'Hybrids', loss: 0.354 },
  suv: { label: 'SUVs', loss: 0.449 },
  ev: { label: 'Electric vehicles', loss: 0.572 }
});
// Source: iSeeCars 2026 Five-Year Depreciation Study.
// https://www.iseecars.com/cars-that-hold-their-value-study
// These five-year cross-sectional benchmarks are used ONLY as scenario assumptions.
// The model extrapolates a constant rate beyond five years; it is NOT a
// model-specific valuation, confidence interval, or mileage-adjusted forecast.

export const METRICS = Object.freeze({
  netYear: { label: 'Net cost / year after resale', better: 'min', unit: 'moneyYear' },
  netMile: { label: 'Net cost / driven mile after resale', better: 'min', unit: 'moneyMile' },
  spendYear: { label: 'Spending / year before resale', better: 'min', unit: 'moneyYear' },
  warrantyYears: { label: 'Warranty-covered years', better: 'max', unit: 'years' },
  warrantyMiles: { label: 'Warranty-covered miles', better: 'max', unit: 'miles' },
  paidYears: { label: 'Payment-free years', better: 'max', unit: 'years' },
  paidMiles: { label: 'Payment-free miles', better: 'max', unit: 'miles' },
  bothYears: { label: 'Years paid off AND under warranty', better: 'max', unit: 'years' },
  coveredPct: { label: 'Percent of ownership covered by warranty', better: 'max', unit: 'pct' },
  warrantyDollar: { label: 'Purchase price / warranty-covered year', better: 'min', unit: 'moneyYear' },
  payment: { label: 'Regular monthly loan payment', better: 'min', unit: 'money' },
  interest: { label: 'Interest accrued before replacement', better: 'min', unit: 'money' }
});

const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const nonnegative = (v) => Math.max(0, finite(v));
const safeDiv = (n,d) => d > 1e-9 ? n / d : null;
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));

export function calculateCar(car, settings) {
  const warnings = [];
  const price = nonnegative(car.price);
  const age = nonnegative(car.age);
  const currentMiles = nonnegative(car.miles);
  const annualMiles = nonnegative(settings.annualMiles);
  const limitYears = settings.retireMode === 'ownership'
    ? nonnegative(settings.ownYears)
    : Math.max(0, nonnegative(settings.retireAge) - age);
  const maxMiles = nonnegative(settings.maxMiles);
  const milesUntilRetire = maxMiles > 0
    ? Math.max(0, maxMiles - currentMiles)
    : Infinity;
  const yearsFromMiles = annualMiles > 0 ? milesUntilRetire / annualMiles : (milesUntilRetire > 0 ? Infinity : 0);
  const years = Math.min(limitYears, yearsFromMiles);
  const drivenMiles = annualMiles * years;
  const finalMiles = currentMiles + drivenMiles;
  if (years <= 0) warnings.push('Replacement rule gives no ownership time. Adjust the age or mileage cutoff.');
  const tax = price * clamp(nonnegative(settings.tax), 0, 30) / 100;
  const fees = nonnegative(settings.fees);
  const acquisition = price + tax + fees;
  const down = Math.min(acquisition, nonnegative(car.down));
  if (nonnegative(car.down) > acquisition) warnings.push('Down payment exceeds the drive-away price; capped for the calculation.');
  const financed = Math.max(0, acquisition - down);
  const apr = clamp(nonnegative(car.apr),0,100) / 100;
  const rate = apr / 12;
  const months = clamp(Math.round(nonnegative(settings.termMonths)),1,360);
  let payment = 0;
  if (financed > 0) {
    if (settings.financeMode === 'budget') payment = nonnegative(settings.budget);
    else payment = rate === 0 ? financed / months : financed * rate / (1 - Math.pow(1 + rate, -months));
  }
  // Amortize monthly through departure, including a prorated final partial month.
  // Outstanding principal at disposal is paid off from sale proceeds/other cash;
  // adding it to acquisition a second time would double count the principal.
  let balance = financed;
  let interest = 0;
  let payoffYears = financed <= 0 ? 0 : Infinity;
  const horizon = Math.min(720, Math.max(0, years * 12));
  for (let month = 0; month < Math.ceil(horizon - 1e-9); month++) {
    if (balance <= 1e-7) break;
    const fraction = Math.min(1, horizon - month);
    if (fraction <= 0) break;
    const monthlyInterest = balance * rate * fraction;
    interest += monthlyInterest;
    const due = balance + monthlyInterest;
    const paid = Math.min(due, payment * fraction);
    balance = Math.max(0, due - paid);
    if (balance <= 0.00001) { balance = 0; payoffYears = (month + fraction) / 12; }
  }
  if (financed > 0 && payment <= financed * rate + 1e-8 && settings.financeMode === 'budget')
    warnings.push('Your monthly budget does not reduce this loan principal at the starting balance.');
  if (years * 12 > 720) warnings.push('Loan simulation is capped at 60 years.');
  if (balance > 0.01) warnings.push('Loan is not paid off at replacement; estimated remaining balance must be settled at sale.');
  const paidYears = Number.isFinite(payoffYears) ? Math.max(0, years - payoffYears) : 0;

  const warrantyAgeCap = nonnegative(car.warrantyYears);
  const warrantyMileCap = nonnegative(car.warrantyMiles);
  const warrantyTransfer = car.transfer !== false;
  const remainingYears = Math.max(0, warrantyAgeCap - age);
  const remainingWarrantyMiles = Math.max(0, warrantyMileCap - currentMiles);
  let warrantyYears = 0;
  if (warrantyTransfer && warrantyAgeCap > 0 && warrantyMileCap > 0 && remainingYears > 0 && remainingWarrantyMiles > 0) {
    const milesLimitYears = annualMiles > 0 ? remainingWarrantyMiles / annualMiles : Infinity;
    warrantyYears = Math.max(0, Math.min(years, remainingYears, milesLimitYears));
  }
  const warrantyMiles = annualMiles * warrantyYears;
  const bothYears = Number.isFinite(payoffYears) ? Math.max(0, warrantyYears - payoffYears) : 0;
  const runYear = nonnegative(car.running);
  const running = runYear * years;
  const spending = acquisition + interest + running;
  const mode = ['estimate','manual','unknown'].includes(car.resaleMode) ? car.resaleMode : 'unknown';
  let resale = null;
  let lowResale = null;
  let highResale = null;
  let annualDecay = null;
  if (mode === 'manual') {
    resale = nonnegative(car.resale);
    lowResale = highResale = resale;
  } else if (mode === 'estimate') {
    const segment = FIVE_YEAR_DEPRECIATION[car.category] || FIVE_YEAR_DEPRECIATION.overall;
    const factor = clamp(nonnegative(car.decayFactor || 1), 0.5, 2);
    annualDecay = (1 - Math.pow(1 - segment.loss, 1/5)) * factor;
    const f = (mult) => price * Math.pow(Math.max(0,1 - Math.min(0.99,annualDecay * mult)), years);
    resale = f(1);
    lowResale = f(1.25); // faster depreciation -> lower resale
    highResale = f(0.75); // slower depreciation -> higher resale
  }
  const netCost = resale === null ? null : spending - resale;
  const netLow = highResale === null ? null : spending - highResale;
  const netHigh = lowResale === null ? null : spending - lowResale;
  return {
    id: car.id, name: car.name || 'Unnamed car',
    price, age, currentMiles, annualMiles, years, drivenMiles, finalMiles,
    tax, fees, acquisition, down, financed, apr, payment, interest,
    payoffYears, paidYears, remainingBalance: balance,
    warrantyYears, warrantyMiles, bothYears, running, spending,
    mode, resale, lowResale, highResale, annualDecay, netCost, netLow, netHigh,
    warnings,
    netYear: netCost === null ? null : safeDiv(netCost, years),
    netMile: netCost === null ? null : safeDiv(netCost, drivenMiles),
    spendYear: safeDiv(spending, years),
    paidMiles: annualMiles * paidYears,
    coveredPct: safeDiv(100 * warrantyYears, years),
    warrantyDollar: safeDiv(price,warrantyYears)
  };
}

export function compare(cars, settings) {
  const computed = cars.map(c => calculateCar(c, settings));
  const metric = METRICS[settings.metric] ? settings.metric : 'netYear';
  const info = METRICS[metric];
  const valid = computed.filter(c => c[metric] !== null && Number.isFinite(c[metric]) && c.years > 0);
  let winners = [];
  if (valid.length) {
    const sorted = [...valid].sort((a,b) => info.better === 'min' ? a[metric] - b[metric] : b[metric] - a[metric]);
    const best = sorted[0][metric];
    winners = sorted.filter(c => Math.abs(c[metric] - best) <= 1e-7 * Math.max(1,Math.abs(best))).map(c => c.id);
  }
  return { computed, metric, info, winners, rankedCount: valid.length };
}

export function formatMetric(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'N/A';
  if (unit === 'money') return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
  if (unit === 'moneyYear') return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value) + '/yr';
  if (unit === 'moneyMile') return '$' + value.toFixed(2) + '/mi';
  if (unit === 'pct') return value.toFixed(1) + '%';
  if (unit === 'years') return value.toFixed(2) + ' yr';
  if (unit === 'miles') return Math.round(value).toLocaleString('en-US') + ' mi';
  return String(value);
}
