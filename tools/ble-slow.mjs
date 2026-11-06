// Печать теста ширины по BLE с медленной отправкой: node tools/ble-slow.mjs [chunk=20] [delayMs=20]
import puppeteer from "puppeteer-core";
const chunk = Number(process.argv[2] ?? 20), delay = Number(process.argv[3] ?? 20);
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null, protocolTimeout: 300000 });
const page = (await browser.pages()).find((p) => p.url().startsWith("http://localhost")) ?? (await browser.pages())[0];
const out = await page.evaluate(async (chunk, delay) => {
  const { widthTest } = await import("/js/tests.js");
  const { packRows } = await import("/js/printer.js");
  const p = window.__p, tx = p.chars["49535343-8841-43f4-a8d4-ecbe34729bb3"];
  const t = widthTest(), H = t.height;
  const job = Uint8Array.from([0x1d,0x49,0xf0,0x19, 0x1b,0x40, 0x1d,0x76,0x30,0x00,48,0,H&255,H>>8, ...packRows(t.bits, 384, H), 0x0a,0x0a,0x0a,0x0a]);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const t0 = performance.now();
  for (let i = 0; i < job.length; i += chunk) { await tx.writeValueWithoutResponse(job.subarray(i, i + chunk)); await sleep(delay); }
  return { bytes: job.length, rows: H, sec: ((performance.now() - t0) / 1000).toFixed(1), kbps: (job.length / 1024 / ((performance.now() - t0) / 1000)).toFixed(2) };
}, chunk, delay);
console.log(JSON.stringify(out));
browser.disconnect();
