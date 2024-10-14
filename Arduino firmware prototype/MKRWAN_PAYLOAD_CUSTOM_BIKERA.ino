#include <SPI.h>
#include <Uart.h>
#include <Arduino.h>
#include <MKRWAN.h>
#include <WM1110_Geolocation.hpp>
#include <LbmWm1110.hpp>
#include <Lbmx.hpp>
#include <Tracker_Peripheral.hpp>
#include <Lbm_Modem_Common.hpp>
#include <ArduinoECCX08.h>
#include <SD.h>
#include <FlashStorage.h>

#define PIN_SPI_CS 4

File BikeraLog;
String Err = "This is the last location before power OFF";
byte SavedLastLocationBufferByteArray[] = {};

BikeraLoRaModem modem;
BikeraLoRaPacket packet;
BikeraConnectionSaveData data;

String nwkSKey;
String appSKey;

static constexpr uint32_t EXECUTION_PERIOD = 50;    // [msec.]static WM1110_Geolocation& wm1110_geolocation = WM1110_Geolocation::getInstance();

FlashStorage(flashStore, BikeraConnectionSaveData);

struct BikeraConnectionSaveData {
  String appEui;
  String appKey;
  String devAddr;
  bool OTAAConnectionEstablished;
}

struct BikeraPacketLoRa { // Define the structure of a LoRaWAN packet
  uint8_t preamble[0];
  uint8_t phdr;
  uint8_t phdr_crc;
  uint8_t phyPayload[];
  uint8_t crc;
  uint8_t payload[];
  size_t SendData = 0;
  uint8_t lenght; //keeps track of the payload lenght
  int err;
};

// Function to create a LoRaWAN packet
void createLoRaWANPacket(LoRaWAN_Packet &packet, uint8_t *payload, uint8_t payloadSize) {
  // Fill the preamble
    packet.preamble[] = [33, 48, 68]; // Example preamble value
  }

  // Set the PHDR and PHDR_CRC
  packet.phdr = payloadSize;
  packet.phdr_crc = 0xa8; // Example CRC value

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
  Serial.println("Welcome to Bikera");
  
  // Initialize LoRa module
  if (!Bikeramodem.begin(EU868)) {  //if you're in another region change this to AS923, 915E6, ...
    Serial.println("Starting LoRamodem failed!");
    while(1);
  }
  Serial.print("Your module version is: ");
  Serial.println(modem.version());
  if (modem.version() != ARDUINO_FW_VERSION) {
    Serial.println("Please make sure that the latest modem firmware is installed.");
    Serial.println("To update the firmware upload the 'MKRWANFWUpdate_standalone.ino' sketch.");
  }
  Serial.print("Your device EUI is: ");
  Serial.println(modem.deviceEUI());
  int connected;
  if (OTAAConnectionEstablished != 1) {
    Serial.println("Enter your APP EUI");
    while (!Serial.available());
    appEui = Serial.readStringUntil('\n');

    Serial.println("Enter your APP KEY");
    while (!Serial.available());
    appKey = Serial.readStringUntil('\n');

    appKey.trim();
    appEui.trim();

    connected = modem.joinOTAA(appEui, appKey); //this is confirmation of the network for connection activation
    
    BikeraNetworkDataSaved = 1
    }
if (!connected) {
    Serial.println("Something went wrong; are you indoor? Move near a window and retry");
    while (1) {}
  }

    
  // Initialize ATEC608 or ATEC508 chip
if (!ECCX08.begin()) {
    Serial.println("Failed to communicate with ECC508/ECC608!");
    while(1);
  }
  //See if chip is locked with a private key
if (!ECCX08.locked()) {
    Serial.println("The ECC508/ECC608 is not locked!");
    while (1);
  }

}

void loop() {
  if (Serial.available() > 0) {
    // Read the payload from serial input
    String input =  ; // coordinates of wio or gps module
    HEX input = buffer[];
   
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
