// Prints the current layout in GS v 0 bands, syncing on the 1E 47 03 reply.
// node tools/band-test.mjs [bandRows=24] [chunkDelay=20]
import puppeteer from "puppeteer-core";
const band = Number(process.argv[2] ?? 24), delay = Number(process.argv[3] ?? 20);
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null, protocolTimeout: 120000 });
const page = (await browser.pages()).find((p) => p.url().startsWith("http://localhost"));
const out = await page.evaluate(async (band, delay) => {
  const { renderLabel } = await import("/js/render.js");
  const { packRows } = await import("/js/printer.js");
  const pr = window.studio.printer, st = window.studio.state.settings;
  const H = Math.round(st.heightMm * 8);
  const r = renderLabel({ width: 384, height: H, objects: window.studio.state.objects }, st);
  const packed = packRows(r.bits, 384, H);
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const w = async (arr) => {
    const u = arr instanceof Uint8Array ? arr : Uint8Array.from(arr);
    for (let i = 0; i < u.length; i += 180) { await pr.tx.writeValueWithoutResponse(u.subarray(i, i + 180)); await sleep(delay); }
  };
  const t0 = performance.now(), log = [];
  await w([0x1b, 0x40]); await sleep(100);
  await w([0x1d, 0x49, 0xf0, 0x19]); await sleep(100);
  for (let y = 0; y < H; y += band) {
    const n = Math.min(band, H - y);
    const black = packed.subarray(y * 48, (y + n) * 48).reduce((s, b) => s + (b ? 1 : 0), 0);
    await w([0x1d, 0x76, 0x30, 0x00, 48, 0, n & 255, n >> 8]);
    await w(packed.subarray(y * 48, (y + n) * 48));
    const tq = performance.now();
    const ans = await pr.query([0x1e, 0x47, 0x03], 5000);
    log.push(`rows ${y}-${y + n - 1} nonzeroBytes=${black} ack=${ans ? Math.round(performance.now() - tq) + "ms" : "TIMEOUT"}`);
  }
  await w([0x0a, 0x0a, 0x0a]);
  return { H, total: Math.round(performance.now() - t0) + "ms", log };
}, band, delay);
console.log(JSON.stringify(out, null, 1));
browser.disconnect();
