import "./ui.js";
import { t } from "./i18n.js";
import { widthTest, resolutionTest, wideWidthTest } from "./tests.js";
import { YhkPrinter, PRINT_WIDTH, DEFAULT_PRINT_OPTIONS, DENSITY_PROFILES, densityByte } from "./printer.js";
import {
  DITHERS, BARCODE_FORMATS, FRAME_STYLES, barcodeRender, fontOf, renderLabel, renderEditPreview, paintBits, paintBitsDotGain, boundsOf, trimRows, contentRows,
  rotate180, imageFor,
} from "./render.js";

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "yhk-label-studio-v1";

// System fonts plus bundled ones (fonts/, with Cyrillic, work offline). The value is a CSS font-family.
const FONTS = [
  ["Inter, -apple-system, Helvetica, Arial, sans-serif", "System"],
  ["'Roboto', sans-serif", "Roboto"],
  ["'Montserrat', sans-serif", "Montserrat"],
  ["'Rubik', sans-serif", "Rubik"],
  ["'Oswald', sans-serif", "Oswald (condensed)"],
  ["'Russo One', sans-serif", "Russo One (heavy)"],
  ["'Comfortaa', sans-serif", "Comfortaa (rounded)"],
  ["'PT Serif', serif", "PT Serif (serif)"],
  ["Georgia, 'Times New Roman', serif", "Georgia"],
  ["'JetBrains Mono', monospace", "JetBrains Mono"],
  ["'Press Start 2P', monospace", "Press Start 2P (pixel)"],
  ["'Lobster', cursive", "Lobster (script)"],
  ["'Caveat', cursive", "Caveat (handwritten)"],
  ["Impact, 'Arial Narrow', sans-serif", "Impact"],
];

const WIDTH_PRESETS = [58, 50, 48, 40, 30, 25, 20, 15];
const HEIGHT_PRESETS = [15, 20, 25, 30, 40, 50, 60, 80];

// ---------------- state ----------------

const defaults = {
  settings: {
    widthMm: 48, heightMm: 40,
    dither: "floyd", threshold: 128, invert: false,
    trim: false, trimMargin: 8, copies: 1,
    feedLines: DEFAULT_PRINT_OPTIONS.feedLines, rotate: false,
    transport: "ble", densityLevel: 1, densityCustom: null, protoV: 3,
    feedAfterOn: false, feedAfterMm: 12,
    dotGain: 25, sharpen: 0, previewGain: false,
    snapHalfX: true, snapHalfY: true, snapThirdX: true, snapThirdY: true, snapQuarterX: true, snapQuarterY: true,
    chunkSize: DEFAULT_PRINT_OPTIONS.chunkSize, chunkDelay: DEFAULT_PRINT_OPTIONS.chunkDelayMs,
    acceptAll: false, zoom: 1.5, view: "print",
  },
  objects: [
    { id: 1, type: "text", x: 0, y: 40, text: t("Hello, YHK!"), fontSize: 44, fontFamily: FONTS[0][0], bold: true, italic: false, align: "center", inverse: false, lineHeight: 1.15 },
    { id: 2, type: "text", x: 0, y: 120, text: t("Label Studio · 48 × 40 mm"), fontSize: 22, fontFamily: FONTS[0][0], bold: false, italic: false, align: "center", inverse: false, lineHeight: 1.15 },
    { id: 3, type: "rect", x: 4, y: 4, w: 376, h: 312, stroke: 3, fill: false },
  ],
};

let state = load();
let selectedId = null;
let nextId = Math.max(0, ...state.objects.map((o) => o.id)) + 1;
let lastRender = null;
let abortCtrl = null;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s?.settings && Array.isArray(s.objects)) {
      const settings = { ...defaults.settings, ...s.settings };
      // v2: banded BLE became the main channel — migrate old settings
      if ((s.settings.protoV ?? 1) < 3) {
        Object.assign(settings, { transport: "ble", chunkSize: 180, chunkDelay: 0, protoV: 3 });
      }
      return { settings, objects: s.objects };
    }
  } catch { /* ignore */ }
  const st = structuredClone(defaults);
  centerAll(st);
  return st;
}

function centerAll(st) {
  // center the starter texts once the font has been measured
  requestAnimationFrame(() => {
    for (const o of st.objects) if (o.type === "text") o.x = labelCenterX(boundsOf(o).w);
    scheduleRender();
  });
}

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { toast(t("Couldn't save the layout (images are too large)"), true); }
  }, 300);
}

const S = () => state.settings;
// The head physically prints 8 dots/mm (384 px = 48 mm), so the scale is fixed.
// A label narrower than 48 mm is the centered part of the print band; nothing outside it prints.
const PX_PER_MM = PRINT_WIDTH / 48;
const PRINT_MM = 48; // print head width
const MAX_WIDTH_MM = 80;
// margin of a label wider than 48 mm on each side — the head can't reach it
const sideMarginMm = () => Math.max(0, (S().widthMm - PRINT_MM) / 2);
const heightPx = () => Math.max(8, Math.round(S().heightMm * PX_PER_MM));
const labelW = () => Math.min(PRINT_WIDTH, Math.round(Math.min(MAX_WIDTH_MM, S().widthMm) * PX_PER_MM));
const labelX = () => Math.floor((PRINT_WIDTH - labelW()) / 2);
const labelCenterX = (w) => Math.round(labelX() + (labelW() - w) / 2);

/** Clears pixels outside the label width. */
function maskOutside(bits, h) {
  const x0 = labelX(), x1 = x0 + labelW();
  if (x0 <= 0 && x1 >= PRINT_WIDTH) return bits;
  for (let y = 0; y < h; y++) {
    const row = y * PRINT_WIDTH;
    bits.fill(0, row, row + x0);
    bits.fill(0, row + x1, row + PRINT_WIDTH);
  }
  return bits;
}
const doc = () => ({ width: PRINT_WIDTH, height: heightPx(), objects: state.objects });
const selected = () => state.objects.find((o) => o.id === selectedId) ?? null;

// ---------------- printer ----------------

const printer = new YhkPrinter();

printer.addEventListener("log", (e) => log(e.detail.msg, e.detail.level));
// Model and head width come from the printer: the BLE device name and the DPI in the 1E 47 03 reply
let deviceModel = "";
const setBrandSub = () => {
  const dpi = printer.info?.dpi;
  $("brandSub").textContent = !printer.connected
    ? t("Printer not connected")
    : dpi ? t("{name} · {mm} mm print head", { name: deviceModel, mm: dpi / 8 }) : deviceModel;
  $("statHead").textContent = printer.connected && dpi ? t("{mm} mm", { mm: dpi / 8 }) : "—";
};

printer.addEventListener("connected", (e) => {
  deviceModel = String(e.detail.name).replace(/\s*\(.*\)$/, "");
  $("devName").textContent = e.detail.name;
  setBrandSub();
  $("devInfo").textContent = t("Reading info…");
  $("pillText").textContent = e.detail.name;
  $("statChannel").textContent = e.detail.kind === "ble" ? "BLE" : "SPP";
  updateConnUi();
  printer.getInfo().then(showInfo).catch((err) => log(err.message, "warn"));
});
printer.addEventListener("disconnected", () => {
  $("devName").textContent = t("Not connected");
  $("devInfo").textContent = t("Connection lost");
  $("pillText").textContent = t("Connect printer");
  $("statBattery").textContent = "—";
  $("statChannel").textContent = "—";
  setBrandSub();
  updateConnUi();
});
printer.addEventListener("busy", updateConnUi);

function showInfo(i) {
  syncPrintUi();
  if (!i.firmware && !i.publicId) {
    const msg = t("The port is open but the printer doesn't respond. Make sure it's on and not connected to a phone; if that doesn't help, turn Bluetooth off and on and reconnect.");
    $("devInfo").textContent = t("No response from the printer");
    log(msg, "err");
    toast(msg, true);
    return;
  }
  const parts = [];
  if (i.firmware) parts.push(`FW ${i.firmware}`);
  if (i.hardware) parts.push(`HW ${i.hardware}`);
  if (i.serial) parts.push(`S/N ${i.serial}`);
  $("devInfo").textContent = parts.join(" · ") || t("Ready");
  const kind = printer.kind === "ble" ? "BLE" : "SPP";
  $("statChannel").textContent = kind;
  $("statBattery").textContent = i.voltageMv ? `${i.batteryPct} %` : "—";
  $("pillText").textContent = `${deviceModel || "YHK"} · ${kind}${i.voltageMv ? ` · ${i.batteryPct} %` : ""}`;
  setBrandSub();
  if (i.serial) $("device").title = `S/N ${i.serial}${i.publicId ? ` · ID ${i.publicId}` : ""}`;
  if (i.dpi && i.dpi !== PRINT_WIDTH) log(t("Printer reports width {w}px", { w: i.dpi }), "warn");
}

function updateConnUi() {
  const c = printer.connected, busy = printer.busy;
  $("dot").className = "dot" + (busy ? " busy" : c ? " on" : "");
  $("btnConnect").hidden = c;
  $("btnDisconnect").hidden = !c;
  $("btnPrint").disabled = !c || busy;
  document.querySelectorAll("[data-feed], #btnFeedMm, #btnWidthTest, #btnDpiTest, #btnWideTest").forEach((b) => (b.disabled = !c || busy));
  $("btnCancel").hidden = !busy;
  $("progress").hidden = !busy;
}

let connectFailed = false;
$("btnConnect").onclick = async () => {
  try {
    await printer.connect({ via: S().transport, acceptAll: S().acceptAll, reuse: !connectFailed });
    connectFailed = false;
  } catch (e) {
    // next attempt shows the chooser instead of reusing the previously granted port
    connectFailed = true;
    if (e.name === "NotFoundError") return log(t("Device selection cancelled"), "warn");
    log(e.message, "err");
    toast(e.message, true);
  }
};
$("btnDisconnect").onclick = () => printer.disconnect();

function printOpts(extra = {}) {
  return {
    densityLevel: S().densityLevel,
    densityValue: Number.isFinite(S().densityCustom) && S().densityCustom > 0 ? S().densityCustom : null,
    feedLines: S().feedLines,
    feedAfterMm: S().feedAfterOn ? S().feedAfterMm : 0,
    chunkSize: S().chunkSize,
    chunkDelayMs: S().chunkDelay,
    copies: S().copies,
    onProgress: (p) => ($("progressBar").style.width = `${Math.round(p * 100)}%`),
    ...extra,
  };
}

async function runPrint(bits, height, extra, width = PRINT_WIDTH) {
  abortCtrl = new AbortController();
  $("progressBar").style.width = "0%";
  try {
    await printer.print(bits, height, printOpts({ signal: abortCtrl.signal, ...extra }), width);
    toast(t("Sent to printer ✓"));
  } catch (e) {
    if (e.name === "AbortError") {
      log(t("Printing cancelled"), "warn");
    } else {
      log(e.message, "err");
      toast(e.message, true);
    }
  } finally {
    abortCtrl = null;
  }
}

function printableBits() {
  const r = renderLabel(doc(), S());
  let bits = maskOutside(r.bits, r.height), h = r.height;
  if (S().trim) {
    const t = trimRows(bits, r.width, h, S().trimMargin);
    bits = t.bits; h = t.height;
  }
  if (S().rotate) bits = rotate180(bits);
  return { bits, height: h };
}

$("btnPrint").onclick = () => {
  const { bits, height } = printableBits();
  if (!bits.some(Boolean)) return toast(t("The label is empty — nothing to print"), true);
  runPrint(bits, height);
};
$("btnCancel").onclick = () => abortCtrl?.abort();
const feed = (mm) => printer.feedMm(mm).catch((e) => { log(e.message, "err"); toast(e.message, true); });
document.querySelectorAll("[data-feed]").forEach((b) => (b.onclick = () => feed(Number(b.dataset.feed))));
$("btnFeedMm").onclick = () => {
  const mm = Number($("feedMm").value);
  if (mm > 0) feed(mm);
};
// tests print without trimming or rotation, one copy
$("btnWidthTest").onclick = () => { const t = widthTest(); runPrint(t.bits, t.height, { copies: 1 }); };
$("btnDpiTest").onclick = () => { const t = resolutionTest(); runPrint(t.bits, t.height, { copies: 1 }); };
// raster wider than the head: checks whether the printer can do 58 mm
$("btnWideTest").onclick = () => { const t = wideWidthTest(58); runPrint(t.bits, t.height, { copies: 1 }, t.width); };
$("btnPng").onclick = () => {
  const { bits, height } = printableBits();
  const c = document.createElement("canvas");
  paintBits(c, bits, PRINT_WIDTH, height, [0, 0, 0]);
  c.toBlob((b) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `label-${S().widthMm}x${S().heightMm}mm.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
};

// ---------------- settings ----------------

function bindSetting(id, key, { type = "number", after } = {}) {
  const el = $(id);
  const read = () => (type === "check" ? el.checked : type === "number" ? Number(el.value) : el.value);
  const write = () => (type === "check" ? (el.checked = S()[key]) : (el.value = S()[key]));
  write();
  el.addEventListener(type === "check" || el.tagName === "SELECT" ? "change" : "input", () => {
    const v = read();
    if (type === "number" && !Number.isFinite(v)) return;
    S()[key] = v;
    after?.();
    save();
    scheduleRender();
  });
  return write;
}

const fillDitherOptions = () => {
  const sel = $("dither"), cur = sel.value || S().dither;
  sel.innerHTML = Object.entries(DITHERS).map(([k, v]) => `<option value="${k}">${t(v)}</option>`).join("");
  sel.value = cur;
};
fillDitherOptions();

const syncSize = () => {
  if (document.activeElement !== $("widthMm")) $("widthMm").value = S().widthMm;
  if (document.activeElement !== $("heightMm")) $("heightMm").value = S().heightMm;
  $("widthPx").value = labelW();
  if (document.activeElement !== $("heightPx")) $("heightPx").value = heightPx();
  $("sizeBtnLabel").textContent = t("{w} × {h} mm", { w: S().widthMm, h: S().heightMm });
  const h = heightPx();
  const side = sideMarginMm();
  $("sizeHint").textContent =
    t("{w} × {h} mm = {pw} × {ph} px · 8 px/mm · raster {kb} KB", { w: S().widthMm, h: S().heightMm, pw: labelW(), ph: h, kb: (h * 48 / 1024).toFixed(1) }) +
    (side > 0 ? t(" · prints the central {p} mm; {s} mm on each side stay blank (print head limit)", { p: PRINT_MM, s: +side.toFixed(1) }) : "");
  document.querySelectorAll("#widthChips .chip").forEach((c) => c.classList.toggle("on", Number(c.dataset.v) === S().widthMm));
  document.querySelectorAll("#heightChips .chip").forEach((c) => c.classList.toggle("on", Number(c.dataset.v) === S().heightMm));
};

const sizeChanged = () => { syncSize(); save(); scheduleRender(); fitZoomIfNeeded(); };
const chips = (vals) => vals.map((v) => `<button class="chip" data-v="${v}">${v}</button>`).join("");
$("widthChips").innerHTML = chips(WIDTH_PRESETS);
$("heightChips").innerHTML = chips(HEIGHT_PRESETS);
$("widthChips").onclick = (e) => {
  const b = e.target.closest(".chip");
  if (b) { S().widthMm = Number(b.dataset.v); sizeChanged(); }
};
$("heightChips").onclick = (e) => {
  const b = e.target.closest(".chip");
  if (b) { S().heightMm = Number(b.dataset.v); sizeChanged(); }
};
$("widthMm").addEventListener("input", () => {
  const v = Number($("widthMm").value);
  if (v >= 5 && v <= MAX_WIDTH_MM) { S().widthMm = v; sizeChanged(); }
});
$("heightMm").addEventListener("input", () => {
  const v = Number($("heightMm").value);
  if (v >= 1) { S().heightMm = v; sizeChanged(); }
});
$("heightPx").addEventListener("change", () => {
  const px = Number($("heightPx").value);
  if (px >= 8) { S().heightMm = Math.round((px / PX_PER_MM) * 100) / 100; sizeChanged(); }
});

bindSetting("dither", "dither", { type: "text" });
bindSetting("threshold", "threshold", { after: () => ($("thresholdVal").textContent = S().threshold) });
$("thresholdVal").textContent = S().threshold;
bindSetting("dotGain", "dotGain", { after: () => ($("dotGainVal").textContent = `${S().dotGain}%`) });
bindSetting("sharpen", "sharpen", { after: () => ($("sharpenVal").textContent = `${S().sharpen}%`) });
$("dotGainVal").textContent = `${S().dotGain}%`;
$("sharpenVal").textContent = `${S().sharpen}%`;
bindSetting("previewGain", "previewGain", { type: "check" });
bindSetting("invert", "invert", { type: "check" });
bindSetting("trim", "trim", { type: "check" });
bindSetting("trimMargin", "trimMargin");
bindSetting("copies", "copies");
bindSetting("feedLines", "feedLines");
for (const k of ["snapHalfX", "snapHalfY", "snapThirdX", "snapThirdY", "snapQuarterX", "snapQuarterY"]) bindSetting(k, k, { type: "check" });
const syncFeedAfter = () => {
  $("feedAfterBox").hidden = !S().feedAfterOn;
  $("feedLines").disabled = S().feedAfterOn;
};
bindSetting("feedAfterOn", "feedAfterOn", { type: "check", after: syncFeedAfter });
bindSetting("feedAfterMm", "feedAfterMm");
syncFeedAfter();
bindSetting("rotate", "rotate", { type: "check" });
$("densityCustom").value = S().densityCustom ?? "";
$("densityCustom").addEventListener("input", () => {
  const v = Number($("densityCustom").value);
  S().densityCustom = $("densityCustom").value === "" || !Number.isFinite(v) ? null : v;
  syncPrintUi(); save();
});
$("densitySeg").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  S().densityLevel = Number(b.dataset.v);
  syncPrintUi(); save();
};
$("transportSeg").onclick = async (e) => {
  const b = e.target.closest("button");
  if (!b || b.dataset.v === S().transport) return;
  S().transport = b.dataset.v;
  if (printer.connected) await printer.disconnect();
  syncPrintUi(); save();
};

function syncPrintUi() {
  const profile = printer.info.profile ?? "public";
  const opts = { profile, densityLevel: S().densityLevel, densityValue: S().densityCustom };
  document.querySelectorAll("#densitySeg button").forEach((b) => b.classList.toggle("on", Number(b.dataset.v) === S().densityLevel && !S().densityCustom));
  document.querySelectorAll("#transportSeg button").forEach((b) => b.classList.toggle("on", b.dataset.v === S().transport));
  $("densityHint").textContent =
    t("Profile {name}: {levels} · now {v}", { name: DENSITY_PROFILES[profile].label, levels: DENSITY_PROFILES[profile].levels.join(" / "), v: densityByte(opts) }) +
    (printer.info.profile ? "" : t(" (confirmed after connecting)"));
  $("transportHint").textContent = S().transport === "ble"
    ? t("Main channel. The image is sent row by row: each row is a separate acknowledged packet (over BLE the printer prints only one row per packet).")
    : t("Fallback channel (like WalkPrint): the “cu.YHK-0926” port. On macOS it works only while the printer is connected in Settings → Bluetooth.");
  $("bleOpts").hidden = S().transport !== "ble";
  scheduleRender();
}
bindSetting("chunkSize", "chunkSize");
bindSetting("chunkDelay", "chunkDelay");
bindSetting("acceptAll", "acceptAll", { type: "check" });

// ---------------- view / zoom ----------------

const paper = $("paper"), out = $("out"), overlay = $("overlay");

function applyZoom() {
  const z = S().zoom, H = heightPx() * z;
  // The sheet is shown at the real label width. Narrower than 48 mm — a window onto the head center;
  // wider than 48 mm — the 48 mm print band plus hatched non-printable edges outside.
  paper.style.width = `${labelW() * z}px`;
  paper.style.height = `${H}px`;
  const side = sideMarginMm();
  paper.classList.toggle("wide", side > 0);
  paper.style.setProperty("--side", `${side * PX_PER_MM * z}px`);
  for (const c of [out, overlay]) {
    c.style.width = `${PRINT_WIDTH * z}px`;
    c.style.height = `${H}px`;
    c.style.left = `${-labelX() * z}px`;
  }
  $("zoomVal").textContent = `${Math.round(z * 100)}%`;
  drawOverlay();
}
const setZoom = (z) => { S().zoom = Math.min(6, Math.max(0.25, Math.round(z * 100) / 100)); applyZoom(); save(); };
$("zoomIn").onclick = () => setZoom(S().zoom * 1.25);
$("zoomOut").onclick = () => setZoom(S().zoom / 1.25);
$("zoomFit").onclick = () => fitZoom();
const shownWidthPx = () => Math.max(labelW(), Math.round(S().widthMm * PX_PER_MM));
// Zoom is computed for the widest label (58 mm) so the sheet doesn't jump when the width changes:
// only the sheet width changes, a millimeter stays the same size on screen.
// on narrow screens fit the label itself — every pixel matters more there than a constant scale
const narrowScreen = window.matchMedia("(max-width: 1023px)");
const refWidthPx = () => (narrowScreen.matches ? shownWidthPx() : Math.max(58 * PX_PER_MM, shownWidthPx()));
function fitZoom() {
  const st = $("stage");
  const zw = (st.clientWidth - 48) / refWidthPx();
  const zh = (st.clientHeight - 104) / heightPx();
  setZoom(Math.max(0.25, Math.min(zw, zh, 3)));
}
function fitZoomIfNeeded() {
  const st = $("stage");
  if (heightPx() * S().zoom > st.clientHeight - 104 || refWidthPx() * S().zoom > st.clientWidth - 48) fitZoom();
}

$("viewSeg").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  S().view = b.dataset.view;
  save();
  scheduleRender();
};

// ---------------- render ----------------

let raf = 0;
function scheduleRender() {
  if (raf) return;
  raf = requestAnimationFrame(() => { raf = 0; render(); });
}

// Fonts in fonts/ load lazily: if the one needed isn't loaded yet, load it and re-render
const fontsPending = new Set();
const CYR_PROBE = "\u042F"; // a Cyrillic glyph, so the Cyrillic subset of the font gets loaded too
function ensureFonts() {
  if (!document.fonts) return;
  for (const o of state.objects) {
    if (o.type !== "text") continue;
    const f = fontOf(o);
    if (fontsPending.has(f) || document.fonts.check(f, o.text || CYR_PROBE)) continue;
    fontsPending.add(f);
    document.fonts.load(f, o.text || CYR_PROBE).then(() => { fontsPending.delete(f); scheduleRender(); }).catch(() => fontsPending.delete(f));
  }
}

function render() {
  ensureFonts();
  const d = doc();
  document.querySelectorAll("#viewSeg button").forEach((b) => b.classList.toggle("on", b.dataset.view === S().view));
  lastRender = renderLabel(d, S());
  maskOutside(lastRender.bits, lastRender.height);
  if (S().view === "print") {
    if (S().previewGain) paintBitsDotGain(out, lastRender.bits, d.width, lastRender.height);
    else paintBits(out, lastRender.bits, d.width, lastRender.height);
  }
  else renderEditPreview(out, d);
  applyZoom();
  renderLayers();

  const rows = contentRows(lastRender.bits, d.width, lastRender.height);
  let h = lastRender.height;
  if (S().trim && rows) h = Math.min(lastRender.height, rows.bottom - rows.top + 1 + 2 * S().trimMargin);
  const mm = (h / PX_PER_MM).toFixed(1);
  $("printHint").textContent = rows
    ? t("{w} × {h} px ≈ {mm} mm", { w: 384, h, mm }) + (S().copies > 1 ? ` × ${S().copies}` : "")
    : t("Empty label");
  const dens = S().densityCustom ? t("density {v}", { v: S().densityCustom }) : t(["light", "medium", "dark"][S().densityLevel] ?? "");
  $("printSummary").textContent = rows ? t("{w} × {mm} mm · {dens} · {n} pcs", { w: S().widthMm, mm, dens, n: S().copies }) : t("Empty label");
}

/** Snap guides: groups 1/2, 1/3 · 2/3, 1/4 · 3/4 for width and height — each is toggled in the sidebar. */
const GUIDE_GROUPS = {
  half: { fr: [1 / 2], color: "229, 72, 77", dash: [] },        // red, solid
  third: { fr: [1 / 3, 2 / 3], color: "245, 158, 11", dash: [5, 4] }, // orange, dashed
  quarter: { fr: [1 / 4, 3 / 4], color: "139, 92, 246", dash: [1.5, 3] }, // purple, dotted
};
function guides() {
  const x0 = labelX(), w = labelW(), h = heightPx(), st = S();
  const pick = (axis) => [
    st[`snapHalf${axis}`] && "half", st[`snapThird${axis}`] && "third", st[`snapQuarter${axis}`] && "quarter",
  ].filter(Boolean).flatMap((g) => GUIDE_GROUPS[g].fr.map((f) => ({ f, g })));
  return {
    x: pick("X").map((l) => ({ ...l, at: x0 + w * l.f })),
    y: pick("Y").map((l) => ({ ...l, at: h * l.f })),
  };
}

function drawOverlay() {
  const z = S().zoom, dpr = window.devicePixelRatio || 1;
  const W = PRINT_WIDTH, H = heightPx();
  overlay.width = Math.round(W * z * dpr);
  overlay.height = Math.round(H * z * dpr);
  const ctx = overlay.getContext("2d");
  ctx.setTransform(z * dpr, 0, 0, z * dpr, 0, 0);
  const px = 1 / z;

  // trim zone
  if (S().trim && lastRender) {
    const r = contentRows(lastRender.bits, W, lastRender.height);
    if (r) {
      const top = Math.max(0, r.top - S().trimMargin), bottom = Math.min(H, r.bottom + 1 + S().trimMargin);
      ctx.fillStyle = "rgba(229, 72, 77, .10)";
      ctx.fillRect(0, 0, W, top);
      ctx.fillRect(0, bottom, W, H - bottom);
      ctx.strokeStyle = "rgba(229, 72, 77, .7)";
      ctx.setLineDash([6 * px, 4 * px]);
      ctx.lineWidth = px;
      ctx.beginPath();
      ctx.moveTo(0, top); ctx.lineTo(W, top);
      ctx.moveTo(0, bottom); ctx.lineTo(W, bottom);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // outlines of all objects in editor view
  if (S().view === "edit") {
    ctx.strokeStyle = "rgba(59, 91, 253, .35)";
    ctx.lineWidth = px;
    ctx.setLineDash([3 * px, 3 * px]);
    for (const o of state.objects) {
      const b = boundsOf(o);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    ctx.setLineDash([]);
  }

  // guides 1/3 · 1/2 · 2/3 — visible while dragging, the active one highlighted
  if (drag?.mode === "move") {
    const g = guides();
    const line = (l, vertical) => {
      const active = vertical ? drag.snapX === l : drag.snapY === l;
      const grp = GUIDE_GROUPS[l.g];
      ctx.strokeStyle = `rgba(${grp.color}, ${active ? 1 : 0.5})`;
      ctx.lineWidth = (active ? 2 : 1) * px;
      ctx.setLineDash(grp.dash.map((d) => d * px));
      ctx.beginPath();
      if (vertical) { ctx.moveTo(l.at, 0); ctx.lineTo(l.at, H); }
      else { ctx.moveTo(labelX(), l.at); ctx.lineTo(labelX() + labelW(), l.at); }
      ctx.stroke();
    };
    g.x.forEach((l) => line(l, true));
    g.y.forEach((l) => line(l, false));
    ctx.setLineDash([]);
  }

  const o = selected();
  if (o) {
    const b = boundsOf(o);
    ctx.strokeStyle = "#3b5bfd";
    ctx.lineWidth = 2 * px;
    ctx.strokeRect(b.x - px, b.y - px, b.w + 2 * px, b.h + 2 * px);
    const hs = 10 * px;
    ctx.fillStyle = "#fff";
    ctx.fillRect(b.x + b.w - hs / 2, b.y + b.h - hs / 2, hs, hs);
    ctx.strokeRect(b.x + b.w - hs / 2, b.y + b.h - hs / 2, hs, hs);
  }
}

// ---------------- layers ----------------

const ICON = { text: "T", qr: "▣", image: "🖼", rect: "▢", barcode: "║", vector: "◆" };
function layerName(o) {
  if (o.type === "text") return o.text.split("\n")[0] || t("Text");
  if (o.type === "qr") return `QR: ${o.data}`;
  if (o.type === "image") return o.name || t("Picture");
  if (o.type === "barcode") return `${BARCODE_FORMATS[o.format]?.label ?? o.format}: ${o.data}`;
  if (o.type === "vector") return o.name || "SVG";
  return t("Frame {style} {w}×{h}", { style: t(FRAME_STYLES[o.style ?? "solid"]).toLowerCase(), w: o.w, h: o.h });
}
function renderLayers() {
  const ul = $("layers");
  if (!state.objects.length) {
    ul.innerHTML = `<li class="empty">${t("Empty — add an element")}</li>`;
    return;
  }
  ul.innerHTML = [...state.objects].reverse().map((o) =>
    `<li data-id="${o.id}" class="${o.id === selectedId ? "on" : ""}"><span class="ico">${ICON[o.type]}</span><span class="name"></span></li>`).join("");
  ul.querySelectorAll("li").forEach((li) => {
    const o = state.objects.find((x) => x.id === Number(li.dataset.id));
    li.querySelector(".name").textContent = layerName(o);
  });
}
$("layers").onclick = (e) => {
  const li = e.target.closest("li[data-id]");
  if (li) select(Number(li.dataset.id));
};

// ---------------- adding objects ----------------

function addObject(o) {
  o.id = nextId++;
  state.objects.push(o);
  select(o.id);
  save();
  scheduleRender();
}

function freeY(h) {
  // place a new object below the existing ones if it fits
  const bottom = Math.max(0, ...state.objects.filter((o) => o.type !== "rect").map((o) => { const b = boundsOf(o); return b.y + b.h; }));
  return bottom + h + 8 <= heightPx() ? bottom + 8 : Math.max(0, Math.round((heightPx() - h) / 2));
}

document.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => {
  const kind = b.dataset.add;
  if (kind === "text") {
    const o = { type: "text", x: 0, y: 0, text: t("Text"), fontSize: 32, fontFamily: FONTS[0][0], bold: true, italic: false, align: "center", inverse: false, lineHeight: 1.15 };
    const bb = boundsOf(o);
    o.x = labelCenterX(bb.w);
    o.y = freeY(bb.h);
    addObject(o);
    setTimeout(() => document.querySelector("#propsBody textarea")?.select(), 0);
  } else if (kind === "qr") {
    const size = Math.max(21, Math.min(200, labelW() - 16, heightPx() - 16));
    addObject({ type: "qr", x: labelCenterX(size), y: freeY(size), size, data: "https://example.com", ecc: "M" });
  } else if (kind === "rect") {
    addObject({ type: "rect", x: labelX() + 4, y: 4, w: labelW() - 8, h: heightPx() - 8, stroke: 3, radius: 0, style: "solid", fill: false });
  } else if (kind === "image") {
    $("fileInput").click();
  } else if (kind === "vector") {
    $("svgInput").click();
  } else if (kind === "barcode") {
    const o = { type: "barcode", x: 0, y: 0, format: "CODE128", data: BARCODE_FORMATS.CODE128.sample, module: 2, barHeight: 60, showText: true, fontSize: 18 };
    const bb = boundsOf(o);
    o.x = labelCenterX(bb.w);
    o.y = freeY(bb.h);
    addObject(o);
  }
}));

$("svgInput").onchange = (e) => {
  const f = e.target.files?.[0];
  if (f) addImageFile(f);
  e.target.value = "";
};
$("fileInput").onchange = (e) => {
  const f = e.target.files?.[0];
  if (f) addImageFile(f);
  e.target.value = "";
};

async function addSvgFile(file) {
  const text = await file.text();
  const src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(text)));
  const img = imageFor(src);
  try { await img.decode(); } catch { return toast(t("Couldn't read the SVG"), true); }
  // size: from width/height, otherwise from the viewBox
  let w0 = img.naturalWidth, h0 = img.naturalHeight;
  const vb = text.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (vb && (!w0 || !h0 || (w0 === 150 && h0 === 150))) { w0 = parseFloat(vb[1]); h0 = parseFloat(vb[2]); }
  if (!w0 || !h0) { w0 = 100; h0 = 100; }
  const H = heightPx();
  const fit = Math.min(labelW() / w0, H / h0);
  const w = Math.round(w0 * fit), h = Math.round(h0 * fit);
  addObject({ type: "vector", name: file.name, src, x: labelCenterX(w), y: Math.round((H - h) / 2), w, h, aspect: w0 / h0, dither: false });
}

async function addImageFile(file) {
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name ?? "")) return addSvgFile(file);
  if (!file.type.startsWith("image/")) return toast(t("This is not an image"), true);
  const src = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = new Image();
  img.src = src;
  await img.decode();
  // downscale so the layout fits in localStorage
  const max = 768;
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const cx = c.getContext("2d");
  cx.fillStyle = "#fff";
  cx.fillRect(0, 0, c.width, c.height);
  cx.drawImage(img, 0, 0, c.width, c.height);
  const small = c.toDataURL("image/jpeg", 0.9);
  await imageFor(small).decode().catch(() => {});

  const H = heightPx();
  const fit = Math.min(labelW() / c.width, H / c.height);
  const w = Math.round(c.width * fit), h = Math.round(c.height * fit);
  addObject({
    type: "image", name: file.name, src: small,
    x: labelCenterX(w), y: Math.round((H - h) / 2), w, h,
    aspect: c.width / c.height, brightness: 100, contrast: 100,
  });
}

// drag & drop / paste
const ws = $("workspace");
ws.addEventListener("dragover", (e) => { e.preventDefault(); $("dropzone").classList.add("on"); });
ws.addEventListener("dragleave", (e) => { if (!ws.contains(e.relatedTarget)) $("dropzone").classList.remove("on"); });
ws.addEventListener("drop", (e) => {
  e.preventDefault();
  $("dropzone").classList.remove("on");
  const f = [...(e.dataTransfer?.files ?? [])].find((x) => x.type.startsWith("image/"));
  if (f) addImageFile(f);
});
window.addEventListener("paste", (e) => {
  if (isTyping()) return;
  const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
  if (item) { e.preventDefault(); addImageFile(item.getAsFile()); }
  else {
    const text = e.clipboardData?.getData("text");
    if (text) {
      const o = { type: "text", x: 0, y: 0, text, fontSize: 28, fontFamily: FONTS[0][0], bold: false, italic: false, align: "left", inverse: false, lineHeight: 1.15 };
      o.x = Math.max(labelX(), labelCenterX(boundsOf(o).w));
      o.y = freeY(boundsOf(o).h);
      addObject(o);
    }
  }
});

// ---------------- selection and dragging ----------------

let drag = null;

function toLabel(e) {
  const r = overlay.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * PRINT_WIDTH, y: ((e.clientY - r.top) / r.height) * heightPx() };
}

function hitHandle(p) {
  const o = selected();
  if (!o) return false;
  const b = boundsOf(o), tol = 9 / S().zoom;
  return Math.abs(p.x - (b.x + b.w)) < tol && Math.abs(p.y - (b.y + b.h)) < tol;
}

function hitObject(p) {
  for (let i = state.objects.length - 1; i >= 0; i--) {
    const o = state.objects[i], b = boundsOf(o);
    if (o.type === "rect" && !o.fill) {
      // a frame is grabbed by its edge only, so it doesn't block selecting objects inside
      const t = Math.max(6 / S().zoom, o.stroke);
      const inside = p.x >= b.x + t && p.x <= b.x + b.w - t && p.y >= b.y + t && p.y <= b.y + b.h - t;
      if (inside) continue;
    }
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return o;
  }
  return null;
}

overlay.addEventListener("pointerdown", (e) => {
  const p = toLabel(e);
  overlay.setPointerCapture(e.pointerId);
  if (hitHandle(p)) {
    const o = selected();
    drag = { mode: "resize", o, start: p, orig: { ...o, ...boundsOf(o) } };
    return;
  }
  const o = hitObject(p);
  if (o) {
    if (o.id !== selectedId) select(o.id);
    drag = { mode: "move", o, start: p, orig: { x: o.x, y: o.y } };
  } else {
    select(null);
  }
});

overlay.addEventListener("pointermove", (e) => {
  const p = toLabel(e);
  if (!drag) {
    overlay.style.cursor = hitHandle(p) ? "nwse-resize" : hitObject(p) ? "move" : "default";
    return;
  }
  const { o, orig, start } = drag;
  const dx = p.x - start.x, dy = p.y - start.y;
  if (drag.mode === "move") {
    o.x = Math.round(orig.x + dx);
    o.y = Math.round(orig.y + dy);
    // snap the object's center to the enabled guides on both axes (Alt disables snapping)
    const b = boundsOf(o);
    const tol = 6 / S().zoom;
    const g = guides();
    const near = (v, lines) => lines.reduce((best, l) => (Math.abs(v - l.at) < tol && (!best || Math.abs(v - l.at) < Math.abs(v - best.at)) ? l : best), null);
    drag.snapX = e.altKey ? null : near(o.x + b.w / 2, g.x);
    drag.snapY = e.altKey ? null : near(o.y + b.h / 2, g.y);
    if (drag.snapX) o.x = Math.round(drag.snapX.at - b.w / 2);
    if (drag.snapY) o.y = Math.round(drag.snapY.at - b.h / 2);
  } else {
    const nw = Math.max(8, orig.w + dx), nh = Math.max(8, orig.h + dy);
    if (o.type === "text") o.fontSize = Math.round(Math.min(400, Math.max(6, orig.fontSize * (nw / orig.w))));
    else if (o.type === "qr") o.size = Math.round(Math.max(21, orig.size + Math.max(dx, dy)));
    else if (o.type === "barcode") {
      // module width is a whole number of dots; bar height is free
      o.module = Math.max(1, Math.min(8, Math.round(orig.module * (nw / orig.w))));
      o.barHeight = Math.max(10, Math.round(orig.barHeight + dy));
    } else if (o.type === "image" || o.type === "vector") {
      const k = e.shiftKey ? null : o.aspect || orig.w / orig.h;
      o.w = Math.round(nw);
      o.h = Math.round(k ? nw / k : nh);
    } else { o.w = Math.round(nw); o.h = Math.round(nh); }
  }
  syncPropsValues();
  scheduleRender();
});

const endDrag = () => {
  if (drag) { drag = null; save(); scheduleRender(); }
};
overlay.addEventListener("pointerup", endDrag);
overlay.addEventListener("pointercancel", endDrag);

const isTyping = () => ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);

window.addEventListener("keydown", (e) => {
  if (isTyping()) return;
  const o = selected();
  if (!o) return;
  const step = e.shiftKey ? 10 : 1;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) {
    e.preventDefault();
    o.x += moves[e.key][0];
    o.y += moves[e.key][1];
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    removeSelected();
    return;
  } else if (e.key === "Escape") {
    select(null);
    return;
  } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
    e.preventDefault();
    duplicateSelected();
    return;
  } else return;
  syncPropsValues();
  save();
  scheduleRender();
});

function select(id) {
  selectedId = id;
  buildProps();
  scheduleRender();
}

function removeSelected() {
  state.objects = state.objects.filter((o) => o.id !== selectedId);
  select(null);
  save();
}

function duplicateSelected() {
  const o = selected();
  if (!o) return;
  const c = structuredClone(o);
  c.x += 10; c.y += 10;
  addObject(c);
}

function moveLayer(dir) {
  const i = state.objects.findIndex((o) => o.id === selectedId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.objects.length) return;
  [state.objects[i], state.objects[j]] = [state.objects[j], state.objects[i]];
  save();
  scheduleRender();
}

// ---------------- properties panel ----------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = (prop, label, min, max, step = 1) =>
  `<label>${t(label)}<input type="number" data-prop="${prop}" min="${min}" max="${max}" step="${step}" /></label>`;
const range = (prop, label, min, max) =>
  `<label>${t(label)} <output data-out="${prop}"></output><input type="range" data-prop="${prop}" min="${min}" max="${max}" /></label>`;
const check = (prop, label) => `<label class="check"><input type="checkbox" data-prop="${prop}" /> ${t(label)}</label>`;

function buildProps() {
  const o = selected();
  const body = $("propsBody");
  if (!o) {
    body.innerHTML = `<p class="hint">${t("Select an element on the canvas or add a new one on the left.<br/>Arrows move it, Shift ×10, ⌫ deletes, ⌘D duplicates.")}</p>`;
    return;
  }
  let html = "";
  if (o.type === "text") {
    html += `<label>${t("Text")}<textarea data-prop="text" rows="3"></textarea></label>
      <label>${t("Font")}<select data-prop="fontFamily">${FONTS.map(([v, n]) => `<option value="${esc(v)}" style="font-family:${esc(v)}">${t(n)}</option>`).join("")}</select></label>
      <div class="grid2">${num("fontSize", "Size, px", 6, 400)}${num("lineHeight", "Line spacing", 0.8, 3, 0.05)}</div>
      <div class="align" data-align>
        <button data-v="left">${t("⟸ Left")}</button><button data-v="center">${t("Center")}</button><button data-v="right">${t("Right ⟹")}</button>
      </div>
      ${check("bold", "Bold")}${check("italic", "Italic")}${check("inverse", "White on black")}`;
  } else if (o.type === "qr") {
    html += `<label>${t("Content")}<textarea data-prop="data" rows="3"></textarea></label>
      <div class="grid2">${num("size", "Size, px", 21, 384)}
      <label>${t("Error correction")}<select data-prop="ecc"><option value="L">L · 7%</option><option value="M">M · 15%</option><option value="Q">Q · 25%</option><option value="H">H · 30%</option></select></label></div>`;
  } else if (o.type === "image") {
    html += `<div class="grid2">${num("w", "Width, px", 8, 2000)}${num("h", "Height, px", 8, 4000)}</div>
      ${range("brightness", "Brightness", 20, 250)}${range("contrast", "Contrast", 20, 300)}
      <div class="propsActions"><button class="btn small" data-act="fitw">${t("Fit width")}</button><button class="btn small" data-act="fith">${t("Fit height")}</button></div>`;
  } else if (o.type === "barcode") {
    html += `<label>${t("Standard")}<select data-prop="format">${Object.entries(BARCODE_FORMATS).map(([k, f]) => `<option value="${k}">${t(f.label)}</option>`).join("")}</select></label>
      <label>${t("Data")}<input type="text" data-prop="data" spellcheck="false" /></label>
      <p class="hint" id="barcodeInfo"></p>
      <div class="grid2">${num("module", "Module, dots", 1, 8)}${num("barHeight", "Bar height, px", 10, 2000)}</div>
      ${check("showText", "Text under the code")}
      ${num("fontSize", "Text size, px", 8, 60)}
      <div class="propsActions"><button class="btn small" data-act="sample">${t("Sample data")}</button></div>`;
  } else if (o.type === "vector") {
    html += `<div class="grid2">${num("w", "Width, px", 8, 4000)}${num("h", "Height, px", 8, 8000)}</div>
      ${check("dither", "Dithering (for SVGs with gradients)")}
      <p class="hint">${t("Without dithering an SVG prints with a hard threshold, like text. Shadows and gradients look better dithered.")}</p>
      <div class="propsActions"><button class="btn small" data-act="fitw">${t("Fit width")}</button><button class="btn small" data-act="fith">${t("Fit height")}</button></div>`;
  } else if (o.type === "rect") {
    html += `<div class="grid2">${num("w", "Width, px", 2, 384)}${num("h", "Height, px", 2, 8000)}</div>
      <label>${t("Style")}<select data-prop="style">${Object.entries(FRAME_STYLES).map(([k, v]) => `<option value="${k}">${t(v)}</option>`).join("")}</select></label>
      <div class="grid2">${num("stroke", "Thickness, px", 1, 50)}${num("radius", "Corner radius, px", 0, 200)}</div>
      ${check("fill", "Fill")}
      <div class="propsActions"><button class="btn small" data-act="fullframe">${t("Full label")}</button></div>`;
  }
  html += `<div class="grid2">${num("x", "X, px", -2000, 2000)}${num("y", "Y, px", -2000, 8000)}</div>
    <div class="propsActions">
      <button class="btn small" data-act="centerx">${t("⇔ Center")}</button>
      <button class="btn small" data-act="centery">${t("⇕ Center")}</button>
    </div>
    <div class="propsActions">
      <button class="btn small" data-act="up">${t("↑ Up")}</button>
      <button class="btn small" data-act="down">${t("↓ Down")}</button>
      <button class="btn small" data-act="dup">${t("Duplicate")}</button>
      <button class="btn small danger" data-act="del">${t("Delete")}</button>
    </div>`;
  body.innerHTML = html;
  syncPropsValues();

  body.querySelectorAll("[data-prop]").forEach((el) => {
    const evt = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evt, () => {
      const p = el.dataset.prop;
      let v = el.type === "checkbox" ? el.checked : el.type === "number" || el.type === "range" ? Number(el.value) : el.value;
      if (typeof v === "number" && !Number.isFinite(v)) return;
      const cur = selected();
      if ((cur.type === "image" || cur.type === "vector") && (p === "w" || p === "h") && cur.aspect) {
        if (p === "w") cur.h = Math.round(v / cur.aspect); else cur.w = Math.round(v * cur.aspect);
      }
      cur[p] = v;
      // standard changed: if the data doesn't fit it, put in the sample
      if (cur.type === "barcode" && p === "format" && barcodeRender(cur).error) cur.data = BARCODE_FORMATS[v].sample;
      syncPropsValues(el);
      save();
      scheduleRender();
    });
  });
  body.querySelector("[data-align]")?.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const cur = selected();
    cur.align = b.dataset.v;
    const bb = boundsOf(cur);
    // also align the block on the label
    cur.x = cur.align === "left" ? labelX() + 8 : cur.align === "right" ? labelX() + labelW() - bb.w - 8 : labelCenterX(bb.w);
    syncPropsValues(); save(); scheduleRender();
  });
  body.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => {
    const cur = selected(), bb = boundsOf(cur), H = heightPx();
    switch (b.dataset.act) {
      case "centerx": cur.x = labelCenterX(bb.w); break;
      case "centery": cur.y = Math.round((H - bb.h) / 2); break;
      case "up": return moveLayer(1);
      case "down": return moveLayer(-1);
      case "dup": return duplicateSelected();
      case "del": return removeSelected();
      case "fitw": cur.w = labelW(); cur.h = Math.round(labelW() / cur.aspect); cur.x = labelX(); break;
      case "fith": cur.h = H; cur.w = Math.round(H * cur.aspect); cur.y = 0; cur.x = labelCenterX(cur.w); break;
      case "sample": cur.data = BARCODE_FORMATS[cur.format].sample; break;
      case "fullframe": Object.assign(cur, { x: labelX(), y: 0, w: labelW(), h: H }); break;
    }
    syncPropsValues(); save(); scheduleRender();
  }));
}

function syncPropsValues(except) {
  const o = selected();
  if (!o) return;
  $("propsBody").querySelectorAll("[data-prop]").forEach((el) => {
    if (el === except) return;
    const v = o[el.dataset.prop];
    if (el.type === "checkbox") el.checked = !!v;
    else if (document.activeElement !== el || el.type === "range") el.value = v ?? "";
  });
  $("propsBody").querySelectorAll("[data-out]").forEach((el) => (el.textContent = `${o[el.dataset.out]}%`));
  const bi = $("barcodeInfo");
  if (bi && o.type === "barcode") {
    const r = barcodeRender(o), f = BARCODE_FORMATS[o.format];
    if (r.error) { bi.textContent = r.error; bi.style.color = "var(--err)"; }
    else {
      const mm = (r.canvas.width / PX_PER_MM).toFixed(1), tooWide = r.canvas.width > labelW();
      bi.textContent = t("{hint}. Width with quiet zones: {mm} mm{wide}.", { hint: t(f.hint), mm, wide: tooWide ? t(" — wider than the label, reduce the module") : "" });
      bi.style.color = tooWide ? "var(--warn)" : "";
    }
  }
  $("propsBody").querySelectorAll("[data-align] button").forEach((b) => b.classList.toggle("on", b.dataset.v === o.align));
}

// ---------------- log / toasts ----------------

function log(msg, level = "info") {
  const li = document.createElement("li");
  li.className = level;
  li.textContent = `${new Date().toLocaleTimeString()} ${msg}`;
  const ol = $("log");
  ol.prepend(li);
  while (ol.children.length > 200) ol.lastChild.remove();
}

let toastTimer;
function toast(msg, err = false) {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast on${err ? " err" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 2600);
}

// ---------------- language switch ----------------
// i18n.js translates static markup; here we rebuild everything that JS generates.
window.addEventListener("langchange", () => {
  fillDitherOptions();
  buildProps();
  renderLayers();
  syncSize();
  syncPrintUi();
  if (printer.connected) showInfo(printer.info);
  else {
    $("devName").textContent = t("Not connected");
    $("pillText").textContent = t("Connect printer");
  }
  setBrandSub();
  scheduleRender();
});

// ---------------- startup ----------------

if (!YhkPrinter.serialSupported && !YhkPrinter.bleSupported) {
  $("devInfo").textContent = t("Requires Chrome or Edge (Web Serial / Web Bluetooth)");
  $("btnConnect").disabled = true;
} else if (!YhkPrinter.bleSupported && S().transport === "ble") {
  S().transport = "serial";
} else if (!YhkPrinter.serialSupported && S().transport === "serial") {
  S().transport = "ble";
}
syncPrintUi();
syncSize();
buildProps();
updateConnUi();
// images from the saved layout load asynchronously — re-render when ready
state.objects.filter((o) => o.type === "image").forEach((o) => imageFor(o.src).decode().then(scheduleRender).catch(() => {}));
document.fonts?.ready.then(scheduleRender);
let resizeTimer;
window.addEventListener("resize", () => {
  drawOverlay();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitZoomIfNeeded, 120);
});
render();
requestAnimationFrame(fitZoomIfNeeded);
log(t("Ready. Connect the YHK-0926 printer."));

// PWA offline cache. Not registered on localhost (gets in the way of development) unless opened with ?sw=1.
if ("serviceWorker" in navigator) {
  const dev = ["localhost", "127.0.0.1"].includes(location.hostname) && !new URLSearchParams(location.search).has("sw");
  if (!dev) navigator.serviceWorker.register("sw.js").catch((e) => log(`Service worker: ${e.message}`, "warn"));
}

// for debugging from the console
window.studio = { state, printer, render: scheduleRender };
