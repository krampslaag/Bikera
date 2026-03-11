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
- Motor-solenoide driver

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
- Zowel ROM chip (~5MB) als SD-kaart voor logging
- BMS op PCB (TP4056 chip, protectiecircuit en spanningsregelaar)

# Opties voor prototype
- Antenne
	- LoRa: FPC antenne met MHF4 connector
	- Verschillende antennes testen
- E-ink module i.p.v. paneel
- SD module

# Opties voor latere ontwikkelingsfases
- kleinere componenten (reflow soolderen)
- STM32WL als MCU en LoRa radio
- 2 versies: zonder en met bluetooth? (2 RAK lora modules)
- RAK11720: RF pinout versie:
    - Draadantenne: dipool in V-vorm
    - BLE antenne op PCB
- [NXP EdgeLock SE050](https://www.mouser.be/new/nxp-semiconductors/nxp-edgelock-se050/): meer geavanceerde ECC chip