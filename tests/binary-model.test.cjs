'use strict';
const assert = require('node:assert/strict');
const B = require('../binary-model.js');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`PASS ${name}`); }
function close(a, b, tolerance = 1e-10) { assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`); }
const p = { m1: 1.2, m2: 0.8, r1: 1.2, r2: 0.8, t1: 6500, t2: 4500, period: 3, inc: 90 };
test('Kepler absolute scale and period/mass scaling', () => {
  const earth = B.derive({ ...p, m1: 0.5, m2: 0.5, period: 365.25 });
  close(earth.a, 215.03, 0.01);
  close(B.derive({ ...p, period: 24 }).a / B.derive(p).a, 4);
  close(B.derive({ ...p, m1: 9.6, m2: 6.4 }).a / B.derive(p).a, 2);
});
test('barycenter, separation and periodicity at all phases', () => {
  const d = B.derive(p);
  for (let j = 0; j <= 100; j++) {
    const s = B.sample(p, j / 100);
    for (const axis of ['x', 'y', 'z']) close(p.m1 * s.star1[axis] + p.m2 * s.star2[axis], 0);
    close(Math.hypot(s.star1.x - s.star2.x, s.star1.y - s.star2.y, s.star1.z - s.star2.z), d.a);
    close(s.flux, B.sample(p, 1 + j / 100).flux);
  }
});
test('overlap: separate, tangent, concentric, containment, partial and symmetry', () => {
  close(B.overlap(1, 1, 3), 0); close(B.overlap(1, 1, 2), 0);
  close(B.overlap(1, 1, 0), Math.PI); close(B.overlap(2, 1, 0.5), Math.PI);
  close(B.overlap(1, 1, 1), 2 * Math.PI / 3 - Math.sqrt(3) / 2);
  close(B.overlap(2, 1, 2), B.overlap(1, 2, 2));
  for (const d of [1e-12, 1.999999999999]) assert.ok(Number.isFinite(B.overlap(1, 1, d)));
});
test('primary and secondary remove only the rear star surface flux', () => {
  const d = B.derive(p);
  const primary = B.sample(p, 0.25);
  const secondary = B.sample(p, 0.75);
  assert.equal(primary.front, 2); assert.equal(secondary.front, 1);
  assert.equal(primary.event, 'primary'); assert.equal(secondary.event, 'secondary');
  close(primary.flux, 1 - p.r2 ** 2 * d.s1 / (d.l1 + d.l2));
  close(secondary.flux, d.l1 / (d.l1 + d.l2));
  close((1 - primary.flux) / (1 - secondary.flux), (p.t1 / p.t2) ** 4);
});
test('temperature reversal moves primary; equal temperatures give equal depths', () => {
  const reversed = { ...p, t1: 4500, t2: 6500 };
  assert.equal(B.derive(reversed).primaryPhase, 0.75);
  assert.equal(B.sample(reversed, 0.75).event, 'primary');
  const equal = { ...p, t1: 5772, t2: 5772, r1: 1, r2: 1 };
  close(B.sample(equal, 0.25).flux, 0.5);
  close(B.sample(equal, 0.75).flux, 0.5);
  assert.equal(B.sample(equal, 0.25).event, 'equal');
});
test('face-on and non-eclipsing examples remain flat', () => {
  for (const inc of [0, 60]) for (const point of B.curve({ ...p, inc })) close(point.flux, 1);
});
test('grazing eclipse, exact contact and contact duration', () => {
  const d = B.derive(p);
  const critical = Math.acos((p.r1 + p.r2) / d.a) * 180 / Math.PI;
  assert.ok(1 - B.sample({ ...p, inc: critical + 0.01 }, 0.25).flux > 0);
  close(B.sample({ ...p, inc: critical - 0.01 }, 0.25).flux, 1);
  close(B.sample(p, 0.25 - d.duration / p.period / 2).flux, 1, 1e-8);
});
test('overlapping and contact stars invalid; Roche overflow flagged separately', () => {
  const huge = { ...p, r1: 5, r2: 5, period: 0.2 };
  assert.equal(B.derive(huge).valid, false);
  assert.equal(B.sample(huge, 0.25).flux, null);
  assert.equal(B.derive({ ...p, r1: 5 }).rocheRisk, true);
});
test('curve resolves narrow eclipses and stays finite/in bounds across parameter extremes', () => {
  const narrow = { ...p, r1: 0.1, r2: 0.1, period: 30 };
  const curve = B.curve(narrow);
  assert.ok(curve.filter(v => v.flux < 1).length > 100);
  close(Math.min(...curve.map(v => v.flux)), B.sample(narrow, 0.25).flux);
  for (const inc of [0, 60, 89.9, 90]) for (const t1 of [2500, 12000]) {
    for (const q of B.curve({ ...narrow, inc, t1 })) assert.ok(Number.isFinite(q.flux) && q.flux >= 0 && q.flux <= 1);
  }
});
test('invalid numerical parameters rejected', () => {
  for (const change of [{ m1: 0 }, { t2: NaN }, { inc: 91 }, { period: -1 }]) assert.throws(() => B.derive({ ...p, ...change }), { name: 'RangeError' });
});
console.log(`${passed} model tests passed`);
