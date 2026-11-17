'use strict';

// Pure circular, spherical, uniform-brightness binary model. Lengths in R_sun,
// masses in M_sun, period in days. +z points toward the observer.
const BinaryModel = (() => {
  const GM_SUN = 1.3271244e20; // IAU nominal solar mass parameter, m^3 s^-2
  const R_SUN = 6.957e8;
  const TAU = 2 * Math.PI;
  const clamp = (x) => Math.max(-1, Math.min(1, x));

  function overlap(r1, r2, d) {
    if (d >= r1 + r2) return 0;
    if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
    const a = Math.acos(clamp((d * d + r1 * r1 - r2 * r2) / (2 * d * r1)));
    const b = Math.acos(clamp((d * d + r2 * r2 - r1 * r1) / (2 * d * r2)));
    const lens = Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) *
      (d - r1 + r2) * (d + r1 + r2)));
    return Math.max(0, Math.min(Math.PI * Math.min(r1, r2) ** 2,
      r1 * r1 * a + r2 * r2 * b - lens / 2));
  }

  function derive(p) {
    for (const key of ['m1', 'm2', 'r1', 'r2', 't1', 't2', 'period']) {
      if (!Number.isFinite(p[key]) || p[key] <= 0) throw new RangeError(`${key} must be positive`);
    }
    if (!Number.isFinite(p.inc) || p.inc < 0 || p.inc > 90) throw new RangeError('inclination must be 0–90°');
    const a = Math.cbrt(GM_SUN * (p.m1 + p.m2) * (p.period * 86400 / TAU) ** 2) / R_SUN;
    const a1 = a * p.m2 / (p.m1 + p.m2);
    const a2 = a * p.m1 / (p.m1 + p.m2);
    const s1 = (p.t1 / 5772) ** 4;
    const s2 = (p.t2 / 5772) ** 4;
    const l1 = p.r1 ** 2 * s1;
    const l2 = p.r2 ** 2 * s2;
    const inc = p.inc * Math.PI / 180;
    const impact = a * Math.cos(inc);
    const valid = a > p.r1 + p.r2;
    const eclipses = valid && impact < p.r1 + p.r2;
    // Eggleton volume-equivalent Roche radii: warning only, not a distortion model.
    const roche = (q) => a * 0.49 * q ** (2 / 3) /
      (0.6 * q ** (2 / 3) + Math.log1p(q ** (1 / 3)));
    const rocheRisk = p.r1 >= roche(p.m1 / p.m2) || p.r2 >= roche(p.m2 / p.m1);
    const area = valid ? overlap(p.r1, p.r2, impact) : 0;
    const depth1 = area * s1 / (Math.PI * (l1 + l2));
    const depth2 = area * s2 / (Math.PI * (l1 + l2));
    const equalDepth = Math.abs(depth1 - depth2) < 1e-12;
    const primaryPhase = s1 >= s2 ? 0.25 : 0.75;
    let duration = 0;
    if (eclipses) duration = p.period / Math.PI * Math.asin(Math.min(1,
      Math.sqrt((p.r1 + p.r2) ** 2 - impact ** 2) / (a * Math.sin(inc))));
    return { a, a1, a2, s1, s2, l1, l2, inc, impact, valid, eclipses,
      rocheRisk, depth1, depth2, equalDepth, primaryPhase, duration };
  }

  function sample(p, phase, d = derive(p)) {
    if (!Number.isFinite(phase)) throw new RangeError('phase must be finite');
    const angle = TAU * phase;
    const x = d.a * Math.cos(angle);
    const v = d.a * Math.sin(angle);
    const y = v * Math.cos(d.inc);
    const z = v * Math.sin(d.inc);
    const point = (f) => ({ x: x * f, y: y * f, z: z * f, v: v * f });
    const star1 = point(-p.m2 / (p.m1 + p.m2));
    const star2 = point(p.m1 / (p.m1 + p.m2));
    const front = z >= 0 ? 2 : 1;
    const area = d.valid ? overlap(p.r1, p.r2, Math.hypot(x, y)) : 0;
    const blocked = area * (front === 2 ? d.s1 : d.s2);
    const flux = d.valid ? Math.max(0, Math.min(1, 1 - blocked / (Math.PI * (d.l1 + d.l2)))) : null;
    const event = area === 0 ? 'none' : d.equalDepth ? 'equal' :
      ((front === 2) === (d.s1 >= d.s2) ? 'primary' : 'secondary');
    return { star1, star2, front, area, flux, event };
  }

  function curve(p, d = derive(p)) {
    // Add exact conjunctions and contact neighborhoods so narrow eclipses are
    // resolved even at long periods; a uniform grid alone can miss the dips.
    const phases = new Set(Array.from({ length: 801 }, (_, j) => j / 800));
    if (d.eclipses) for (const center of [0.25, 0.75]) {
      const half = d.duration / p.period / 2;
      for (let j = -100; j <= 100; j++) phases.add(center + half * j / 100);
    }
    return [...phases].sort((a, b) => a - b).map(phase => ({ phase, flux: sample(p, phase, d).flux }));
  }
  return { derive, sample, curve, overlap };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BinaryModel;
