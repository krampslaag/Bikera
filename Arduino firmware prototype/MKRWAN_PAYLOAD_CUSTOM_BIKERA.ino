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

int PrivateKeyGenChoice = 0;
String PrivateKeyLockOwner = "";
int PrivateKeyGenChoiceVerify = 0;

int StorePrivateKey = 0;
byte PrivateKeyLockOwnerBuffer[32];
int slot = 0;
byte publicKey[64];
int publicKeyLength;

static constexpr uint32_t EXECUTION_PERIOD = 50;    // [msec.]static WM1110_Geolocation& wm1110_geolocation = WM1110_Geolocation::getInstance();

FlashStorage(BikeraNetworkAppKeyAppEuiSaved, bool);
FlashStorage(BikeraNetworkAppKey, String);
FlashStorage(BikeraNetworkAppEui, String);
FlashStorage(CurrentFreeSlot, int);
FlashStorage(SavedPrivateKeySlot, int);

  
struct BikeraSaveData {
  String appEui;
  String appKey;
  String devAddr;
  bool OTAAConnectionEstablished;
}

struct BikeraLora { // Define the structure of a LoRaWAN packet
  int connected;
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
void createLoRaWANPacket(BikeraLora &packet, uint8_t *payload, uint8_t payloadSize) {
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
  if (!modem.begin(EU868)) {  //if you're in another region change this to AS923, 915E6, ...
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

  BikeraNetworkAppKeyAppEuiSaved.read() = OTAAConnectionEstablished
  if (OTAAConnectionEstablished != 1) {
    Serial.println("Enter The Bikera Network APP EUI and confirm by pressing Enter");
    while (!Serial.available());
    appEui = Serial.readStringUntil('\n');

    Serial.println("Enter The local Bikera sidechain APP KEY");
    while (!Serial.available());
    appKey = Serial.readStringUntil('\n');

    appKey.trim();
    appEui.trim();

    connected = modem.joinOTAA(appEui, appKey); //this is confirmation of the network for connection activation

    BikeraNetworkAppKey.write(appKey);
    BikeraNetworkAppEui.write(appEui);
    BikeraNetworkAppKeyAppEuiSaved.write(1);
  
    if (!connected) {
      Serial.println("Something went wrong; are you indoor? Move near a window and retry");
      while (1) {}
    }
  }
  if (OTAAConnectionEstablished == 1) {
    BikeraNetworkAppKey.read() = appkey
    BikeraNetworkAppEui.read() = appEui
    
    appKey.trim();
    appEui.trim();

    connected = modem.joinOTAA(appEui, appKey); //this is confirmation of the network for connection activation
    if (!connected) {
      Serial.println("Something went wrong; are you indoor? Move near a window and retry");
      while (1) {}
      }
    }
  
  // Initialize ATEC608 or ATEC508 chip
if (!ECCX08.begin()) {
    Serial.println("Failed to communicate with ECC508/ECC608!");
    while(1);
  }
  //See if chip is locked with a private key
if (!ECCX08.locked()) { //at startup the 
    Serial.println("The ECC508/ECC608 is not locked! and you need to enter a private key for this BikeraLockDevice");
    Serial.println("Enter the number to choose (1) Input private key or (2) Generate private key");
    while (!Serial.available());
    PrivateKeyGenChoice = Serial.readStringUntil('\n').toInt();
    if (PrivateKeyGenChoice == 1) {
        Serial.println("Enter your private key, make sure it is correct because this device is write only once protected!")
        Serial.readBytesuntil('\n', PrivateKeyLockOwnerBuffer, 32); 
        Serial.println("this is the private key you entered");
        for (int i = 0; i < 32; i++) {
            Serial.print(PrivateKeyLockOwnerBuffer[i] >> 4, HEX);
            Serial.print(PrivateKeyLockOwnerBuffer[i] & 0x0f, HEX);
            }
        Serial.println("Do you wish to store this permanently in the lock? (1)YES or (2)NO.");
        StorePrivateKey = Serial.readStringUntil('\n').toInt();
        if (StorePrivateKey != 1) {
            Serial.println("Unplug the battery or power supply to restart the configuration");
            while (1) {}
            }
        if (StorePrivateKey == 1) {
            for (int i = 0; i < 32; i++) {
                PrivateKeyLockOwnerBuffer[i].writeSlot(); //private key should should be able to be loaded in slot 1 or 2, 
                }
            sizeof(publicKey) = publicKeyLength;
            Serial.println("this is your corresponding public key");
            for (int i = 0; i < publicKeyLength; i++) {  /* data is written and stored on the eccX08 chip as an array of bytes. 
                                                  SHA256 ECDSA on elliptic curve p-256 is available, this isn't used in any blockchain today but this will probably be the 
                                                  one we will use on th local sidechains.
                                                  needed for compatibility of accesible hardware 
                                                  
                                                  ECDH private key locked in device, should be used only for verifying this device/chip and communications over LoRa
                                                  */
                Serial.print(input[i] >> 4, HEX);
                Serial.print(input[i] & 0x0f, HEX);
                }
            Serial.println();
            }
        PrivateKeyLockOwnerBuffer = {}; // write the data holder of the private key empty so that no trace of the private key in flash memory of not secure part is deleted
        ECCX08.generatePublicKey(Slot, publicKey);
        
        Serial.println("does this public key match the private key pair? (1)'YES' OR (2)'NO'.")
        while (!Serial.available());
        PrivateKeyGenChoiceVerify = Serial.readStringUntil('\n').toInt(); 
    }  
    if (PrivateKeyGenChoice == 2){
        
      
        }
}

if ( PrivateKeyGenChoiceVerify == 1 || PrivateKeyGenChipOk == 1 ){
  
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
