import { t } from "./i18n.js";
// YHK-0926 / WalkPrint driver.
//
// The protocol comes from the decompiled WalkPrint app (com.yhk.rabbit.print: PrintTask / AppConst / ImageUtil):
//   channels   — BLE (ISSC UART, the main one in the browser) and Classic SPP (RFCOMM 00001101-…, how WalkPrint prints).
//   IMPORTANT (BLE) — the printer parses EVERY BLE packet as a separate command and of a GS v 0 in a packet
//                prints ONLY THE FIRST row (measured: 1/2/3 rows per packet → 10/5/3 mm instead of 10 mm).
//                So over BLE: one row = one packet `1D 76 30 00 30 00 01 00` + 48 bytes (56 bytes),
//                written with response (writeValueWithResponse) — that is the flow control.
//   job        — 1D 49 F0 nn (density) → 1B 40 (init) → 1D 76 30 00 xL xH yL yH + raster → 0A 0A 0A 0A
//   raster     — 48 bytes per row, MSB = leftmost pixel, 1 = black, as one block
//   queries    — 1E 47 03 (HV/SV/VOLT/DPI), 1D 67 39 (serial), 1D 67 69 (public id); replies end with 00
//   density    — depends on the firmware (AppConst.setPrintValue):
//                public id ≥ 200 → «public»: 20 / 25 / 30
//                otherwise SV ≥ 1.19 → "new": 12 / 15 / 18; SV < 1.19 → "old": 5 / 10 / 15 + speed 1D 49 F1 1E

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

/** Picks the density profile the same way WalkPrint does (BTCmd.checkFactory / checkVersion). */
export function densityProfileFor(info) {
  const id = parseInt(info?.publicId ?? "", 10);
  if (Number.isFinite(id) && id >= 200) return "public";
  const sv = parseInt(String(info?.firmware ?? "").replace(/[^0-9]/g, ""), 10);
  if (Number.isFinite(sv) && sv < 119) return "old";
  return Number.isFinite(sv) ? "new" : "public";
}

export const DEFAULT_PRINT_OPTIONS = {
  densityLevel: 1, // 0 light, 1 medium, 2 dark
  densityValue: null, // a number overrides the level
  profile: "public",
  feedLines: 4,
  feedAfterMm: 0, // > 0 — after printing feed exactly this many mm instead of feedLines
  copies: 1,
  // BLE only: max packet size (MTU − 3) and a delay when writing without response
  chunkSize: 180,
  chunkDelayMs: 0,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(" ");
const asciiOf = (bytes) => String.fromCharCode(...bytes.filter((b) => b !== 0)).trim();

/** Packs a 1-bit buffer (1 byte per pixel, 1 = black) into rows of 48 bytes, MSB on the left. */
export function packRows(bits, width, height) {
  if (width % 8) throw new Error(t("Raster width must be a multiple of 8"));
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

/** Job parts in WalkPrint order. */
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

// ---------------- transports ----------------

/** Classic Bluetooth SPP via Web Serial — the channel WalkPrint uses. */
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
    if (!SerialTransport.supported) throw new Error(t("Web Serial is unavailable. Use Chrome/Edge over https:// or localhost."));
    let port = null;
    if (reuse) {
      // a previously granted port — no chooser
      const granted = await navigator.serial.getPorts();
      if (granted.length === 1) port = granted[0];
    }
    port ??= await navigator.serial.requestPort({ allowedBluetoothServiceClassIds: [SPP_UUID] });
    // baud rate is ignored for RFCOMM, but the parameter is required
    try {
      await port.open({ baudRate: 115200, bufferSize: 4096 });
    } catch (e) {
      const native = !!port.getInfo().bluetoothServiceClassId;
      throw new Error(native
        ? t("Couldn't open “YHK-0926 – Paired”. Press “Connect” again and choose “cu.YHK-0926”.")
        : t("Couldn't open the port ({m}). Is the printer on and not connected to a phone?", { m: e.message }));
    }
    this.port = port;
    this.writer = port.writable.getWriter();
    this.#readLoop();
    navigator.serial.addEventListener("disconnect", this.#onDisconnect);
    return port.getInfo().bluetoothServiceClassId ? "YHK (Bluetooth SPP)" : t("YHK (SPP port)");
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
      // port closed or read error
    } finally {
      try { this.reader?.releaseLock(); } catch { /* ignore */ }
    }
  }

  get connected() {
    return !!this.writer;
  }

  /** writer.write waits until the data reaches the OS — RFCOMM does its own flow control. */
  async write(bytes) {
    if (!this.writer) throw new Error(t("Printer not connected"));
    await this.writer.write(bytes);
  }

  async close() {
    const port = this.port;
    try { await this.reader?.cancel(); } catch { /* ignore */ }
    // abort drops undelivered data — otherwise close() waits forever if the link never came up
    try { await this.writer?.abort(); } catch { /* ignore */ }
    try { this.writer?.releaseLock(); } catch { /* ignore */ }
    try { await port?.close(); } catch { /* ignore */ }
    this.#closed();
  }
}

/** BLE (ISSC UART). One writePacket call = one packet = one command for the printer. */
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
    if (!BleTransport.supported) throw new Error(t("Web Bluetooth is unavailable."));
    // The printer is dual-mode; Web Bluetooth can't use its Classic entry in the list (id = MAC).
    // Filtering by the ISSC service leaves only the BLE entry.
    this.device = await navigator.bluetooth.requestDevice(acceptAll
      ? { acceptAllDevices: true, optionalServices: [ISSC_SERVICE] }
      : { filters: [{ services: [ISSC_SERVICE] }], optionalServices: [ISSC_SERVICE] });
    this.device.addEventListener("gattserverdisconnected", () => { this.tx = null; this.onClose?.(); });
    let server, lastErr;
    for (let i = 0; i < 3 && !server; i++) {
      try { server = await this.device.gatt.connect(); }
      catch (e) { lastErr = e; log?.(t("Attempt {n}: {m}", { n: i + 1, m: e.message }), "warn"); await sleep(800 * (i + 1)); }
    }
    if (!server) {
      if (/unsupported device/i.test(lastErr?.message)) throw new Error(t("You picked the printer's Classic entry — choose the other YHK-… in the list."));
      throw lastErr;
    }
    const service = await server.getPrimaryService(ISSC_SERVICE);
    this.tx = await service.getCharacteristic(ISSC_TX);
    try {
      const rx = await service.getCharacteristic(ISSC_RX);
      await rx.startNotifications();
      rx.addEventListener("characteristicvaluechanged", (e) => this.onData?.(new Uint8Array(e.target.value.buffer.slice(0))));
    } catch { /* it prints without notifications too */ }
    return `${this.device.name} (BLE)`;
  }

  get connected() {
    return !!this.device?.gatt?.connected && !!this.tx;
  }

  async writePacket(bytes) {
    if (!this.tx) throw new Error(t("Printer not connected"));
    // write with response: the next packet goes out only after the module has taken the previous one
    if (this.tx.properties.write) await this.tx.writeValueWithResponse(bytes);
    else await this.tx.writeValueWithoutResponse(bytes);
    if (this.chunkDelayMs) await sleep(this.chunkDelayMs);
  }

  /** Short commands (queries, density, feed) — fit into one packet. */
  async write(bytes) {
    for (let i = 0; i < bytes.length; i += this.chunkSize) await this.writePacket(bytes.subarray(i, i + this.chunkSize));
  }

  async close() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
  }
}

// ---------------- printer ----------------

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
    const tr = via === "ble" ? new BleTransport() : new SerialTransport();
    tr.onData = (bytes) => this.#onData(bytes);
    tr.onClose = () => {
      if (this.transport !== tr) return;
      this.transport = null;
      this.#log(t("Printer disconnected"), "warn");
      this.#emit("disconnected");
    };
    this.#log(via === "ble" ? t("Connecting over BLE…") : t("Connecting over Bluetooth SPP…"));
    const name = await tr.open({ acceptAll, reuse, log: (m, l) => this.#log(m, l) });
    this.transport = tr;
    this.#log(t("Connected: {name}", { name }), "ok");
    this.#emit("connected", { name, kind: tr.kind });
    return name;
  }

  async disconnect() {
    const tr = this.transport;
    this.transport = null;
    await tr?.close();
    this.#emit("disconnected");
  }

  // Replies arrive in chunks; each reply ends with a 00 byte.
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
    if (this.#busy) throw new Error(t("The printer is busy printing"));
    if (!this.connected) throw new Error(t("Printer not connected"));
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
        // 2S Li-ion: ~6.8 V empty, ~8.4 V full
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
   * Prints a 1-bit image 384px wide.
   * @param {Uint8Array} bits — 1 byte per pixel, 1 = black
   * @param {number} height
   * @param {object} opts — DEFAULT_PRINT_OPTIONS + onProgress(0..1) + signal
   */
  async print(bits, height, opts = {}, width = PRINT_WIDTH) {
    return this.printRaster(packRows(bits, width, height), width / 8, height, opts);
  }

  /** Prints a packed raster of any width (bpr bytes per row; normally 48). */
  async printRaster(packed, bpr, height, opts = {}) {
    if (!this.connected) throw new Error(t("Printer not connected"));
    if (this.#busy) throw new Error(t("Already printing"));
    const o = { ...DEFAULT_PRINT_OPTIONS, profile: this.info.profile ?? "public", ...opts };
    const tr = this.transport;
    if (tr.kind === "ble") { tr.chunkSize = o.chunkSize; tr.chunkDelayMs = o.chunkDelayMs; }
    const { pre, raster, post } = buildJob(packed, height, o, bpr);

    this.#busy = true;
    this.#emit("busy", true);
    try {
      this.#log(t("Printing: {w}×{h}px, density {d}, {n} pcs, {via}", { w: bpr * 8, h: height, d: densityByte(o), n: o.copies, via: tr.kind === "ble" ? "BLE" : "SPP" }));
      for (const p of pre) { await tr.write(p); await sleep(50); }
      for (let c = 0; c < o.copies; c++) {
        const progress = (f) => o.onProgress?.((c + f) / o.copies);
        if (tr.kind === "ble") await this.#sendBands(tr, raster.subarray(8), height, o, progress, bpr);
        else await this.#sendWhole(tr, raster, post, o, progress);
        await sleep(100);
      }
      if (o.feedAfterMm > 0) await this.#feedRows(tr, Math.round(o.feedAfterMm * 8));
      else await tr.write(post);
      this.#log(t("Sent"), "ok");
    } finally {
      this.#busy = false;
      this.#emit("busy", false);
    }
  }

  /** BLE: each row is a standalone GS v 0 command in its own packet (the printer prints no more than one row per packet). */
  async #sendBands(tr, packed, height, o, progress, bpr = BYTES_PER_ROW) {
    const rowsPer = 1;
    for (let y = 0; y < height; y += rowsPer) {
      if (o.signal?.aborted) throw new DOMException(t("Printing cancelled"), "AbortError");
      const n = Math.min(rowsPer, height - y);
      const pkt = new Uint8Array(8 + n * bpr);
      pkt.set([0x1d, 0x76, 0x30, 0x00, bpr & 0xff, bpr >> 8, n & 0xff, n >> 8]);
      pkt.set(packed.subarray(y * bpr, (y + n) * bpr), 8);
      await tr.writePacket(pkt);
      progress((y + n) / height);
    }
  }

  /** SPP: one raster in 500-byte chunks — like BluetoothService.write in WalkPrint. */
  async #sendWhole(tr, raster, post, o, progress) {
    const CH = 500;
    for (let i = 0; i < raster.length; i += CH) {
      if (o.signal?.aborted) {
        // the printer still expects the rest of the raster — pad it with white, or it will swallow the next commands
        const rest = new Uint8Array(raster.length - i);
        for (let j = 0; j < rest.length; j += CH) await tr.write(rest.subarray(j, j + CH));
        await tr.write(post);
        throw new DOMException(t("Printing cancelled"), "AbortError");
      }
      await tr.write(raster.subarray(i, i + CH));
      progress(Math.min(1, (i + CH) / raster.length));
    }
  }

  async feed(lines = 4) {
    await this.transport?.write(new Uint8Array(lines).fill(0x0a));
  }

  /**
   * Feeds exactly mm millimeters (8 dots/mm) with a blank GS v 0 raster.
   * The printer can't feed backwards — the WalkPrint protocol has no such command.
   */
  async feedMm(mm) {
    if (!this.connected) throw new Error(t("Printer not connected"));
    if (this.#busy) throw new Error(t("The printer is busy printing"));
    this.#busy = true;
    try {
      await this.#feedRows(this.transport, Math.round(mm * 8));
    } finally {
      this.#busy = false;
    }
    this.#log(t("Feed {mm} mm", { mm }));
  }

  /** Feeds exactly `rows` dot rows with a blank raster (8 rows = 1 mm). */
  async #feedRows(tr, rows) {
    rows = Math.max(1, Math.min(4000, rows));
    if (tr.kind === "ble") {
      await this.#sendBands(tr, new Uint8Array(rows * BYTES_PER_ROW), rows, {}, () => {});
    } else {
      const job = new Uint8Array(8 + rows * BYTES_PER_ROW);
      job.set([0x1d, 0x76, 0x30, 0x00, BYTES_PER_ROW, 0, rows & 0xff, rows >> 8]);
      for (let i = 0; i < job.length; i += 500) await tr.write(job.subarray(i, i + 500));
    }
  }
}
