# Payroster: handover for a new Claude session

Read this file first. It tells you what the app is, how the code is laid out, how to build, test and publish it, the pay rules it implements, and how the owner likes to work.

## 1. What Payroster is

An unofficial offline web app (PWA) for **Eurowings Europe cabin crew based in Spain** (Convenio TCP / CLA). The owner is Attila, a purser (PU) and cabin trainer at PMI. He writes in Spanish (sometimes English); answer in the language of his latest message and keep it short and practical.

What it does:
- Reads the **IDPv2 roster PDF** (pdf.js, all times in UTC) and shows each day with what it earns: hours (FDP + additional duty, tiered), per diems (dietas), early check-in bonus, trainer pay, bought days off, sales.
- Estimates the **net payslip** (fixed of month N + variable of month N-1, minus SS and IRPF) and checks it against an uploaded **payslip PDF** (also OCR words from photos).
- Today card: next duty, sky header (night/dawn/day/dusk from real sun altitude), check-in/pick-up/bed/alarm countdowns, delay buttons, quick actions (map, day, crew, layover, rest, more), long-press action sheet, "Coming up" stubs.
- Tools (grouped in 3 categories): Map (2D + 3D globe, live "moving map" with GPS or schedule), Layovers, Calendar export (.ics with alarms), FTL limits (EASA rolling 7/14/28 days, 12 months), Fatigue, Check payslip, Earn more (which day types pay best), What-if simulator, Year summary (with IRPF estimate: state + Illes Balears scales), On-board sales, My year (routes/countries), Leave & days off, Family (birth/adoption leave planner, 19 weeks, blocks), Expiry dates (licences), Compare (with a colleague via link/QR), Backup.
- 11 languages: es, ca, en, de, fr, it, pt, ro, hu, sk, cs.
- All data stays on the device: localStorage `payroster.v1` plus a second copy in IndexedDB (`payroster` / store `kv` / key `state`). No server. Never add one without asking.

Live: https://atibalear.github.io/payroster/ (GitHub Pages, `main` branch = built files only).
This source lives in the **`source` branch** of `atibalear/payroster`.

## 2. Layout

```
src/app.template.html  page shell + ALL CSS + core app code (load/save, render, roster list, hero, payslip table, settings)
src/engine.js          PR: roster parser, pay rules, payslip parser (PDF + OCR), no DOM; also used by node tests
src/i18n.js            all UI strings, 11 languages
src/tools.js           TOOLS list, categories (TOOL_CATS), openTool/closeTool, year, vacation, FTL tool, calendar export…
src/features.js        today card, duty sheet, icons (QI/qIcon), family planner, delay buttons
src/features2.js       fatigue, licences, delay compensation
src/features3.js       sleep plan, weather (Open-Meteo), Face ID lock (WebAuthn), FTL "from today", backup reminder,
                       base warning, IRPF, UI prefs, sky header, coming-up stubs, greeting, month picker, Earn more, meterRow()
src/mapview.js         2D map, moving map (allLegs, renderMoving), layovers
src/globe3d.js         three.js globe
src/airports.js, mapdata.js   airport coords/time zones, country outlines (Natural Earth)
src/pwa_head.html      <head> for the PWA build;  src/sw.template.js  service worker
src/merge_tr.py        merge translations: python3 src/merge_tr.py tmp.json  (tmp.json = {lang:{key:value}} for all 11 langs)
vendor/                qrcode-generator, fflate (inlined at build)
pwa/                   static files copied to dist/: icons (current set: icon5-*), img (earth textures), lib (pdf.js, three.js), manifest
build.py               builds dist/
tests/                 Playwright / jsdom checks (see §4)
```

Build placeholders in the template: `/*I18N*/ /*QR*/ /*FFLATE*/ /*TOOLS*/ /*AIRPORTS*/ /*ENGINE*/ /*DATA*/ /*SETTINGS*/ /*VERSION*/ /*PWA*/ /*SWREG*/`. TOOLS concat order matters: tools, features, mapview, features2, globe3d, features3.

## 3. Build and publish

```
python3 build.py            # -> dist/index.html (PWA), dist/sw.js, version.json, static files; dist/payroster_pub.html
```
Version string = build time `YYYY.MM.DD-HHMM`; the app shows it and the service worker uses it to update.

Publish the PWA: check out `main` of atibalear/payroster in another folder, copy `dist/` over it (keep the old icons), commit, push. GitHub Pages serves it. Before pushing always `git fetch origin main` and look at `git log HEAD..FETCH_HEAD`: another Claude session may have pushed; merge their changes into src first.
Optional Claude artifact copy: publish `dist/payroster_pub.html` (never a copy with personal data).

Personal test data: put a parsed roster in `private/roster.json` and settings in `private/settings.json` (git-ignored); build then also writes `dist/payroster_dev.html` seeded with it. Never commit or publish personal rosters, payslips, colleagues' names or the owner's email.

## 4. Tests (run after every change)

`npm i` (pdfjs-dist, jsdom, playwright). Most tests were written against a seeded single file (`payroster.html` = now `dist/payroster_dev.html`) and serve `pwa/` on localhost; adjust paths when you first run them.
- `tests/dom2.cjs`: loads the page in jsdom in all 11 languages; must print no errors, no `{placeholders}`, no raw keys.
- `tests/toolstest.cjs`: opens every tool in Playwright.
- `tests/overflow.mjs`: nothing wider than the phone (the "Coming up" row scrolls sideways on purpose).
- `tests/tour.cjs light|dark`: screenshots of every screen, look at them.
- `idbt.cjs` (IndexedDB copy), `zt.cjs` (zoom), `td4.cjs`/`sky.cjs` (today card with faked clock), `dd.cjs` (day detail), `tb3.cjs` (bottom bar), `mp.cjs` (month picker), `ipad.cjs` (iPad portrait/landscape), `mmt.cjs`/`gnd.cjs` (moving map, delay).
Use Playwright `devices['iPhone 13']`, `context.clock.install({time})` to fake "now".

## 5. Pay rules implemented (engine.js)

- Salary tables `BASE` (2026) and `BASE_Y` 2027/2028 (new CLA, STAVLA final proposal; switch `settings.cla27`, default on). Levels by seniority date (`levelMode:'date'`, `since`).
- Hourly pay = % of monthly base (art. 24.7.2): PU fdp [0.105, 0.2, 0.32] %, add [0.053, 0.1, 0.16] %; CA fdp [0.065, 0.2, 0.33], add [0.033, 0.1, 0.165]. Tiers at 70 / 110 h (by contract %: TIER_LIMITS).
- Dietas: intl day 66.11, nat day 36.06, intl night 91.35, nat night 53.34. **Never** on off, empty or absence days. Minimum guarantee option.
- Early check-in bonus 30 € (setting). Bought day off (OFF_BEZ) +9 % of base, half/full rules. Uniform 66.66. Fiscal aid 500.
- Trainer works agreement: tBase 270, tTwo 340, tExtra 105, CT 80/80 (owner says trainer pay is outside his control; leave it out of "Earn more").
- From 2027: annual lump sum PU 1.000 € / CA 800 € gross, half in May and November, prorated by contract; 2026 one-off PU 1.750 / CA 1.500 on a payslip the user picks (`settings.claOneOff`).
- Payslip check compares line by line; sales commission per day sums into the month unless a monthly figure is typed (that replaces it).
- Rosters: `parseRosterAll` splits a PDF into months; month objects have `from` (first covered day) and `to` (last day when the PDF only touches the next month, e.g. 1 Jan in a December plan). Partial tail months never wipe a saved full month (`mergeLater`) and the app never opens on them. `R` next to a code = requested day (shown with ★). Bump `PARSER_V` when the reader changes.
- Crew: shown per day; a pure layover day inherits the trip crew; a day with its own legs (e.g. a deadhead) never shows another day's crew.
- Delay per day (`extras[date].delay` minutes) shifts legs, end of duty and the moving map.
- EASA FTL: daily max FDP table, rolling limits; rest is measured to check-in; transport counts as travelling.
- Leave: 19 weeks for each parent (birth or adoption): 6 weeks in one go from the birth or the court/administrative decision, the rest by weeks within 12 months, 2 until the child is 8; nursing leave until 9 months.

## 6. Design rules (owner's taste)

- iOS 26/27 "Liquid Glass" by default (`html.glass`), Classic option. Dark mode is the reference look; light mode = calm grey background, white cards with hairlines, flat grouped inner surfaces.
- Bottom bar "F": month + ‹ › on the left, 3 round buttons (Roster, Tools, My details). Top: big greeting that scrolls away, then a rounded glass top bar with the same shape as the bottom bar.
- Icons: monochrome glyphs on soft squircles (widget style), no emoji in buttons, no glossy/3D effects.
- Compact sky header on the today card (about half height). Payslip cards in month order (this month, then next), eye button (hide amounts) in the corner of every money card.
- Meter tiles (`meterRow`: title, value, bar, one plain line) where a bar explains something.
- iPad: wider content; landscape roster in two columns (today + payslips | calendar + days).
- Must look like our own design, not a copy of CrewNexo or other apps.
- Show the result as screenshots when changing visuals; keep the app uncluttered and "communicative".

## 7. Ideas not done / open

- App Store version: wrap with Capacitor (iOS project), needs a Mac with Xcode and an Apple Developer account. Avoid anything that looks official (name, logo, colours of the airline).
- Automatic roster download (like CrewNexo) is not possible from a web app; would need a native app; never store colleagues' credentials.
- Fatigue-call proportional per diem and the 66 € delayed night flight compensation are entered by hand.
- OM-A chapter 7 (FTL) not available; EASA general rules used.
