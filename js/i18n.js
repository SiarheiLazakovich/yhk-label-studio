// Localization without a build step. English is the source language: UI strings in code
// and markup are English, and t() looks them up in the RU dictionary below.
// A missing translation falls back to the English original, so nothing breaks.
//   t("Print")                          → "Печать"          (when the language is ru)
//   t("{w} × {h} mm", { w: 48, h: 40 })  → "48 × 40 мм"
// Static markup is translated automatically (text, aria-label, title, placeholder);
// dynamic strings in JS go through t(). A language switch fires "langchange" on window.

const RU = {
  // header and common
  "Printer not connected": "Принтер не подключён",
  "{name} · {mm} mm · {dots} dots": "{name} · {mm} мм · {dots} точек",
  "{dots} dots": "{dots} точек",
  "{mm} mm": "{mm} мм",
  "Connect printer": "Подключить принтер",
  "Language": "Язык",
  "Close": "Закрыть",
  "Tools": "Инструменты",
  "Add": "Добавить",
  "Add and layers": "Добавить и слои",
  "Properties and print": "Свойства и печать",
  "Text": "Текст",
  "QR code": "QR-код",
  "Barcode": "Штрихкод",
  "Picture": "Картинка",
  "Frame": "Рамка",
  "Layers": "Слои",
  "Drag a PNG, JPG or SVG onto the canvas, or paste it with ⌘V.": "PNG, JPG или SVG можно перетащить на холст или вставить ⌘V.",
  "Drop to add the image": "Отпустите, чтобы добавить картинку",

  // size and snapping
  "Label size": "Размер этикетки",
  "Width, mm": "Ширина, мм",
  "Height, mm": "Высота, мм",
  "Width, px": "Ширина, px",
  "Height, px": "Высота, px",
  "mm =": "мм =",
  "Snapping": "Привязка",
  "Width": "Ширина",
  "Height": "Высота",
  "1/2 of width": "1/2 ширины",
  "1/2 of height": "1/2 высоты",
  "1/3 and 2/3 of width": "1/3 и 2/3 ширины",
  "1/3 and 2/3 of height": "1/3 и 2/3 высоты",
  "1/4 and 3/4 of width": "1/4 и 3/4 ширины",
  "1/4 and 3/4 of height": "1/4 и 3/4 высоты",
  "The object's center snaps to the lines. Hold Alt to move freely.": "Центр объекта прилипает к линиям. Alt — без привязки.",
  "{w} × {h} mm": "{w} × {h} мм",
  "{w} × {h} mm = {pw} × {ph} px · 8 px/mm · raster {kb} KB": "{w} × {h} мм = {pw} × {ph} px · 8 px/мм · растр {kb} КБ",
  " · prints the central {p} mm; {s} mm on each side stay blank (print head limit)": " · печатается центральные {p} мм, по {s} мм с краёв — поля (ограничение головки)",

  // canvas
  "Print preview": "Как напечатается",
  "Editor": "Редактор",
  "Zoom out": "Уменьшить",
  "Zoom in": "Увеличить",
  "Fit": "Вписать",

  // log
  "Log": "Журнал",
  "All": "Все",
  "Errors": "Ошибки",
  "Printer replies": "Ответы принтера",
  "Copy": "Копировать",
  "Clear": "Очистить",

  // right panel
  "Element": "Элемент",
  "Image": "Изображение",
  "Print": "Печать",
  "Select an element on the canvas.": "Выберите элемент на холсте.",
  "How images and SVGs with gradients turn into dots. Text, QR codes and barcodes always print sharp.": "Как картинки и SVG с градиентами превращаются в точки. Текст, QR и штрихкоды всегда печатаются резко.",
  "Dithering": "Дизеринг",
  "Threshold": "Порог",
  "Dot gain compensation": "Компенсация растекания",
  "Sharpness": "Резкость",
  "Preview dot gain": "Превью с растеканием точек",
  "Invert everything": "Инвертировать всё",
  "Density (heat)": "Плотность (нагрев)",
  "Light": "Светлая",
  "Medium": "Средняя",
  "Dark": "Тёмная",
  "Copies": "Копий",
  "Trim blank space": "Обрезать пустоту",
  "top and bottom": "сверху и снизу",
  "Margin after trim, px": "Поля после обрезки, px",
  "Feed after printing": "Протяжка после печати",
  "to the tear bar, mm": "до линии отрыва, мм",
  "Millimeters": "Миллиметров",
  "Otherwise feed, lines": "Иначе протяжка, строк",
  "Rotate 180°": "Повернуть на 180°",
  "Printer, paper, calibration": "Принтер, бумага, калибровка",
  "channel · feed · tests · protocol": "канал · протяжка · тесты · протокол",
  "Download PNG": "Скачать PNG",
  "Settings": "Настройки",
  "Cancel": "Отмена",

  // printer popover
  "Printer": "Принтер",
  "Not connected": "Не подключено",
  "Press “Connect” and choose YHK-…": "Нажмите «Подключить» и выберите YHK-…",
  "Battery": "Заряд",
  "Channel": "Канал",
  "Print head": "Головка",
  "48 mm": "48 мм",
  "Paper": "Бумага",
  "+1 mm": "+1 мм",
  "+5 mm": "+5 мм",
  "+10 mm": "+10 мм",
  "Feed, mm": "Протянуть, мм",
  "Feed": "Протянуть",
  "Forward only — the printer can't pull paper back.": "Только вперёд — назад принтер бумагу не тянет.",
  "Calibration": "Калибровка",
  "Resolution": "Разрешение",
  "58 mm": "58 мм",
  "Ruler 0–48 mm and edge dots": "Линейка 0–48 мм и крайние точки",
  "1–3 dot lines, 10×10 mm square": "Линии 1–3 точки, квадрат 10×10 мм",
  "464-dot raster: where the head cuts off": "Растр 464 точки: где головка обрезает печать",
  "Protocol": "Протокол",
  "Custom density, 1–60 (empty = auto)": "Своя плотность, 1–60 (пусто — авто)",
  "auto": "авто",
  "BLE packet, bytes": "BLE-пакет, байт",
  "Delay, ms": "Пауза, мс",
  "Show all BLE devices": "Показать все BLE-устройства",
  "Connect": "Подключить",
  "Disconnect": "Отключить",

  // “More” menu
  "More": "Ещё",
  "Size": "Размер",
  "Print settings": "Настройки печати",
  "Printer & calibration": "Принтер и калибровка",

  // dynamic: printer and printing
  "Couldn't save the layout (images are too large)": "Не удалось сохранить макет (слишком большие картинки)",
  "Reading info…": "Читаю информацию…",
  "Connection lost": "Соединение потеряно",
  "The port is open but the printer doesn't respond. Make sure it's on and not connected to a phone; if that doesn't help, turn Bluetooth off and on and reconnect.": "Порт открыт, но принтер не отвечает. Проверьте, что он включён и не подключён к телефону; если не поможет — выключите и включите Bluetooth на Mac и подключитесь снова.",
  "No response from the printer": "Нет ответа от принтера",
  "Ready": "Готов",
  "Printer reports width {w}px": "Принтер сообщает ширину {w}px",
  "Device selection cancelled": "Выбор устройства отменён",
  "Sent to printer ✓": "Отправлено на печать ✓",
  "Printing cancelled": "Печать отменена",
  "The label is empty — nothing to print": "Этикетка пустая — печатать нечего",
  "Empty label": "Этикетка пустая",
  "{w} × {h} px ≈ {mm} mm": "{w} × {h} px ≈ {mm} мм",
  "density {v}": "плотность {v}",
  "light": "светлая",
  "medium": "средняя",
  "dark": "тёмная",
  "{w} × {mm} mm · {dens} · {n} pcs": "{w} × {mm} мм · {dens} · {n} шт.",
  "Profile {name}: {levels} · now {v}": "Профиль {name}: {levels} · сейчас {v}",
  " (confirmed after connecting)": " (профиль уточнится после подключения)",
  "Main channel. The image is sent row by row: each row is a separate acknowledged packet (over BLE the printer prints only one row per packet).": "Основной канал. Изображение уходит построчно: каждая строка — отдельный пакет с подтверждением (больше одной строки за пакет принтер по BLE не печатает).",
  "Fallback channel (like WalkPrint): the “cu.YHK-0926” port. On macOS it works only while the printer is connected in Settings → Bluetooth.": "Запасной канал (как WalkPrint): порт «cu.YHK-0926». На macOS работает, только пока принтер подключён в Настройки → Bluetooth.",
  "Requires Chrome or Edge (Web Serial / Web Bluetooth)": "Нужен Chrome или Edge (Web Serial / Web Bluetooth)",
  "Ready. Connect the YHK-0926 printer.": "Готово. Подключите принтер YHK-0926.",
  "Raster width must be a multiple of 8": "Ширина растра должна быть кратна 8",
  "Web Serial is unavailable. Use Chrome/Edge over https:// or localhost.": "Web Serial недоступен. Нужен Chrome/Edge и https:// или localhost.",
  "Couldn't open “YHK-0926 – Paired”. Press “Connect” again and choose “cu.YHK-0926”.": "Не удалось открыть «YHK-0926 – Paired». Нажмите «Подключить» ещё раз и выберите «cu.YHK-0926».",
  "Couldn't open the port ({m}). Is the printer on and not connected to a phone?": "Не удалось открыть порт ({m}). Принтер включён и не подключён к телефону?",
  "YHK (SPP port)": "YHK (порт SPP)",
  "Web Bluetooth is unavailable.": "Web Bluetooth недоступен.",
  "Attempt {n}: {m}": "Попытка {n}: {m}",
  "You picked the printer's Classic entry — choose the other YHK-… in the list.": "Выбрана Classic-запись принтера — выберите другой YHK-… в списке.",
  "Printer disconnected": "Принтер отключился",
  "Connecting over BLE…": "Подключение по BLE…",
  "Connecting over Bluetooth SPP…": "Подключение по Bluetooth SPP…",
  "Connected: {name}": "Подключено: {name}",
  "The printer is busy printing": "Принтер занят печатью",
  "Already printing": "Уже идёт печать",
  "Printing: {w}×{h}px, density {d}, {n} pcs, {via}": "Печать: {w}×{h}px, плотность {d}, {n} шт., {via}",
  "Sent": "Отправлено",
  "Feed {mm} mm": "Протяжка {mm} мм",

  // object properties
  "Select an element on the canvas or add a new one on the left.<br/>Arrows move it, Shift ×10, ⌫ deletes, ⌘D duplicates.": "Выберите элемент на холсте или добавьте новый слева.<br/>Стрелки — сдвиг, Shift — ×10, ⌫ — удалить, ⌘D — копия.",
  "Font": "Шрифт",
  "Size, px": "Размер, px",
  "Line spacing": "Интервал",
  "⟸ Left": "⟸ Слева",
  "Center": "Центр",
  "Right ⟹": "Справа ⟹",
  "Bold": "Жирный",
  "Italic": "Курсив",
  "White on black": "Белым по чёрному",
  "Content": "Содержимое",
  "Error correction": "Коррекция",
  "Brightness": "Яркость",
  "Contrast": "Контраст",
  "Fit width": "По ширине",
  "Fit height": "По высоте",
  "Standard": "Стандарт",
  "Data": "Данные",
  "Module, dots": "Модуль, точек",
  "Bar height, px": "Высота полос, px",
  "Text under the code": "Подпись под кодом",
  "Text size, px": "Размер подписи, px",
  "Sample data": "Пример данных",
  "Dithering (for SVGs with gradients)": "Дизеринг (для SVG с градиентами)",
  "Without dithering an SVG prints with a hard threshold, like text. Shadows and gradients look better dithered.": "Без дизеринга SVG печатается резким порогом — как текст. Тени и градиенты лучше с дизерингом.",
  "Style": "Стиль",
  "Thickness, px": "Толщина, px",
  "Corner radius, px": "Скругление, px",
  "Fill": "Залить",
  "Full label": "Во всю этикетку",
  "⇔ Center": "⇔ По центру",
  "⇕ Center": "⇕ По центру",
  "↑ Up": "↑ Выше",
  "↓ Down": "↓ Ниже",
  "Duplicate": "Копия",
  "Delete": "Удалить",
  "{hint}. Width with quiet zones: {mm} mm{wide}.": "{hint}. Ширина с полями тишины: {mm} мм{wide}.",
  " — wider than the label, reduce the module": " — шире этикетки, уменьшите модуль",
  "Frame {style} {w}×{h}": "Рамка {style} {w}×{h}",
  "Empty — add an element": "Пусто — добавьте элемент",
  "Couldn't read the SVG": "Не удалось прочитать SVG",
  "This is not an image": "Это не картинка",
  "Hello, YHK!": "Привет, YHK!",
  "Label Studio · 48 × 40 mm": "Label Studio · 48 × 40 мм",

  // fonts
  "System": "Системный",
  "Oswald (condensed)": "Oswald (узкий)",
  "Russo One (heavy)": "Russo One (жирный)",
  "Comfortaa (rounded)": "Comfortaa (округлый)",
  "PT Serif (serif)": "PT Serif (с засечками)",
  "Press Start 2P (pixel)": "Press Start 2P (пиксельный)",
  "Lobster (script)": "Lobster (рукописный)",
  "Caveat (handwritten)": "Caveat (от руки)",

  // frame styles
  "Solid": "Сплошная",
  "Double": "Двойная",
  "Dashed": "Пунктир",
  "Dotted": "Точки",
  "Corners only": "Только уголки",
  "Ticket (notched corners)": "Билет (вырезы в углах)",
  "Scalloped": "Волна (фестоны)",
  "Stamp (perforated)": "Марка (перфорация)",

  // barcodes
  "ITF (2 of 5)": "ITF (2 из 5)",
  "any ASCII characters": "любые символы ASCII",
  "12 digits (check digit is added) or 13": "12 цифр (контрольная добавится) или 13",
  "7 or 8 digits": "7 цифр или 8",
  "11 or 12 digits": "11 цифр или 12",
  "6 or 8 digits": "6 или 8 цифр",
  "A–Z, 0–9, space and - . $ / + %": "A–Z, 0–9, пробел и - . $ / + %",
  "13 or 14 digits": "13 цифр или 14",
  "an even number of digits": "чётное число цифр",
  "digits and - $ : / . +, with A–D at both ends": "цифры и - $ : / . +, по краям A–D",
  "digits": "цифры",
  "a number 3–131070": "число 3–131070",
  "The barcode library didn't load": "Библиотека штрихкодов не загрузилась",
  "Invalid data for {f}: {hint}": "Неверные данные для {f}: {hint}",
  "Error: {m}": "Ошибка: {m}",
  "BARCODE: invalid data": "ШТРИХКОД: ошибка данных",

  // test prints
  "WIDTH TEST · 384 px = 48 mm": "ТЕСТ ШИРИНЫ · 384 px = 48 мм",
  "edges: columns 0 and 383 (arrows)": "края: столбцы 0 и 383 (стрелки)",
  "RESOLUTION · 8 dots/mm ≈ 203 dpi": "РАЗРЕШЕНИЕ · 8 точек/мм ≈ 203 dpi",
  "vert. {n}px": "верт. {n}px",
  "horiz. {n}px": "гор. {n}px",
  "checker {n}px": "шахм. {n}px",
  "10×10 mm": "10×10 мм",
  "{n}px The quick brown fox 0123456789": "{n}px Съешь ещё булок 0123456789",
  "TEST {mm} mm · {w} dots": "ТЕСТ {mm} мм · {w} точек",
  "which mark did it print up to?": "до какой отметки напечатано?",
};

const STORE = "yhk-lang";
let lang = (() => {
  try { const saved = localStorage.getItem(STORE); if (saved === "ru" || saved === "en") return saved; } catch { /* ignore */ }
  return (navigator.language || "en").toLowerCase().startsWith("ru") ? "ru" : "en";
})();

export const getLang = () => lang;

export function t(s, params) {
  let out = lang === "ru" ? (RU[s] ?? s) : s;
  if (params) out = out.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ""));
  return out;
}

// ---------- static markup ----------
// Originals are captured once at load so the language can be switched back and forth.
const ATTRS = ["aria-label", "title", "placeholder"];
const textNodes = []; // [{ node, orig }]
const attrNodes = []; // [{ el, attr, orig }]
const SKIP = new Set(["SCRIPT", "STYLE", "CANVAS", "TEXTAREA", "SVG"]);
const translatable = (v) => RU[v.trim()] !== undefined;

function collect(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === 1) return SKIP.has(n.nodeName.toUpperCase()) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      return translatable(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  for (let n; (n = walker.nextNode());) textNodes.push({ node: n, orig: n.nodeValue });
  for (const el of root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(","))) {
    for (const attr of ATTRS) {
      const v = el.getAttribute(attr);
      if (v && translatable(v)) attrNodes.push({ el, attr, orig: v });
    }
  }
}

function applyDom() {
  for (const { node, orig } of textNodes) {
    if (!node.isConnected) continue; // replaced by JS — the code translates it itself
    const key = orig.trim();
    node.nodeValue = orig.replace(key, t(key));
  }
  for (const { el, attr, orig } of attrNodes) if (el.isConnected) el.setAttribute(attr, t(orig));
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-lang]").forEach((b) => {
    b.classList.toggle("on", b.dataset.lang === lang);
    b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
  });
}

export function setLang(next) {
  if (next !== "ru" && next !== "en") return;
  lang = next;
  try { localStorage.setItem(STORE, next); } catch { /* ignore */ }
  applyDom();
  window.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
}

// module scripts run after the HTML is parsed, so the markup is already there
collect(document.body);
applyDom();
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-lang]");
  if (b) setLang(b.dataset.lang);
});
