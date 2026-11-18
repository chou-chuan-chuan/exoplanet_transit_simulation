'use strict';

// Keep binary controls/state separate from the original transit simulator.
(() => {
  const $ = id => document.getElementById(id);
  const base = { m1: 1.2, m2: 0.8, r1: 1.2, r2: 0.8, t1: 6500, t2: 4500, period: 3, inc: 90, phase: 0.25, e: 0, omega: 0, third: 0, noise: 0, exposure: 0, ld1: "uniform", ld2: "uniform", u1: 0.4, v1: 0.2, u2: 0.4, v2: 0.2 };
  const presets = {
    standard: base,
    equal: { ...base, m1: 1, m2: 1, r1: 1, r2: 1, t1: 5772, t2: 5772, inc: 90 },
    grazing: { ...base, inc: 81 },
    none: { ...base, inc: 60 },
    eccentric: { ...base, e: 0.4, omega: 40, inc: 89 }
  };
  const specs = [
    ['m1', 'Star 1 mass', 0.1, 5, 0.01, ' M☉', 2],
    ['m2', 'Star 2 mass', 0.1, 5, 0.01, ' M☉', 2],
    ['r1', 'Star 1 radius', 0.1, 5, 0.01, ' R☉', 2],
    ['r2', 'Star 2 radius', 0.1, 5, 0.01, ' R☉', 2],
    ['t1', 'Star 1 temperature', 2500, 12000, 1, ' K', 0],
    ['t2', 'Star 2 temperature', 2500, 12000, 1, ' K', 0],
    ['period', 'Orbital period', 0.2, 30, 0.01, ' d', 2],
    ['inc', 'Inclination', 0, 90, 0.01, '°', 2],
    ['phase', 'Orbital phase', 0, 1, 0.0001, '', 4]
  ];
  let p = { ...base };
  let derived = BinaryModel.derive(p);
  let points = BinaryModel.curve(p, derived);
  let raf = null;
  let active = false;
  const fields = new Map();
  const events = { none: 'Out of eclipse', primary: 'Primary eclipse', secondary: 'Secondary eclipse', equal: 'Equal-depth eclipse' };
  const colors = ['#b9ddf6', '#edb879'];

  for (const [key, label, min, max, step, unit, digits] of specs) {
    const row = document.createElement('label');
    row.className = 'control-row';
    const name = document.createElement('span');
    name.textContent = label;
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min, max, step, value: p[key] });
    input.setAttribute('aria-label', label);
    const value = document.createElement('span');
    value.className = 'value-label';
    fields.set(key, { input, value, unit, digits });
    input.addEventListener('input', () => {
      stop();
      p[key] = Number(input.value);
      if (key !== 'phase') recalculate();
      render();
    });
    row.append(name, input, value);
    $('binaryControls').append(row);
  }

  const advanced = $('advancedControls');
  const options = [
    ['eccentric', 'Eccentric Keplerian orbit', [['e', 'Eccentricity', 0, 0.8, 0.01, 0.3], ['omega', 'Argument of periapsis (degrees)', -180, 180, 1, 40]]],
    ['inclination', 'Adjust orbital inclination', [['inc', 'Inclination (degrees)', 0, 90, 0.01, 90]]],
    ['thirdLight', 'Third light', [['third', 'Third light / binary flux', 0, 5, 0.01, 0.2]]],
    ['noiseOn', 'Photometric noise', [['noise', 'Gaussian noise (ppm)', 0, 50000, 100, 1000]]],
    ['exposureOn', 'Exposure-time integration', [['exposure', 'Exposure (minutes; at most 0.1 period)', 0, 4000, 0.1, 10]]]
  ];
  const advancedRows = [];
  for (const [id, title, controls] of options) {
    const group = document.createElement('div');
    group.innerHTML = `<label class="toggle"><input type="checkbox" id="${id}"> ${title}</label><div hidden></div>`;
    const toggle = group.querySelector('input'), body = group.lastElementChild;
    const entries = controls.map(([key, label, min, max, step, initial]) => {
      const row = document.createElement('label'); row.className = 'advanced-row';
      row.textContent = label;
      const input = document.createElement('input'); Object.assign(input, {type:'number', min, max, step, value:initial});
      input.setAttribute('aria-label', label); row.append(input); body.append(row);
      input.onchange = () => { if (!input.checkValidity() || !Number.isFinite(input.valueAsNumber)) { input.reportValidity(); return; }
        const old = p[key]; p[key] = input.valueAsNumber;
        try { recalculate(); stop(); render(); $('advancedError').textContent = ''; }
        catch (e) { p[key] = old; input.value = old; $('advancedError').textContent = e.message; }
      };
      return {key, input, initial};
    });
    toggle.onchange = () => { body.hidden = !toggle.checked;
      for (const f of entries) p[f.key] = toggle.checked ? Number(f.input.value) : (f.key === 'inc' ? 90 : 0);
      if (p.exposure > p.period * 144) p.exposure = p.period * 144;
      recalculate(); stop(); render();
    };
    advanced.append(group); advancedRows.push({toggle, body, entries});
  }
  for (const j of [1,2]) {
    const group = document.createElement('div');
    group.innerHTML = `<label class="advanced-row">Star ${j} limb darkening<select aria-label="Star ${j} limb darkening"><option value="uniform">Off (uniform)</option><option value="linear">Linear</option><option value="quadratic">Quadratic</option></select></label><div hidden></div>`;
    const select = group.querySelector('select'), body = group.lastElementChild;
    for (const key of ['u','v']) {
      const label = document.createElement('label'); label.className = 'advanced-row'; label.textContent = `Star ${j} coefficient ${key}`;
      const input = document.createElement('input'); Object.assign(input,{type:'number',min:0,max:1,step:0.01,value:p[key+j]});
      input.setAttribute('aria-label',label.textContent); label.append(input); body.append(label);
      input.onchange = () => { const old = p[key+j]; p[key+j] = input.valueAsNumber;
        try { recalculate(); render(); $('advancedError').textContent = ''; }
        catch(e) { p[key+j] = old; input.value = old; $('advancedError').textContent = e.message; }
      };
    }
    select.onchange = () => { p['ld'+j] = select.value; if (p['u'+j] + p['v'+j] > 1) { p['v'+j] = 1 - p['u'+j]; body.querySelectorAll('input')[1].value = p['v'+j]; } body.hidden = select.value === 'uniform'; body.lastElementChild.hidden = select.value !== 'quadratic'; recalculate(); render(); };
    group.dataset.star = j; advanced.append(group);
  }
  function syncAdvanced() {
    for (const row of advancedRows) {
      row.toggle.checked = row.entries.some(f => f.key === 'inc' ? p.inc !== 90 : p[f.key] !== 0);
      row.body.hidden = !row.toggle.checked;
      for (const f of row.entries) f.input.value = row.toggle.checked ? p[f.key] : f.initial;
    }
    for (const group of advanced.querySelectorAll('[data-star]')) {
      const j = group.dataset.star; group.querySelector('select').value = p['ld'+j]; group.lastElementChild.hidden = p['ld'+j] === 'uniform'; group.lastElementChild.lastElementChild.hidden = p['ld'+j] !== 'quadratic';
      group.querySelectorAll('input').forEach((input,k) => input.value = p[(k ? 'v':'u')+j]);
    }
  }
  // Inclination belongs to the progressive advanced panel.
  fields.get('inc').input.closest('label').hidden = true;
  function drawRV(now) {
    const canvas = $('binaryRV'), ctx = prepareCanvas(canvas), w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h); const pad=getPlotPadding(w,h);
    const samples = Array.from({length:401},(_,j) => BinaryModel.geometry(p,j/400,derived));
    const limit = Math.max(1,...samples.flatMap(q => [Math.abs(q.rv1),Math.abs(q.rv2)]))*1.12;
    const map=makeMapper(w,h,pad,0,1,-limit,limit);
    drawPlotFrame(ctx,w,h,pad,0,1,-limit,limit,'Orbital phase · t / P','RV (km/s; receding +)');
    for (const j of [1,2]) { drawLine(ctx,samples.map((_,k)=>k/400),samples.map(q=>q['rv'+j]),map,colors[j-1],2,[]);
      ctx.fillStyle=colors[j-1];ctx.beginPath();ctx.arc(map.x(p.phase),map.y(now['rv'+j]),5,0,2*Math.PI);ctx.fill(); }
  }
  function recalculate() {
    if (p.exposure > p.period * 144) { p.exposure = p.period * 144; $('advancedError').textContent = 'Exposure limited to 10% of the new period.'; }
    derived = BinaryModel.derive(p);
    points = derived.valid ? BinaryModel.curve(p, derived) : [];
    updateEquations(true, p);
  }
  function stop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    $('binaryPlay').textContent = 'Play animation';
  }
  function reset() {
    stop();
    p = { ...presets[$('binaryPreset').value] };
    syncAdvanced();
    recalculate();
    render();
  }
  function setMode(binary, mode = "eclipseMode") {
    stopAnimation();
    stop();
    active = binary;
    $('transitPanel').hidden = binary;
    $('binaryPanel').hidden = !binary;
    for (const [id, selected] of [['transitMode', !binary], ['binaryMode', binary && mode === 'binaryMode'], ['eclipseMode', binary && mode === 'eclipseMode']]) {
      $(id).setAttribute('aria-pressed', String(selected));
      $(id).className = selected ? 'primary-button' : 'secondary-button';
    }
    document.querySelector('.subtitle').textContent = binary
      ? 'Explore barycentric orbits, eclipses and radial velocities.'
      : 'Adjust the orbital and limb-darkening parameters to explore the transit geometry and normalized light curve.';
    document.querySelector('.site-footer').textContent = binary
      ? 'Keplerian binary orbit · spherical stars · bolometric flux'
      : 'Circular-orbit transit model · midpoint annulus integration · quadratic limb darkening';
    if (binary) render(); else updateApp();
    updateEquations(binary, p);
  }
  $('transitMode').addEventListener('click', () => setMode(false));
  $('binaryMode').addEventListener('click', () => { p.inc = 60; recalculate(); syncAdvanced(); setMode(true, "binaryMode"); });
  $('eclipseMode').addEventListener('click', () => { p.inc = 90; recalculate(); syncAdvanced(); setMode(true); });
  $('binaryPreset').addEventListener('change', reset);
  $('binaryReset').addEventListener('click', reset);
  $('primaryJump').addEventListener('click', () => { stop(); p.phase = derived.primaryPhase; render(); });
  $('secondaryJump').addEventListener('click', () => { stop(); p.phase = derived.secondaryPhase; render(); });
  $('binaryPlay').addEventListener('click', () => {
    if (raf !== null) { stop(); return; }
    const start = performance.now();
    const initial = p.phase;
    $('binaryPlay').textContent = 'Pause animation';
    const tick = now => {
      p.phase = (initial + (now - start) / 12000) % 1;
      render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
  window.addEventListener('resize', () => { if (active) render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  document.fonts?.ready.then(() => { if (active) render(); });

  function render() {
    if (!active) return;
    const d = derived;
    const now = BinaryModel.sample(p, p.phase, d);
    for (const [key, f] of fields) {
      f.input.value = String(p[key]);
      f.value.textContent = p[key].toFixed(f.digits) + f.unit;
      f.input.setAttribute('aria-valuetext', f.value.textContent);
    }
    $('binaryPlay').disabled = !d.valid;
    $('primaryJump').disabled = $('secondaryJump').disabled = !d.eclipses;
    $('primaryJump').textContent = d.equalDepth ? 'First eclipse center' : 'Primary eclipse center';
    $('secondaryJump').textContent = d.equalDepth ? 'Second eclipse center' : 'Secondary eclipse center';
    const status = !d.valid ? 'Invalid: stars touch at periastron. Reduce radii or increase period.'
      : !d.eclipses ? 'No eclipse at this inclination.'
      : `${events[now.event]} · Star ${now.front} in front`;
    $('binaryStatus').textContent = status + (d.valid && d.rocheRisk ? ' Warning: possible Roche overflow; spherical approximation is unreliable.' : '');
    $('binaryStatus').classList.toggle('warning', !d.valid || !d.eclipses || d.rocheRisk);
    $('binaryParams').textContent = [
      `Relative semimajor axis a = ${d.a.toFixed(3)} R☉`,
      `Barycentric semimajor axes a₁ / a₂ = ${d.a1.toFixed(3)} / ${d.a2.toFixed(3)} R☉`,
      `Luminosity L₁ / L₂ = ${d.l1.toFixed(3)} / ${d.l2.toFixed(3)} L☉`,
      `Mean surface brightness ratio S₂/S₁ = ${(d.s2 / d.s1).toFixed(4)}`,
      `Minimum projected separation = ${d.impact.toFixed(3)} R☉`,
      d.valid ? `Depth (deep / shallow)= ${(100 * Math.max(d.depth1, d.depth2)).toFixed(3)} / ${(100 * Math.min(d.depth1, d.depth2)).toFixed(3)} %` : 'Depth = n/a',
      `Primary T14 = ${d.eclipses ? (d.duration * 24).toFixed(3) + ' h' : 'n/a'}`,
      `t = ${(p.phase * p.period).toFixed(4)} d · Phase = ${p.phase.toFixed(4)}`,
      `Instantaneous flux = ${now.flux === null ? 'n/a' : now.flux.toFixed(6)}`
    ].join('\n');
    $('binaryCurveDescription').textContent = !d.valid ? 'Contact systems are not modeled.'
      : !d.eclipses ? 'The stars orbit without projected overlap.'
      : d.equalDepth ? 'Equal-depth eclipses have no unique primary.'
      : `Primary phase ${d.primaryPhase.toFixed(4)}; secondary phase ${d.secondaryPhase.toFixed(4)}. Pink markers share the orbital phase.`;
    drawOrbit($('binaryTop'), now, false);
    drawOrbit($('binarySky'), now, true);
    drawBinaryCurve(now);
    drawRV(now);
  }

  function drawOrbit(canvas, now, sky) {
    const ctx = prepareCanvas(canvas);
    const { width: w, height: h } = canvas;
    const d = derived;
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 6, 6);
    const extent = Math.max(d.a1 * (1 + d.e) + p.r1, d.a2 * (1 + d.e) + p.r2) * 1.2;
    const scale = Math.min(w, h) * 0.42 / extent;
    const x = v => w / 2 + v * scale;
    const y = v => h / 2 - v * scale;
    ctx.save();
    [d.a1, d.a2].forEach((radius, j) => {
      ctx.strokeStyle = colors[j];
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      for (let k = 0; k <= 240; k++) {
        const g = BinaryModel.geometry(p, k / 240, d)['star' + (j + 1)];
        if (k === 0) ctx.moveTo(x(g.x), y(sky ? g.y : g.v));
        else ctx.lineTo(x(g.x), y(sky ? g.y : g.v));
      }
      ctx.stroke();
    });
    ctx.restore();
    const stars = [
      { ...now.star1, radius: p.r1, id: 1 },
      { ...now.star2, radius: p.r2, id: 2 }
    ];
    if (sky) stars.sort((a, b) => a.z - b.z);
    for (const star of stars) {
      ctx.fillStyle = colors[star.id - 1];
      ctx.beginPath();
      ctx.arc(x(star.x), y(sky ? star.y : star.v), star.radius * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 5, h / 2); ctx.lineTo(w / 2 + 5, h / 2);
    ctx.moveTo(w / 2, h / 2 - 5); ctx.lineTo(w / 2, h / 2 + 5);
    ctx.stroke();
    drawTitle(ctx, sky ? `i = ${p.inc.toFixed(2)}° · Star ${now.front} in front` : `Phase ${p.phase.toFixed(3)} · Fixed barycenter`);
    drawAxisLabels(ctx, w, h, `x (R☉) · Full width ${(w / scale).toFixed(1)} R☉`, sky ? 'y (R☉)' : 'Orbital plane (R☉)');
  }

  function drawBinaryCurve(now) {
    const canvas = $('binaryCurve');
    const ctx = prepareCanvas(canvas);
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    if (!derived.valid) { drawTitle(ctx, 'Contact system: flux unavailable'); return; }
    const depth = Math.max(derived.depth1, derived.depth2);
    const margin = Math.max(0.01, depth * 0.15, p.noise * 5e-6);
    const pad = getPlotPadding(w, h);
    const map = makeMapper(w, h, pad, 0, 1, 1 - depth - margin, 1 + margin);
    drawPlotFrame(ctx, w, h, pad, 0, 1, 1 - depth - margin, 1 + margin, 'Orbital phase · t / P', 'Normalized flux');
    drawLine(ctx, points.map(v => v.phase), points.map(v => v.flux), map, '#d9eaff', 2.5, []);
    if (derived.eclipses) for (const phase of [derived.primaryPhase, derived.secondaryPhase]) {
      drawVerticalGuide(ctx, map.x(phase), pad.top, h - pad.bottom);
      ctx.fillStyle = '#d9dde1';
      ctx.textAlign = 'center';
      ctx.fillText(derived.equalDepth ? 'Equal-depth eclipse' : phase === derived.primaryPhase ? 'Primary eclipse' : 'Secondary eclipse', map.x(phase), pad.top + 20 * (window.devicePixelRatio || 1));
    }
    if (p.noise) for (let j=0;j<=200;j++) { const phase=j/200; ctx.fillStyle='#edb879';ctx.beginPath();ctx.arc(map.x(phase),map.y(BinaryModel.observedFlux(p,phase,derived)+p.noise*1e-6*BinaryModel.gaussian(j)),2,0,2*Math.PI);ctx.fill(); }
    ctx.fillStyle = '#f3a8ba';
    ctx.beginPath();
    ctx.arc(map.x(p.phase), map.y(BinaryModel.observedFlux(p, p.phase, derived)), 5 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
    ctx.fill();
  }
})();
