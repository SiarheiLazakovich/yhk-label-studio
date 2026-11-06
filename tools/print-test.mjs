// node tools/print-test.mjs [--no-start] [--invert] — печатает полосу 384x40: левая половина чёрная.
import puppeteer from "puppeteer-core";
const args = new Set(process.argv.slice(2));
const TX = "49535343-8841-43f4-a8d4-ecbe34729bb3";
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222" });
const page = (await browser.pages()).find((p) => p.url().startsWith("https://")) ?? (await browser.pages())[0];
const out = await page.evaluate(async (TX, start, invert) => {
  const p = window.__p;
  if (!p?.device.gatt.connected) return "not connected";
  const ch = p.chars[TX];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const W = 48, H = 40;
  const bmp = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = x < 24 ? 0xff : 0x00;
    bmp[y * W + x] = invert ? v ^ 0xff : v;
  }
  const parts = [[0x1b, 0x40]];
  if (start) parts.push([0x1d, 0x49, 0xf0, 0x19]);
  parts.push([0x1d, 0x76, 0x30, 0x00, W, 0, H & 0xff, H >> 8], bmp, [0x0a, 0x0a, 0x0a, 0x0a]);
  for (const part of parts) {
    const data = Uint8Array.from(part);
    for (let i = 0; i < data.length; i += 180) {
      await ch.writeValueWithoutResponse(data.slice(i, i + 180));
      await sleep(40);
    }
    await sleep(200);
  }
  await sleep(1000);
  return { sent: parts.reduce((a, b) => a + b.length, 0), rx: p.rx.slice(-5).map((r) => r.hex) };
}, TX, !args.has("--no-start"), args.has("--invert"));
console.log(JSON.stringify(out, null, 2));
browser.disconnect();
