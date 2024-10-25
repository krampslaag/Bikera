#include <SPI.h>
#include <Arduino.h>
#include <MKRWAN.h>
#include <ArduinoECCX08.h>
#include <SD.h>
#include <FlashStorage.h>
#include <AlmostRandom.h>
#include <ECCX08_DEFAULT_BIKERA_CONFIG.h>

#define PIN_SPI_CS 4
#define MAX_PREAMBLE_SIZE 16
#define MAX_PAYLOAD_SIZE 256

File BikeraLog;
String Error = "This is the last location before power OFF";
byte SavedLastLocationBufferByteArray[] = {};

String nwkSKey;
String appSKey;
byte OTAAConnectionEstablished;
bool VerifyAppKeyAppEuiCorrect = 0;
bool ConfigurationChipOk = 0;
byte configCopy[sizeof(ECCX08_DEFAULT_BIKERA_CONFIG)];

byte PrivateKeyGenChoice = 0;
String PrivateKeyLockOwner = "";
int PrivateKeyGenChoiceVerify = 0;

byte SavedPrivateKeyToSlot = 0;
int StorePrivateKey = 0;
byte ConfigurationAlreadyLoaded = 0;
byte StoreConfiguration = 0;
byte PrivateKeyLockOwnerBuffer[32];
byte slot = 0;
byte publicKey[64];
byte publicKeyLength;
uint8_t *payLoad;
uint8_t payloadSize;

static const uint32_t EXECUTION_PERIOD = 50;    // [msec.]static WM1110_Geolocation& wm1110_geolocation = WM1110_Geolocation::getInstance();

struct FlashSaved {
  bool BikeraNetworkAppKeyAppEuiSaved;
  char BikeraNetworkAppKey [80];
  char BikeraNetworkAppEui [80];
  byte CurrentFreeSlot;
  bool SavedPrivateKeyToSlotFlash;
  bool ConfigurationAlreadyLoadedFlash;
  bool AppKeyAppEuiVerified;
};

struct LoRaSavedData {
  String appEui = "";
  String appKey = "";
  String devAddr;
  bool verified;
};

struct LoRaBikeraPacket { // Define the structure of a LoRaWAN packet
  int connected;
  uint8_t* preamble;  // should this have random generated numbers? check for further connection..
  uint8_t* payload; 
  size_t SendData = 0;
  uint8_t length; //keeps track of the payload length
  int err;
  uint8_t* payloadInput;
};

FlashStorage(flashmem, FlashSaved);

LoRaModem modem;
LoRaSavedData data;
LoRaBikeraPacket packet;
AlmostRandom ranDom;
FlashSaved flash;

void setup() {

  // Start UART communication
  Serial.begin(9600);
  while (!Serial);
  Serial.println("Welcome to Bikera");
  Serial.setTimeout(30000);
  
  // allocate memory for variable arrays
  packet.preamble = (uint8_t*)malloc(MAX_PREAMBLE_SIZE * sizeof(uint8_t)); // allocate memory for dynamic size array 
  packet.payload = (uint8_t*)malloc(MAX_PAYLOAD_SIZE * sizeof(uint8_t));
  packet.payloadInput = (uint8_t*)malloc(MAX_PAYLOAD_SIZE * sizeof(uint8_t));

  // read the memory of the 2Mb internal SPI connected memory and fill the FlashSaved variables with the stored value
  flash = flashmem.read();
  
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

 //Appeui and Appkey need to be entered, check weither it is already stored in flashdrive
  OTAAConnectionEstablished = flash.BikeraNetworkAppKeyAppEuiSaved; 
  if (!OTAAConnectionEstablished) {
    Serial.println("Enter The Bikera Network APP EUI and confirm by pressing Enter");
    while (!Serial.available());
    data.appEui = Serial.readStringUntil('\n');

    Serial.println("Enter The local Bikera sidechain APP KEY");
    while (!Serial.available());
    data.appKey = Serial.readStringUntil('\n');
    
    data.appKey.toCharArray(flash.BikeraNetworkAppKey, 80);
    data.appEui.toCharArray(flash.BikeraNetworkAppEui, 80);
    flash.BikeraNetworkAppKeyAppEuiSaved = 1;
    OTAAConnectionEstablished = 1;
    
  }
  data.verified = flash.AppKeyAppEuiVerified;
  if (data.verified == 1) {
      data.appKey = flash.BikeraNetworkAppKey;
      data.appEui = flash.BikeraNetworkAppEui;
  }
  if (OTAAConnectionEstablished == 1 && data.verified == 0 ) {
    Serial.println("this is the stored appEui:");
    Serial.println(flash.BikeraNetworkAppEui);
    Serial.println("this is the stored appKey:");
    Serial.println(flash.BikeraNetworkAppKey);
    Serial.println("Verify if this is correct and verify with (1)Yes or (2)No");
    while (!Serial.available());
    VerifyAppKeyAppEuiCorrect = Serial.readStringUntil('\n').toInt();
  }
  if (VerifyAppKeyAppEuiCorrect == 1) {
        flash.AppKeyAppEuiVerified = 1;
  }
  if (VerifyAppKeyAppEuiCorrect == 2) {
        flash.BikeraNetworkAppKeyAppEuiSaved = 0;  // flashmemory variable gets set to 0, which resets this part of the setup
        Serial.println("appKey and appEui reset, unplug the power and restart the setup.");
  }
  if (OTAAConnectionEstablished == 1 && data.verified == 1) {
    packet.connected = modem.joinOTAA(data.appEui, data.appKey); //this is confirmation of the network for connection activation
    if (!packet.connected) {
          Serial.println("Something went wrong; are you indoor? Move near a window and retry");
          while (1) {}
    }
    Serial.println("connecting to IoT network");
  }

  // Initialize ATEC608 or ATEC508 chip
  if (!ECCX08.begin()) {
    Serial.println("Failed to communicate with ECC508/ECC608!");
    while(1);
  }
  memcpy(configCopy, ECCX08_DEFAULT_BIKERA_CONFIG, sizeof(ECCX08_DEFAULT_BIKERA_CONFIG));
  //See if chip is locked with a private key
  if (!ECCX08.locked()) { //at startup the 
    Serial.println("The ECC508/ECC608 is not locked! and you need to enter a private key for this BikeraLockDevice");
    Serial.println("Enter the number to choose (1) Input private key or (2) Generate private key");
    while (!Serial.available());
    PrivateKeyGenChoice = Serial.readStringUntil('\n').toInt();
    if (PrivateKeyGenChoice == 1) {
        Serial.println("Enter your private key, make sure it is correct because this device is write only once protected! ");
        Serial.println("the Private key is inputted as 2 hexadecimal values per byte, totalling to 64 hexadecimal numbers for 32Byte or 256bit encryption.");
        while (!Serial.available());
        Serial.readBytesUntil('\n', PrivateKeyLockOwnerBuffer, 32); // ***the input was D and it stored the value as 4, so somehow it translates the inputted bytes from 
                                                                    //the serial monitor to a different form
        Serial.println("this is the private key you entered");
        for (int i = 0; i < 32; i++) {
            Serial.print(PrivateKeyLockOwnerBuffer[i] >> 4, HEX); // print last 4 bit as hexadecimal number
            Serial.print(PrivateKeyLockOwnerBuffer[i] & 0x0f, HEX); // print first 4 bit in hexadecimal format
            }
        Serial.println("Do you wish to store this permanently in the lock? (1)YES or (2)NO.");
        while (!Serial.available());
        StorePrivateKey = Serial.readStringUntil('\n').toInt();
        if (StorePrivateKey == 2) {
            Serial.println("Unplug the battery or power supply to restart the configuration");
            while (1);
            }
        if (StorePrivateKey == 1) {
            ECCX08.writeSlot(slot, PrivateKeyLockOwnerBuffer, 32); //private key should should be able to be loaded in slot 1 or 2, 
            }
            ECCX08.generatePublicKey(slot, publicKey);
            publicKeyLength = sizeof(publicKey);  //if you're using a private key used in Bitcoin or Ethereum; this will not generate the same Public key
            Serial.println("this is your corresponding public key");
            for (int i = 0; i < publicKeyLength; i++) {  /* data is written and stored on the eccX08 chip as an array of bytes. 
                                                  SHA256 ECDSA on elliptic curve p-256 is available, this isn't used in many blockchain today but this will probably be the 
                                                  one we will use on th local sidechains, due to the memory restraints and power consumption by running A BIP66 
                                                  ipmlemantation for the SAMD21 chip, itterations and field testing will provide details on power consumption
                                                  and the purpose of having/needing a crypto chip onboard.. ( NIST p-256 curve, is used with NEO and ontology)
                                                  needed for compatibility of accesible hardware 
                                                  ECDH private key locked in device, should be used only for verifying this device/chip and communications over LoRa
                                                  */
                Serial.print(publicKey[i] >> 4, HEX);
                Serial.print(publicKey[i] & 0x0f, HEX);
                }
             Serial.println();
             memset(PrivateKeyLockOwnerBuffer, 0, sizeof(PrivateKeyLockOwnerBuffer));  // write the data holder of the private key empty so that no trace of the private key in flash memory 
             Serial.println("does this public key match the private key pair? (1)'YES' OR (2)'NO'.");
             while (!Serial.available());
             PrivateKeyGenChoiceVerify = Serial.readStringUntil('\n').toInt(); 
             if ( PrivateKeyGenChoiceVerify == 1 ) {
                Serial.println("Succes, the device will now configure and lock.");
                flash.SavedPrivateKeyToSlotFlash = 1;
                StoreConfiguration = 1;
                }
             if ( PrivateKeyGenChoiceVerify == 2 ){
               Serial.println("Try another curve then secp256k1, Last chance to pull the power and restart");
               Serial.println("Go YOLO and press ENTER to continue");
               while (!Serial.available());
               Serial.readStringUntil('\n');
               flash.SavedPrivateKeyToSlotFlash = 1;
               StoreConfiguration = 1;
                }
              
      }         

      if (PrivateKeyGenChoice == 2){
          ECCX08.generatePrivateKey(slot, publicKey);
          ECCX08.generatePublicKey(slot, publicKey);
          publicKeyLength = sizeof(publicKey); //if you're using a private key used in Bitcoin or Ethereum; this will not generate the same Public key
          Serial.println("this is your corresponding public key");
          for (int i = 0; i < publicKeyLength; i++) {
                Serial.print(publicKey[i] >> 4, HEX);
                Serial.print(publicKey[i] & 0x0f, HEX);
                } 
          flash.SavedPrivateKeyToSlotFlash = 1;
          StoreConfiguration = 1;
          }
  }
  SavedPrivateKeyToSlot = flash.SavedPrivateKeyToSlotFlash;
  ConfigurationAlreadyLoaded = flash.ConfigurationAlreadyLoadedFlash; 
  if (StoreConfiguration == 1 && ConfigurationAlreadyLoaded != 1) {
          ECCX08.writeConfiguration(ECCX08_DEFAULT_BIKERA_CONFIG);
          flash.ConfigurationAlreadyLoadedFlash = 1;
  }
  if (ECCX08.readConfiguration(configCopy)) {
          Serial.println("EECX08 configuration loaded correctly.");
          ConfigurationChipOk = 1;
  }
  if (!ECCX08.readConfiguration(configCopy)) {
          Serial.println("Configuration file loading failed or is not the same as first entry, check if file is corrupted!");
          Serial.println("Press enter to restart the device to load the current updated or altered configuration file or unplug the power to retry.");
          while(!Serial.available());
          Serial.readStringUntil('\n');
          flash.ConfigurationAlreadyLoadedFlash = 0;
  }
  if ( SavedPrivateKeyToSlot == 1 && ConfigurationChipOk == 1 ){
          if (!ECCX08.lock()) {
              Serial.println("Locking ECCX08 configuration failed!");
              while (1);
              }
          Serial.println("ECCX08 locked & loaded");
          Serial.println();
  }
   flashmem.write(flash);
   modem.minPollInterval(60);
  // NOTE: independent of this setting, the modem will
  // not allow sending more than one message every 2 minutes,
  // this is enforced by firmware and can not be changed. #MKWRWAN limitation
}

// Function to create a LoRaWAN packet
void createBikeraLoraPacket(uint8_t *payLoad, uint8_t payloadSize) {
  
  int EncodeMessage = 0; 
  byte signature[64];
  byte RandomBytenumber;
  
  // Fill preamble function, now it will have fixed 6 numbers
  for(int i=0; i < 5; i++) {
  packet.preamble[i] = random(15);  
  }
  
  if (Serial.available() > 0) { // testing if input is comming through the network with right output 
    // Read the payload from serial input
    Serial.readBytesUntil('\n', packet.payloadInput, sizeof(packet.payloadInput));//  manual input coordinates of wio or gps module
    Serial.println("Encode message with private key on-board lock (1)Yes or (2)No");
    while (!Serial.available());
    EncodeMessage = Serial.read();
    if (EncodeMessage == 1) {
      ECCX08.ecSign(slot, packet.payloadInput, signature);
      for(int i=0; i < 64; i++) {
        payLoad[i] = signature[i];
        payloadSize = 64;
      }
    }
    if (EncodeMessage == 2) {
      for(int i=0; i < payloadSize; i++) {
      packet.payload[i] = packet.payloadInput[i]; 
      }
    }
  }
  if (!Serial.available()) { // lock is not connected to a computer or serial input device
    for(int i=0; i < 64; i++) { /*for testing purpose we will let the MCU generated random data, in the future this data should be encrypted for the bikera blockchain sidechain
                                to decypher and store GPS coordinates on the ledger if needed, gps module inbound ETA december added in code.
                                64 bytes of data, this is a SHA-256 digest. 
                                */   
      RandomBytenumber = random(255);
      packet.payload[i] = RandomBytenumber;
      payloadSize = 64;
    }
  }
}


void loop() {
    createBikeraLoraPacket (payLoad, payloadSize);
  // Print the packet for verification
  Serial.println("LoRaWAN Packet Created:");
  for (int i = 0; i < sizeof(packet.preamble); i++) {
    Serial.print(packet.preamble[i], HEX);
    Serial.print(" ");
  }
  Serial.println();
  Serial.print("Payload: ");
  for (int i = 0; i < payloadSize; i++) {
    Serial.print(packet.payload[i], HEX);
    Serial.print(" ");
  }
  modem.beginPacket();
  modem.write(packet.payload, payloadSize);
  packet.err = modem.endPacket(true);
  if (packet.err > 0) {
    Serial.println("Message sent correctly!");
  } 
  else {
    Serial.println("Error sending message :(");
    Serial.println("(you may send a limited amount of messages per minute, depending on the signal strength");
    Serial.println("it may vary from 1 message every couple of seconds to 1 message every minute)");
  }
  free(packet.preamble);
  free(packet.payload);
}
