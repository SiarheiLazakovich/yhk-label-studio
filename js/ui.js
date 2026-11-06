import { t } from "./i18n.js";
// Каркас интерфейса: панели, всплывающие окна, шторки, вкладки, журнал.
// Одна и та же разметка работает на всех ширинах — CSS решает, колонка это, окно или нижняя шторка.
//   ≥ 1280      — три колонки; «size»/«printer» — всплывающие окна; журнал раскрывается под холстом
//   1024–1279   — левая колонка — рейка; «add» раскрывает её поверх холста
//   < 1024      — всё, кроме холста, — нижние шторки с затемнением

const $ = (id) => document.getElementById(id);
const mqMobile = window.matchMedia("(max-width: 1023px)");
const mqRail = window.matchMedia("(min-width: 1024px) and (max-width: 1279px)");

const sheets = Object.fromEntries([...document.querySelectorAll("[data-sheet]")].map((el) => [el.dataset.sheet, el]));
const backdrop = $("backdrop");
const TAB_TITLES = { element: "Элемент", image: "Изображение", print: "Печать" };

let current = null; // открытая шторка/окно

/** Что для данной ширины считается «оверлеем» (нужен фон и закрытие по клику мимо). */
function isOverlay(name) {
  if (mqMobile.matches) return true;
  if (name === "size" || name === "printer") return true;
  if (name === "add") return mqRail.matches;
  return false; // panel и log на десктопе — часть раскладки
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
    // на десктопе панель уже видна; журнал раскрывается на месте
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

// ---------- делегирование кликов ----------
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
    // повторный клик по кнопке открытого окна — закрыть
    if (current === name && !el.closest(".sheet")) return close();
    open(name, { focus: el.dataset.focus, tab: el.dataset.tabGo });
    return;
  }
  if (el.dataset.tabGo) setTab(el.dataset.tabGo);
});

backdrop.addEventListener("click", close);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

// при смене раскладки закрываем оверлеи, чтобы не остались «висеть»
for (const mq of [mqMobile, mqRail]) mq.addEventListener("change", close);

// на телефоне после добавления элемента или выбора слоя показываем холст
document.addEventListener("click", (e) => {
  if (!mqMobile.matches && !mqRail.matches) return;
  if (e.target.closest("[data-add]:not([data-add=image]):not([data-add=vector]), #layers li[data-id]")) close();
});
for (const id of ["fileInput", "svgInput"]) $(id)?.addEventListener("change", close);

// ---------- журнал: последняя строка, фильтры, копирование ----------
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

// ---------- кнопка «Печать» в нижней панели повторяет основную ----------
const btnPrint = $("btnPrint"), fab = $("fabPrint"), fabLabel = fab.querySelector("span");
const syncFab = () => {
  const busy = !$("progress").hidden;
  fab.disabled = busy;
  fabLabel.textContent = busy ? `${parseInt($("progressBar").style.width, 10) || 0} %` : t("Печать");
};
new MutationObserver(syncFab).observe(btnPrint, { attributes: true, attributeFilter: ["disabled"] });
new MutationObserver(syncFab).observe($("progressBar"), { attributes: true, attributeFilter: ["style"] });
new MutationObserver(syncFab).observe($("progress"), { attributes: true, attributeFilter: ["hidden"] });
// без подключённого принтера «Печать» в нижней панели открывает окно принтера
fab.addEventListener("click", (e) => {
  if (!$("btnConnect").hidden) { e.stopPropagation(); open("printer"); }
}, true);
syncFab();

window.addEventListener("langchange", () => {
  const cur = document.querySelector('#rightPanel [data-tab][aria-selected="true"]')?.dataset.tab ?? "element";
  $("rightTitle").textContent = t(TAB_TITLES[cur]);
  syncFab();
});

// стартовая вкладка
let startTab = "element";
try { startTab = localStorage.getItem("yhk-tab") || startTab; } catch { /* ignore */ }
setTab(TAB_TITLES[startTab] ? startTab : "element");
