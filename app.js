import { FIVE_YEAR_DEPRECIATION, METRICS, compare, formatMetric } from './engine.mjs';

const STORAGE = 'carValue.scenario.v1';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const esc = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const money = v => formatMetric(v,'money');
const yrs = v => Number.isFinite(v) ? formatMetric(v,'years') : 'Not paid off by sale';
const miles = v => formatMetric(v,'miles');
const money2 = v => v === null ? 'N/A' : '$' + Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt = (v,unit) => formatMetric(v,unit);

function example() {
  const base = { price: 30000,age:0,miles:0,down:0,apr:6,running:0,
    warrantyYears:10,warrantyMiles:80000,transfer:true,
    resaleMode:'estimate',category:'overall',decayFactor:1,resale:5000 };
  return {
    settings:{ annualMiles:10000,retireMode:'age',retireAge:15,ownYears:10,maxMiles:0,tax:0,fees:0,
      financeMode:'term',termMonths:60,budget:350,metric:'netYear' },
    cars:[{...base,id:'example-new',name:'Car X — brand new'},
      {...base,id:'example-used',name:'Car X — 5 years old',price:10000,age:5,miles:40000}]
  };
}
const numericSettings = ['annualMiles','retireAge','ownYears','maxMiles','tax','fees','termMonths','budget'];
const numericCar = ['price','age','miles','down','apr','running','warrantyYears','warrantyMiles','decayFactor','resale'];
const textCar = ['name','resaleMode','category'];
function normalize(input) {
  const defaults = example();
  if (!input || typeof input !== 'object' || !Array.isArray(input.cars)) return defaults;
  const s = {...defaults.settings};
  for (const k of numericSettings) if (input.settings && input.settings[k] !== undefined) s[k] = Math.max(0,num(input.settings[k]));
  for (const k of ['retireMode','financeMode','metric']) if (input.settings && typeof input.settings[k] === 'string') s[k] = input.settings[k];
  if (!['age','ownership'].includes(s.retireMode)) s.retireMode = 'age';
  if (!['term','budget'].includes(s.financeMode)) s.financeMode = 'term';
  if (!METRICS[s.metric]) s.metric = 'netYear';
  s.termMonths = Math.min(360,Math.max(1,Math.round(s.termMonths)));
  s.retireAge = Math.min(60,s.retireAge);
  s.ownYears = Math.min(60,s.ownYears);
  s.annualMiles = Math.min(100000,s.annualMiles);
  s.maxMiles = Math.min(1000000,s.maxMiles);
  s.tax = Math.min(30,s.tax);
  const seen = new Set();
  const cars = input.cars.slice(0,12).map((c,i) => {
    const copy = { ...defaults.cars[0] };
    for (const k of numericCar) if (c && c[k] !== undefined) copy[k] = Math.max(0,num(c[k]));
    for (const k of textCar) if (c && typeof c[k] === 'string') copy[k] = c[k].slice(0,100);
    copy.transfer = c && c.transfer !== false;
    copy.id = c && typeof c.id === 'string' && !seen.has(c.id) ? c.id.slice(0,80) : 'car-' + i;
    seen.add(copy.id);
    copy.decayFactor = Math.min(1.5,Math.max(.5,copy.decayFactor || 1));
    if (!['estimate','manual','unknown'].includes(copy.resaleMode)) copy.resaleMode = 'unknown';
    if (!FIVE_YEAR_DEPRECIATION[copy.category]) copy.category = 'overall';
    return copy;
  });
  return { settings:s,cars:cars.length ? cars : defaults.cars };
}
function load() {
  try { return normalize(JSON.parse(localStorage.getItem(STORAGE))); }
  catch { return example(); }
}
let state = load();
function save() { try { localStorage.setItem(STORAGE,JSON.stringify(state)); } catch {} }
function control(label,key,value,opts={}) {
  const id = 'v-' + key;
  const attrs = 'data-field="' + key + '"';
  const hint = opts.hint ? '<small>' + esc(opts.hint) + '</small>' : '';
  let controlHtml;
  if (opts.type === 'select') {
    controlHtml = '<select ' + attrs + '>' + opts.options.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(value) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>';
  } else if (opts.type === 'checkbox') {
    controlHtml = '<span class="check"><input type="checkbox" ' + attrs + (value ? ' checked' : '') + '><span>' + esc(opts.checkLabel || 'Yes') + '</span></span>';
  } else if (opts.type === 'range') {
    controlHtml = '<input type="range" ' + attrs + ' min=".5" max="1.5" step=".05" value="' + esc(value) + '"><span class="range-value">' + Number(value).toFixed(2) + '× baseline annual depreciation</span>';
  } else {
    controlHtml = '<input type="' + (opts.type || 'number') + '" ' + attrs + ' value="' + esc(value) + '" ' +
      (opts.type === 'text' ? 'maxlength="100"' : 'min="0" step="' + (opts.step || 'any') + '"') + '>';
  }
  return '<label for="' + id + '">' + esc(label) + controlHtml + hint + '</label>';
}
function carMarkup(car,index) {
  const categories = Object.entries(FIVE_YEAR_DEPRECIATION).map(([key,v]) =>
    [key,v.label + ' · ' + (v.loss * 100).toFixed(1) + '% lost in 5 years']);
  const resaleOptions = [['estimate','Estimate from historical segment benchmark'],
    ['manual','Enter my own future resale value'],['unknown','Unknown — leave net cost uncalculated']];
  const id = esc(car.id);
  const isEstimate = car.resaleMode === 'estimate';
  const isManual = car.resaleMode === 'manual';
  return '<article class="car" data-id="' + id + '"><div class="car-head"><div><strong>Vehicle ' + (index+1) +
    '</strong> <span class="tags">' + esc(car.name) + '</span></div><div class="car-actions">' +
    '<button type="button" class="button ghost-invert" data-action="duplicate">Duplicate</button>' +
    '<button type="button" class="button danger" data-action="remove">Remove</button></div></div>' +
    '<div class="car-body"><div class="car-fields">' +
    control('Name or trim','name',car.name,{type:'text'}) +
    control('Purchase price ($)','price',car.price) +
    control('Current vehicle age (years)','age',car.age) +
    control('Current odometer (miles)','miles',car.miles) +
    control('Down payment ($)','down',car.down) +
    control('Loan APR (%)','apr',car.apr,{step:'.1'}) +
    control('Annual running cost estimate ($)','running',car.running,{hint:'Optional average for gas, insurance, maintenance, etc. Set 0 to exclude.'}) +
    '</div><p class="car-subtitle">Original warranty (from new)</p><div class="car-fields">' +
    control('Warranty age limit (years)','warrantyYears',car.warrantyYears) +
    control('Warranty odometer limit (miles)','warrantyMiles',car.warrantyMiles) +
    control('Coverage transfers / is valid','transfer',car.transfer,{type:'checkbox',checkLabel:'Count remaining original warranty'}) +
    '</div><div class="resale-box"><p class="car-subtitle" style="margin:0">Future resale at your planned replacement date</p>' +
    '<div class="car-fields">' + control('Resale method','resaleMode',car.resaleMode,{type:'select',options:resaleOptions}) +
    (isManual ? control('Expected resale value ($)','resale',car.resale) : '') +
    (isEstimate ? control('Historical comparison category','category',car.category,{type:'select',options:categories}) : '') +
    (isEstimate ? control('How fast will it depreciate?','decayFactor',car.decayFactor,{type:'range',hint:'0.50× = half baseline loss rate; 1.50× = 50% faster.'}) : '') +
    '</div><div class="resale-explainer">' +
    (isEstimate ? 'Today’s entered price is the starting value. We extrapolate a constant annual loss rate from the selected segment’s 2026 five-year historical average. This is an illustrative forecast, not a make/model appraisal. A wider scenario band is shown in results.' :
      isManual ? 'Enter a future value for this specific car at the end of the planned ownership period. It can be adjusted freely.' :
      'Net cost will show N/A until you provide a resale method. Spending before resale is still shown.') +
    '</div></div></div></article>';
}
function renderCars() { $('#cars').innerHTML = state.cars.map(carMarkup).join(''); }
function refreshSettings() {
  $$('[data-setting]').forEach(el => el.value = state.settings[el.dataset.setting]);
  $$('[data-radio]').forEach(el => el.checked = el.value === state.settings[el.dataset.radio]);
  $('#ageSetting').classList.toggle('hidden',state.settings.retireMode !== 'age');
  $('#ownedSetting').classList.toggle('hidden',state.settings.retireMode !== 'ownership');
  $('#termSetting').classList.toggle('hidden',state.settings.financeMode !== 'term');
  $('#budgetSetting').classList.toggle('hidden',state.settings.financeMode !== 'budget');
  if ($('#annualSlider')) $('#annualSlider').value = Math.min(30000,state.settings.annualMiles);
}
function row(label,key,unit,computed,rankedKey) {
  return '<tr><td>' + esc(label) + '</td>' + computed.map(c => {
    const v = c[key]; const isBest = key === rankedKey && c.years > 0 &&
      ranking.winners.includes(c.id) && v !== null && Number.isFinite(v);
    return '<td' + (isBest ? ' class="best"' : '') + '>' + fmt(v,unit) + '</td>';
  }).join('') + '</tr>';
}
function group(label) { return '<tr class="group-row"><td colspan="' + (ranking.computed.length + 1) + '">' + esc(label) + '</td></tr>'; }
let ranking;
function renderOutput() {
  ranking = compare(state.cars,state.settings);
  const cs = ranking.computed;
  const metric = ranking.metric;
  const info = ranking.info;
  const names = ranking.winners.map(id => cs.find(c => c.id === id)?.name || 'Unnamed');
  let messages = cs.flatMap(c => c.warnings.map(w => esc(c.name) + ': ' + esc(w)));
  if (cs.some(c => c.mode === 'estimate')) messages.push('Resale estimates are category-level extrapolations; actual long-term value can be substantially different.');
  if (cs.some(c => c.running === 0)) messages.push('Annual running costs are set to $0 for one or more cars. Those expenses are excluded, not necessarily free.');
  if (state.settings.financeMode === 'budget' && metric === 'payment') messages.push('With the same monthly payment budget, the regular payment metric will generally tie. Payment-free years are more informative.');
  if (cs.some(c => c.mode === 'unknown') && ['netYear','netMile'].includes(metric)) messages.push('Cars with unknown resale values are excluded from net-cost rankings.');
  if (['netYear','netMile'].includes(metric) && cs.length === 2 && cs.every(c => c.resale !== null)) {
    const [a,b] = cs;
    const denomA = metric === 'netYear' ? a.years : a.drivenMiles;
    const denomB = metric === 'netYear' ? b.years : b.drivenMiles;
    if (denomA && denomB) {
      const aLo = a.netLow / denomA, aHi = a.netHigh / denomA;
      const bLo = b.netLow / denomB, bHi = b.netHigh / denomB;
      if (aLo <= bHi && bLo <= aHi && (a.lowResale !== a.highResale || b.lowResale !== b.highResale))
        messages.push('The resale stress-test ranges overlap. The ranking could reverse under different depreciation assumptions.');
    }
  }
  $('#messages').innerHTML = messages.length ? '<div class="card warn">' + [...new Set(messages)].map(s => '<p>⚠ ' + s + '</p>').join('') + '</div>' : '';
  let sentence;
  if (!ranking.rankedCount) sentence = 'No comparable results for this metric. Check your ownership horizon and, for net cost, enter a resale method.';
  else if (ranking.rankedCount === 1 && cs.length > 1) sentence = 'Only one vehicle has a calculable result for this priority; there is no fair winner until the others have data.';
  else if (ranking.winners.length > 1) sentence = 'Tie: ' + names.map(esc).join(' and ') + ' are equal under this one metric.';
  else sentence = esc(names[0]) + ' ranks first for ' + esc(info.label.toLowerCase()) + '.';
  const lead = ranking.winners.length && ranking.rankedCount > 1 ? cs.find(c => c.id === ranking.winners[0]) : null;
  $('#winner').innerHTML = '<div class="card winner"><h3>' + (ranking.rankedCount > 1 ? 'Current priority: ' + esc(info.label) : 'Your selected priority') +
    '</h3><p><b>' + sentence + '</b></p>' +
    (lead ? '<p>Result: <strong>' + fmt(lead[metric],info.unit) + '</strong>. This compares only the selected priority, not overall quality, safety, or reliability.</p>' : '') +
    '</div>';
  const heads = cs.map(c => '<th scope="col">' + esc(c.name) + '</th>').join('');
  $('#table').innerHTML = '<table class="compare"><thead><tr><th scope="col">Metric</th>' + heads + '</tr></thead><tbody>' +
    group('Ownership and resale') +
    row('Years you will own it','years','years',cs,metric) +
    row('Miles you will drive it','drivenMiles','miles',cs,metric) +
    row('Projected end odometer','finalMiles','miles',cs,metric) +
    row('Projected resale (midpoint)','resale','money',cs,metric) +
    row('Resale in slower depreciation scenario','highResale','money',cs,metric) +
    row('Resale in faster depreciation scenario','lowResale','money',cs,metric) +
    group('Costs') +
    row('Net cost / year (after resale)','netYear','moneyYear',cs,metric) +
    row('Net cost / mile (after resale)','netMile','moneyMile',cs,metric) +
    row('Total net cost (after resale)','netCost','money',cs,metric) +
    row('Spending / year (before resale)','spendYear','moneyYear',cs,metric) +
    row('Total spending (before resale)','spending','money',cs,metric) +
    row('Interest before replacement','interest','money',cs,metric) +
    group('Original warranty') +
    row('Years under warranty','warrantyYears','years',cs,metric) +
    row('Miles under warranty','warrantyMiles','miles',cs,metric) +
    row('Share of ownership under warranty','coveredPct','pct',cs,metric) +
    row('Purchase price / warranty year','warrantyDollar','moneyYear',cs,metric) +
    group('Financing and freedom') +
    row('Regular monthly loan payment','payment','money',cs,metric) +
    row('Years payment-free','paidYears','years',cs,metric) +
    row('Miles payment-free','paidMiles','miles',cs,metric) +
    row('Years both covered and paid off','bothYears','years',cs,metric) +
    row('Loan balance due at replacement','remainingBalance','money',cs,metric) +
    '</tbody></table>';
  $('#details').innerHTML = cs.map(c => {
    const sales = c.resale === null ? 'Unknown' : money(c.resale);
    const uncertainty = c.mode === 'estimate' ?
      '<p>Resale stress-test band: ' + money(c.lowResale) + ' to ' + money(c.highResale) +
      ' (not statistical bounds). Net cost / yr band: ' + fmt(c.netLow / (c.years || Infinity),'moneyYear') +
      ' to ' + fmt(c.netHigh / (c.years || Infinity),'moneyYear') + '.</p>' : '';
    const items = [
      ['Purchase price',money(c.price)],
      ['Sales tax + fees',money(c.tax + c.fees)],
      ['Down payment',money(c.down)],
      ['Amount initially financed',money(c.financed)],
      ['Monthly payment',money(c.payment)],
      ['Payoff into ownership',c.financed === 0 ? 'Immediately' : yrs(c.payoffYears)],
      ['Loan balance settled on sale',money(c.remainingBalance)],
      ['Interest until sale',money(c.interest)],
      ['Running costs for ownership',money(c.running)],
      ['Spending before resale',money(c.spending)],
      ['Estimated resale proceeds',sales],
      ['Net ownership cost',c.netCost === null ? 'Not calculated' : money(c.netCost)],
      ['Original warranty time left at purchase',yrs(Math.max(0,num(state.cars.find(v => v.id === c.id)?.warrantyYears) - c.age))],
      ['Original warranty miles left at purchase',miles(Math.max(0,num(state.cars.find(v => v.id === c.id)?.warrantyMiles) - c.currentMiles))],
      ['Warranty actually used',yrs(c.warrantyYears)]
    ];
    return '<article class="card"><h3>' + esc(c.name) + ': calculation audit</h3><dl>' +
      items.map(([k,v]) => '<dt>' + esc(k) + '</dt><dd>' + v + '</dd>').join('') +
      '</dl>' + uncertainty +
      '<p>Ownership: ' + c.age.toFixed(1) + ' → ' + (c.age+c.years).toFixed(1) +
      ' years old, ' + Math.round(c.currentMiles).toLocaleString('en-US') + ' → ' + Math.round(c.finalMiles).toLocaleString('en-US') +
      ' miles. Costs are undiscounted nominal dollars.</p></article>';
  }).join('') + breakEven(cs);
}
function breakEven(cs) {
  if (cs.length !== 2 || cs.some(c => c.netYear === null || c.years <= 0)) return '';
  const [a,b] = cs;
  const neededA = a.spending - b.netYear * a.years;
  const neededB = b.spending - a.netYear * b.years;
  function describe(c,other,needed) {
    const intro = '<p><strong>' + esc(c.name) + '</strong> needs ';
    return intro + (needed <= 0 ? 'no resale credit at all' : 'at least ' + money(needed) + ' at resale') +
      ' to match ' + esc(other.name) + ' on net cost per owned year, holding the other car’s inputs fixed.</p>';
  }
  return '<article class="card"><h3>Break-even resale analysis</h3>' +
    '<p>What would each vehicle need to resell for to match the other vehicle’s net cost per year?</p>' +
    describe(a,b,neededA) + describe(b,a,neededB) +
    '<p>This is an algebraic threshold, not a prediction. It ignores risk and time value of money.</p></article>';
}
function renderAll() { refreshSettings();renderCars();renderOutput();save(); }
function vehicleByTarget(el) { const card = el.closest('.car');return card && state.cars.find(c => c.id === card.dataset.id); }
function updateSetting(el) {
  const key = el.dataset.setting || el.dataset.radio;
  if (!key) return;
  if (numericSettings.includes(key)) state.settings[key] = Math.max(0,num(el.value));
  else state.settings[key] = el.value;
  if (['retireMode','financeMode'].includes(key)) refreshSettings();
  if (key === 'annualMiles' && $('#annualSlider')) $('#annualSlider').value = Math.min(30000,state.settings.annualMiles);
  renderOutput();save();
}
$$('[data-setting], [data-radio]').forEach(el => el.addEventListener(el.tagName === 'SELECT' || el.type === 'radio' ? 'change' : 'input', () => updateSetting(el)));
$('#cars').addEventListener('input',e => {
  const key = e.target.dataset.field;
  const car = vehicleByTarget(e.target);
  if (!car || !key) return;
  if (numericCar.includes(key)) car[key] = Math.max(0,num(e.target.value));
  else if (key === 'name') {
    car.name = e.target.value;
    const tag = e.target.closest('.car').querySelector('.tags');
    if (tag) tag.textContent = car.name;
  }
  if (key === 'decayFactor') {
    const value = e.target.parentElement.querySelector('.range-value');
    if (value) value.textContent = Number(car.decayFactor).toFixed(2) + '× baseline annual depreciation';
  }
  renderOutput();save();
});
$('#cars').addEventListener('change',e => {
  const key = e.target.dataset.field;
  const car = vehicleByTarget(e.target);
  if (!car || !key) return;
  if (key === 'transfer') car.transfer = e.target.checked;
  if (key === 'resaleMode') car.resaleMode = e.target.value;
  if (key === 'category') car.category = e.target.value;
  if (['resaleMode','category'].includes(key)) renderCars();
  renderOutput();save();
});
$('#cars').addEventListener('click',e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const car = vehicleByTarget(btn);
  if (!car) return;
  if (btn.dataset.action === 'remove') {
    if (state.cars.length === 1) { alert('Keep at least one vehicle in the scenario.');return; }
    state.cars = state.cars.filter(v => v.id !== car.id);
  } else if (btn.dataset.action === 'duplicate') {
    if (state.cars.length >= 12) {alert('The current limit is 12 vehicles.');return;}
    const copy = {...car,id:'car-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),name:car.name + ' (copy)'};
    state.cars.splice(state.cars.indexOf(car)+1,0,copy);
  }
  renderCars();renderOutput();save();
});
$('#add').addEventListener('click',() => {
  if (state.cars.length >= 12) {alert('The current limit is 12 vehicles.');return;}
  const defaultCar = example().cars[0];
  state.cars.push({...defaultCar,id:'car-' + Date.now(),name:'Vehicle ' + (state.cars.length + 1)});
  renderCars();renderOutput();save();
  $('#cars').lastElementChild.scrollIntoView({behavior:'smooth',block:'center'});
});
$('#reset').addEventListener('click',() => {
  if (!confirm('Reset the entire carValue scenario to the original two example cars?')) return;
  state = example();renderAll();
});
$('#export').addEventListener('click',() => {
  const blob = new Blob([JSON.stringify({version:1,...state},null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');anchor.href=url;anchor.download='carValue-scenario.json';anchor.click();
  setTimeout(() => URL.revokeObjectURL(url),5000);
});
$('#import').addEventListener('change',async e => {
  const file = e.target.files?.[0];if(!file)return;
  try {
    if (file.size > 200000) throw new Error('File is too large.');
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.cars) || typeof data.settings !== 'object') throw new Error('Not a carValue scenario.');
    state = normalize(data);renderAll();
  } catch(err) { alert('Unable to import scenario: ' + err.message); }
  e.target.value = '';
});
const milesControl = $('[data-setting="annualMiles"]');
if (milesControl) {
  const slider = document.createElement('input');
  slider.type='range';slider.id='annualSlider';slider.min='0';slider.max='30000';slider.step='1000';
  slider.style.width='100%';slider.setAttribute('aria-label','Annual miles driven slider');
  slider.value=Math.min(30000,state.settings.annualMiles);
  milesControl.insertAdjacentElement('afterend',slider);
  slider.addEventListener('input',() => {milesControl.value=slider.value;updateSetting(milesControl);});
}
renderAll();
