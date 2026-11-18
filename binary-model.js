'use strict';
// Detached spherical binaries. Length: nominal solar radii; mass: solar masses;
// time: days; +z toward observer; RV positive away. Phase zero is periastron.
const BinaryModel = (() => {
  const GM_SUN = 1.3271244e20, R_SUN = 6.957e8, TAU = 2 * Math.PI;
  const clamp = x => Math.max(-1, Math.min(1, x));
  const wrap = x => ((x % 1) + 1) % 1;
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


  function kepler(M, e) {
    M = ((M + Math.PI) % TAU + TAU) % TAU - Math.PI;
    let E = M;
    for (let j = 0; j < 40; j++) {
      const delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= delta;
      if (Math.abs(delta) < 1e-13) return E;
    }
    throw new RangeError('Kepler solver did not converge');
  }
  function coefficients(p, j) {
    const law = p['ld' + j] || 'uniform';
    if (!['uniform', 'linear', 'quadratic'].includes(law)) throw new RangeError('Unknown limb-darkening law');
    const u = law === 'uniform' ? 0 : (p['u' + j] ?? 0.4);
    const v = law === 'quadratic' ? (p['v' + j] ?? 0.2) : 0;
    if (![u, v].every(Number.isFinite) || u < 0 || v < 0 || u + v > 1)
      throw new RangeError('Limb coefficients must be non-negative with u + v ≤ 1');
    return { u, v };
  }
  function blockedFraction(R, occulter, separation, c, N = 256) {
    if (separation >= R + occulter) return 0;
    if (occulter >= R + separation) return 1;
    if (c.u === 0 && c.v === 0) return overlap(R, occulter, separation) / (Math.PI * R * R);
    // Piecewise-constant intensity in annuli, with exact occulted annulus areas.
    // Unlike midpoint angular sampling this also handles a concentric small disk.
    let blocked = 0, total = 0, previous = 0;
    for (let k = 1; k <= N; k++) {
      const r = R * k / N, mid = (k - 0.5) / N;
      const mu = Math.sqrt(1 - mid * mid);
      const I = 1 - c.u * (1 - mu) - c.v * (1 - mu) ** 2;
      const area = overlap(r, occulter, separation);
      blocked += I * (area - previous);
      total += I * Math.PI * R * R * (2 * k - 1) / (N * N);
      previous = area;
    }
    return Math.max(0, Math.min(1, blocked / total));
  }
  function geometry(p, phase, d) {
    const E = kepler(TAU * phase, d.e);
    const X = d.a * (Math.cos(E) - d.e), Y = d.a * Math.sqrt(1 - d.e ** 2) * Math.sin(E);
    const x = X * Math.cos(d.omega) - Y * Math.sin(d.omega);
    const v = X * Math.sin(d.omega) + Y * Math.cos(d.omega);
    const y = v * Math.cos(d.inc), z = v * Math.sin(d.inc);
    const point = f => ({ x: x * f, y: y * f, z: z * f, v: v * f });
    const Edot = TAU / (p.period * 86400) / (1 - d.e * Math.cos(E));
    const vdot = d.a * Edot * (-Math.sin(E) * Math.sin(d.omega) + Math.sqrt(1 - d.e ** 2) * Math.cos(E) * Math.cos(d.omega));
    const rv = -vdot * Math.sin(d.inc) * R_SUN / 1000;
    const f1 = -p.m2 / (p.m1 + p.m2), f2 = p.m1 / (p.m1 + p.m2);
    return { star1: point(f1), star2: point(f2), front: z >= 0 ? 2 : 1,
      separation: Math.hypot(x, y), rv1: rv * f1, rv2: rv * f2, E };
  }
  function sample(p, phase, d = derive(p)) {
    if (!Number.isFinite(phase)) throw new RangeError('Phase must be finite');
    const g = geometry(p, phase, d);
    const rear = g.front === 2 ? 1 : 2;
    const area = d.valid ? overlap(p.r1, p.r2, g.separation) : 0;
    const lost = d.valid ? blockedFraction(p['r' + rear], p['r' + g.front], g.separation, d['c' + rear]) * d['l' + rear] : 0;
    const flux = d.valid ? 1 - lost / ((d.l1 + d.l2) * (1 + d.third)) : null;
    const event = area === 0 ? 'none' : d.equalDepth ? 'equal' : (rear === d.primaryRear ? 'primary' : 'secondary');
    return { ...g, area, flux, event };
  }
  function phaseFromLongitude(longitude, d) {
    const nu = longitude - d.omega;
    const E = Math.atan2(Math.sqrt(1 - d.e ** 2) * Math.sin(nu), d.e + Math.cos(nu));
    return wrap((E - d.e * Math.sin(E)) / TAU);
  }
  function minimum(fn, lo, hi) {
    for (let j = 0; j < 65; j++) {
      const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
      if (fn(a) < fn(b)) hi = b; else lo = a;
    }
    return (lo + hi) / 2;
  }
  function derive(p) {
    for (const key of ['m1','m2','r1','r2','t1','t2','period'])
      if (!Number.isFinite(p[key]) || p[key] <= 0) throw new RangeError(key + ' must be positive');
    const range = (value, lo, hi, name) => {
      if (!Number.isFinite(value) || value < lo || value > hi) throw new RangeError(name + ' is outside its supported range');
      return value;
    };
    const inc = range(p.inc, 0, 90, 'Inclination') * Math.PI / 180;
    const e = range(p.e ?? 0, 0, 0.8, 'Eccentricity');
    const omega = range(p.omega ?? 0, -180, 180, 'Argument of periapsis') * Math.PI / 180;
    const third = range(p.third ?? 0, 0, 5, 'Third light');
    const exposure = range(p.exposure ?? 0, 0, p.period * 144, 'Exposure (maximum 10% of period)');
    const noise = range(p.noise ?? 0, 0, 50000, 'Noise');
    const a = Math.cbrt(GM_SUN * (p.m1 + p.m2) * (p.period * 86400 / TAU) ** 2) / R_SUN;
    const s1 = (p.t1 / 5772) ** 4, s2 = (p.t2 / 5772) ** 4;
    const d = { a, a1: a * p.m2 / (p.m1 + p.m2), a2: a * p.m1 / (p.m1 + p.m2),
      s1, s2, l1: p.r1 ** 2 * s1, l2: p.r2 ** 2 * s2, c1: coefficients(p, 1), c2: coefficients(p, 2),
      inc, e, omega, third, exposure, noise, valid: a * (1 - e) > p.r1 + p.r2 };
    const roche = q => a * (1 - e) * 0.49 * q ** (2/3) / (0.6 * q ** (2/3) + Math.log1p(q ** (1/3)));
    d.rocheRisk = p.r1 >= roche(p.m1 / p.m2) || p.r2 >= roche(p.m2 / p.m1);
    d.events = [0, 1].map(half => {
      const lo = half * Math.PI, hi = lo + Math.PI;
      const sep = l => geometry(p, phaseFromLongitude(l, d), d).separation;
      let best = lo, bestD = sep(lo);
      for (let k = 1; k <= 256; k++) {
        const l = lo + Math.PI * k / 256, value = sep(l);
        if (value < bestD) { best = l; bestD = value; }
      }
      const center = e === 0 ? lo + Math.PI / 2 : minimum(sep, Math.max(lo, best - Math.PI / 256), Math.min(hi, best + Math.PI / 256));
      const phase = phaseFromLongitude(center, d), distance = sep(center);
      const eclipses = d.valid && distance < p.r1 + p.r2;
      const contact = boundary => {
        let outside = boundary, inside = center;
        for (let j = 0; j < 60; j++) {
          const mid = (outside + inside) / 2;
          if (sep(mid) < p.r1 + p.r2) inside = mid; else outside = mid;
        }
        const cp = phaseFromLongitude((inside + outside) / 2, d);
        return phase + ((cp - phase + 1.5) % 1 - 0.5);
      };
      const start = eclipses ? contact(lo) : phase, end = eclipses ? contact(hi) : phase;
      return { phase, start, end, distance, rear: half === 0 ? 1 : 2, depth: eclipses ? 1 - sample(p, phase, d).flux : 0 };
    });
    d.eclipses = d.events.some(x => x.depth > 0);
    d.depth1 = d.events[0].depth; d.depth2 = d.events[1].depth;
    d.equalDepth = Math.abs(d.depth1 - d.depth2) < 1e-8;
    const primary = d.events[d.depth1 >= d.depth2 ? 0 : 1], secondary = d.events[d.depth1 >= d.depth2 ? 1 : 0];
    d.primaryPhase = primary.phase; d.secondaryPhase = secondary.phase; d.primaryRear = primary.rear;
    d.duration = (primary.end - primary.start) * p.period;
    d.impact = Math.min(...d.events.map(x => x.distance));
    return d;
  }
  function observedFlux(p, phase, d = derive(p), steps = 32) {
    if (!d.valid) return null;
    if (!d.exposure) return sample(p, phase, d).flux;
    const width = d.exposure / (1440 * p.period), lo = phase - width / 2, hi = phase + width / 2;
    // Split at contacts and centers so even sub-cadence eclipses are integrated.
    const cuts = [lo, hi];
    for (const event of d.events) for (const value of [event.start, event.phase, event.end])
      for (let shift = Math.floor(lo) - 1; shift <= Math.ceil(hi) + 1; shift++)
        if (value + shift > lo && value + shift < hi) cuts.push(value + shift);
    cuts.sort((a,b) => a-b);
    let sum = 0;
    for (let j = 1; j < cuts.length; j++) {
      const step = (cuts[j] - cuts[j-1]) / steps;
      for (let k = 0; k < steps; k++) sum += step * sample(p, cuts[j-1] + (k + 0.5) * step, d).flux;
    }
    return sum / width;
  }
  function gaussian(index) {
    // Fixed-seed synthetic observations; stable through animation and redraws.
    let seed = (index + 1) >>> 0;
    const uniform = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return (seed + 0.5) / 4294967296; };
    for (let k = 0; k < 8; k++) uniform();
    return Math.sqrt(-2 * Math.log(uniform())) * Math.cos(TAU * uniform());
  }
  function curve(p, d = derive(p)) {
    const phases = new Set(Array.from({length: 801}, (_,j) => j / 800));
    for (const ev of d.events) if (ev.depth > 0) {
      phases.add(ev.phase);
      const span = (ev.end - ev.start + d.exposure / (1440 * p.period)) / 2;
      for (let j = -100; j <= 100; j++) phases.add(wrap(ev.phase + span * j / 100));
    }
    return [...phases].sort((a,b) => a-b).map(phase => ({ phase, flux: observedFlux(p, phase, d) }));
  }
  return { derive, sample, curve, overlap, kepler, geometry, blockedFraction, observedFlux, gaussian };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = BinaryModel;
