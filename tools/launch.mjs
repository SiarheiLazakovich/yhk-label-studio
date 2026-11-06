// Запускает отдельный Google Chrome (временный профиль) с CDP на порту 9222.
// Важно: через `open`, чтобы macOS считала Chrome «ответственным» процессом
// (иначе TCC убивает его при доступе к Bluetooth из-под терминала).
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
