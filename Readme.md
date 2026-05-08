# Bikera PCB
Ontwerp van een prototype development board voor een beveiligd IoT-fietsslot
--
Een prototype wordt ontwikkeld in de vorm van een development board met een custom PCB-ontwerp in KiCad. Het doel is een energiezuinig, veilig en uitbreidbaar embedded platform te ontwerpen dat later kan evolueren naar een functioneel eindproduct.
# Componenten:
- Energiezuinige MCU: [STM32L431CCT6TR](https://www.digikey.be/nl/products/detail/stmicroelectronics/STM32L431CCT6TR/8257907?s=N4IgTCBcDaIMoBUCyBmMAZALCgjAYTwQDYEAlEAXQF8g)
- LoRa module (+BLE): [WisDuo RAK11720](https://www.digikey.be/nl/products/detail/rakwireless-technology-limited/RAK11720-8-SM-I/26861631) 
	- Bijhorende LoRa antenne: [FPC antenne](https://be.farnell.com/te-connectivity/l000551-05/rf-antenna-863-to-870mhz-2-2dbi/dp/4457734)
	- Bijhorende BLE antenne: [AANI-FB-0086-0100W (100mm)](https://www.digikey.be/nl/products/detail/abracon-llc/AANI-FB-0086-0100W/25558929)
- ECC secure element: [ATECC608B-SSHDA-T](https://www.digikey.be/nl/products/detail/microchip-technology/ATECC608B-SSHDA-T/13415162?s=N4IgTCBcDaIIIBUCiBhFA2ADADgEIFoBlQgCQBE58EQBdAXyA)
- GPS/GNSS module: [](https://www.mouser.be/ProductDetail/Quectel/LC76GPAMD?qs=vvQtp7zwQdMfDuCTmjRUww%3D%3D)[Quectel LC76GPAMD](https://www.mouser.be/ProductDetail/Quectel/LC76GPAMD?qs=vvQtp7zwQdMfDuCTmjRUww%3D%3D)
	- Bijhorende antenne: [YFGA003AA](https://www.digikey.be/nl/products/detail/quectel/YFGA003AA/21273116)
- ePaper module: [Waveshare 1.54” module](https://www.waveshare.com/1.54inch-e-Paper-Module.htm)
	%%voor QR codes%%
- Accelerometer: [LIS2DW12 module](https://www.tinytronics.nl/en/sensors/acceleration-rotation/dfrobot-fermion-triple-axis-accelerometer-spi-i2c-lis2dw12)
- SD-kaart module: [SD adapter module](https://www.tinytronics.nl/en/data-storage/modules/sd-card-adapter-module-3.3v-5v)
	%%Voor logging (alleen prototype)%%
- FRAM geheugen: [FM24V01A-GTR](https://www.digikey.be/nl/products/detail/infineon-technologies/FM24V01A-GTR/5210532)
	%%Voor logging%%
- BMS-systeem
	%%voor 2-4 18650 Li-Ion batterijen%%
	- Li-ion protectie en lader (USB-C): [BQ25630YBGR](https://www.digikey.nl/nl/products/detail/texas-instruments/BQ25630YBGR/28738812?s=N4IgTCBcDaIEIEUwFYBsBmADCAugXyA)
	- 3.3V buck-boost: [RAA2361052GNP#HC5](https://www.mouser.be/ProductDetail/Renesas-Intersil/RAA2361052GNPHC5?qs=olJun0bQHM%2FTMxAlNSaKDw%3D%3D)
	- 3.3V LDO:[TCR3UG33A,LF](https://www.mouser.be/ProductDetail/Toshiba/TCR3UG33ALF?qs=0lQeLiL1qyaZy60Q7HF0yg%3D%3D)
		%%Voor GPS%%
	- 5V boost: [TPS61253F](https://www.digikey.be/nl/products/detail/texas-instruments/TPS61253FYFFR/29174815)
		%%Voor servomotor%%
- Servo motor: [TD-8120MG Digital Servo](https://www.tinytronics.nl/en/mechanics-and-actuators/motors/servomotors/td-8120mg-waterproof-digital-servo-20kg)
	%%Aangesloten met pinheader%%
- Hall effect sensors: [](https://www.mouser.be/ProductDetail/Texas-Instruments/DRV5032DULPGM?qs=OlC7AqGiEDk9MwfBkgsRPw%3D%3D)[DRV5032DULPGM](https://www.mouser.be/ProductDetail/Texas-Instruments/DRV5032DULPGM?qs=OlC7AqGiEDk9MwfBkgsRPw%3D%3D)
	%%voor slot beugel en pin%%
- Kleurled: [](https://www.digikey.be/nl/products/detail/american-bright-optoelectronics-corporation/BL-BEG204-7-E/22486902)[BL-BEG204-7-E](https://www.digikey.be/nl/products/detail/american-bright-optoelectronics-corporation/BL-BEG204-7-E/22486902)
	%%rood en groen, zonder blauw%%
## BOM
Er wordt een **materiaallijst (BOM)** opgesteld met alle gebruikte componenten in [google sheets](https://docs.google.com/spreadsheets/d/1ZxJHOLqpuJL-1dvZkRNnV-r1_EjUXDaZgLNVo9UeM5s/edit?gid=1010541530#gid=1010541530).

Hier staat een **sheet 'Basiscomponenten'** met verschillende opties voor elk component, aangeduid welke voor prototype gebruikt worden en welke voor finaal ontwerp kan gebruikt worden. 

Er is ook een **sheet 'Architectuur'**, gebruikt om het architectuurschema op te stellen.

# Afspraken
- PCB ontwerp in KiCad
- De End-of-Life (EOL) van de componenten mag minimaal nog vijf jaar zijn.
- Prototype = developer board
    - Met debugconnectoren
    - Eerste versie als datalogger
    - Met hand soldeerbare componenten
- RTC
	- Updaten via LoRa
	- Eventueel aparte (oplaadbare) knoopcel
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
	  -> dan kan batterijspanning kan zakken tot 3V
	- 3.3V LDO regulator voor GPS (weinig ruis)
	- 5V boost voor servomotor
- Servomotor
	- aan/uit met enable pin van 5V boost
	- sense weerstand om blokkage overstroom te detecteren
- Hall sensors
	- THT
	- één voor noordpool en één voor zuidpool (beugel en pin) om manipulatie tegen te gaan
- LED
	- Rood + groen -> geel en oranje kan ook gemaakt worden
## Opties voor prototype
- Antenne
	- LoRa & bluetooth: FPC antenne met MHF4 connector
	- Verschillende LoRa antennes testen
	- GPS: FPC antenne 
		- -> kabel proberen solderen
		- anders extra RF-1 connector (quectel GPS heeft RF pinout)
- E-ink module i.p.v. paneel
- SD module
- Accelerometer op breakout bord
- Twee gelijke hall sensors is ok
- RTC updaten via LoRa
- JST PH connectors i.p.v. dupont headers (zelf krimpen)
## Opties voor latere ontwikkelingsfases
- kleinere componenten (reflow soolderen)
- STM32WL als MCU en LoRa radio
- 2 versies: zonder en met bluetooth? (2 RAK lora modules)
- RAK11720: RF pinout versie:
    - Draadantenne: dipool in V-vorm
    - BLE antenne op PCB
- Draadantenne of patch antenne proberen voor GPS
- [NXP EdgeLock SE050](https://www.mouser.be/new/nxp-semiconductors/nxp-edgelock-se050/): meer geavanceerde ECC chip
- Accelerometer chip in plaats van breakout bord
- Unipolaire hall sensors: één voor noordpool en één voor zuidpool (beugel en pin)
- Eventueel aparte (oplaadbare) knoopcel voor RTC (STM32 VBAT)

# Stand van zaken
## In grote lijnen
- [x] Basiscomponenten uitzoeken
- [ ] Randcomponenten en deelcircuits
- [ ] Materiaallijst
	- [x] Basiscomponenten (google sheets)
		- [ ] *ST-link toevoegen*
	- [ ] Randcomponenten
	- [ ] Volledige BOM
- [x] Architectuurdocument
	%%Schema in drawio%%
	- [ ] *ST-link header aanpassen*
## Componenten uitzoeken
- [x] STM32 *STM32L431CCT6TR*
- [x] LoRa *RAK11720*
- [x] EEC chip *ATECC608B-SSHDA-T*
	- [ ] Breakout bord
- [x] GPS Quectel *LC76GPAMD*
	- [ ] Randcomponenten
- [x] BMS
	- [x] li-ion lader *BQ25630YBGR*
		- [ ] Randcomponenten
	- [x] 3,3V buck-boost *RAA2361052GNP#HC5*
		- [ ] Randcomponenten
	- [x] 3,3V LDO regulator *TCR3UG33A,LF*
		- [ ] Randcomponenten
	- [x] BMS - 5V boost *TPS61253F*
		- [ ] Randcomponenten
	- [ ] USB-C connector
- [x] Hall effect sensor *DRV5032DULPGM*
- [x] ST-link
	- [x] St-link *STLINK-V3MINIE*
	- [x] Header *009159010603906*
- [x] FRAM *FM24V01A-GTR*
- [x] ePaper​ *Waveshare 1.54” module*
- [x] Accelerometer​ *LIS2DW12 module*
- [x] SD-kaart​ module  *SD adapter module*
- [x] Servo motor *TD-8120MG Digital Servo*
	- [ ] Randcomponenten
- [x] LED *BL-BEG204-7-E*
	- [ ] Weerstanden
## KiCad
### KiCad schema
- [ ] **Symbolen en footprints importeren**
	- **Bestaand**
	- [x] STM32 *STM32L431CCT6TR
	- [x] LoRa *RAK11720*
	- [x] EEC chip *ATECC608B-SSHDA-T*
		- [ ] 
	- **Gedownload**
	- [x] GPS *Quectel LC76GPAMD*
	- [x] FRAM *FM24V01A-GTR*
	- [x] BMS - li-ion lader *BQ25630YBGR*
	- [x] BMS - 3,3V buck-boost *RAA2361052GNP#HC5*
	- [x] BMS - 3,3V LDO regulator *TCR3UG33A,LF*
	- [x] Hall effect sensor *DRV5032DULPGM*
	- [x] ST-link header *009159010603906*
	- **Gemaakt**
	- [x] E-ink​ module *Waveshare 1.54” module*
	- [ ] Accelerometer​ *LIS2DW12 module*
	- [ ] SD-kaart​ module  *SD adapter module*
	- [ ] BMS - 5V boost *TPS61253F*
	- [ ] Servo pinheader *Pin header female ( 1x3 2.54mm)*
	- [ ] LED *BL-BEG204-7-E*
- [ ] **Pinout uitzoeken**
	- [ ] STM32 *STM32L431CCT6TR*
	- [x] LoRa *RAK11720*
	- [x] EEC chip *ATECC608B-SSHDA-T*
	- [ ] GPS Quectel *LC76GPAMD*
		- [x] Beschikbare pinnen
		- [ ] Optionele verbindingen (zie arch.schema)
	- [ ] BMS
		- [ ] Eerst deelcircuits
		- [ ] li-ion lader *BQ25630YBGR*
		- [ ] 3,3V buck-boost *RAA2361052GNP#HC5
		- [ ] 3,3V LDO regulator *TCR3UG33A,LF*
		- [ ] 5V boost *TPS61253F**
	- [x] Hall effect sensor *DRV5032DULPGM*
	- [ ] ST-link (header) *009159010603906*
	- [x] FRAM *FM24V01A-GTR*
	- [x] ePaper​ *Waveshare 1.54” module*
	- [x] Accelerometer​ *LIS2DW12 module*
	- [x] SD-kaart​ module  *SD adapter module*
	- [x] Servo motor *TD-8120MG Digital Servo*
	- [x] LED *BL-BEG204-7-E*
### KiCad PCB
- [ ] - Strategie uitzoeken (PCB afmetingen, lagen, ground plane, trace width...)
- [ ] - Componenten plaatsen
- [ ] - Verbindingen
## Realisatie
- Componenten bestellen
- PCB bestellen
- Reflow hot plate zoeken & bestellen/maken
- Solderen
- Testen
- Software ontwikkelen, itereren,...


