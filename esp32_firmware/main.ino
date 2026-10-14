#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>

#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ================= WIFI CREDENTIALS =================
#define WIFI_SSID "Nandu"
#define WIFI_PASSWORD "12345678"

// ================= FIREBASE CONFIG =================
#define API_KEY "AIzaSyCM0rwFlapYWvq6HCzrGcU9Spn-fhTKIrI"
#define DATABASE_URL "airaqi-54c24-default-rtdb.firebaseio.com"

// ================= FIREBASE OBJECTS =================
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
bool signupOK = false;

// ================= OLED DISPLAY =================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ================= SENSORS =================
#define DHT_PIN 4
#define DHT_TYPE DHT11
DHT dht(DHT_PIN, DHT_TYPE);

#define MQ135_PIN 32
#define MQ7_PIN   33

// ================= ALERTS & ACTUATORS =================
#define BUZZER_PIN    23
#define LED_RED_PIN   19
#define LED_GREEN_PIN 18

unsigned long sendDataPrevMillis = 0;

// =====================================================
// SETUP
// =====================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  // ---------- Initialize Pins ----------
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_RED_PIN, LOW);
  digitalWrite(LED_GREEN_PIN, LOW);

  // ---------- Initialize DHT ----------
  dht.begin();
  Serial.println("DHT11 Sensor initialized on GPIO 4");

  // ---------- Initialize OLED ----------
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED allocation failed!");
    while (true) {
      delay(1000);
    }
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 10);
  display.println("Connecting WiFi...");
  display.display();

  // ---------- WiFi Connection ----------
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi Connected successfully!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // ---------- Firebase Setup ----------
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.signer.test_mode = true;
  signupOK = true;

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // ---------- OLED Status ----------
  display.clearDisplay();
  display.setCursor(0, 10);
  display.println("WiFi: Connected");
  display.println("Firebase: OK");
  display.println("DHT11: Ready");
  display.println("System Ready!");
  display.display();

  delay(2000);
}

// =====================================================
// MAIN LOOP
// =====================================================
void loop() {
  // ---------- 1. Read DHT Sensor ----------
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();

  // Safe fallback if a read glitches momentarily
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Warning: DHT sensor read failed, retrying...");
    delay(500);
    temperature = dht.readTemperature();
    humidity = dht.readHumidity();
  }

  float safeTemp = isnan(temperature) ? 0.0 : temperature;
  float safeHum  = isnan(humidity) ? 0.0 : humidity;

  // ---------- 2. Read Gas Sensors ----------
  int mq135Value = analogRead(MQ135_PIN);
  int mq7Value   = analogRead(MQ7_PIN);

  // ---------- 3. Air Quality Safety Alert ----------
  bool isAirQualityBad = (mq135Value > 2000 || mq7Value > 1000);

  if (isAirQualityBad) {
    digitalWrite(LED_RED_PIN, HIGH);
    digitalWrite(LED_GREEN_PIN, LOW);
    digitalWrite(BUZZER_PIN, HIGH);
  } else {
    digitalWrite(LED_RED_PIN, LOW);
    digitalWrite(LED_GREEN_PIN, HIGH);
    digitalWrite(BUZZER_PIN, LOW);
  }

  // ---------- 4. Update OLED Display ----------
  display.clearDisplay();
  display.setCursor(0, 0);
  display.printf("Temp:  %.1f C\n", safeTemp);
  display.printf("Hum:   %.1f %%\n", safeHum);
  display.printf("MQ135: %d\n", mq135Value);
  display.printf("MQ7:   %d\n", mq7Value);

  if (isAirQualityBad) {
    display.println("AIR:   HAZARDOUS!");
  } else {
    display.println("AIR:   GOOD");
  }
  display.display();

  // Print to Serial Monitor
  Serial.printf("Temp: %.1f C | Hum: %.1f %% | MQ135: %d | MQ7: %d | Status: %s\n",
                safeTemp, safeHum, mq135Value, mq7Value, isAirQualityBad ? "HAZARDOUS" : "GOOD");

  // ---------- 5. Push to Firebase RTDB ----------
  if (Firebase.ready() && signupOK && (millis() - sendDataPrevMillis > 5000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    FirebaseJson json;
    json.set("temperature", safeTemp);
    json.set("temp", safeTemp);
    json.set("humidity", safeHum);
    json.set("hum", safeHum);
    json.set("mq135", mq135Value);
    json.set("mq7", mq7Value);
    json.set("heartbeat", (int)random(1, 100000));

    // Update Latest Node
    Serial.println("Pushing latest data to Firebase...");
    if (Firebase.RTDB.setJSON(&fbdo, "/sensor_data/latest", &json)) {
      Serial.println("Latest data updated SUCCESS");
    } else {
      Serial.print("Latest update FAILED: ");
      Serial.println(fbdo.errorReason());
    }

    // Push to History Node
    Serial.println("Pushing to history node...");
    if (Firebase.RTDB.pushJSON(&fbdo, "/sensor_data/history", &json)) {
      Serial.println("History data pushed SUCCESS");
    } else {
      Serial.print("History push FAILED: ");
      Serial.println(fbdo.errorReason());
    }
  }

  delay(2000);
}
