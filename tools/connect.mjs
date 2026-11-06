// Connects to the running Chrome, calls requestDevice and picks YHK-* in the chooser itself.
// Result: window.__p = { device, chars: {uuid: characteristic}, rx: [] } on the page.
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9222" });
const pages = await browser.pages();
const page = pages.find((p) => p.url().startsWith("https://")) ?? pages[0];
await page.bringToFront();

const OPTIONAL = [
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC UART
  0xae30, 0xaf30, 0xff00, 0xffe0, 0xfff0, 0x18f0, 0xfee7, 0xae3a,
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

const promptP = page.waitForDevicePrompt({ timeout: 30000 });
const resultP = page.evaluate(async (optionalServices) => {
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: ["49535343-fe7d-4ae5-8fa9-9fafd205e455"] }],
    optionalServices,
  });
  let gatt, lastErr;
  for (let i = 0; i < 5 && !gatt; i++) {
    try { gatt = await device.gatt.connect(); }
    catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 1500)); }
  }
  if (!gatt) throw new Error("gatt.connect failed x5: " + lastErr);
  const services = await gatt.getPrimaryServices();
  const p = { device, chars: {}, rx: [] };
  const report = [];
  for (const s of services) {
    const chars = await s.getCharacteristics();
    for (const c of chars) {
      p.chars[c.uuid] = c;
      const props = Object.entries(c.properties.toJSON ? c.properties.toJSON() : {})
        .filter(([, v]) => v).map(([k]) => k);
      const pr = ["read", "write", "writeWithoutResponse", "notify", "indicate"]
        .filter((k) => c.properties[k]);
      report.push({ service: s.uuid, char: c.uuid, props: pr.length ? pr : props });
      if (c.properties.notify || c.properties.indicate) {
        try {
          await c.startNotifications();
          c.addEventListener("characteristicvaluechanged", (e) => {
            const b = new Uint8Array(e.target.value.buffer);
            p.rx.push({ t: Date.now(), char: c.uuid, hex: [...b].map((x) => x.toString(16).padStart(2, "0")).join(" ") });
          });
        } catch (e) { report.push({ char: c.uuid, notifyError: String(e) }); }
      }
    }
  }
  window.__p = p;
  return { name: device.name, id: device.id, report };
}, OPTIONAL);

const prompt = await promptP;
const dev = await prompt.waitForDevice((d) => (d.name ?? "").startsWith("YHK"), { timeout: 30000 });
console.log("Found in picker:", dev.name, dev.id);
await prompt.select(dev);

console.log(JSON.stringify(await resultP, null, 2));
browser.disconnect();
