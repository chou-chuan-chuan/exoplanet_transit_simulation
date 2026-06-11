'use strict';

const cases = [
  { name: 'Case A', aRs: 7.975411766, P: 2.828042, p: 0.13729, u1: 0.000006168, u2: 0.069713088 },
  { name: 'Case B', aRs: 7.75, P: 2.828042, p: 0.1321, u1: 0.466, u2: 0.219 },
  { name: 'Case C', aRs: 6.613175269, P: 1.8053564, p: 0.14266, u1: 0.480712844, u2: 0.519287156 },
  { name: 'Case D', aRs: 7.11, P: 1.805356, p: 0.1379, u1: 0.4, u2: 0.233 }
];

const controlSpecs = [
  { key: 'aRs', label: 'a/Rs', min: 3, max: 15, step: 0.001, unit: '', digits: 3 },
  { key: 'P', label: 'P', min: 0.5, max: 5, step: 0.001, unit: ' d', digits: 3 },
  { key: 'p', label: 'Rp/Rs', min: 0.02, max: 0.3, step: 0.0001, unit: '', digits: 4 },
  { key: 'inc', label: 'Inclination', min: 75, max: 90, step: 0.01, unit: '°', digits: 2 },
  { key: 'u1', label: 'u1', min: 0, max: 1, step: 0.0001, unit: '', digits: 4 },
  { key: 'u2', label: 'u2', min: 0, max: 1, step: 0.0001, unit: '', digits: 4 },
  { key: 'N', label: 'Annuli N', min: 100, max: 1200, step: 10, unit: '', digits: 0 },
  { key: 'tRange', label: 'Time range', min: 0.02, max: 0.2, step: 0.001, unit: ' d', digits: 3 },
  { key: 'time', label: 'Frame time', min: -0.08, max: 0.08, step: 0.0005, unit: ' d', digits: 4 }
];

const state = {
  aRs: cases[0].aRs,
  P: cases[0].P,
  p: cases[0].p,
  inc: 88,
  u1: cases[0].u1,
  u2: cases[0].u2,
  N: 300,
  tRange: 0.08,
  time: 0
};

const controlsDiv = document.getElementById('controls');
const caseSelect = document.getElementById('caseSelect');
const playBtn = document.getElementById('playBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');
const paramBox = document.getElementById('paramBox');
const starCanvas = document.getElementById('starCanvas');
const curveCanvas = document.getElementById('curveCanvas');
const brightnessCanvas = document.getElementById('brightnessCanvas');

const inputs = new Map();
const valueLabels = new Map();
let animationId = null;
let currentCurve = null;
let redrawScheduled = false;

const ANIMATION_DURATION_MS = 6500; // Slower animation for clearer planet motion.

init();

function init() {
  for (const item of cases) {
    const option = document.createElement('option');
    option.value = item.name;
    option.textContent = item.name;
    caseSelect.appendChild(option);
  }

  for (const spec of controlSpecs) {
    const row = document.createElement('label');
    row.className = 'control-row';

    const name = document.createElement('span');
    name.textContent = spec.label;

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(state[spec.key]);
    input.setAttribute('aria-label', spec.label);

    const value = document.createElement('span');
    value.className = 'value-label';

    input.addEventListener('input', () => {
      const raw = Number(input.value);
      state[spec.key] = spec.key === 'N' ? Math.round(raw) : raw;
      if (spec.key === 'tRange') clampTimeSlider();
      if (spec.key !== 'time') currentCurve = null;
      scheduleUpdate();
    });

    row.append(name, input, value);
    controlsDiv.appendChild(row);
    inputs.set(spec.key, input);
    valueLabels.set(spec.key, value);
  }

  caseSelect.addEventListener('change', loadSelectedCase);
  resetBtn.addEventListener('click', loadSelectedCase);
  playBtn.addEventListener('click', toggleAnimation);
  window.addEventListener('resize', scheduleUpdate);

  clampTimeSlider();
  updateApp();
}

function loadSelectedCase() {
  const selected = cases.find((item) => item.name === caseSelect.value) || cases[0];
  state.aRs = selected.aRs;
  state.P = selected.P;
  state.p = selected.p;
  state.u1 = selected.u1;
  state.u2 = selected.u2;
  state.time = 0;
  syncInputs();
  currentCurve = null;
  updateApp();
}

function syncInputs() {
  for (const spec of controlSpecs) {
    const input = inputs.get(spec.key);
    if (input) input.value = String(state[spec.key]);
  }
  clampTimeSlider();
}

function clampTimeSlider() {
  const timeInput = inputs.get('time');
  if (!timeInput) return;
  timeInput.min = String(-state.tRange);
  timeInput.max = String(state.tRange);
  if (state.time < -state.tRange || state.time > state.tRange) state.time = 0;
  timeInput.value = String(state.time);
}

function scheduleUpdate() {
  if (redrawScheduled) return;
  redrawScheduled = true;
  requestAnimationFrame(() => {
    redrawScheduled = false;
    updateApp();
  });
}

function updateApp() {
  for (const spec of controlSpecs) {
    const label = valueLabels.get(spec.key);
    if (!label) continue;
    label.textContent = `${Number(state[spec.key]).toFixed(spec.digits)}${spec.unit}`;
  }

  if (!currentCurve) currentCurve = calculateCurve();

  const i = deg2rad(state.inc);
  const phiNow = 2 * Math.PI * state.time / state.P;
  const xNow = state.aRs * Math.sin(phiNow);
  const yNow = state.aRs * Math.cos(phiNow) * Math.cos(i);
  const zNow = Math.sqrt(xNow * xNow + yNow * yNow);
  const FNow = transitFluxAnnulus([zNow], state.p, state.u1, state.u2, state.N)[0];
  const b = state.aRs * Math.cos(i);
  const depth = (1 - Math.min(...currentCurve.Fld)) * 100;
  const transitPossible = b < 1 + state.p;

  statusEl.textContent = transitPossible
    ? 'Status: transit possible'
    : 'Status: no transit for this inclination';
  statusEl.classList.toggle('warning', !transitPossible);

  paramBox.textContent = [
    `a/Rs = ${state.aRs.toFixed(3)}    P = ${state.P.toFixed(3)} d`,
    `Rp/Rs = ${state.p.toFixed(4)}    i = ${state.inc.toFixed(2)} deg`,
    `u1 = ${state.u1.toFixed(4)}       u2 = ${state.u2.toFixed(4)}`,
    `Impact b = ${b.toFixed(3)}   depth = ${depth.toFixed(3)} %`,
    `t = ${state.time.toFixed(4)} d    flux = ${FNow.toFixed(5)}`
  ].join('\n');

  drawStar(starCanvas, xNow, yNow, state.p, state.u1, state.u2, state.time, FNow);
  drawCurve(curveCanvas, currentCurve.t, currentCurve.Fld, currentCurve.Funiform, state.time, FNow);
  drawBrightness(brightnessCanvas, state.u1, state.u2);
}

function calculateCurve() {
  const pointCount = 420;
  const t = linspace(-state.tRange, state.tRange, pointCount);
  const i = deg2rad(state.inc);
  const z = t.map((tt) => {
    const phi = 2 * Math.PI * tt / state.P;
    return state.aRs * Math.sqrt(
      Math.sin(phi) ** 2 + Math.cos(phi) ** 2 * Math.cos(i) ** 2
    );
  });

  return {
    t,
    Fld: transitFluxAnnulus(z, state.p, state.u1, state.u2, state.N),
    Funiform: transitFluxAnnulus(z, state.p, 0, 0, state.N)
  };
}

function toggleAnimation() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
    playBtn.textContent = 'Play animation';
    return;
  }

  playBtn.textContent = 'Stop animation';
  const startTime = performance.now();
  const duration = ANIMATION_DURATION_MS;
  const start = -state.tRange;
  const end = state.tRange;

  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    state.time = start + (end - start) * progress;
    const timeInput = inputs.get('time');
    if (timeInput) timeInput.value = String(state.time);
    updateApp();

    if (progress < 1) {
      animationId = requestAnimationFrame(step);
    } else {
      animationId = null;
      playBtn.textContent = 'Play animation';
    }
  }

  animationId = requestAnimationFrame(step);
}

function transitFluxAnnulus(zArray, p, u1, u2, N) {
  const n = Math.max(50, Math.round(N));
  const r = linspace(0, 1, n);
  const dr = r[1] - r[0];
  const intensity = new Array(n);
  const annulusArea = new Array(n);
  let totalFlux = 0;

  for (let k = 0; k < n; k += 1) {
    const rk = r[k];
    const mu = Math.sqrt(Math.max(0, 1 - rk * rk));
    const I = 1 - u1 * (1 - mu) - u2 * (1 - mu) ** 2;
    const area = 2 * Math.PI * rk * dr;
    intensity[k] = I;
    annulusArea[k] = area;
    totalFlux += I * area;
  }

  const F = new Array(zArray.length);

  for (let j = 0; j < zArray.length; j += 1) {
    const z = zArray[j];
    let blockedFlux = 0;

    for (let k = 0; k < n; k += 1) {
      const rk = r[k];
      let W = 0;

      if (z === 0) {
        W = rk <= p ? 1 : 0;
      } else if (rk === 0) {
        W = z < p ? 1 : 0;
      } else if (rk < Math.abs(z - p) || rk > z + p) {
        W = rk < p - z ? 1 : 0;
      } else {
        let arg = (rk * rk + z * z - p * p) / (2 * rk * z);
        arg = Math.max(-1, Math.min(1, arg));
        W = Math.acos(arg) / Math.PI;
      }

      blockedFlux += intensity[k] * annulusArea[k] * W;
    }

    F[j] = 1 - blockedFlux / totalFlux;
  }

  return F;
}

function drawStar(canvas, xPlanet, yPlanet, p, u1, u2, tNow, FNow) {
  const ctx = prepareCanvas(canvas);
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  // Use the same physical range in x and y so the star and planet remain circular.
  // This matches MATLAB's axis equal / 1:1 visual geometry behavior.
  const xMin = -1.6;
  const xMax = 1.6;
  const yMin = -1.6;
  const yMax = 1.6;

  const toX = (x) => ((x - xMin) / (xMax - xMin)) * width;
  const toY = (y) => height - ((y - yMin) / (yMax - yMin)) * height;
  const scaleX = width / (xMax - xMin);
  const scaleY = height / (yMax - yMin);

  drawGrid(ctx, width, height, 6, 5);

  const img = ctx.createImageData(width, height);
  const data = img.data;
  const cx = toX(0);
  const cy = toY(0);
  const rx = scaleX;
  const ry = scaleY;

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const x = (px - cx) / rx;
      const y = -(py - cy) / ry;
      const r = Math.sqrt(x * x + y * y);
      if (r <= 1) {
        const mu = Math.sqrt(Math.max(0, 1 - r * r));
        const I = 1 - u1 * (1 - mu) - u2 * (1 - mu) ** 2;
        const color = hotColor(I);
        const idx = (py * width + px) * 4;
        data[idx] = color[0];
        data[idx + 1] = color[1];
        data[idx + 2] = color[2];
        data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.96)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(255,255,255,0.72)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(toX(-1.6), toY(yPlanet));
  ctx.lineTo(toX(1.6), toY(yPlanet));
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#03040a';
  ctx.strokeStyle = '#f4f7fb';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(toX(xPlanet), toY(yPlanet), p * scaleX, p * scaleY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  drawAxisLabels(ctx, width, height, 'x / Rs', 'y / Rs');
  drawTitle(ctx, `t = ${tNow.toFixed(4)} d, flux = ${FNow.toFixed(5)}`);
}

function drawCurve(canvas, t, Fld, Funiform, tNow, FNow) {
  const ctx = prepareCanvas(canvas);
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const pad = getPlotPadding(width, height);
  const xMin = Math.min(...t);
  const xMax = Math.max(...t);
  const yMinRaw = Math.min(...Fld, ...Funiform);
  const yMaxRaw = Math.max(...Fld, ...Funiform);
  const yPad = Math.max((yMaxRaw - yMinRaw) * 0.18, 0.0008);
  const yMin = yMinRaw - yPad;
  const yMax = yMaxRaw + yPad;

  const map = makeMapper(width, height, pad, xMin, xMax, yMin, yMax);
  drawPlotFrame(ctx, width, height, pad, xMin, xMax, yMin, yMax, 'Time from mid-transit (d)', 'Normalized flux');

  drawLine(ctx, t, Funiform, map, 'rgba(255, 209, 102, 0.95)', 2, [6, 7]);
  drawLine(ctx, t, Fld, map, 'rgba(124, 199, 255, 1)', 2.5, []);

  // Current-time mark: red point only, without guide line, glow ring, or label.
  if (Number.isFinite(tNow) && Number.isFinite(FNow)) {
    const dpr = window.devicePixelRatio || 1;
    const x = map.x(tNow);
    const y = map.y(FNow);
    ctx.save();
    ctx.fillStyle = '#ff3b4f';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4 * dpr;
    ctx.beginPath();
    ctx.arc(x, y, 7.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawLegend(ctx, pad.left + 12, pad.top + 10, [
    ['Limb darkened', 'rgba(124, 199, 255, 1)'],
    ['Uniform disk', 'rgba(255, 209, 102, 0.95)']
  ]);
}

function drawBrightness(canvas, u1, u2) {
  const ctx = prepareCanvas(canvas);
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  const r = linspace(0, 1, 260);
  const I = r.map((rv) => {
    const mu = Math.sqrt(1 - rv * rv);
    return 1 - u1 * (1 - mu) - u2 * (1 - mu) ** 2;
  });

  const pad = getPlotPadding(width, height);
  const yMin = Math.max(0, Math.min(...I) - 0.05);
  const yMax = 1.05;
  const map = makeMapper(width, height, pad, 0, 1, yMin, yMax);
  drawPlotFrame(ctx, width, height, pad, 0, 1, yMin, yMax, 'r / Rs', 'Relative intensity');
  drawLine(ctx, r, I, map, 'rgba(124, 199, 255, 1)', 2.5, []);
}

function prepareCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.font = `${13 * dpr}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`;
  return ctx;
}

function drawGrid(ctx, width, height, nx, ny) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let i = 1; i < nx; i += 1) {
    const x = (width * i) / nx;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let j = 1; j < ny; j += 1) {
    const y = (height * j) / ny;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTitle(ctx, text) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'center';
  ctx.fillText(text, ctx.canvas.width / 2, 24 * (window.devicePixelRatio || 1));
  ctx.restore();
}

function drawAxisLabels(ctx, width, height, xLabel, yLabel) {
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.textAlign = 'center';
  ctx.fillText(xLabel, width / 2, height - 13 * dpr);
  ctx.translate(15 * dpr, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function getPlotPadding(width, height) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = width / dpr;

  // Give the y-axis enough room so the vertical label does not overlap
  // with the numerical tick values, especially on phone-sized screens.
  const leftPad = cssWidth < 420 ? 92 * dpr : 104 * dpr;

  return {
    left: Math.min(leftPad, width * 0.34),
    right: 26 * dpr,
    top: 26 * dpr,
    bottom: Math.min(60 * dpr, height * 0.24)
  };
}

function makeMapper(width, height, pad, xMin, xMax, yMin, yMax) {
  return {
    x: (xv) => pad.left + ((xv - xMin) / (xMax - xMin)) * (width - pad.left - pad.right),
    y: (yv) => height - pad.bottom - ((yv - yMin) / (yMax - yMin)) * (height - pad.top - pad.bottom)
  };
}

function drawPlotFrame(ctx, width, height, pad, xMin, xMax, yMin, yMax, xLabel, yLabel) {
  const dpr = window.devicePixelRatio || 1;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(xLabel, pad.left + plotW / 2, height - pad.bottom + 30 * dpr);

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.translate(18 * dpr, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';

  for (let j = 0; j <= 4; j += 1) {
    const y = pad.top + (plotH * j) / 4;
    const val = yMax - ((yMax - yMin) * j) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillText(val.toFixed(4), pad.left - 14 * dpr, y);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= 4; i += 1) {
    const x = pad.left + (plotW * i) / 4;
    const val = xMin + ((xMax - xMin) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, height - pad.bottom);
    ctx.stroke();
    ctx.fillText(val.toFixed(3), x, height - pad.bottom + 8 * dpr);
  }
  ctx.restore();
}

function drawLine(ctx, xValues, yValues, map, color, width, dash) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width * (window.devicePixelRatio || 1);
  ctx.setLineDash(dash.map((v) => v * (window.devicePixelRatio || 1)));
  ctx.beginPath();
  for (let i = 0; i < xValues.length; i += 1) {
    const x = map.x(xValues[i]);
    const y = map.y(yValues[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawLegend(ctx, x, y, items) {
  const dpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.font = `${12 * dpr}px ui-sans-serif, system-ui`;
  ctx.textBaseline = 'middle';
  items.forEach(([label, color], idx) => {
    const yy = y + idx * 18 * dpr;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * dpr;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + 24 * dpr, yy);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(label, x + 32 * dpr, yy);
  });
  ctx.restore();
}

function hotColor(I) {
  const v = Math.max(0, Math.min(1, I));
  const r = Math.round(255 * Math.min(1, 0.45 + 0.7 * v));
  const g = Math.round(255 * Math.max(0, Math.min(1, 1.15 * v - 0.15)));
  const b = Math.round(255 * Math.max(0, 0.28 * v - 0.04));
  return [r, g, b];
}

function linspace(start, end, count) {
  if (count <= 1) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}

function deg2rad(degrees) {
  return degrees * Math.PI / 180;
}
