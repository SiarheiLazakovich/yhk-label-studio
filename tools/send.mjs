// node tools/send.mjs "1e 47 03" ["1d 67 39" ...] — writes hex packets to TX and prints the RX replies.
import puppeteer from "puppeteer-core";
const TX = "49535343-8841-43f4-a8d4-ecbe34729bb3";
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222" });
const page = (await browser.pages()).find((p) => p.url().startsWith("https://")) ?? (await browser.pages())[0];
const out = await page.evaluate(async (packets, TX) => {
  const p = window.__p;
  if (!p?.device.gatt.connected) return { error: "not connected" };
  const res = [];
  for (const hex of packets) {
    const before = p.rx.length;
    const bytes = new Uint8Array(hex.trim().split(/\s+/).map((h) => parseInt(h, 16)));
    await p.chars[TX].writeValueWithoutResponse(bytes);
    await new Promise((r) => setTimeout(r, 800));
    const rx = p.rx.slice(before).map((r) => r.hex);
    const ascii = rx.join(" ").split(" ").filter(Boolean).map((h) => { const c = parseInt(h, 16); return c >= 32 && c < 127 ? String.fromCharCode(c) : "."; }).join("");
    res.push({ sent: hex, rx, ascii });
  }
  return res;
}, process.argv.slice(2), TX);
console.log(JSON.stringify(out, null, 2));
browser.disconnect();
