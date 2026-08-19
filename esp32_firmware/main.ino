#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <HardwareSerial.h>

// --- Configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://YOUR_SERVER_IP:3000/api/sensor-data"; // Replace with your computer's local IP address

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
  display.clearDisplay();
  display.setCursor(0, 10);
  display.println("WiFi Connected!");
  display.display();
  delay(2000);
}

// Function to read PMS5003 (simplified)
int readPM25() {
  if (pmsSerial.available()) {
     // Implement proper parsing here based on the PMS5003 datasheet
  }
  return random(10, 50); // Replace with real value
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

  // 2. Alert Logic (Example Thresholds)
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

  // 4. Send Data to Server
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // Construct JSON payload
    String jsonPayload = "{";
    jsonPayload += "\"temperature\":" + String(t) + ",";
    jsonPayload += "\"humidity\":" + String(h) + ",";
    jsonPayload += "\"pm25\":" + String(pm25) + ",";
    jsonPayload += "\"co2\":" + String(co2) + ",";
    jsonPayload += "\"mq135\":" + String(mq135Value) + ",";
    jsonPayload += "\"mq7\":" + String(mq7Value) + ",";
    jsonPayload += "\"no2\":" + String(no2Value);
    jsonPayload += "}";

    int httpResponseCode = http.POST(jsonPayload);
    if (httpResponseCode > 0) {
      Serial.printf("HTTP Response code: %d\n", httpResponseCode);
    } else {
      Serial.printf("Error code: %d\n", httpResponseCode);
    }
    http.end();
  }

  delay(5000); // Send data every 5 seconds
}
