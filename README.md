**English** | [Русский](README.ru.md)

# YHK Label Studio

A label editor for the **YHK-0926** pocket thermal printer (the one that ships with the WalkPrint app), printing straight from the browser over Web Bluetooth. No build step, works offline as a PWA.

**Live:** https://siarheilazakovich.github.io/yhk-label-studio/ (Chrome or Edge on desktop or Android)

```bash
npm install
npm start            # → http://localhost:5173  (open in Chrome/Edge)
```

## Features

- **Elements:** text with 14 bundled fonts (Cyrillic included), QR codes, 11 barcode standards (Code 128, EAN-13/8, UPC-A/E, Code 39, ITF/ITF-14, Codabar, MSI, Pharmacode), PNG/JPG and SVG images, 8 frame styles.
- **Editing:** drag and resize on the canvas, snapping to 1/2, 1/3 · 2/3 and 1/4 · 3/4 of the label (each group can be toggled), layers, keyboard nudging.
- **Monochrome:** 11 dithering methods (Floyd–Steinberg, Atkinson, Stucki, Jarvis, Sierra, Burkes, blue noise, Bayer…), dot gain compensation, sharpening, dot gain preview.
- **Label size:** 15–58 mm wide at the true 8 dots/mm. Wider than 48 mm, the edges stay blank because the head is 48 mm.
- **Printing:** density (light / medium / dark), copies, trimming blank space, exact feed after printing in mm, 180° rotation.
- **Calibration:** paper feed by +1/+5/+10 mm, width, resolution and 58 mm test prints.
- **Responsive:** three columns on desktop, an icon rail on landscape tablets, bottom sheets on phones and portrait tablets.
- **Languages:** English and Russian, switchable in the header.

## Protocol (from the decompiled WalkPrint 14.7, verified on paper)

| | |
|---|---|
| Channels | WalkPrint: Classic SPP (RFCOMM `00001101-…`). In the browser: **BLE with one row per packet** (see below) |
| Job | `1D 49 F0 nn` (density) → `1B 40` → `1D 76 30 00 30 00 hL hH` + 48 bytes per row → `0A 0A 0A 0A` |
| Raster | MSB = leftmost pixel, 1 = black, 384 dots wide (8 dots/mm) |
| Density | public id ≥ 200 → 20/25/30; otherwise firmware ≥ 1.19 → 12/15/18, < 1.19 → 5/10/15 + `1D 49 F1 1E` |
| Queries | `1E 47 03` → `HV=…,SV=…,VOLT=7980mv,DPI=384`; `1D 67 39` → serial; `1D 67 69` → public id (replies end with `00`) |

### BLE (the main channel in the browser)

The printer accepts the same commands over BLE (ISSC UART `49535343-fe7d-…`, writes to `…8841…`), but it **parses every BLE packet as a separate command**, and of a `GS v 0` in a packet it prints **only the first row**. A large raster therefore comes out as "a couple of white lines" (this is what happens with joshmcarthur/yhk-mini-printer). What works:

- the raster is sent **one row per packet**: `1D 76 30 00 30 00 01 00` + 48 bytes = 56 bytes. With more rows per packet only the first one prints (measured: 1/2/3 rows per packet → 10/5/3 mm);
- write with response (`writeValueWithResponse`): the next packet goes out only after the module acknowledges the previous one;
- density, init and feed are each a separate short packet.

Classic SPP (`cu.YHK-0926` via Web Serial) is kept as a fallback. On macOS it only works while the printer is connected in Settings → Bluetooth; the OS does not bring the Classic link up on its own.

The printer is dual-mode and may appear twice in the chooser under the same name. Web Bluetooth can't use the Classic entry (its id is the MAC; connecting fails with "Unsupported device"), so the app filters by the ISSC service, which leaves only the BLE entry.

### No reverse feed

Verified on a YHK-0926 (SV=V1.01): `ESC K n`, `ESC e n`, `ESC j n` and the `51 78 A0 …` retract command from other cat printers do not move the paper backwards. WalkPrint has no such command either. The `GS v 0` length is unsigned, so "−1" (`FF FF`) means 65,535 rows forward. Labels are aligned by feeding forward only: +1/+5/+10 mm and the "Feed after printing" option.

### No per-dot grayscale

WalkPrint has a hidden `grayPrint` mode: rows of `1D 78 wL wH` + one brightness byte per dot, then 100 white rows and `1B 23 23 43 4C 45 4E` (`##CLEN`). The YHK-0926 (SV=V1.01) prints nothing in it: tried full 388-byte rows and short 180-byte rows, with both polarities. Density (`1D 49 F0 nn`) applies to the whole job. Shades come from dithering only.

## Label size

The head always prints 8 dots/mm (384 px = 48 mm), so the scale is fixed: `px = mm × 8`. A label narrower than 48 mm is the centered part of the print band; anything outside it is shaded in the editor and not printed. Width and height are chosen independently.

## Languages

English is the source language of the code and markup; `js/i18n.js` holds the Russian dictionary, keyed by the English string (`t("Print")` → "Печать"). Without a saved choice the language follows the browser. A missing translation falls back to English.

## Publishing (GitHub Pages) and PWA

- `.github/workflows/pages.yml` collects `index.html`, `manifest.webmanifest`, `sw.js`, `css/`, `js/`, `vendor/`, `icons/`, `fonts/` on every push to `main` and publishes them (Settings → Pages → Source: **GitHub Actions**).
- Paths are relative, so the app also works under `https://<user>.github.io/<repo>/`. Pages serve over HTTPS, which Web Bluetooth requires.
- PWA: manifest and icons in `icons/`, offline cache in `sw.js` (the cache version is replaced with the commit SHA on deploy). On localhost the service worker is not registered unless you open `?sw=1`.
- Web Bluetooth works in Chrome, Edge, Opera and Samsung Internet on desktop and Android (on Android allow the browser "Nearby devices"; older versions also need Location on). On iPhone and iPad every browser is WebKit without Web Bluetooth — use the [Bluefy](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055) browser: open the site in it and print as usual. The app falls back to the older `writeValue` call and does image brightness/contrast without `ctx.filter`, which WebKit lacks.

## iPhone and iPad

Every iOS browser (Safari, Chrome, Edge…) is WebKit without Web Bluetooth, and a home screen PWA runs in WebKit too, so it can't print. Use the **Bluefy** browser, which adds Web Bluetooth, and a shortcut that puts it on the home screen:

1. Install [Bluefy – Web BLE Browser](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055) from the App Store.
2. Open https://siarheilazakovich.github.io/yhk-label-studio/ in Bluefy, tap the printer status in the header → **Connect**, choose YHK-… and allow Bluetooth. Print a test to make sure it works.
3. Get the shortcut: in Safari open [YHK Label Studio.shortcut](https://siarheilazakovich.github.io/yhk-label-studio/ios/YHK%20Label%20Studio.shortcut) (the same link is in the app's printer panel when it's opened in Safari) → **Add Shortcut**.
4. Save the app icon to Photos: open [apple-touch-icon.png](https://siarheilazakovich.github.io/yhk-label-studio/icons/apple-touch-icon.png), long-press → **Save to Photos**.
5. In the Shortcuts app long-press **YHK Label Studio** → **Share** → **Add to Home Screen**. Tap the icon next to the name → **Choose Photo** → pick the saved icon → **Add**.
6. The home screen icon now opens Bluefy. If Bluefy doesn't come back to the app by itself, make the site its home page or a bookmark.

It isn't a true PWA: iOS briefly shows a Shortcuts banner on launch, and the app runs inside Bluefy's window. The shortcut is generated and signed by `tools/make-ios-shortcut.py` (macOS, `shortcuts sign`).

## Browser extension

The same app also ships as a Chrome/Edge extension (Manifest V3): the toolbar icon opens it full-size in a tab, or focuses the tab if it is already open. Web Bluetooth and Web Serial work on extension pages, and no extra permissions are requested.

```bash
npm run extension     # → dist/extension/ and dist/yhk-label-studio-extension-<version>.zip
```

Load it with chrome://extensions → Developer mode → **Load unpacked** → `dist/extension`. The zip is ready for the Chrome Web Store. Packing only copies files (`index.html`, `css/`, `js/`, `vendor/`, `icons/`, `fonts/` plus `extension/`), there is no transpiling. The extension version follows `package.json`.

## Layout

```
index.html, css/app.css               UI
manifest.webmanifest, sw.js, icons/   PWA
js/printer.js     BLE/SPP driver + ESC/POS (WalkPrint)
js/render.js      layout rendering, dithering, trimming, barcodes, frames
js/app.js         editor: objects, dragging, properties, printing
js/ui.js          UI shell: panels, popovers, sheets, tabs, log
js/i18n.js        t(), Russian dictionary, RU/EN switch
js/tests.js       test patterns: width 48/58 mm, resolution
vendor/           qrcode-generator (MIT), JsBarcode 3.12 (MIT)
fonts/            Fontsource woff2 (SIL OFL 1.1, licenses in fonts/licenses/)
server.mjs        local static server
extension/        extension manifest, background worker, _locales (en, ru)
ios/              signed iOS shortcut that opens the app in Bluefy
tools/            debugging over the Chrome DevTools Protocol (Puppeteer), extension packing
```

## Debugging without clicks (tools/)

`npm run chrome` starts a separate Chrome with CDP on :9222. It is launched via `open`, because macOS kills Chrome on Bluetooth access when it is started from a terminal (TCC). Then:

- `node tools/connect.mjs` picks YHK-… in the BLE chooser and prints the GATT characteristics;
- `node tools/send.mjs "1e 47 03"` sends raw bytes and shows the reply;
- `node tools/app-e2e.mjs out.png [print]` runs the whole app end to end.
