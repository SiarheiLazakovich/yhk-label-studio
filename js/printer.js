// YHK-0926 / WalkPrint driver.
//
// Протокол взят из декомпилированного WalkPrint (com.yhk.rabbit.print: PrintTask / AppConst / ImageUtil):
//   каналы     — BLE (ISSC UART, основной в браузере) и Classic SPP (RFCOMM 00001101-…, так печатает WalkPrint).
//   ВАЖНО (BLE) — принтер разбирает КАЖДЫЙ BLE-пакет как отдельную команду и из GS v 0 в пакете
//                печатает ТОЛЬКО ПЕРВУЮ строку (замер: 1/2/3 строки в пакете → 10/5/3 мм вместо 10 мм).
//                Поэтому по BLE: одна строка = один пакет `1D 76 30 00 30 00 01 00` + 48 байт (56 байт),
//                запись с подтверждением (writeValueWithResponse) — это и есть управление потоком.
//   задание    — 1D 49 F0 nn (плотность) → 1B 40 (init) → 1D 76 30 00 xL xH yL yH + растр → 0A 0A 0A 0A
//   растр      — 48 байт на строку, старший бит = левый пиксель, 1 = чёрный, одним блоком
//   запросы    — 1E 47 03 (HV/SV/VOLT/DPI), 1D 67 39 (серийник), 1D 67 69 (public id); ответы оканчиваются 00
//   плотность  — зависит от прошивки (AppConst.setPrintValue):
//                public id ≥ 200 → «public»: 20 / 25 / 30
//                иначе SV ≥ 1.19 → «new»: 12 / 15 / 18; SV < 1.19 → «old»: 5 / 10 / 15 + скорость 1D 49 F1 1E

export const SPP_UUID = "00001101-0000-1000-8000-00805f9b34fb";
export const ISSC_SERVICE = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
export const ISSC_TX = "49535343-8841-43f4-a8d4-ecbe34729bb3";
export const ISSC_RX = "49535343-1e4d-4bd9-ba61-23c647249616";

export const PRINT_WIDTH = 384;
export const BYTES_PER_ROW = PRINT_WIDTH / 8;

export const CMD = {
  init: [0x1b, 0x40],
  status: [0x1e, 0x47, 0x03],
  serial: [0x1d, 0x67, 0x39],
  publicId: [0x1d, 0x67, 0x69],
  density: (n) => [0x1d, 0x49, 0xf0, n & 0xff],
  speed30: [0x1d, 0x49, 0xf1, 0x1e],
};

export const DENSITY_PROFILES = {
  public: { label: "Public", levels: [20, 25, 30], pre: null },
  new: { label: "New (SV ≥ 1.19)", levels: [12, 15, 18], pre: null },
  old: { label: "Old (SV < 1.19)", levels: [5, 10, 15], pre: CMD.speed30 },
};

/** Выбор профиля плотности так же, как в WalkPrint (BTCmd.checkFactory / checkVersion). */
export function densityProfileFor(info) {
  const id = parseInt(info?.publicId ?? "", 10);
  if (Number.isFinite(id) && id >= 200) return "public";
  const sv = parseInt(String(info?.firmware ?? "").replace(/[^0-9]/g, ""), 10);
  if (Number.isFinite(sv) && sv < 119) return "old";
  return Number.isFinite(sv) ? "new" : "public";
}

export const DEFAULT_PRINT_OPTIONS = {
  densityLevel: 1, // 0 светлая, 1 средняя, 2 тёмная
  densityValue: null, // число — переопределяет уровень
  profile: "public",
  feedLines: 4,
  feedAfterMm: 0, // > 0 — после печати точная протяжка на столько мм вместо feedLines
  copies: 1,
  // только для BLE: максимальный размер пакета (MTU − 3) и пауза, если запись без подтверждения
  chunkSize: 180,
  chunkDelayMs: 0,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(" ");
const asciiOf = (bytes) => String.fromCharCode(...bytes.filter((b) => b !== 0)).trim();

/** Упаковка 1-bit буфера (1 байт на пиксель, 1 = чёрный) в строки по 48 байт, MSB слева. */
export function packRows(bits, width, height) {
  if (width % 8) throw new Error("Ширина растра должна быть кратна 8");
  const bpr = width / 8;
  const out = new Uint8Array(bpr * height);
  for (let y = 0; y < height; y++) {
    const rowOff = y * width, outOff = y * bpr;
    for (let x = 0; x < width; x++) if (bits[rowOff + x]) out[outOff + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return out;
}

export function densityByte(o) {
  if (Number.isFinite(o.densityValue)) return Math.max(1, Math.min(60, o.densityValue));
  const p = DENSITY_PROFILES[o.profile] ?? DENSITY_PROFILES.public;
  return p.levels[Math.max(0, Math.min(2, o.densityLevel))];
}

/** Части задания в порядке WalkPrint. */
export function buildJob(packed, height, opts = {}, bpr = BYTES_PER_ROW) {
  const o = { ...DEFAULT_PRINT_OPTIONS, ...opts };
  const preCmd = DENSITY_PROFILES[o.profile]?.pre;
  const header = [0x1d, 0x76, 0x30, 0x00, bpr & 0xff, bpr >> 8, height & 0xff, (height >> 8) & 0xff];
  const pre = [];
  if (preCmd) pre.push(Uint8Array.from(preCmd));
  pre.push(Uint8Array.from(CMD.density(densityByte(o))));
  pre.push(Uint8Array.from(CMD.init));
  const raster = new Uint8Array(header.length + packed.length);
  raster.set(header);
  raster.set(packed, header.length);
  return { pre, raster, post: new Uint8Array(Math.max(0, o.feedLines)).fill(0x0a) };
}

// ---------------- транспорты ----------------

/** Classic Bluetooth SPP через Web Serial — основной канал, как в WalkPrint. */
class SerialTransport {
  kind = "serial";
  port = null;
  writer = null;
  reader = null;
  onData = null;
  onClose = null;

  static get supported() {
    return typeof navigator !== "undefined" && !!navigator.serial;
  }

  async open({ reuse = true } = {}) {
    if (!SerialTransport.supported) throw new Error("Web Serial недоступен. Нужен Chrome/Edge и https:// или localhost.");
    let port = null;
    if (reuse) {
      // ранее разрешённый порт — без окна выбора
      const granted = await navigator.serial.getPorts();
      if (granted.length === 1) port = granted[0];
    }
    port ??= await navigator.serial.requestPort({ allowedBluetoothServiceClassIds: [SPP_UUID] });
    // для RFCOMM скорость игнорируется, но параметр обязателен
    try {
      await port.open({ baudRate: 115200, bufferSize: 4096 });
    } catch (e) {
      const native = !!port.getInfo().bluetoothServiceClassId;
      throw new Error(native
        ? "Не удалось открыть «YHK-0926 – Paired». Нажмите «Подключить» ещё раз и выберите «cu.YHK-0926»."
        : `Не удалось открыть порт (${e.message}). Принтер включён и не подключён к телефону?`);
    }
    this.port = port;
    this.writer = port.writable.getWriter();
    this.#readLoop();
    navigator.serial.addEventListener("disconnect", this.#onDisconnect);
    return port.getInfo().bluetoothServiceClassId ? "YHK (Bluetooth SPP)" : "YHK (порт SPP)";
  }

  #onDisconnect = (e) => {
    if (e.target === this.port) this.#closed();
  };

  #closed() {
    if (!this.port) return;
    navigator.serial.removeEventListener("disconnect", this.#onDisconnect);
    this.port = this.writer = this.reader = null;
    this.onClose?.();
  }

  async #readLoop() {
    if (!this.port?.readable) return;
    this.reader = this.port.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value?.length) this.onData?.(value);
      }
    } catch {
      // порт закрыт или ошибка чтения
    } finally {
      try { this.reader?.releaseLock(); } catch { /* ignore */ }
    }
  }

  get connected() {
    return !!this.writer;
  }

  /** writer.write ждёт, пока данные уйдут в ОС — RFCOMM сам регулирует поток. */
  async write(bytes) {
    if (!this.writer) throw new Error("Принтер не подключён");
    await this.writer.write(bytes);
  }

  async close() {
    const port = this.port;
    try { await this.reader?.cancel(); } catch { /* ignore */ }
    // abort отбрасывает недоставленные данные — иначе close() ждёт их бесконечно, если канал не поднялся
    try { await this.writer?.abort(); } catch { /* ignore */ }
    try { this.writer?.releaseLock(); } catch { /* ignore */ }
    try { await port?.close(); } catch { /* ignore */ }
    this.#closed();
  }
}

/** BLE (ISSC UART). Один вызов writePacket = один пакет = одна команда для принтера. */
class BleTransport {
  kind = "ble";
  device = null;
  tx = null;
  onData = null;
  onClose = null;
  chunkSize = 180;
  chunkDelayMs = 0;

  static get supported() {
    return typeof navigator !== "undefined" && !!navigator.bluetooth;
  }

  async open({ acceptAll = false, log } = {}) {
    if (!BleTransport.supported) throw new Error("Web Bluetooth недоступен.");
    // Принтер двухрежимный; Classic-запись в списке (id = MAC) Web Bluetooth не поддерживает.
    // Фильтр по ISSC-сервису оставляет только BLE-запись.
    this.device = await navigator.bluetooth.requestDevice(acceptAll
      ? { acceptAllDevices: true, optionalServices: [ISSC_SERVICE] }
      : { filters: [{ services: [ISSC_SERVICE] }], optionalServices: [ISSC_SERVICE] });
    this.device.addEventListener("gattserverdisconnected", () => { this.tx = null; this.onClose?.(); });
    let server, lastErr;
    for (let i = 0; i < 3 && !server; i++) {
      try { server = await this.device.gatt.connect(); }
      catch (e) { lastErr = e; log?.(`Попытка ${i + 1}: ${e.message}`, "warn"); await sleep(800 * (i + 1)); }
    }
    if (!server) {
      if (/unsupported device/i.test(lastErr?.message)) throw new Error("Выбрана Classic-запись принтера — выберите другой YHK-… в списке.");
      throw lastErr;
    }
    const service = await server.getPrimaryService(ISSC_SERVICE);
    this.tx = await service.getCharacteristic(ISSC_TX);
    try {
      const rx = await service.getCharacteristic(ISSC_RX);
      await rx.startNotifications();
      rx.addEventListener("characteristicvaluechanged", (e) => this.onData?.(new Uint8Array(e.target.value.buffer.slice(0))));
    } catch { /* без уведомлений тоже печатает */ }
    return `${this.device.name} (BLE)`;
  }

  get connected() {
    return !!this.device?.gatt?.connected && !!this.tx;
  }

  async writePacket(bytes) {
    if (!this.tx) throw new Error("Принтер не подключён");
    // запись с подтверждением: следующий пакет уходит только после того, как модуль принял предыдущий
    if (this.tx.properties.write) await this.tx.writeValueWithResponse(bytes);
    else await this.tx.writeValueWithoutResponse(bytes);
    if (this.chunkDelayMs) await sleep(this.chunkDelayMs);
  }

  /** Короткие команды (запросы, плотность, протяжка) — помещаются в один пакет. */
  async write(bytes) {
    for (let i = 0; i < bytes.length; i += this.chunkSize) await this.writePacket(bytes.subarray(i, i + this.chunkSize));
  }

  async close() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
  }
}

// ---------------- принтер ----------------

export class YhkPrinter extends EventTarget {
  transport = null;
  info = {};
  #rxBuf = [];
  #waiters = [];
  #busy = false;

  static get serialSupported() { return SerialTransport.supported; }
  static get bleSupported() { return BleTransport.supported; }

  get connected() { return !!this.transport?.connected; }
  get busy() { return this.#busy; }
  get kind() { return this.transport?.kind ?? null; }

  #emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  #log(msg, level = "info") { this.#emit("log", { msg, level }); }

  /** @param {{via?: "serial"|"ble", acceptAll?: boolean, reuse?: boolean}} o */
  async connect({ via = "serial", acceptAll = false, reuse = true } = {}) {
    if (this.connected) await this.disconnect();
    const t = via === "ble" ? new BleTransport() : new SerialTransport();
    t.onData = (bytes) => this.#onData(bytes);
    t.onClose = () => {
      if (this.transport !== t) return;
      this.transport = null;
      this.#log("Принтер отключился", "warn");
      this.#emit("disconnected");
    };
    this.#log(via === "ble" ? "Подключение по BLE…" : "Подключение по Bluetooth SPP…");
    const name = await t.open({ acceptAll, reuse, log: (m, l) => this.#log(m, l) });
    this.transport = t;
    this.#log(`Подключено: ${name}`, "ok");
    this.#emit("connected", { name, kind: t.kind });
    return name;
  }

  async disconnect() {
    const t = this.transport;
    this.transport = null;
    await t?.close();
    this.#emit("disconnected");
  }

  // Ответы приходят кусками; каждый ответ завершается байтом 00.
  #onData(bytes) {
    this.#log(`← ${toHex(bytes)}`, "rx");
    for (const b of bytes) {
      if (b === 0) {
        const msg = Uint8Array.from(this.#rxBuf);
        this.#rxBuf = [];
        this.#waiters.shift()?.(msg);
      } else this.#rxBuf.push(b);
    }
  }

  async query(cmd, timeoutMs = 2000) {
    if (this.#busy) throw new Error("Принтер занят печатью");
    if (!this.connected) throw new Error("Принтер не подключён");
    this.#rxBuf = [];
    const answer = new Promise((resolve) => {
      const waiter = (b) => { clearTimeout(timer); resolve(b); };
      const timer = setTimeout(() => {
        const i = this.#waiters.indexOf(waiter);
        if (i >= 0) this.#waiters.splice(i, 1);
        resolve(null);
      }, timeoutMs);
      this.#waiters.push(waiter);
    });
    await this.transport.write(Uint8Array.from(cmd));
    return answer;
  }

  /** {hardware, firmware, voltageMv, batteryPct, dpi, serial, publicId, profile} */
  async getInfo() {
    const info = {};
    const status = await this.query(CMD.status);
    if (status) {
      for (const kv of asciiOf(status).split(",")) {
        const [k, v] = kv.split("=");
        if (k === "HV") info.hardware = v;
        if (k === "SV") info.firmware = v;
        if (k === "VOLT") info.voltageMv = parseInt(v, 10);
        if (k === "DPI") info.dpi = parseInt(v, 10);
      }
      if (info.voltageMv) {
        // 2S Li-ion: ~6.8 В — пусто, ~8.4 В — полностью
        info.batteryPct = Math.round(Math.min(1, Math.max(0, (info.voltageMv - 6800) / 1600)) * 100);
      }
    }
    const sn = await this.query(CMD.serial);
    if (sn) info.serial = asciiOf(sn).replace(/^sn:/i, "").replace(/\.$/, "");
    const pub = await this.query(CMD.publicId);
    if (pub) info.publicId = asciiOf(pub).replace(/^public id:/i, "").replace(/\.$/, "");
    info.profile = densityProfileFor(info);
    this.info = info;
    this.#emit("info", info);
    return info;
  }

  /**
   * Печать 1-bit изображения шириной 384px.
   * @param {Uint8Array} bits — 1 байт на пиксель, 1 = чёрный
   * @param {number} height
   * @param {object} opts — DEFAULT_PRINT_OPTIONS + onProgress(0..1) + signal
   */
  async print(bits, height, opts = {}, width = PRINT_WIDTH) {
    return this.printRaster(packRows(bits, width, height), width / 8, height, opts);
  }

  /** Печать упакованного растра произвольной ширины (bpr байт в строке; штатно 48). */
  async printRaster(packed, bpr, height, opts = {}) {
    if (!this.connected) throw new Error("Принтер не подключён");
    if (this.#busy) throw new Error("Уже идёт печать");
    const o = { ...DEFAULT_PRINT_OPTIONS, profile: this.info.profile ?? "public", ...opts };
    const t = this.transport;
    if (t.kind === "ble") { t.chunkSize = o.chunkSize; t.chunkDelayMs = o.chunkDelayMs; }
    const { pre, raster, post } = buildJob(packed, height, o, bpr);

    this.#busy = true;
    this.#emit("busy", true);
    try {
      this.#log(`Печать: ${bpr * 8}×${height}px, плотность ${densityByte(o)}, ${o.copies} шт., ${t.kind === "ble" ? "BLE" : "SPP"}`);
      for (const p of pre) { await t.write(p); await sleep(50); }
      for (let c = 0; c < o.copies; c++) {
        const progress = (f) => o.onProgress?.((c + f) / o.copies);
        if (t.kind === "ble") await this.#sendBands(t, raster.subarray(8), height, o, progress, bpr);
        else await this.#sendWhole(t, raster, post, o, progress);
        await sleep(100);
      }
      if (o.feedAfterMm > 0) await this.#feedRows(t, Math.round(o.feedAfterMm * 8));
      else await t.write(post);
      this.#log("Отправлено", "ok");
    } finally {
      this.#busy = false;
      this.#emit("busy", false);
    }
  }

  /** BLE: каждая строка — самостоятельная команда GS v 0 в своём пакете (больше одной строки принтер не печатает). */
  async #sendBands(t, packed, height, o, progress, bpr = BYTES_PER_ROW) {
    const rowsPer = 1;
    for (let y = 0; y < height; y += rowsPer) {
      if (o.signal?.aborted) throw new DOMException("Печать отменена", "AbortError");
      const n = Math.min(rowsPer, height - y);
      const pkt = new Uint8Array(8 + n * bpr);
      pkt.set([0x1d, 0x76, 0x30, 0x00, bpr & 0xff, bpr >> 8, n & 0xff, n >> 8]);
      pkt.set(packed.subarray(y * bpr, (y + n) * bpr), 8);
      await t.writePacket(pkt);
      progress((y + n) / height);
    }
  }

  /** SPP: один растр кусками по 500 байт — как BluetoothService.write в WalkPrint. */
  async #sendWhole(t, raster, post, o, progress) {
    const CH = 500;
    for (let i = 0; i < raster.length; i += CH) {
      if (o.signal?.aborted) {
        // принтер ждёт оставшиеся байты растра — досылаем белым, иначе он съест следующие команды
        const rest = new Uint8Array(raster.length - i);
        for (let j = 0; j < rest.length; j += CH) await t.write(rest.subarray(j, j + CH));
        await t.write(post);
        throw new DOMException("Печать отменена", "AbortError");
      }
      await t.write(raster.subarray(i, i + CH));
      progress(Math.min(1, (i + CH) / raster.length));
    }
  }

  async feed(lines = 4) {
    await this.transport?.write(new Uint8Array(lines).fill(0x0a));
  }

  /**
   * Точная протяжка на mm миллиметров (8 точек/мм) пустым растром GS v 0.
   * Назад принтер бумагу не тянет — в протоколе WalkPrint такой команды нет.
   */
  async feedMm(mm) {
    if (!this.connected) throw new Error("Принтер не подключён");
    if (this.#busy) throw new Error("Принтер занят печатью");
    this.#busy = true;
    try {
      await this.#feedRows(this.transport, Math.round(mm * 8));
    } finally {
      this.#busy = false;
    }
    this.#log(`Протяжка ${mm} мм`);
  }

  /** Протяжка ровно на rows точечных строк пустым растром (8 строк = 1 мм). */
  async #feedRows(t, rows) {
    rows = Math.max(1, Math.min(4000, rows));
    if (t.kind === "ble") {
      await this.#sendBands(t, new Uint8Array(rows * BYTES_PER_ROW), rows, {}, () => {});
    } else {
      const job = new Uint8Array(8 + rows * BYTES_PER_ROW);
      job.set([0x1d, 0x76, 0x30, 0x00, BYTES_PER_ROW, 0, rows & 0xff, rows >> 8]);
      for (let i = 0; i < job.length; i += 500) await t.write(job.subarray(i, i + 500));
    }
  }
}
