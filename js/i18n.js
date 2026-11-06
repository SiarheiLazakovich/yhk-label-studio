// Интернационализация без сборки: ключ — русская строка, словарь EN переводит её.
// Нет перевода — показывается русский оригинал (ничего не ломается).
//   t("Печать")                       → "Print"
//   t("{w} × {h} мм", { w: 48, h: 40 }) → "48 × 40 mm"
// Статическая разметка переводится автоматически (тексты, aria-label, title, placeholder);
// динамические строки в JS оборачиваются в t(). Смена языка — событие "langchange" на window.

const EN = {
  // шапка и общее
  "Принтер не подключён": "No printer connected",
  "{name} · головка {mm} мм": "{name} · {mm} mm print head",
  "{mm} мм": "{mm} mm",
  "Подключить принтер": "Connect printer",
  "Язык": "Language",
  "Закрыть": "Close",
  "Инструменты": "Tools",
  "Добавить": "Add",
  "Добавить и слои": "Add and layers",
  "Свойства и печать": "Properties and print",
  "Текст": "Text",
  "QR-код": "QR code",
  "Штрихкод": "Barcode",
  "Картинка": "Image",
  "Рамка": "Frame",
  "Слои": "Layers",
  "PNG, JPG или SVG можно перетащить на холст или вставить ⌘V.": "Drag a PNG, JPG or SVG onto the canvas, or paste it with ⌘V.",
  "Отпустите, чтобы добавить картинку": "Drop to add the image",

  // размер и привязка
  "Размер этикетки": "Label size",
  "Ширина, мм": "Width, mm",
  "Высота, мм": "Height, mm",
  "Ширина, px": "Width, px",
  "Высота, px": "Height, px",
  "мм =": "mm =",
  "Привязка": "Snapping",
  "Ширина": "Width",
  "Высота": "Height",
  "1/2 ширины": "1/2 of width",
  "1/2 высоты": "1/2 of height",
  "1/3 и 2/3 ширины": "1/3 and 2/3 of width",
  "1/3 и 2/3 высоты": "1/3 and 2/3 of height",
  "1/4 и 3/4 ширины": "1/4 and 3/4 of width",
  "1/4 и 3/4 высоты": "1/4 and 3/4 of height",
  "Центр объекта прилипает к линиям. Alt — без привязки.": "The object's center snaps to the lines. Hold Alt to move freely.",
  "{w} × {h} мм": "{w} × {h} mm",
  "{w} × {h} мм = {pw} × {ph} px · 8 px/мм · растр {kb} КБ": "{w} × {h} mm = {pw} × {ph} px · 8 px/mm · raster {kb} KB",
  " · печатается центральные {p} мм, по {s} мм с краёв — поля (ограничение головки)": " · prints the central {p} mm; {s} mm on each side stay blank (print head limit)",

  // холст
  "Как напечатается": "Print preview",
  "Редактор": "Editor",
  "Уменьшить": "Zoom out",
  "Увеличить": "Zoom in",
  "Вписать": "Fit",

  // журнал
  "Журнал": "Log",
  "Все": "All",
  "Ошибки": "Errors",
  "Ответы принтера": "Printer replies",
  "Копировать": "Copy",
  "Очистить": "Clear",

  // правая панель
  "Элемент": "Element",
  "Изображение": "Image",
  "Печать": "Print",
  "Выберите элемент на холсте.": "Select an element on the canvas.",
  "Как картинки и SVG с градиентами превращаются в точки. Текст, QR и штрихкоды всегда печатаются резко.": "How images and SVGs with gradients turn into dots. Text, QR codes and barcodes always print sharp.",
  "Дизеринг": "Dithering",
  "Порог": "Threshold",
  "Компенсация растекания": "Dot gain compensation",
  "Резкость": "Sharpness",
  "Превью с растеканием точек": "Preview dot gain",
  "Инвертировать всё": "Invert everything",
  "Плотность (нагрев)": "Density (heat)",
  "Светлая": "Light",
  "Средняя": "Medium",
  "Тёмная": "Dark",
  "Копий": "Copies",
  "Обрезать пустоту": "Trim blank space",
  "сверху и снизу": "top and bottom",
  "Поля после обрезки, px": "Margin after trim, px",
  "Протяжка после печати": "Feed after printing",
  "до линии отрыва, мм": "to the tear bar, mm",
  "Миллиметров": "Millimeters",
  "Иначе протяжка, строк": "Otherwise feed, lines",
  "Повернуть на 180°": "Rotate 180°",
  "Принтер, бумага, калибровка": "Printer, paper, calibration",
  "канал · протяжка · тесты · протокол": "channel · feed · tests · protocol",
  "Скачать PNG": "Download PNG",
  "Настройки": "Settings",
  "Отмена": "Cancel",

  // окно принтера
  "Принтер": "Printer",
  "Не подключено": "Not connected",
  "Нажмите «Подключить» и выберите YHK-…": "Press “Connect” and choose YHK-…",
  "Заряд": "Battery",
  "Канал": "Channel",
  "Головка": "Print head",
  "48 мм": "48 mm",
  "Бумага": "Paper",
  "+1 мм": "+1 mm",
  "+5 мм": "+5 mm",
  "+10 мм": "+10 mm",
  "Протянуть, мм": "Feed, mm",
  "Протянуть": "Feed",
  "Только вперёд — назад принтер бумагу не тянет.": "Forward only — the printer can't pull paper back.",
  "Калибровка": "Calibration",
  "Разрешение": "Resolution",
  "58 мм": "58 mm",
  "Линейка 0–48 мм и крайние точки": "Ruler 0–48 mm and edge dots",
  "Линии 1–3 точки, квадрат 10×10 мм": "1–3 dot lines, 10×10 mm square",
  "Растр 464 точки: где головка обрезает печать": "464-dot raster: where the head cuts off",
  "Протокол": "Protocol",
  "Своя плотность, 1–60 (пусто — авто)": "Custom density, 1–60 (empty = auto)",
  "авто": "auto",
  "BLE-пакет, байт": "BLE packet, bytes",
  "Пауза, мс": "Delay, ms",
  "Показать все BLE-устройства": "Show all BLE devices",
  "Подключить": "Connect",
  "Отключить": "Disconnect",

  // меню «Ещё»
  "Ещё": "More",
  "Размер": "Size",
  "Настройки печати": "Print settings",
  "Принтер и калибровка": "Printer & calibration",

  // динамика: принтер и печать
  "Не удалось сохранить макет (слишком большие картинки)": "Couldn't save the layout (images are too large)",
  "Читаю информацию…": "Reading info…",
  "Соединение потеряно": "Connection lost",
  "Порт открыт, но принтер не отвечает. Проверьте, что он включён и не подключён к телефону; если не поможет — выключите и включите Bluetooth на Mac и подключитесь снова.":
    "The port is open but the printer doesn't respond. Make sure it's on and not connected to a phone; if that doesn't help, turn Bluetooth off and on and reconnect.",
  "Нет ответа от принтера": "No response from the printer",
  "Готов": "Ready",
  "Принтер сообщает ширину {w}px": "Printer reports width {w}px",
  "Выбор устройства отменён": "Device selection cancelled",
  "Отправлено на печать ✓": "Sent to printer ✓",
  "Печать отменена": "Printing cancelled",
  "Этикетка пустая — печатать нечего": "The label is empty — nothing to print",
  "Этикетка пустая": "Empty label",
  "{w} × {h} px ≈ {mm} мм": "{w} × {h} px ≈ {mm} mm",
  "плотность {v}": "density {v}",
  "светлая": "light",
  "средняя": "medium",
  "тёмная": "dark",
  "{w} × {mm} мм · {dens} · {n} шт.": "{w} × {mm} mm · {dens} · {n} pcs",
  "Профиль {name}: {levels} · сейчас {v}": "Profile {name}: {levels} · now {v}",
  " (профиль уточнится после подключения)": " (confirmed after connecting)",
  "Основной канал. Изображение уходит построчно: каждая строка — отдельный пакет с подтверждением (больше одной строки за пакет принтер по BLE не печатает).":
    "Main channel. The image is sent row by row: each row is a separate acknowledged packet (over BLE the printer prints only one row per packet).",
  "Запасной канал (как WalkPrint): порт «cu.YHK-0926». На macOS работает, только пока принтер подключён в Настройки → Bluetooth.":
    "Fallback channel (like WalkPrint): the “cu.YHK-0926” port. On macOS it works only while the printer is connected in Settings → Bluetooth.",
  "Нужен Chrome или Edge (Web Serial / Web Bluetooth)": "Requires Chrome or Edge (Web Serial / Web Bluetooth)",
  "Готово. Подключите принтер YHK-0926.": "Ready. Connect the YHK-0926 printer.",
  "Ширина растра должна быть кратна 8": "Raster width must be a multiple of 8",
  "Web Serial недоступен. Нужен Chrome/Edge и https:// или localhost.": "Web Serial is unavailable. Use Chrome/Edge over https:// or localhost.",
  "Не удалось открыть «YHK-0926 – Paired». Нажмите «Подключить» ещё раз и выберите «cu.YHK-0926».": "Couldn't open “YHK-0926 – Paired”. Press “Connect” again and choose “cu.YHK-0926”.",
  "Не удалось открыть порт ({m}). Принтер включён и не подключён к телефону?": "Couldn't open the port ({m}). Is the printer on and not connected to a phone?",
  "YHK (порт SPP)": "YHK (SPP port)",
  "Принтер не подключён": "Printer not connected",
  "Web Bluetooth недоступен.": "Web Bluetooth is unavailable.",
  "Попытка {n}: {m}": "Attempt {n}: {m}",
  "Выбрана Classic-запись принтера — выберите другой YHK-… в списке.": "You picked the printer's Classic entry — choose the other YHK-… in the list.",
  "Принтер отключился": "Printer disconnected",
  "Подключение по BLE…": "Connecting over BLE…",
  "Подключение по Bluetooth SPP…": "Connecting over Bluetooth SPP…",
  "Подключено: {name}": "Connected: {name}",
  "Принтер занят печатью": "The printer is busy printing",
  "Уже идёт печать": "Already printing",
  "Печать: {w}×{h}px, плотность {d}, {n} шт., {via}": "Printing: {w}×{h}px, density {d}, {n} pcs, {via}",
  "Отправлено": "Sent",
  "Протяжка {mm} мм": "Feed {mm} mm",

  // свойства объектов
  "Выберите элемент на холсте или добавьте новый слева.<br/>Стрелки — сдвиг, Shift — ×10, ⌫ — удалить, ⌘D — копия.":
    "Select an element on the canvas or add a new one on the left.<br/>Arrows move it, Shift ×10, ⌫ deletes, ⌘D duplicates.",
  "Шрифт": "Font",
  "Размер, px": "Size, px",
  "Интервал": "Line spacing",
  "⟸ Слева": "⟸ Left",
  "Центр": "Center",
  "Справа ⟹": "Right ⟹",
  "Жирный": "Bold",
  "Курсив": "Italic",
  "Белым по чёрному": "White on black",
  "Содержимое": "Content",
  "Коррекция": "Error correction",
  "Яркость": "Brightness",
  "Контраст": "Contrast",
  "По ширине": "Fit width",
  "По высоте": "Fit height",
  "Стандарт": "Standard",
  "Данные": "Data",
  "Модуль, точек": "Module, dots",
  "Высота полос, px": "Bar height, px",
  "Подпись под кодом": "Text under the code",
  "Размер подписи, px": "Text size, px",
  "Пример данных": "Sample data",
  "Дизеринг (для SVG с градиентами)": "Dithering (for SVGs with gradients)",
  "Без дизеринга SVG печатается резким порогом — как текст. Тени и градиенты лучше с дизерингом.":
    "Without dithering an SVG prints with a hard threshold, like text. Shadows and gradients look better dithered.",
  "Стиль": "Style",
  "Толщина, px": "Thickness, px",
  "Скругление, px": "Corner radius, px",
  "Залить": "Fill",
  "Во всю этикетку": "Full label",
  "⇔ По центру": "⇔ Center",
  "⇕ По центру": "⇕ Center",
  "↑ Выше": "↑ Up",
  "↓ Ниже": "↓ Down",
  "Копия": "Duplicate",
  "Удалить": "Delete",
  "{hint}. Ширина с полями тишины: {mm} мм{wide}.": "{hint}. Width with quiet zones: {mm} mm{wide}.",
  " — шире этикетки, уменьшите модуль": " — wider than the label, reduce the module",
  "Рамка {style} {w}×{h}": "Frame {style} {w}×{h}",
  "Пусто — добавьте элемент": "Empty — add an element",
  "Не удалось прочитать SVG": "Couldn't read the SVG",
  "Это не картинка": "This is not an image",
  "Привет, YHK!": "Hello, YHK!",
  "Label Studio · 48 × 40 мм": "Label Studio · 48 × 40 mm",

  // шрифты
  "Системный": "System",
  "Oswald (узкий)": "Oswald (condensed)",
  "Russo One (жирный)": "Russo One (heavy)",
  "Comfortaa (округлый)": "Comfortaa (rounded)",
  "PT Serif (с засечками)": "PT Serif (serif)",
  "Press Start 2P (пиксельный)": "Press Start 2P (pixel)",
  "Lobster (рукописный)": "Lobster (script)",
  "Caveat (от руки)": "Caveat (handwritten)",

  // рамки
  "Сплошная": "Solid",
  "Двойная": "Double",
  "Пунктир": "Dashed",
  "Точки": "Dotted",
  "Только уголки": "Corners only",
  "Билет (вырезы в углах)": "Ticket (notched corners)",
  "Волна (фестоны)": "Scalloped",
  "Марка (перфорация)": "Stamp (perforated)",

  // штрихкоды
  "ITF (2 из 5)": "ITF (2 of 5)",
  "любые символы ASCII": "any ASCII characters",
  "12 цифр (контрольная добавится) или 13": "12 digits (check digit is added) or 13",
  "7 цифр или 8": "7 or 8 digits",
  "11 цифр или 12": "11 or 12 digits",
  "6 или 8 цифр": "6 or 8 digits",
  "A–Z, 0–9, пробел и - . $ / + %": "A–Z, 0–9, space and - . $ / + %",
  "13 цифр или 14": "13 or 14 digits",
  "чётное число цифр": "an even number of digits",
  "цифры и - $ : / . +, по краям A–D": "digits and - $ : / . +, with A–D at both ends",
  "цифры": "digits",
  "число 3–131070": "a number 3–131070",
  "Библиотека штрихкодов не загрузилась": "The barcode library didn't load",
  "Неверные данные для {f}: {hint}": "Invalid data for {f}: {hint}",
  "Ошибка: {m}": "Error: {m}",
  "ШТРИХКОД: ошибка данных": "BARCODE: invalid data",

  // тестовые отпечатки
  "ТЕСТ ШИРИНЫ · 384 px = 48 мм": "WIDTH TEST · 384 px = 48 mm",
  "края: столбцы 0 и 383 (стрелки)": "edges: columns 0 and 383 (arrows)",
  "РАЗРЕШЕНИЕ · 8 точек/мм ≈ 203 dpi": "RESOLUTION · 8 dots/mm ≈ 203 dpi",
  "верт. {n}px": "vert. {n}px",
  "гор. {n}px": "horiz. {n}px",
  "шахм. {n}px": "checker {n}px",
  "10×10 мм": "10×10 mm",
  "{n}px Съешь ещё булок 0123456789": "{n}px The quick brown fox 0123456789",
  "ТЕСТ {mm} мм · {w} точек": "TEST {mm} mm · {w} dots",
  "до какой отметки напечатано?": "which mark did it print up to?",
};

const STORE = "yhk-lang";
let lang = (() => {
  try { const saved = localStorage.getItem(STORE); if (saved === "ru" || saved === "en") return saved; } catch { /* ignore */ }
  return (navigator.language || "en").toLowerCase().startsWith("ru") ? "ru" : "en";
})();

export const getLang = () => lang;

export function t(s, params) {
  let out = lang === "en" ? (EN[s] ?? s) : s;
  if (params) out = out.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ""));
  return out;
}

// ---------- статическая разметка ----------
// Оригиналы запоминаются один раз при загрузке: так можно переключать язык туда и обратно.
const ATTRS = ["aria-label", "title", "placeholder"];
const textNodes = []; // [{ node, orig }]
const attrNodes = []; // [{ el, attr, orig }]
const SKIP = new Set(["SCRIPT", "STYLE", "CANVAS", "TEXTAREA", "SVG", "symbol"]);

function collect(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === 1) return SKIP.has(n.nodeName) || SKIP.has(n.nodeName.toUpperCase()) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
      return /[А-Яа-яЁё]/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  for (let n; (n = walker.nextNode());) textNodes.push({ node: n, orig: n.nodeValue });
  for (const el of root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(","))) {
    for (const attr of ATTRS) {
      const v = el.getAttribute(attr);
      if (v && /[А-Яа-яЁё]/.test(v)) attrNodes.push({ el, attr, orig: v });
    }
  }
}

function applyDom() {
  for (const { node, orig } of textNodes) {
    if (!node.isConnected) continue; // узел заменил JS — его переводит сам код
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

// модульные скрипты выполняются после разбора HTML — разметка уже на месте
collect(document.body);
applyDom();
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-lang]");
  if (b) setLang(b.dataset.lang);
});
