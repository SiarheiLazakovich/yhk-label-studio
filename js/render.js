import { t } from "./i18n.js";
// Рендер макета этикетки в 1-bit буфер: текст/QR/фигуры — порог, картинки — дизеринг.
/* global qrcode, JsBarcode */

export const DITHERS = {
  floyd: "Floyd–Steinberg",
  atkinson: "Atkinson",
  stucki: "Stucki",
  jarvis: "Jarvis–Judice–Ninke",
  sierra: "Sierra",
  sierralite: "Sierra Lite",
  burkes: "Burkes",
  bluenoise: "Blue noise",
  bayer4: "Bayer 4×4",
  bayer8: "Bayer 8×8",
  threshold: "Порог",
};

// Ядра диффузии ошибки: [dx, dy, вес]; делитель — сумма весов (у Atkinson намеренно 6/8 — теряет часть ошибки).
const KERNELS = {
  floyd: { div: 16, k: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
  atkinson: { div: 8, k: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
  stucki: { div: 42, k: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]] },
  jarvis: { div: 48, k: [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]] },
  sierra: { div: 32, k: [[1, 0, 5], [2, 0, 3], [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2], [-1, 2, 2], [0, 2, 3], [1, 2, 2]] },
  sierralite: { div: 4, k: [[1, 0, 2], [-1, 1, 1], [0, 1, 1]] },
  burkes: { div: 32, k: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2]] },
};

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

/** Маска blue noise 64×64 методом void-and-cluster (Ulichney), считается один раз. Значения 0..1. */
let blueNoise = null;
function blueNoiseMask() {
  if (blueNoise) return blueNoise;
  const N = 64, NN = N * N, sigma = 1.9, R = 6;
  const kern = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) kern.push([dx, dy, Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))]);
  const energy = new Float32Array(NN), on = new Uint8Array(NN), rank = new Float32Array(NN);
  const splat = (i, sign) => {
    const x = i % N, y = (i / N) | 0;
    for (const [dx, dy, v] of kern) energy[((y + dy + N) % N) * N + ((x + dx + N) % N)] += sign * v;
  };
  // детерминированный ГПСЧ — маска одинакова при каждом запуске
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const initial = Math.floor(NN / 10);
  for (let n = 0; n < initial; n++) { let i; do i = (rnd() * NN) | 0; while (on[i]); on[i] = 1; splat(i, 1); }
  const tightest = () => { let b = -1, bv = -Infinity; for (let i = 0; i < NN; i++) if (on[i] && energy[i] > bv) { bv = energy[i]; b = i; } return b; };
  const largestVoid = () => { let b = -1, bv = Infinity; for (let i = 0; i < NN; i++) if (!on[i] && energy[i] < bv) { bv = energy[i]; b = i; } return b; };
  // перераспределение стартовых точек
  for (;;) {
    const c = tightest(); on[c] = 0; splat(c, -1);
    const v = largestVoid();
    if (v === c) { on[c] = 1; splat(c, 1); break; }
    on[v] = 1; splat(v, 1);
  }
  const proto = Uint8Array.from(on), protoE = Float32Array.from(energy);
  // фаза 1: ранги стартовых точек (убираем самые плотные)
  let ones = initial;
  for (let r = ones - 1; r >= 0; r--) { const c = tightest(); on[c] = 0; splat(c, -1); rank[c] = r; }
  // фаза 2–3: добавляем точки в самые большие пустоты
  on.set(proto); energy.set(protoE);
  for (let r = ones; r < NN; r++) { const v = largestVoid(); on[v] = 1; splat(v, 1); rank[v] = r; }
  blueNoise = { N, m: rank.map((r) => (r + 0.5) / NN) };
  return blueNoise;
}

/**
 * gray: Float32Array 0..255 (255 = белый). Возвращает Uint8Array, 1 = чёрный.
 * Диффузионные методы идут «змейкой» (чётные строки слева направо, нечётные — справа налево).
 */
export function dither(gray, w, h, method = "floyd", threshold = 128) {
  const out = new Uint8Array(w * h);
  if (method === "threshold") {
    for (let i = 0; i < gray.length; i++) out[i] = gray[i] < threshold ? 1 : 0;
    return out;
  }
  const bias = threshold - 128;
  if (method === "bayer4" || method === "bayer8" || method === "bluenoise") {
    let n, m;
    if (method === "bluenoise") { const bn = blueNoiseMask(); n = bn.N; m = bn.m; }
    else { n = method === "bayer4" ? 4 : 8; const src = n === 4 ? BAYER4 : BAYER8; m = src.map((v) => (v + 0.5) / (n * n)); }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) out[y * w + x] = gray[y * w + x] < m[(y % n) * n + (x % n)] * 255 + bias ? 1 : 0;
    return out;
  }
  const { div, k } = KERNELS[method] ?? KERNELS.floyd;
  const g = Float32Array.from(gray);
  for (let y = 0; y < h; y++) {
    const rev = y & 1, dir = rev ? -1 : 1;
    for (let j = 0; j < w; j++) {
      const x = rev ? w - 1 - j : j, i = y * w + x;
      const old = g[i], nv = old < threshold ? 0 : 255;
      out[i] = nv === 0 ? 1 : 0;
      const err = (old - nv) / div;
      for (const [dx, dy, f] of k) {
        const xx = x + dx * dir, yy = y + dy;
        if (xx >= 0 && xx < w && yy < h) g[yy * w + xx] += err * f;
      }
    }
  }
  return out;
}

/**
 * Подготовка картинки перед дизерингом:
 *  sharpen 0..100 — нерезкое маскирование 3×3 (как фильтр резкости в WalkPrint);
 *  dotGain 0..100 — компенсация растекания: термоточка расплывается и тон темнеет, поэтому
 *  средние тона заранее осветляются гамма-кривой (γ от 1 до 2.2). Чистые белый/чёрный не меняются.
 */
export function prepareGray(gray, w, h, { sharpen = 0, dotGain = 0 } = {}) {
  let g = gray;
  if (sharpen > 0) {
    const a = (sharpen / 100) * 1.5, s = new Float32Array(g.length);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < w && yy >= 0 && yy < h) { sum += g[yy * w + xx]; n++; }
        }
        s[i] = Math.min(255, Math.max(0, g[i] + a * (g[i] - sum / n)));
      }
    g = s;
  }
  if (dotGain > 0) {
    const gamma = 1 + (dotGain / 100) * 1.2, lut = new Float32Array(256);
    for (let v = 0; v < 256; v++) lut[v] = 255 * Math.pow(v / 255, 1 / gamma);
    const o = new Float32Array(g.length);
    for (let i = 0; i < g.length; i++) o[i] = lut[Math.max(0, Math.min(255, Math.round(g[i])))];
    g = o;
  }
  return g;
}

function grayOf(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  for (let i = 0, p = 0; i < g.length; i++, p += 4) {
    // альфа поверх белого
    const a = d[p + 3] / 255;
    const lum = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
    g[i] = lum * a + 255 * (1 - a);
  }
  return g;
}

// ---------- геометрия объектов ----------

const measureCtx = document.createElement("canvas").getContext("2d");

export function fontOf(o) {
  return `${o.italic ? "italic " : ""}${o.bold ? "700 " : "400 "}${o.fontSize}px ${o.fontFamily}`;
}

function textLayout(o) {
  measureCtx.font = fontOf(o);
  const lines = String(o.text || " ").split("\n");
  const lh = Math.round(o.fontSize * (o.lineHeight ?? 1.15));
  const widths = lines.map((l) => measureCtx.measureText(l || " ").width);
  return { lines, lh, widths, w: Math.ceil(Math.max(1, ...widths)), h: lh * lines.length };
}

const qrCache = new Map();
export function qrMatrix(data, ecc = "M") {
  const key = ecc + "|" + data;
  if (qrCache.has(key)) return qrCache.get(key);
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  const q = qrcode(0, ecc);
  q.addData(data || " ", "Byte");
  q.make();
  const n = q.getModuleCount();
  const m = { n, dark: (r, c) => q.isDark(r, c) };
  if (qrCache.size > 50) qrCache.clear();
  qrCache.set(key, m);
  return m;
}

function qrGeometry(o) {
  let n;
  try { n = qrMatrix(o.data, o.ecc).n; } catch { n = 21; }
  const cell = Math.max(1, Math.floor(o.size / n));
  return { n, cell, side: cell * n };
}

// ---------- штрихкоды (JsBarcode) ----------

export const BARCODE_FORMATS = {
  CODE128: { label: "Code 128", sample: "YHK-0926", hint: "любые символы ASCII" },
  EAN13: { label: "EAN-13", sample: "460123456789", hint: "12 цифр (контрольная добавится) или 13" },
  EAN8: { label: "EAN-8", sample: "4601234", hint: "7 цифр или 8" },
  UPC: { label: "UPC-A", sample: "12345678901", hint: "11 цифр или 12" },
  UPCE: { label: "UPC-E", sample: "123456", hint: "6 или 8 цифр" },
  CODE39: { label: "Code 39", sample: "YHK0926", hint: "A–Z, 0–9, пробел и - . $ / + %" },
  ITF14: { label: "ITF-14", sample: "1460123456789", hint: "13 цифр или 14" },
  ITF: { label: "ITF (2 из 5)", sample: "123456", hint: "чётное число цифр" },
  codabar: { label: "Codabar", sample: "A12345B", hint: "цифры и - $ : / . +, по краям A–D" },
  MSI: { label: "MSI", sample: "123456", hint: "цифры" },
  pharmacode: { label: "Pharmacode", sample: "1234", hint: "число 3–131070" },
};

const barcodeCache = new Map();
/**
 * Рисует штрихкод в отдельный canvas: модуль — целое число точек головки (o.module),
 * белые поля тишины по 10 модулей слева и справа (нужны сканеру).
 * Возвращает {canvas} или {error}.
 */
export function barcodeRender(o) {
  const key = JSON.stringify([o.format, o.data, o.module, o.barHeight, o.showText, o.fontSize, t("Ошибка: {m}")]);
  if (barcodeCache.has(key)) return barcodeCache.get(key);
  let res;
  if (typeof JsBarcode !== "function") res = { error: t("Библиотека штрихкодов не загрузилась") };
  else {
    const canvas = document.createElement("canvas");
    let valid = true;
    try {
      JsBarcode(canvas, String(o.data ?? ""), {
        format: o.format, width: Math.max(1, Math.round(o.module)), height: Math.max(8, Math.round(o.barHeight)),
        displayValue: !!o.showText, fontSize: o.fontSize, font: "Inter, Helvetica, Arial, sans-serif", textMargin: 2,
        margin: 0, marginLeft: 10 * o.module, marginRight: 10 * o.module,
        background: "#ffffff", lineColor: "#000000", flat: false,
        valid: (v) => { valid = v; },
      });
      res = valid ? { canvas } : { error: t("Неверные данные для {f}: {hint}", { f: t(BARCODE_FORMATS[o.format]?.label ?? o.format), hint: t(BARCODE_FORMATS[o.format]?.hint ?? "") }) };
    } catch (e) {
      res = { error: t("Ошибка: {m}", { m: e.message ?? e }) };
    }
  }
  if (barcodeCache.size > 50) barcodeCache.clear();
  barcodeCache.set(key, res);
  return res;
}

function drawBarcode(ctx, o) {
  const r = barcodeRender(o);
  if (r.error) {
    const b = boundsOf(o);
    ctx.save();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.setLineDash([]); ctx.fillStyle = "#000"; ctx.font = "700 14px Inter, Helvetica, Arial, sans-serif"; ctx.textBaseline = "top";
    ctx.fillText(t("ШТРИХКОД: ошибка данных"), b.x + 8, b.y + 8);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.imageSmoothingEnabled = false; // полосы — ровно по точкам головки
  ctx.drawImage(r.canvas, Math.round(o.x), Math.round(o.y));
  ctx.restore();
}

// ---------- векторные изображения (SVG) ----------

function drawVector(ctx, o) {
  const img = imageFor(o.src);
  if (!img.complete || !img.naturalWidth) return;
  ctx.save();
  if (o.dither) ctx.filter = "grayscale(1)";
  ctx.drawImage(img, o.x, o.y, o.w, o.h); // SVG растеризуется сразу в нужном размере — без потери резкости
  ctx.restore();
}

/** Габариты объекта {x,y,w,h} в пикселях этикетки. */
export function boundsOf(o) {
  switch (o.type) {
    case "text": {
      const { w, h } = textLayout(o);
      return { x: o.x, y: o.y, w, h };
    }
    case "qr": {
      const { side } = qrGeometry(o);
      return { x: o.x, y: o.y, w: side, h: side };
    }
    case "barcode": {
      const r = barcodeRender(o);
      return r.canvas ? { x: o.x, y: o.y, w: r.canvas.width, h: r.canvas.height } : { x: o.x, y: o.y, w: 220, h: Math.max(40, o.barHeight) };
    }
    default:
      return { x: o.x, y: o.y, w: o.w, h: o.h };
  }
}

// ---------- отрисовка ----------

function drawText(ctx, o) {
  const { lines, lh, widths, w } = textLayout(o);
  ctx.font = fontOf(o);
  ctx.textBaseline = "top";
  if (o.inverse) {
    ctx.fillStyle = "#000";
    ctx.fillRect(o.x - 4, o.y - 2, w + 8, lh * lines.length + 4);
  }
  ctx.fillStyle = o.inverse ? "#fff" : "#000";
  lines.forEach((line, i) => {
    let dx = 0;
    if (o.align === "center") dx = (w - widths[i]) / 2;
    else if (o.align === "right") dx = w - widths[i];
    // небольшой сдвиг: canvas рисует с верхним отступом
    ctx.fillText(line, o.x + dx, o.y + i * lh + Math.round((lh - o.fontSize) / 2));
  });
}

function drawQr(ctx, o) {
  let m;
  try { m = qrMatrix(o.data, o.ecc); } catch {
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
    ctx.strokeRect(o.x, o.y, o.size, o.size);
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.size, o.y + o.size); ctx.stroke();
    return;
  }
  const { cell } = qrGeometry(o);
  ctx.fillStyle = "#000";
  for (let r = 0; r < m.n; r++)
    for (let c = 0; c < m.n; c++)
      if (m.dark(r, c)) ctx.fillRect(Math.round(o.x) + c * cell, Math.round(o.y) + r * cell, cell, cell);
}

export const FRAME_STYLES = {
  solid: "Сплошная",
  double: "Двойная",
  dashed: "Пунктир",
  dotted: "Точки",
  corners: "Только уголки",
  ticket: "Билет (вырезы в углах)",
  scallop: "Волна (фестоны)",
  stamp: "Марка (перфорация)",
};

/**
 * Рамка: o.style из FRAME_STYLES, o.stroke — толщина, o.radius — скругление углов, o.fill — заливка.
 * Линия всегда внутри габаритов (x, y, w, h), чтобы толстая рамка не вылезала за этикетку.
 */
function drawRect(ctx, o) {
  const t = Math.max(1, o.stroke ?? 3), r = Math.max(0, o.radius ?? 0), style = o.style ?? "solid";
  const x = o.x, y = o.y, w = o.w, h = o.h;
  ctx.save();
  ctx.fillStyle = ctx.strokeStyle = "#000";
  ctx.lineWidth = t;
  const rr = (inset, rad) => {
    ctx.beginPath();
    ctx.roundRect(x + inset, y + inset, w - 2 * inset, h - 2 * inset, Math.max(0, Math.min(rad, (Math.min(w, h) - 2 * inset) / 2)));
  };

  if (o.fill && ["solid", "double", "dashed", "dotted"].includes(style)) {
    rr(0, r); ctx.fill(); ctx.restore(); return;
  }
  switch (style) {
    case "double": {
      rr(t / 2, r); ctx.stroke();
      rr(t * 2.5, Math.max(0, r - t * 2)); ctx.stroke();
      break;
    }
    case "dashed": ctx.setLineDash([t * 3, t * 2]); rr(t / 2, r); ctx.stroke(); break;
    case "dotted": {
      ctx.lineWidth = Math.max(2, t * 1.2);
      ctx.lineCap = "round";
      ctx.setLineDash([0.01, Math.max(4, t * 2.4)]);
      rr(ctx.lineWidth / 2, r); ctx.stroke();
      break;
    }
    case "corners": {
      const L = Math.max(8, Math.min(w, h) * 0.2), i = t / 2;
      ctx.lineCap = "square";
      ctx.beginPath();
      ctx.moveTo(x + i, y + L); ctx.lineTo(x + i, y + i); ctx.lineTo(x + L, y + i);
      ctx.moveTo(x + w - L, y + i); ctx.lineTo(x + w - i, y + i); ctx.lineTo(x + w - i, y + L);
      ctx.moveTo(x + w - i, y + h - L); ctx.lineTo(x + w - i, y + h - i); ctx.lineTo(x + w - L, y + h - i);
      ctx.moveTo(x + L, y + h - i); ctx.lineTo(x + i, y + h - i); ctx.lineTo(x + i, y + h - L);
      ctx.stroke();
      break;
    }
    case "ticket": {
      // вогнутые четверть-круги в углах
      const n = Math.max(6, r || Math.min(w, h) * 0.12), i = t / 2;
      const x0 = x + i, y0 = y + i, x1 = x + w - i, y1 = y + h - i;
      ctx.beginPath();
      ctx.moveTo(x0 + n, y0);
      ctx.lineTo(x1 - n, y0); ctx.arc(x1, y0, n, Math.PI, Math.PI / 2, true);
      ctx.lineTo(x1, y1 - n); ctx.arc(x1, y1, n, -Math.PI / 2, Math.PI, true);
      ctx.lineTo(x0 + n, y1); ctx.arc(x0, y1, n, 0, -Math.PI / 2, true);
      ctx.lineTo(x0, y0 + n); ctx.arc(x0, y0, n, Math.PI / 2, 0, true);
      ctx.closePath();
      if (o.fill) ctx.fill(); else ctx.stroke();
      break;
    }
    case "scallop": {
      // полукруги наружу по всем сторонам
      const s0 = Math.max(4, r || t * 3), i = s0 + t / 2;
      const x0 = x + i, y0 = y + i, x1 = x + w - i, y1 = y + h - i;
      const edge = (ax, ay, bx, by, a0) => {
        const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / (2 * s0))), step = len / n;
        const ux = (bx - ax) / len, uy = (by - ay) / len;
        for (let k = 0; k < n; k++) {
          const cx = ax + ux * (k + 0.5) * step, cy = ay + uy * (k + 0.5) * step;
          ctx.arc(cx, cy, step / 2, a0, a0 + Math.PI, false);
        }
      };
      ctx.beginPath();
      edge(x0, y0, x1, y0, Math.PI);           // верх — дуги вверх
      edge(x1, y0, x1, y1, -Math.PI / 2);      // право — вправо
      edge(x1, y1, x0, y1, 0);                 // низ — вниз
      edge(x0, y1, x0, y0, Math.PI / 2);       // лево — влево
      ctx.closePath();
      if (o.fill) ctx.fill(); else ctx.stroke();
      break;
    }
    case "stamp": {
      // сплошная рамка + ряд «дырочек» перфорации по внешнему краю
      const hole = Math.max(2, r || t * 1.2), gap = hole * 3.2;
      rr(hole * 2 + t / 2, 0); ctx.stroke();
      const dots = (ax, ay, bx, by) => {
        const len = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.round(len / gap));
        for (let k = 0; k <= n; k++) {
          ctx.beginPath();
          ctx.arc(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n, hole, 0, Math.PI * 2);
          ctx.fill();
        }
      };
      const p = hole;
      dots(x + p, y + p, x + w - p, y + p);
      dots(x + p, y + h - p, x + w - p, y + h - p);
      dots(x + p, y + p, x + p, y + h - p);
      dots(x + w - p, y + p, x + w - p, y + h - p);
      break;
    }
    default: rr(t / 2, r); ctx.stroke();
  }
  ctx.restore();
}

const imageCache = new Map();
export function imageFor(src) {
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    imageCache.set(src, img);
  }
  return img;
}

function drawImage(ctx, o) {
  const img = imageFor(o.src);
  if (!img.complete || !img.naturalWidth) return;
  ctx.save();
  ctx.filter = `brightness(${o.brightness ?? 100}%) contrast(${o.contrast ?? 100}%) grayscale(1)`;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, o.x, o.y, o.w, o.h);
  ctx.restore();
}

/**
 * @param {{width:number,height:number,objects:any[]}} doc
 * @param {{dither:string,threshold:number,invert:boolean}} settings
 * @returns {{width:number,height:number,bits:Uint8Array}}
 */
export function renderLabel(doc, settings) {
  const w = doc.width, h = Math.max(1, Math.round(doc.height));
  // Векторный слой рисуется на прозрачном фоне: где он непрозрачен — он перекрывает картинки
  // (в т.ч. белые пиксели inverse-текста), где прозрачен — видна дизеринг-картинка.
  const vec = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true });

  // в слой дизеринга идут растровые картинки и SVG с включённым дизерингом
  const images = doc.objects.filter((o) => o.type === "image" || (o.type === "vector" && o.dither));
  let imgBits = null;
  if (images.length) {
    const ic = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true });
    ic.fillStyle = "#fff";
    ic.fillRect(0, 0, w, h);
    images.forEach((o) => (o.type === "image" ? drawImage(ic, o) : drawVector(ic, o)));
    const g = prepareGray(grayOf(ic, w, h), w, h, { sharpen: settings.sharpen ?? 0, dotGain: settings.dotGain ?? 0 });
    imgBits = dither(g, w, h, settings.dither, settings.threshold);
  }

  for (const o of doc.objects) {
    if (o.type === "text") drawText(vec, o);
    else if (o.type === "qr") drawQr(vec, o);
    else if (o.type === "rect") drawRect(vec, o);
    else if (o.type === "barcode") drawBarcode(vec, o);
    else if (o.type === "vector" && !o.dither) drawVector(vec, o); // SVG — резкий порог, как текст
  }
  const d = vec.getImageData(0, 0, w, h).data;
  const bits = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < bits.length; i++, p += 4) {
    let b;
    if (d[p + 3] >= 128) b = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2] < 128 ? 1 : 0;
    else b = imgBits ? imgBits[i] : 0;
    if (settings.invert) b ^= 1;
    bits[i] = b;
  }
  return { width: w, height: h, bits };
}

/** Находит первую/последнюю строку с чёрными пикселями. null — если пусто. */
export function contentRows(bits, w, h) {
  let top = -1, bottom = -1;
  for (let y = 0; y < h && top < 0; y++)
    for (let x = 0; x < w; x++) if (bits[y * w + x]) { top = y; break; }
  if (top < 0) return null;
  for (let y = h - 1; y >= top && bottom < 0; y--)
    for (let x = 0; x < w; x++) if (bits[y * w + x]) { bottom = y; break; }
  return { top, bottom };
}

/** Обрезает пустые строки сверху/снизу, оставляя margin px. */
export function trimRows(bits, w, h, margin = 8) {
  const r = contentRows(bits, w, h);
  if (!r) return { bits, height: h, top: 0, bottom: h - 1 };
  const top = Math.max(0, r.top - margin);
  const bottom = Math.min(h - 1, r.bottom + margin);
  return { bits: bits.slice(top * w, (bottom + 1) * w), height: bottom - top + 1, top, bottom };
}

export function rotate180(bits) {
  return Uint8Array.from(bits).reverse();
}

/** Рисует 1-bit буфер на canvas. */
/**
 * Превью с имитацией растекания: каждая чёрная точка «подмачивает» соседей (spread 0..1).
 * Так на экране видно, насколько темнее картинка выйдет на термобумаге.
 */
export function paintBitsDotGain(canvas, bits, w, h, spread = 0.35) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let ink = bits[i] ? 1 : 0;
      if (!ink) {
        let n = 0;
        if (x > 0 && bits[i - 1]) n++;
        if (x < w - 1 && bits[i + 1]) n++;
        if (y > 0 && bits[i - w]) n++;
        if (y < h - 1 && bits[i + w]) n++;
        ink = Math.min(1, n * spread * 0.45);
      }
      const v = Math.round(255 - ink * 238), p = i * 4;
      d[p] = d[p + 1] = d[p + 2] = v;
      d[p + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
}

export function paintBits(canvas, bits, w, h, ink = [17, 17, 17]) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0, p = 0; i < bits.length; i++, p += 4) {
    if (bits[i]) { d[p] = ink[0]; d[p + 1] = ink[1]; d[p + 2] = ink[2]; }
    else { d[p] = d[p + 1] = d[p + 2] = 255; }
    d[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Цветной (неупрощённый) предпросмотр для режима «Редактор». */
export function renderEditPreview(canvas, doc) {
  const w = doc.width, h = Math.max(1, Math.round(doc.height));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  // тот же порядок слоёв, что и при печати: сначала картинки, поверх — текст/QR/рамки
  for (const o of doc.objects) if (o.type === "image" || (o.type === "vector" && o.dither)) (o.type === "image" ? drawImage : drawVector)(ctx, o);
  for (const o of doc.objects) {
    if (o.type === "text") drawText(ctx, o);
    else if (o.type === "qr") drawQr(ctx, o);
    else if (o.type === "rect") drawRect(ctx, o);
    else if (o.type === "barcode") drawBarcode(ctx, o);
    else if (o.type === "vector" && !o.dither) drawVector(ctx, o);
  }
}
