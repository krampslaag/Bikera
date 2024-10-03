#include <Arduino.h>
#include <LoRaWan-Arduino.h>
#include <SX126x-Arduino.h>
#include <Arduino_LoRaWAN_network.h>

// set up the data structures.
Arduino_LoRaWAN_network myLoRaWAN {};

// Define your Helium LoRaWAN keys and settings
const char *devEui = "YOUR_HELIUM_DEVICE_EUI";
const char *appEui = "YOUR_HELIUM_APP_EUI";
const char *appKey = "YOUR_HELIUM_APP_KEY";

void setup() {
  Serial.begin(9600); // Initialize serial communication at 9600 baud rate
  while (!Serial);

  // Initialize the LoRaWAN stack
  if (!myLoRaWAN.begin()) {
    Serial.println("Failed to initialize LoRaWAN");
    while (1);
  }

  // Set device EUI, application EUI, and application key
  myLoRaWAN.setDevEui(devEui);
  myLoRaWAN.setAppEui(appEui);
  myLoRaWAN.setAppKey(appKey);

  // Join the network
  if (!myLoRaWAN.join()) {
    Serial.println("Failed to join LoRaWAN network");
    while (1);
  }

  Serial.println("Joined LoRaWAN network");
}

void loop() {
  // Send a test message through LoRaWAN
  myLoRaWAN.beginPacket();
  myLoRaWAN.print("Hello, Helium!");
  myLoRaWAN.endPacket();

  // Send the same message through RXD/TXD
  Serial.println("Hello, RXD/TXD!");

  // Wait for a while before sending the next message
  delay(60000); // 1 minute
}
