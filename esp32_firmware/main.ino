#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <HardwareSerial.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

// --- Configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// --- Firebase Configuration ---
#define API_KEY "YOUR_FIREBASE_API_KEY"
#define DATABASE_URL "YOUR_FIREBASE_DATABASE_URL" 

// Define Firebase Data objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// --- OLED Display ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// --- DHT22 ---
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

// --- Analog Sensors ---
#define MQ135_PIN 32
#define MQ7_PIN 33
#define NO2_PIN 34 

// --- Alerts ---
#define BUZZER_PIN 23
#define LED_RED_PIN 19
#define LED_GREEN_PIN 18

// --- Serial for PM2.5 (PMS5003) & CO2 (MH-Z19B) ---
HardwareSerial pmsSerial(1);
HardwareSerial co2Serial(2);

unsigned long sendDataPrevMillis = 0;
bool signupOK = false;

void setup() {
  Serial.begin(115200);

  // Initialize sensors
  dht.begin();
  
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  
  // Initialize Serial ports for sensors (RX, TX)
  pmsSerial.begin(9600, SERIAL_8N1, 16, 17); 
  co2Serial.begin(9600, SERIAL_8N1, 25, 26); 

  // Initialize OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("SSD1306 allocation failed"));
    for(;;);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(WHITE);
  display.setCursor(0, 10);
  display.println("Connecting WiFi...");
  display.display();

  // Connect WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  
  // --- Initialize Firebase ---
  display.clearDisplay();
  display.setCursor(0, 10);
  display.println("Connecting Firebase...");
  display.display();

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Bypass Authentication completely (Database is in Test Mode)
  config.signer.test_mode = true; 
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  signupOK = true;

  display.clearDisplay();
  display.setCursor(0, 10);
  display.println("System Ready!");
  display.display();
  delay(2000);
}

// Function to read PMS5003 (simplified)
int readPM25() {
  if (pmsSerial.available()) {
     // Implement proper parsing here based on the PMS5003 datasheet
  }
  return random(10, 50); // Currently a placeholder, replace with actual serial parsing
}

// Function to read MH-Z19B (CO2)
int readCO2() {
  byte cmd[9] = {0xFF,0x01,0x86,0x00,0x00,0x00,0x00,0x00,0x79};
  co2Serial.write(cmd, 9);
  delay(100);
  if (co2Serial.available()) {
    byte response[9];
    co2Serial.readBytes(response, 9);
    if (response[0] == 0xFF && response[1] == 0x86) {
      int co2 = (256 * response[2]) + response[3];
      return co2;
    }
  }
  return -1; // Error
}

void loop() {
  // 1. Read Sensors
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  int mq135Value = analogRead(MQ135_PIN);
  int mq7Value = analogRead(MQ7_PIN);
  int no2Value = analogRead(NO2_PIN);
  int pm25 = readPM25();
  int co2 = readCO2();

  // 2. Alert Logic (Hardware Thresholds)
  bool isAirQualityBad = (pm25 > 100 || co2 > 1000 || mq135Value > 2000);
  if (isAirQualityBad) {
    digitalWrite(LED_RED_PIN, HIGH);
    digitalWrite(LED_GREEN_PIN, LOW);
    digitalWrite(BUZZER_PIN, HIGH); // Sound buzzer
  } else {
    digitalWrite(LED_RED_PIN, LOW);
    digitalWrite(LED_GREEN_PIN, HIGH);
    digitalWrite(BUZZER_PIN, LOW); // Silence buzzer
  }

  // 3. Update OLED
  display.clearDisplay();
  display.setCursor(0, 0);
  display.printf("T:%.1fC H:%.1f%%\n", t, h);
  display.printf("PM2.5:%d CO2:%d\n", pm25, co2);
  display.printf("MQ135:%d MQ7:%d\n", mq135Value, mq7Value);
  display.display();

  // 4. Send Data to Firebase every 5 seconds
  if (Firebase.ready() && signupOK && (millis() - sendDataPrevMillis > 5000 || sendDataPrevMillis == 0)) {
    sendDataPrevMillis = millis();

    // Create a JSON object for Firebase
    FirebaseJson json;
    json.set("temperature", t);
    json.set("humidity", h);
    json.set("pm25", pm25);
    json.set("co2", co2);
    json.set("mq135", mq135Value);
    json.set("mq7", mq7Value);
    json.set("no2", no2Value);
    
    // Get current Unix timestamp from Firebase server
    json.set(".sv", "timestamp"); 

    // Push the new reading to the "sensor_data/history" node
    if (Firebase.RTDB.pushJSON(&fbdo, "sensor_data/history", &json)) {
      Serial.println("Data pushed to history successfully");
    } else {
      Serial.println("Failed to push to history: " + fbdo.errorReason());
    }

    // Set the latest reading at "sensor_data/latest" (overwrites old data for the dashboard to read instantly)
    if (Firebase.RTDB.setJSON(&fbdo, "sensor_data/latest", &json)) {
      Serial.println("Latest data updated successfully");
    } else {
      Serial.println("Failed to update latest data: " + fbdo.errorReason());
    }
  }

  // Prevent CPU lockup and give sensors time to stabilize between reads
  delay(2000);
}
