import { t } from "./i18n.js";
// UI shell: panels, popovers, bottom sheets, tabs, log.
// The same markup works at every width — CSS decides whether it is a column, a popover or a bottom sheet.
//   ≥ 1280      — three columns; "size"/"printer" are popovers; the log expands below the canvas
//   1024–1279   — the left column is a rail; "add" expands it over the canvas
//   < 1024      — everything except the canvas is a bottom sheet with a backdrop

const $ = (id) => document.getElementById(id);
const mqMobile = window.matchMedia("(max-width: 1023px)");
const mqRail = window.matchMedia("(min-width: 1024px) and (max-width: 1279px)");

const sheets = Object.fromEntries([...document.querySelectorAll("[data-sheet]")].map((el) => [el.dataset.sheet, el]));
const backdrop = $("backdrop");
const TAB_TITLES = { element: "Element", image: "Image", print: "Print" };

let current = null; // currently open sheet/popover

/** What counts as an overlay at this width (needs a backdrop and closes on an outside click). */
function isOverlay(name) {
  if (mqMobile.matches) return true;
  if (name === "size" || name === "printer") return true;
  if (name === "add") return mqRail.matches;
  return false; // panel and log are part of the desktop layout
}

function setExpanded(name, on) {
  document.querySelectorAll(`[data-open="${name}"]`).forEach((b) => b.setAttribute("aria-expanded", on ? "true" : "false"));
}

export function setTab(tab) {
  document.querySelectorAll("#rightPanel [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  document.querySelectorAll("#rightPanel [data-pane]").forEach((p) => (p.hidden = p.dataset.pane !== tab));
  $("rightTitle").textContent = t(TAB_TITLES[tab] ?? "");
  try { localStorage.setItem("yhk-tab", tab); } catch { /* ignore */ }
}

export function open(name, { focus, tab } = {}) {
  if (tab) setTab(tab);
  const el = sheets[name];
  if (!el) return;
  if (!isOverlay(name)) {
    // on desktop the panel is already visible; the log expands in place
    if (name === "log") toggleLog(true);
    if (focus) $(focus)?.scrollIntoView({ block: "start", behavior: "smooth" });
    return;
  }
  if (current && current !== name) close();
  el.classList.add("open");
  current = name;
  setExpanded(name, true);
  backdrop.hidden = false;
  if (focus) requestAnimationFrame(() => $(focus)?.scrollIntoView({ block: "start" }));
}

export function close() {
  if (!current) return;
  sheets[current]?.classList.remove("open");
  setExpanded(current, false);
  current = null;
  backdrop.hidden = true;
}

function toggleLog(force) {
  const panel = $("logPanel");
  const on = force ?? !panel.classList.contains("open");
  panel.classList.toggle("open", on);
  $("logBar").setAttribute("aria-expanded", String(on));
}

// ---------- click delegation ----------
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-open], [data-close], [data-tab], [data-tab-go], [data-proxy], [data-toggle]");
  if (!el) return;
  if (el.hasAttribute("data-close")) return close();
  if (el.dataset.toggle === "log") {
    if (mqMobile.matches) return open("log");
    return toggleLog();
  }
  if (el.dataset.proxy) {
    close();
    $(el.dataset.proxy)?.click();
    return;
  }
  if (el.dataset.tab) return setTab(el.dataset.tab);
  if (el.dataset.open) {
    const name = el.dataset.open;
    // a second click on the button of an open popover closes it
    if (current === name && !el.closest(".sheet")) return close();
    open(name, { focus: el.dataset.focus, tab: el.dataset.tabGo });
    return;
  }
  if (el.dataset.tabGo) setTab(el.dataset.tabGo);
});

backdrop.addEventListener("click", close);

// ---------- swipe down to dismiss a bottom sheet (phones / portrait tablets) ----------
// Drag by the handle/title: the sheet follows the finger; release past 80 px or with a quick
// flick closes it, otherwise it springs back. Works with touch and mouse (pointer events).
for (const el of Object.values(sheets)) {
  const head = el.querySelector(".sheethead");
  if (!head) continue;
  let startY = null, dy = 0, t0 = 0;
  head.addEventListener("pointerdown", (e) => {
    if (!mqMobile.matches || !el.classList.contains("open") || e.target.closest("button")) return;
    startY = e.clientY; dy = 0; t0 = performance.now();
    head.setPointerCapture(e.pointerId);
    el.style.transition = "none";
  });
  head.addEventListener("pointermove", (e) => {
    if (startY === null) return;
    dy = Math.max(0, e.clientY - startY);
    el.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY === null) return;
    const speed = dy / Math.max(1, performance.now() - t0); // px per ms
    startY = null;
    el.style.transition = "";
    if (dy > 80 || (dy > 20 && speed > 0.5)) {
      el.style.transform = "translateY(105%)"; // animate on from where the finger left it
      close();
      setTimeout(() => (el.style.transform = ""), 300);
    } else {
      el.style.transform = ""; // spring back
    }
  };
  head.addEventListener("pointerup", end);
  head.addEventListener("pointercancel", end);
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

// close overlays when the layout changes so they don't get stuck
for (const mq of [mqMobile, mqRail]) mq.addEventListener("change", close);

// on phones, show the canvas after adding an element or picking a layer
document.addEventListener("click", (e) => {
  if (!mqMobile.matches && !mqRail.matches) return;
  if (e.target.closest("[data-add]:not([data-add=image]):not([data-add=vector]), #layers li[data-id]")) close();
});
for (const id of ["fileInput", "svgInput"]) $(id)?.addEventListener("change", close);

// ---------- log: last line, filters, copy ----------
const logEl = $("log");
new MutationObserver(() => {
  const li = logEl.firstElementChild;
  const last = $("logLast");
  last.textContent = li?.textContent ?? "";
  last.className = `loglast ${li?.className ?? ""}`;
}).observe(logEl, { childList: true });

document.querySelectorAll("[data-logfilter]").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("[data-logfilter]").forEach((x) => x.classList.toggle("on", x === b));
  logEl.dataset.filter = b.dataset.logfilter;
}));
$("btnLogCopy").addEventListener("click", async () => {
  const text = [...logEl.children].map((li) => li.textContent).reverse().join("\n");
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
});
$("btnLogClear").addEventListener("click", () => { logEl.textContent = ""; });

// ---------- the bottom-bar Print button mirrors the main one ----------
const btnPrint = $("btnPrint"), fab = $("fabPrint"), fabLabel = fab.querySelector("span");
const syncFab = () => {
  const busy = !$("progress").hidden;
  fab.disabled = busy;
  fabLabel.textContent = busy ? `${parseInt($("progressBar").style.width, 10) || 0} %` : t("Print");
};
new MutationObserver(syncFab).observe(btnPrint, { attributes: true, attributeFilter: ["disabled"] });
new MutationObserver(syncFab).observe($("progressBar"), { attributes: true, attributeFilter: ["style"] });
new MutationObserver(syncFab).observe($("progress"), { attributes: true, attributeFilter: ["hidden"] });
// with no printer connected, the bottom-bar Print button opens the printer popover
fab.addEventListener("click", (e) => {
  if (!$("btnConnect").hidden) { e.stopPropagation(); open("printer"); }
}, true);
syncFab();

window.addEventListener("langchange", () => {
  const cur = document.querySelector('#rightPanel [data-tab][aria-selected="true"]')?.dataset.tab ?? "element";
  $("rightTitle").textContent = t(TAB_TITLES[cur]);
  syncFab();
});

// initial tab
let startTab = "element";
try { startTab = localStorage.getItem("yhk-tab") || startTab; } catch { /* ignore */ }
setTab(TAB_TITLES[startTab] ? startTab : "element");
