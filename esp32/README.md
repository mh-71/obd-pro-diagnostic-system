# ESP32 firmware starter

## API endpoints
- `GET http://192.168.4.1/api/health`
- `GET http://192.168.4.1/api/obd`

`/api/obd` returns JSON:
```json
{
  "ok": true,
  "source": "ESP32 OBD-II CAN",
  "can_ready": true,
  "updated_ms": 12345,
  "sensors": {
    "rpm": 1726,
    "coolant_c": 89,
    "speed_kmh": 0,
    "engine_load_pct": 34.5,
    "throttle_pct": 12.5,
    "map_kpa": 32,
    "intake_air_c": 36,
    "maf_gps": 3.8
  }
}
```
Unavailable PIDs are returned as `null`; UI marks them unsupported rather than making up a value.

## Hardware assumptions
This starter targets an original ESP32 board with the TWAI peripheral and a CAN transceiver module such as SN65HVD230. GPIO defaults in code are TX=5 and RX=4; verify your board and transceiver pin labels before wiring.

Vehicle OBD-II connector CAN pins on many ISO 15765-4 vehicles are pin 6 (CAN-H), pin 14 (CAN-L), pins 4/5 (ground). Pin 16 is vehicle battery power and MUST NOT be connected directly to ESP32 3V3. Use an automotive-rated protected power supply and appropriate fusing. Do not connect or disconnect wires with ignition on.

## Build steps
1. Install Arduino IDE and Espressif ESP32 board support.
2. Select the exact compatible ESP32 board.
3. Open `obd_pro_esp32.ino`, set TX/RX pins for your board and upload.
4. Connect computer Wi-Fi to `OBD_SCANNER` (password initially `obdpro123`; change it in firmware before use).
5. Open `http://192.168.4.1/api/health` in the browser. Confirm `can_ready:true`.
6. Open the project `live-data.html`, enter `http://192.168.4.1` in API base URL and click **Start live polling**.

## Important limitations and safety
- This is a starter implementation, not a certified automotive tool. Test on a current-limited bench CAN setup first.
- It sends only standard OBD-II Mode 01 read requests. It does not clear codes or send diagnostic writes.
- This first version uses 11-bit CAN IDs and 500 kbit/s, typical for ISO 15765-4 CAN; not all vehicles/protocols are supported.
- PID support varies by vehicle/ECU; unsupported fields should remain null.
- Do not work while driving. Use a parked vehicle, parking brake engaged, and a competent helper.
- On a vehicle, use a properly protected power input, fuse, correct connector, and appropriate isolation/protection. Never short CAN-H/CAN-L or use an unknown pinout.
- This starter currently requests PIDs sequentially and may take a few seconds per refresh. Optimize after confirming basic communication.
- If using `file://` and the browser blocks API access, run a local server from the project folder (`python -m http.server 8000`) and open `http://localhost:8000/live-data.html`, while remaining connected to the ESP32 Wi-Fi. If browser CORS still blocks it, the cleanest next step is to serve the dashboard from the ESP32 itself.
