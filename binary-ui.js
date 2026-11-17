'use strict';

// Keep binary controls/state separate from the original transit simulator.
(() => {
  const $ = id => document.getElementById(id);
  const base = { m1: 1.2, m2: 0.8, r1: 1.2, r2: 0.8, t1: 6500, t2: 4500, period: 3, inc: 88, phase: 0.25 };
  const presets = {
    standard: base,
    equal: { ...base, m1: 1, m2: 1, r1: 1, r2: 1, t1: 5772, t2: 5772, inc: 90 },
    grazing: { ...base, inc: 81 },
    none: { ...base, inc: 60 }
  };
  const specs = [
    ['m1', '星 1 質量', 0.1, 5, 0.01, ' M☉', 2],
    ['m2', '星 2 質量', 0.1, 5, 0.01, ' M☉', 2],
    ['r1', '星 1 半徑', 0.1, 5, 0.01, ' R☉', 2],
    ['r2', '星 2 半徑', 0.1, 5, 0.01, ' R☉', 2],
    ['t1', '星 1 溫度', 2500, 12000, 1, ' K', 0],
    ['t2', '星 2 溫度', 2500, 12000, 1, ' K', 0],
    ['period', '軌道週期', 0.2, 30, 0.01, ' d', 2],
    ['inc', '軌道傾角', 0, 90, 0.01, '°', 2],
    ['phase', '軌道相位', 0, 1, 0.0001, '', 4]
  ];
  let p = { ...base };
  let derived = BinaryModel.derive(p);
  let points = BinaryModel.curve(p, derived);
  let raf = null;
  let active = false;
  const fields = new Map();
  const events = { none: '食外', primary: '主食', secondary: '次食', equal: '等深食' };
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

  function recalculate() {
    derived = BinaryModel.derive(p);
    points = derived.valid ? BinaryModel.curve(p, derived) : [];
  }
  function stop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    $('binaryPlay').textContent = '播放動畫';
  }
  function reset() {
    stop();
    p = { ...presets[$('binaryPreset').value] };
    recalculate();
    render();
  }
  function setMode(binary) {
    stopAnimation();
    stop();
    active = binary;
    $('transitPanel').hidden = binary;
    $('binaryPanel').hidden = !binary;
    for (const [id, selected] of [['transitMode', !binary], ['binaryMode', binary]]) {
      $(id).setAttribute('aria-pressed', String(selected));
      $(id).className = selected ? 'primary-button' : 'secondary-button';
    }
    document.querySelector('.subtitle').textContent = binary
      ? '探索兩顆恆星的質心軌道、觀測幾何，以及主食與次食的光通量變化。'
      : 'Adjust the orbital and limb-darkening parameters to explore the transit geometry and normalized light curve.';
    document.querySelector('.site-footer').textContent = binary
      ? 'Circular binary orbit · Kepler’s third law · uniform stellar disks · bolometric flux'
      : 'Circular-orbit transit model · midpoint annulus integration · quadratic limb darkening';
    if (binary) render(); else updateApp();
  }
  $('transitMode').addEventListener('click', () => setMode(false));
  $('binaryMode').addEventListener('click', () => setMode(true));
  $('binaryPreset').addEventListener('change', reset);
  $('binaryReset').addEventListener('click', reset);
  $('primaryJump').addEventListener('click', () => { stop(); p.phase = derived.primaryPhase; render(); });
  $('secondaryJump').addEventListener('click', () => { stop(); p.phase = 1 - derived.primaryPhase; render(); });
  $('binaryPlay').addEventListener('click', () => {
    if (raf !== null) { stop(); return; }
    const start = performance.now();
    const initial = p.phase;
    $('binaryPlay').textContent = '暫停動畫';
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
    $('primaryJump').textContent = d.equalDepth ? '第一次食中心' : '主食中心';
    $('secondaryJump').textContent = d.equalDepth ? '第二次食中心' : '次食中心';
    const status = !d.valid ? '無效組合：兩星相碰或接觸，請縮小半徑或增加週期。'
      : !d.eclipses ? '此傾角不會發生食；光通量維持 1。'
      : `${events[now.event]} · 星 ${now.front} 在前`;
    $('binaryStatus').textContent = status + (d.valid && d.rocheRisk ? ' 注意：恆星達到 Roche 瓣，球形近似不可靠。' : '');
    $('binaryStatus').classList.toggle('warning', !d.valid || !d.eclipses || d.rocheRisk);
    $('binaryParams').textContent = [
      `星間距 a = ${d.a.toFixed(3)} R☉`,
      `質心半徑 a₁ / a₂ = ${d.a1.toFixed(3)} / ${d.a2.toFixed(3)} R☉`,
      `光度 L₁ / L₂ = ${d.l1.toFixed(3)} / ${d.l2.toFixed(3)} L☉`,
      `表面亮度比 S₂/S₁ = ${(d.s2 / d.s1).toFixed(4)}`,
      `最小投影距離 = ${d.impact.toFixed(3)} R☉`,
      d.valid ? `食深（深 / 淺）= ${(100 * Math.max(d.depth1, d.depth2)).toFixed(3)} / ${(100 * Math.min(d.depth1, d.depth2)).toFixed(3)} %` : '食深 = 不適用',
      `每次食 T₁₄ = ${d.eclipses ? (d.duration * 24).toFixed(3) + ' h' : '不適用'}`,
      `t = ${(p.phase * p.period).toFixed(4)} d · 相位 = ${p.phase.toFixed(4)}`,
      `目前光通量 = ${now.flux === null ? '不適用' : now.flux.toFixed(6)}`
    ].join('\n');
    $('binaryCurveDescription').textContent = !d.valid ? '無效的接觸／重疊組合不計算光變。'
      : !d.eclipses ? '無食：兩星仍互繞，但天空平面上的圓盤不交疊。'
      : d.equalDepth ? '相位 0.25 與 0.75 為等深食；相同表面亮度沒有唯一的主食。'
      : `主食在相位 ${d.primaryPhase}，次食在相位 ${1 - d.primaryPhase}。紅點與兩張軌道圖共用目前相位。`;
    drawOrbit($('binaryTop'), now, false);
    drawOrbit($('binarySky'), now, true);
    drawBinaryCurve(now);
  }

  function drawOrbit(canvas, now, sky) {
    const ctx = prepareCanvas(canvas);
    const { width: w, height: h } = canvas;
    const d = derived;
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 6, 6);
    const extent = Math.max(d.a1 + p.r1, d.a2 + p.r2) * 1.2;
    const scale = Math.min(w, h) * 0.42 / extent;
    const x = v => w / 2 + v * scale;
    const y = v => h / 2 - v * scale;
    ctx.save();
    [d.a1, d.a2].forEach((radius, j) => {
      ctx.strokeStyle = colors[j];
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, radius * scale,
        radius * scale * (sky ? Math.cos(d.inc) : 1), 0, 0, 2 * Math.PI);
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
    drawTitle(ctx, sky ? `i = ${p.inc.toFixed(2)}° · 星 ${now.front} 在前` : `相位 ${p.phase.toFixed(3)} · 質心固定`);
    drawAxisLabels(ctx, w, h, `x (R☉) · 全寬 ${(w / scale).toFixed(1)} R☉`, sky ? 'y (R☉)' : '軌道平面 (R☉)');
  }

  function drawBinaryCurve(now) {
    const canvas = $('binaryCurve');
    const ctx = prepareCanvas(canvas);
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    if (!derived.valid) { drawTitle(ctx, '兩星接觸或重疊：光變曲線不適用'); return; }
    const depth = Math.max(derived.depth1, derived.depth2);
    const margin = Math.max(0.01, depth * 0.15);
    const pad = getPlotPadding(w, h);
    const map = makeMapper(w, h, pad, 0, 1, 1 - depth - margin, 1 + margin);
    drawPlotFrame(ctx, w, h, pad, 0, 1, 1 - depth - margin, 1 + margin, 'Orbital phase · t / P', 'Normalized flux');
    drawLine(ctx, points.map(v => v.phase), points.map(v => v.flux), map, '#d9eaff', 2.5, []);
    if (derived.eclipses) for (const phase of [0.25, 0.75]) {
      drawVerticalGuide(ctx, map.x(phase), pad.top, h - pad.bottom);
      ctx.fillStyle = '#d9dde1';
      ctx.textAlign = 'center';
      ctx.fillText(derived.equalDepth ? '等深食' : phase === derived.primaryPhase ? '主食' : '次食', map.x(phase), pad.top + 20 * (window.devicePixelRatio || 1));
    }
    ctx.fillStyle = '#f3a8ba';
    ctx.beginPath();
    ctx.arc(map.x(p.phase), map.y(now.flux), 5 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
    ctx.fill();
  }
})();
