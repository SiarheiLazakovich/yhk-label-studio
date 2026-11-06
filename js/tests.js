import { t } from "./i18n.js";
// Тестовые шаблоны для калибровки: ширина печати и разрешение. Всё в пикселях головки (8 px/мм).
import { PRINT_WIDTH } from "./printer.js";

const MM = 8;

function canvas(h) {
  const c = new OffscreenCanvas(PRINT_WIDTH, h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, PRINT_WIDTH, h);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.textBaseline = "top";
  return ctx;
}

function toBits(ctx, h) {
  const d = ctx.getImageData(0, 0, PRINT_WIDTH, h).data;
  const bits = new Uint8Array(PRINT_WIDTH * h);
  for (let i = 0, p = 0; i < bits.length; i++, p += 4) bits[i] = d[p] < 128 ? 1 : 0;
  return { bits, height: h };
}

/**
 * Линейка во всю ширину головки: деления каждый 1 мм, длинные — каждые 5 и 10 мм, подписи в мм.
 * Крайние столбцы 0 и 383 залиты полностью — видно, где реально начинается и заканчивается печать.
 */
export function widthTest() {
  const h = 22 * MM;
  const ctx = canvas(h);
  ctx.font = "700 18px Inter, Helvetica, Arial, sans-serif";
  ctx.fillText(t("ТЕСТ ШИРИНЫ · 384 px = 48 мм"), 8, 4);
  ctx.font = "400 13px Inter, Helvetica, Arial, sans-serif";
  ctx.fillText(t("края: столбцы 0 и 383 (стрелки)"), 8, 26);

  const base = 12 * MM; // линия линейки
  ctx.fillRect(0, base, PRINT_WIDTH, 2);
  for (let mm = 0; mm <= 48; mm++) {
    const x = Math.min(PRINT_WIDTH - 1, mm * MM);
    const len = mm % 10 === 0 ? 40 : mm % 5 === 0 ? 26 : 14;
    ctx.fillRect(x, base - len, 1, len);
    if (mm % 5 === 0 && mm > 0 && mm < 48) {
      ctx.font = "700 12px Inter, Helvetica, Arial, sans-serif";
      const t = String(mm);
      ctx.fillText(t, x - ctx.measureText(t).width / 2, base + 6);
    }
  }
  // крайние столбцы во всю высоту + стрелки внутрь
  ctx.fillRect(0, 0, 1, h);
  ctx.fillRect(PRINT_WIDTH - 1, 0, 1, h);
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(1, base + 30 + i, 10 - i, 1);
    ctx.fillRect(PRINT_WIDTH - 11 + i, base + 30 + i, 10 - i, 1);
  }
  // полоса «шахматкой» по 1 мм — удобно считать миллиметры
  for (let mm = 0; mm < 48; mm++) if (mm % 2 === 0) ctx.fillRect(mm * MM, h - 3 * MM, MM, 2 * MM);
  return toBits(ctx, h);
}

/**
 * Разрешение: линии и шахматки толщиной 1/2/3 точки по обеим осям, квадрат 10×10 мм для проверки
 * масштаба (8 точек/мм = 203 dpi), диагонали и мелкий текст.
 */
export function resolutionTest() {
  const h = 60 * MM;
  const ctx = canvas(h);
  ctx.font = "700 16px Inter, Helvetica, Arial, sans-serif";
  ctx.fillText(t("РАЗРЕШЕНИЕ · 8 точек/мм ≈ 203 dpi"), 6, 4);

  let y = 30;
  const label = (t, yy) => { ctx.font = "400 11px Inter, Helvetica, Arial, sans-serif"; ctx.fillText(t, 4, yy); };

  // вертикальные линии с шагом 2/4/6 точек (линия N точек + промежуток N)
  for (const n of [1, 2, 3]) {
    label(t("верт. {n}px", { n }), y + 4);
    for (let x = 70; x < PRINT_WIDTH - 4; x += 2 * n) ctx.fillRect(x, y, n, 22);
    y += 28;
  }
  // горизонтальные линии
  for (const n of [1, 2, 3]) {
    label(t("гор. {n}px", { n }), y + 4);
    for (let yy = y; yy < y + 22; yy += 2 * n) ctx.fillRect(70, yy, PRINT_WIDTH - 74, n);
    y += 28;
  }
  // шахматки
  for (const n of [1, 2]) {
    label(t("шахм. {n}px", { n }), y + 4);
    for (let yy = 0; yy < 22; yy++)
      for (let x = 70; x < PRINT_WIDTH - 4; x++)
        if (((Math.floor((x - 70) / n) + Math.floor(yy / n)) & 1) === 0) ctx.fillRect(x, y + yy, 1, 1);
    y += 28;
  }
  // квадрат 10×10 мм + сплошной 5×5 мм
  y += 6;
  ctx.fillRect(8, y, 10 * MM, 1); ctx.fillRect(8, y + 10 * MM - 1, 10 * MM, 1);
  ctx.fillRect(8, y, 1, 10 * MM); ctx.fillRect(8 + 10 * MM - 1, y, 1, 10 * MM);
  ctx.fillRect(8 + 2.5 * MM, y + 2.5 * MM, 5 * MM, 5 * MM);
  ctx.font = "700 12px Inter, Helvetica, Arial, sans-serif";
  ctx.fillText(t("10×10 мм"), 8, y + 10 * MM + 4);
  // диагонали и окружность (сглаживание выключено — чистые точки)
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { ctx.moveTo(110 + i * 10, y); ctx.lineTo(170 + i * 10, y + 80); }
  ctx.stroke();
  ctx.beginPath(); ctx.arc(290, y + 40, 38, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(290, y + 40, 20, 0, Math.PI * 2); ctx.fill();
  y += 10 * MM + 24;
  // мелкий текст
  for (const size of [7, 8, 9, 10, 12, 14]) {
    ctx.font = `400 ${size}px Inter, Helvetica, Arial, sans-serif`;
    ctx.fillText(t("{n}px Съешь ещё булок 0123456789", { n: size }), 4, y);
    y += size + 4;
  }
  return toBits(ctx, Math.min(h, y + 8));
}

/**
 * Широкая линейка: wideMm мм = wideMm × 8 точек (58 мм = 464 точки = 58 байт в строке).
 * Если головка уже — правый край обрежется (или строки съедут). Сплошные вертикали на 0, 48 и краю.
 */
export function wideWidthTest(wideMm = 58) {
  const W = wideMm * MM, h = 24 * MM;
  const c = new OffscreenCanvas(W, h);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, h);
  ctx.fillStyle = "#000"; ctx.textBaseline = "top";
  ctx.font = "700 16px Inter, Helvetica, Arial, sans-serif";
  ctx.fillText(t("ТЕСТ {mm} мм · {w} точек", { mm: wideMm, w: W }), 8, 4);
  ctx.font = "400 12px Inter, Helvetica, Arial, sans-serif";
  ctx.fillText(t("до какой отметки напечатано?"), 8, 24);

  const base = 12 * MM;
  ctx.fillRect(0, base, W, 2);
  for (let mm = 0; mm <= wideMm; mm++) {
    const x = Math.min(W - 1, mm * MM);
    const len = mm % 10 === 0 ? 40 : mm % 5 === 0 ? 26 : 14;
    ctx.fillRect(x, base - len, 1, len);
    if (mm % 5 === 0 && mm > 0 && mm < wideMm) {
      ctx.font = "700 12px Inter, Helvetica, Arial, sans-serif";
      const t = String(mm);
      ctx.fillText(t, x - ctx.measureText(t).width / 2, base + 6);
    }
  }
  // сплошные вертикали: начало, граница 48 мм, правый край
  for (const x of [0, 48 * MM - 1, W - 1]) ctx.fillRect(x, 0, 2, h);
  ctx.font = "700 12px Inter, Helvetica, Arial, sans-serif";
  ctx.fillText("48", 48 * MM - 18, h - 5 * MM);
  ctx.fillText(String(wideMm), W - 20, h - 5 * MM);
  // полоса по 1 мм
  for (let mm = 0; mm < wideMm; mm++) if (mm % 2 === 0) ctx.fillRect(mm * MM, h - 3 * MM, MM, 2 * MM);

  const d = ctx.getImageData(0, 0, W, h).data;
  const bits = new Uint8Array(W * h);
  for (let i = 0, p = 0; i < bits.length; i++, p += 4) bits[i] = d[p] < 128 ? 1 : 0;
  return { bits, height: h, width: W };
}
