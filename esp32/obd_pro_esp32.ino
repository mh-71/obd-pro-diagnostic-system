/*
  OBD PRO - ESP32 classic + SN65HVD230 CAN transceiver
  Read-only OBD-II Mode 01 polling over 11-bit CAN.

  Hardware assumptions:
    - Original ESP32 (TWAI-capable), not ESP32-C3/S2/S3 without checking its CAN peripheral support
    - SN65HVD230 CAN transceiver board
    - OBD-II connector: pin 6 CAN-H, pin 14 CAN-L, pin 4/5 ground, pin 16 vehicle battery
    - ESP32 GPIO 5 = CAN TX, GPIO 4 = CAN RX (change for your board)
  IMPORTANT: use a properly protected automotive power supply; do NOT feed car pin 16 directly into ESP32 3V3/VIN.
*/
#include <WiFi.h>
#include <WebServer.h>
#include "driver/twai.h"

static const int CAN_TX_PIN = 5;
static const int CAN_RX_PIN = 4;
static const uint32_t OBD_REQUEST_ID = 0x7DF;
static const uint32_t RESPONSE_ID_MIN = 0x7E8;
static const uint32_t RESPONSE_ID_MAX = 0x7EF;

const char* AP_SSID = "OBD_SCANNER";
const char* AP_PASSWORD = "obdpro123"; // Change this before real use; minimum 8 characters.
WebServer server(80);

struct SensorData {
  float rpm = NAN;
  float coolant_c = NAN;
  float speed_kmh = NAN;
  float engine_load_pct = NAN;
  float throttle_pct = NAN;
  float map_kpa = NAN;
  float intake_air_c = NAN;
  float maf_gps = NAN;
  unsigned long updated_ms = 0;
} sensors;

bool canReady = false;
String lastError = "Starting";

bool validNumber(float v) { return !isnan(v) && isfinite(v); }

bool requestPid(uint8_t pid, uint8_t* response, size_t& responseLen, uint32_t timeoutMs = 250) {
  twai_message_t tx = {};
  tx.identifier = OBD_REQUEST_ID;
  tx.extd = 0;
  tx.rtr = 0;
  tx.data_length_code = 8;
  tx.data[0] = 0x02; // two payload bytes follow: service + PID
  tx.data[1] = 0x01; // Mode 01: current powertrain data (read only)
  tx.data[2] = pid;
  for (int i = 3; i < 8; i++) tx.data[i] = 0x55;

  if (twai_transmit(&tx, pdMS_TO_TICKS(100)) != ESP_OK) {
    lastError = "CAN transmit failed";
    return false;
  }

  const uint32_t start = millis();
  while (millis() - start < timeoutMs) {
    twai_message_t rx = {};
    if (twai_receive(&rx, pdMS_TO_TICKS(20)) != ESP_OK) continue;
    if (rx.extd || rx.rtr || rx.identifier < RESPONSE_ID_MIN || rx.identifier > RESPONSE_ID_MAX) continue;
    if (rx.data_length_code < 4) continue;
    // Positive Mode 01 response is 0x41, followed by PID and data bytes.
    if (rx.data[1] == 0x41 && rx.data[2] == pid) {
      responseLen = rx.data_length_code;
      for (size_t i = 0; i < responseLen; i++) response[i] = rx.data[i];
      return true;
    }
  }
  lastError = "No response for PID 0x" + String(pid, HEX);
  return false;
}

bool readPidBytes(uint8_t pid, uint8_t* a, uint8_t* b = nullptr) {
  uint8_t response[8] = {};
  size_t len = 0;
  if (!requestPid(pid, response, len)) return false;
  if (len < 4) return false;
  *a = response[3];
  if (b) {
    if (len < 5) return false;
    *b = response[4];
  }
  return true;
}

void readSensorsOnce() {
  uint8_t a = 0, b = 0;
  if (readPidBytes(0x0C, &a, &b)) sensors.rpm = ((a * 256.0f) + b) / 4.0f;
  if (readPidBytes(0x05, &a)) sensors.coolant_c = (float)a - 40.0f;
  if (readPidBytes(0x0D, &a)) sensors.speed_kmh = a;
  if (readPidBytes(0x04, &a)) sensors.engine_load_pct = a * 100.0f / 255.0f;
  if (readPidBytes(0x11, &a)) sensors.throttle_pct = a * 100.0f / 255.0f;
  if (readPidBytes(0x0B, &a)) sensors.map_kpa = a;
  if (readPidBytes(0x0F, &a)) sensors.intake_air_c = (float)a - 40.0f;
  if (readPidBytes(0x10, &a, &b)) sensors.maf_gps = ((a * 256.0f) + b) / 100.0f;
  sensors.updated_ms = millis();
}

String numberOrNull(float value, int decimals = 1) {
  if (!validNumber(value)) return "null";
  return String(value, decimals);
}

void handleHealth() {
  String json = "{\"ok\":true,\"device\":\"OBD PRO ESP32\",\"can_ready\":";
  json += canReady ? "true" : "false";
  json += ",\"error\":\"" + lastError + "\"}";
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}

void handleObd() {
  // Keep each request read-only. Query only standard Mode 01 PIDs.
  if (canReady) readSensorsOnce();
  String json = "{\"ok\":true,\"source\":\"ESP32 OBD-II CAN\",\"can_ready\":";
  json += canReady ? "true" : "false";
  json += ",\"updated_ms\":" + String(sensors.updated_ms);
  json += ",\"sensors\":{";
  json += "\"rpm\":" + numberOrNull(sensors.rpm, 0) + ",";
  json += "\"coolant_c\":" + numberOrNull(sensors.coolant_c, 1) + ",";
  json += "\"speed_kmh\":" + numberOrNull(sensors.speed_kmh, 0) + ",";
  json += "\"engine_load_pct\":" + numberOrNull(sensors.engine_load_pct, 1) + ",";
  json += "\"throttle_pct\":" + numberOrNull(sensors.throttle_pct, 1) + ",";
  json += "\"map_kpa\":" + numberOrNull(sensors.map_kpa, 1) + ",";
  json += "\"intake_air_c\":" + numberOrNull(sensors.intake_air_c, 1) + ",";
  json += "\"maf_gps\":" + numberOrNull(sensors.maf_gps, 2);
  json += "}}";
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}

void setupCan() {
  twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT((gpio_num_t)CAN_TX_PIN, (gpio_num_t)CAN_RX_PIN, TWAI_MODE_NORMAL);
  g_config.rx_queue_len = 32;
  g_config.tx_queue_len = 8;
  twai_timing_config_t t_config = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();
  esp_err_t installResult = twai_driver_install(&g_config, &t_config, &f_config);
  if (installResult != ESP_OK) { lastError = "TWAI driver install failed"; return; }
  if (twai_start() != ESP_OK) { lastError = "TWAI start failed"; return; }
  canReady = true;
  lastError = "CAN driver ready; waiting for ECU response";
}

void setup() {
  Serial.begin(115200);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  Serial.print("OBD PRO AP IP: ");
  Serial.println(WiFi.softAPIP());

  setupCan();
  server.on("/api/health", HTTP_GET, handleHealth);
  server.on("/api/obd", HTTP_GET, handleObd);
  server.onNotFound([]() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(404, "application/json", "{\"error\":\"not found\"}");
  });
  server.begin();
  Serial.println("API server started. GET /api/health and /api/obd");
}

void loop() {
  server.handleClient();
  delay(2);
}
