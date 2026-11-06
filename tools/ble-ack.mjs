// Печать теста ширины по BLE с записью С ПОДТВЕРЖДЕНИЕМ (writeValueWithResponse).
// node tools/ble-ack.mjs [chunk=180]
import puppeteer from "puppeteer-core";
const chunk = Number(process.argv[2] ?? 180);
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null, protocolTimeout: 300000 });
const page = (await browser.pages()).find((p) => p.url().startsWith("http://localhost")) ?? (await browser.pages())[0];
const out = await page.evaluate(async (chunk) => {
  const { widthTest } = await import("/js/tests.js");
  const { packRows } = await import("/js/printer.js");
  const tx = window.__p.chars["49535343-8841-43f4-a8d4-ecbe34729bb3"];
  const t = widthTest(), H = t.height;
  const job = Uint8Array.from([0x1d,0x49,0xf0,0x19, 0x1b,0x40, 0x1d,0x76,0x30,0x00,48,0,H&255,H>>8, ...packRows(t.bits, 384, H), 0x0a,0x0a,0x0a,0x0a]);
  const t0 = performance.now();
  let errors = 0;
  for (let i = 0; i < job.length; i += chunk) {
    try { await tx.writeValueWithResponse(job.subarray(i, i + chunk)); } catch (e) { errors++; if (errors > 3) return { error: e.message, at: i }; }
  }
  const s = (performance.now() - t0) / 1000;
  return { bytes: job.length, rows: H, sec: s.toFixed(1), kbps: (job.length / 1024 / s).toFixed(2), errors };
}, chunk);
console.log(JSON.stringify(out));
browser.disconnect();
