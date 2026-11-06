// Показывает, что видит окно выбора Chrome при разных фильтрах (потом отменяет выбор).
import puppeteer from "puppeteer-core";
const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222", defaultViewport: null });
const page = (await browser.pages()).find((p) => p.url().startsWith("http://localhost"));
const ISSC = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
for (const [label, opts] of [
  ["namePrefix YHK", { filters: [{ namePrefix: "YHK" }], optionalServices: [ISSC] }],
  ["services ISSC", { filters: [{ services: [ISSC] }] }],
]) {
  const promptP = page.waitForDevicePrompt({ timeout: 10000 });
  const req = page.evaluate((o) => navigator.bluetooth.requestDevice(o).then((d) => d.name).catch((e) => e.message), opts);
  const prompt = await promptP;
  await new Promise((r) => setTimeout(r, 6000));
  console.log(label, JSON.stringify(prompt.devices.map((d) => [d.name, d.id])));
  await prompt.cancel();
  await req;
}
browser.disconnect();
