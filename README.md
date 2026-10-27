# OBD PRO — multipage dashboard + ESP32 Live Data starter

## Website pages
- `index.html` — Dashboard
- `live-data.html` — Live Data (ESP32 API polling)
- `dtc.html` — Fault Codes
- `freeze-frame.html` — Freeze Frame
- `readiness.html` — I/M Readiness
- `vehicle-info.html` — Vehicle Info
- `settings.html` — Settings
- `style.css`, `app.js` — shared UI assets
- `live-data.js` — ESP32 API polling, live charts and CSV export
- `esp32/obd_pro_esp32.ino` — starter firmware for original ESP32 + CAN transceiver

## Start the website
Open `index.html` in a modern browser. For API use, preferably run a local server from this folder:
```bash
python -m http.server 8000
```
Open `http://localhost:8000/live-data.html`.

## Real hardware is required
The Live Data page does not fake live values. It shows `—` until it gets a valid JSON response from the ESP32. See `esp32/README.md` for API format, wiring assumptions, firmware upload steps and safety notes.

**Do not connect the firmware to a vehicle until the board, CAN transceiver, pins and automotive power protection are verified.** Bench-test first. Current firmware is read-only and only requests standard Mode 01 PIDs.
