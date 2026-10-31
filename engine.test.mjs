import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCar, compare, FIVE_YEAR_DEPRECIATION } from './engine.mjs';

const settings = { annualMiles: 10000, retireMode: 'age', retireAge: 15, ownYears: 10,
  maxMiles: 0, tax: 0, fees: 0, financeMode: 'term', termMonths: 60, budget: 350, metric: 'netYear' };
const base = { name:'New', id:'new', price:30000, age:0, miles:0, down:0, apr:0, running:0,
  warrantyYears:10, warrantyMiles:80000, transfer:true, resaleMode:'manual', resale:5000, category:'overall', decayFactor:1 };
const used = {...base,id:'used',name:'Used',price:10000,age:5,miles:40000};

test('Warranty expires at earlier original age or odometer cutoff',() => {
  const a = calculateCar(base,settings), b = calculateCar(used,settings);
  assert.equal(a.warrantyYears,8);
  assert.equal(b.warrantyYears,4);
  assert.equal(a.warrantyMiles,80000);
  assert.equal(b.warrantyMiles,40000);
  assert.equal(a.warrantyDollar,3750);
  assert.equal(b.warrantyDollar,2500);
});
test('Same age at retirement creates different ownership horizons',() => {
  const a = calculateCar(base,settings), b=calculateCar(used,settings);
  assert.equal(a.years,15);assert.equal(b.years,10);
});
test('Real net ownership cost subtracts entered resale value',() => {
  const a=calculateCar(base,settings),b=calculateCar(used,settings);
  assert.equal(a.netCost,25000);assert.equal(a.netYear,25000/15);
  assert.equal(b.netCost,5000);assert.equal(b.netYear,500);
});
test('Unknown resale is not silently treated as zero',() => {
  const a=calculateCar({...base,resaleMode:'unknown'},settings);
  assert.equal(a.resale,null);assert.equal(a.netCost,null);
  assert.equal(a.spendYear,30000/15);
});
test('Loan length and down payment affect finance time and interest, not double counted acquisition',() => {
  const s={...settings,termMonths:60};
  const a=calculateCar({...base,apr:6},s);
  assert.ok(Math.abs(a.payment-579.984) < .1);
  assert.ok(Math.abs(a.paidYears-10) < .001);
  assert.ok(a.interest > 4000 && a.interest < 6000);
  assert.ok(Math.abs(a.netCost-(30000+a.interest-5000)) < .01);
});
test('Same budget can reverse which car gets more payment-free years',() => {
  const s={...settings,financeMode:'budget',budget:350};
  const a=calculateCar({...base,apr:6},s);
  const b=calculateCar({...used,apr:6},s);
  assert.ok(b.paidYears > a.paidYears);
});
test('Replacing by mileage overrides vehicle-age plan',() => {
  const a=calculateCar(base,{...settings,maxMiles:60000});
  const b=calculateCar(used,{...settings,maxMiles:60000});
  assert.equal(a.years,6);assert.equal(b.years,2);
  assert.equal(a.warrantyYears,6);assert.equal(b.warrantyYears,2);
});
test('Warranty cannot be assumed transferable',() => {
  assert.equal(calculateCar({...used,transfer:false},settings).warrantyYears,0);
});
test('Category benchmark is anchored at current purchase price',() => {
  const vehicle={...used,resaleMode:'estimate',category:'truck'};
  const c=calculateCar(vehicle,{...settings,retireMode:'ownership',ownYears:5});
  assert.ok(Math.abs(c.resale-10000*(1-FIVE_YEAR_DEPRECIATION.truck.loss)) < .001);
  assert.ok(c.lowResale<c.resale && c.resale<c.highResale);
});
test('Negative amortization is flagged and outstanding balance is not counted twice',() => {
  const c=calculateCar({...base,apr:30},{...settings,financeMode:'budget',budget:1});
  assert.ok(c.warnings.some(s=>s.includes('does not reduce')));
  assert.ok(c.remainingBalance>30000);
  assert.ok(c.netCost>25000);
});
test('Ranking omits net-cost values with unknown resale',() => {
  const r=compare([{...base,resaleMode:'unknown'},used],settings);
  assert.equal(r.rankedCount,1);
  assert.deepEqual(r.winners,['used']);
});
