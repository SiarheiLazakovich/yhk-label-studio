// Открывает приложение в CDP-Chrome, собирает ошибки консоли и делает скриншот.
import puppeteer from "puppeteer-core";
const shot = process.argv[2] ?? "/tmp/app.png";
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
let page = (await browser.pages()).find((p) => p.url().startsWith("http://localhost:5173"));
const errors = [];
if (!page) page = await browser.newPage();
page.on("console", (m) => ["error", "warning"].includes(m.type()) && errors.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.setViewport({ width: 1440, height: 900 });
await page.goto("http://localhost:5173/", { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: shot });
console.log(JSON.stringify({ errors, title: await page.title() }, null, 2));
browser.disconnect();
