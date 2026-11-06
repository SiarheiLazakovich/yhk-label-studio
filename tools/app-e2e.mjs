// E2E: подключение через кнопку приложения (сам выбирает YHK-*), добавление QR, печать.
import puppeteer from "puppeteer-core";
const [, , shotPath, doPrint] = process.argv;
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const pages = await browser.pages();
// освобождаем соединение, занятое тестовой вкладкой
for (const p of pages.filter((p) => p.url().startsWith("https://"))) {
  await p.evaluate(() => window.__p?.device.gatt.disconnect()).catch(() => {});
  await p.close();
}
const page = (await browser.pages()).find((p) => p.url().startsWith("http://localhost:5173"));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.setViewport({ width: 1440, height: 900 });
await page.reload({ waitUntil: "networkidle0" });
await page.bringToFront();

const prompt = page.waitForDevicePrompt({ timeout: 30000 });
await page.click("#btnConnect");
const dev = await (await prompt).waitForDevice((d) => (d.name ?? "").startsWith("YHK"), { timeout: 30000 });
await (await prompt).select(dev);
await page.waitForFunction(() => window.studio.printer.connected, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500)); // getInfo

// QR + подпись, обрезка пустоты
await page.click('[data-add="qr"]');
await page.evaluate(() => {
  const s = window.studio.state;
  const qr = s.objects.find((o) => o.type === "qr");
  Object.assign(qr, { data: "https://github.com/joshmcarthur/yhk-mini-printer", size: 150, y: 150, x: 117 });
  s.objects = s.objects.filter((o) => o.type !== "rect");
  s.settings.trim = true;
  document.getElementById("trim").checked = true;
  window.studio.render();
});
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: shotPath });

const info = await page.evaluate(() => ({
  devName: document.getElementById("devName").textContent,
  devInfo: document.getElementById("devInfo").textContent,
  hint: document.getElementById("printHint").textContent,
  log: [...document.querySelectorAll("#log li")].slice(0, 8).map((l) => l.textContent),
}));
if (doPrint === "print") {
  await page.click("#btnPrint");
  await page.waitForFunction(() => !window.studio.printer.busy, { timeout: 120000, polling: 500 });
  info.afterPrint = await page.evaluate(() => [...document.querySelectorAll("#log li")].slice(0, 4).map((l) => l.textContent));
}
console.log(JSON.stringify({ errors, ...info }, null, 2));
browser.disconnect();
