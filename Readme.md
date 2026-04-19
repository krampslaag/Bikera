# Bikera PCB
Een prototype wordt ontwikkeld in de vorm van een development board met een custom PCB-ontwerp in KiCad. Het doel is een energiezuinig, veilig en uitbreidbaar embedded platform te ontwerpen dat later kan evolueren naar een functioneel eindproduct.

Het development board zal volgende componenten bevatten:
- Energiezuinige MCU -> STM32​
- LoRa module (+BLE) en bijhorende antennes
- ECC secure element
- GPS/GNSS module
- E-ink display voor QR codes
- Accelerometer
- SD kaart module
- ROM chip
- BMS-systeem (voor 2-4 18650 Li-Ion batterijen)
- Servo motor driver
- Hall effect sensors voor slot beugel en pin
- Kleurled

## BOM
Er wordt een **materiaallijst (BOM)** opgesteld met alle gebruikte componenten. De  End-of-Life (EOL) van de componenten mag minimaal nog vijf jaar zijn.

Materiaallijst: [Zie google sheets](https://docs.google.com/spreadsheets/d/1ZxJHOLqpuJL-1dvZkRNnV-r1_EjUXDaZgLNVo9UeM5s/edit?gid=1010541530#gid=1010541530)

# Afspraken
- PCB ontwerp in KiCad
- Prototype = developer board
    - Met debugconnectoren
    - Eerste versie als datalogger
    - Met hand soldeerbare componenten
- ECC chip:
	- Met socket
	- ethereum: Keccak-256
	- solana: Ed25519 
- RAK11720 = LoRa +BLE 5, geen bluetooth apart
- Zowel geheugenchip (FRAM) als SD-kaart voor logging
- BMS 
	- Op PCB
	- Lader detecteert USB protocol (2.0, 3.0, USB-C) en past de laadstroom aan.
	- 3.3V buck-boost voor de meeste componenten
	  -> batterij kan zakken tot 3V
	- 3.3V LDO regulator voor GPS (weinig ruis)
	- 5V boost voor servomotor
		- aan/uit met enable pin
		- sense weerstand om blokkage overstroom te detecteren
# Opties voor prototype
- Antenne
	- LoRa: FPC antenne met MHF4 connector
	- Verschillende antennes testen
- E-ink module i.p.v. paneel
- SD module
- Accelerometer op breakout bord
# Opties voor latere ontwikkelingsfases
- kleinere componenten (reflow soolderen)
- STM32WL als MCU en LoRa radio
- 2 versies: zonder en met bluetooth? (2 RAK lora modules)
- RAK11720: RF pinout versie:
    - Draadantenne: dipool in V-vorm
    - BLE antenne op PCB
- [NXP EdgeLock SE050](https://www.mouser.be/new/nxp-semiconductors/nxp-edgelock-se050/): meer geavanceerde ECC chip
- Accelerometer chip in plaats van breakout bord