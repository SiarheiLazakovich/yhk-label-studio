// Packs the browser extension: copies the app files and extension/ into dist/extension/
// (load it via chrome://extensions → Developer mode → Load unpacked) and zips it for the
// Chrome Web Store. Copying only — no transpiling. Usage: npm run extension
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "dist", "extension");
const APP = ["index.html", "manifest.webmanifest", "css", "js", "vendor", "icons", "fonts"];

rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const item of APP) cpSync(join(root, item), join(out, item), { recursive: true });
cpSync(join(root, "extension"), out, { recursive: true });

// the extension version follows package.json
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const manifestPath = join(out, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = version;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const zip = join(root, "dist", `yhk-label-studio-extension-${version}.zip`);
try {
  execFileSync("zip", ["-qr", zip, "."], { cwd: out });
  console.log(`Extension: ${out}\nZip:       ${zip}`);
} catch {
  console.log(`Extension: ${out}\n(zip not found — the folder can still be loaded unpacked)`);
}
if (!existsSync(join(out, "icons", "ext-128.png"))) console.warn("warning: icons/ext-*.png are missing");
