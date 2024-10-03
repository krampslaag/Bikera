#include <SPI.h>
#include <LoRa.h>

// Define the structure of a LoRaWAN packet
struct LoRaWAN_Packet {
  uint8_t preamble[12];
  uint8_t phdr;
  uint8_t phdr_crc;
  uint8_t phyPayload[64];
  uint8_t crc;
};

// Function to create a LoRaWAN packet
void createLoRaWANPacket(LoRaWAN_Packet &packet, uint8_t *payload, uint8_t payloadSize) {
  // Fill the preamble
  for (int i = 0; i < 12; i++) {
    packet.preamble[i] = 0; // Example preamble value
  }

  // Set the PHDR and PHDR_CRC
  packet.phdr = payloadSize;
  packet.phdr_crc = 0; // Example CRC value

  // Copy the payload
  for (int i = 0; i < payloadSize; i++) {
    packet.phyPayload[i] = payload[i];
  }

  // Set the CRC
  packet.crc = 0xAB; // Example CRC value
}

void setup() {
  Serial.begin(9600);
  while (!Serial);

  Serial.println("LoRaWAN Packet Creation");

  // Initialize LoRa module
  if (!LoRa.begin(915E6)) {
    Serial.println("Starting LoRa failed!");
    while (1);
  }
}

void loop() {
  if (Serial.available() > 0) {
    // Read the payload from serial input
    String input = Serial.readStringUntil('\n');
    uint8_t payload[255];
    uint8_t payloadSize = input.length();

    // Convert input string to byte array
    for (int i = 0; i < payloadSize; i++) {
      payload[i] = input[i];
    }

    // Create the LoRaWAN packet
    LoRaWAN_Packet packet;
    createLoRaWANPacket(packet, payload, payloadSize);

    // Print the packet for verification
    Serial.println("LoRaWAN Packet Created:");
    for (int i = 0; i < sizeof(packet.preamble); i++) {
      Serial.print(packet.preamble[i], HEX);
      Serial.print(" ");
    }
    Serial.println();
    Serial.print("PHDR: ");
    Serial.println(packet.phdr, HEX);
    Serial.print("PHDR_CRC: ");
    Serial.println(packet.phdr_crc, HEX);
    Serial.print("Payload: ");
    for (int i = 0; i < payloadSize; i++) {
      Serial.print(packet.phyPayload[i], HEX);
      Serial.print(" ");
    }
    Serial.println();
    Serial.print("CRC: ");
    Serial.println(packet.crc, HEX);
  }
}
