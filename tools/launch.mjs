// Launches a separate Google Chrome (temporary profile) with CDP on port 9222.
// Important: via `open`, so macOS treats Chrome as the "responsible" process
// (otherwise TCC kills it when it touches Bluetooth from under a terminal).
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const PROFILE = new URL("../.chrome-profile/", import.meta.url).pathname;
mkdirSync(PROFILE, { recursive: true });
const url = process.argv[2] ?? "https://www.joshmcarthur.com/yhk-mini-printer/qr.html";

execFileSync("open", [
  "-na", "Google Chrome", "--args",
  "--remote-debugging-port=9222",
  `--user-data-dir=${PROFILE}`,
  "--no-first-run", "--no-default-browser-check",
  url,
]);
console.log("Chrome launched via open");
