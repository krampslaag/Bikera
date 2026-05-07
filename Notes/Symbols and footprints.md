https://www.snapeda.com/
https://www.ultralibrarian.com/
https://componentsearchengine.com/
# Componenten
## STM32
**STM32L431CCT6TR**
- Symbol in KiCad: *STM32L431CCTx*
- Footprint in KiCad: *Package_QFP:LQFP-48_7x7mm_P0.5mm*
- 3D: [WisDuo 3D Step files](https://downloads.rakwireless.com/3D_File/WisDuo/)
## LoRa (+BLE)
**RAK11720**
[Snapeda](https://www.snapeda.com/parts/RAK11720/RAK/view-part/?welcome=home&ref=search&t=RAK11720&ab_test_case=b)
Antennes gaan op rak zelf
## ​ECC
**ATECC608B-SSHDA-T**
- [Snapeda](https://www.snapeda.com/parts/ATECC608B-SSHDA-T/Microchip%20Technology/view-part/?ref=search&t=ATECC608B-SSHDA-T&ab_test_case=b)
- [Digikey](https://www.digikey.be/nl/models/13415162?tab=ultralibrarian)
Ah wacht stond al *in KiCad*
## GPS
**Quectel LC76GPAMD**
- [Mouser](https://www.mouser.be/ProductDetail/Quectel/LC76GPAMD?qs=vvQtp7zwQdMfDuCTmjRUww%3D%3D)
- [Ultralibrarian](https://app.ultralibrarian.com/details/e7452cf1-f8e7-11ed-b159-0a34d6323d74/Quectel-Wireless-Solutions/LC76GPAMD?uid=130355632)
- 3D: [Snapeda](https://www.snapeda.com/parts/LC76GPAMD/Quectel/view-part/?ref=search&t=LC76GPAMD&ab_test_case=b)
## E-ink
**Waveshare 1.54” module**
- Symbol: *zelf maken*
- Footprint
	8-pin JST PH 2.0mm aansluiting
	Module footprint met schroefgaten *zelf maken*
	KiCad: 
- [ ] 	- *JST_PH_S8B-PH-K_1x08_P2.00mm_Horizontal*
- [ ] 	- *JST_PH_S8B-PH-SM4-TB_1x08-1MP_P2.00mm_Horizontal*
- [/] 	- *JST_PH_B8B-PH-K_1x08_P2.00mm_Vertical*
- [ ] 	- *JST_PH_B8B-PH-SM4-TB_1x08-1MP_P2.00mm_Vertical*
- [!] Meegeleverde kabel gaat naar 8 individuele dupont connectors:
	- [v] *PinHeader_1x08_P2.54mm_Vertical*
- 3D: pin header
## Accelerometer
LIS2DW12
**LIS2DW12 module**: *Zelf maken* - zie arch.schema
## SD kaart
**SD adapter module**
- Symbol: *Zelf maken*
- Footprint: 8x2 pin header ( **??** mm)
	KiCad:
	- *PinHeader_2x08_P2.54mm_Horizontal*
		Is male
	- Of vertical, of SMD
- 3D: pin header
## FRAM
**FM24V01A-GTR**
- Symbol, footprint, 3D: [Mouser](https://www.mouser.be/ProductDetail/Infineon-Technologies/FM24V01A-G?qs=3FnuM6ZipRKGr6yvOmSjPg%3D%3D)
- 3D: [Snapeda](https://www.snapeda.com/parts/FM24V01A-GTR/Cypress%20Semiconductor/view-part/?ref=search&t=FM24V01A-GTR&ab_test_case=b)
## BMS
### Lader
**BQ25630YBGR**
- Symbol, footprint, 3D: [Mouser](https://www.mouser.be/ProductDetail/Texas-Instruments/BQ25630YBGR?qs=bpu3f%2FCR1jxmQ5vho%252BhFHQ%3D%3D)
### 3.3V buck-boost
**RAA2361052GNP#HC5**
- Symbol, footprint, 3D: [Mouser]([https://www.mouser.be/ProductDetail/Texas-Instruments/BQ25630YBGR?qs=bpu3f%2FCR1jxmQ5vho%252BhFHQ%3D%3D](https://www.mouser.be/ProductDetail/Renesas-Intersil/RAA2361052GNPHC5?qs=olJun0bQHM%2FTMxAlNSaKDw%3D%3D))
### 3.3V LDO
**TCR3UG33A,LF**
- Symbol, footprint, 3D: [Mouser](https://www.mouser.be/ProductDetail/Toshiba/TCR3UG33ALF?qs=0lQeLiL1qyaZy60Q7HF0yg%3D%3D), [Snapeda](https://www.snapeda.com/parts/TCR3UG33A%2CLF/Toshiba%20Semiconductor%20and%20Storage/view-part/?ref=search&t=TCR3UG33A&ab_test_case=b)
### 5V boost
**TPS61253F**
- Symbol: *zelf maken*
- Footprint & 3D: [Snapeda](https://www.snapeda.com/parts/DRV2625YFFR/Texas%20Instruments/view-part/?ref=search&t=DRV2625YFFR&ab_test_case=b) (ander component met zelfde package)
	Zie [DBSGA-9](https://www.ti.com/lit/ml/mxbg144b/mxbg144b.pdf?ts=1776791418137&ref_url=https%253A%252F%252Fwww.ti.com%252Fpackaging%252Fdocs%252Fsearchtipackages.tsp%253FpackageName%253DDSBGA) footprint eigenschappen
## Servo motor
TD-8120MG Digital Servo
**Pin header female ( 1x3 2.54mm)**
- Symbol: *zelf maken*
- Footprint: KiCad
	- [ ] - *PinHeader_1x03_P1.00mm_Horizontal*
	- [/] - *PinHeader_1x03_P1.00mm_Vertical*
	- [ ] - *PinHeader_1x03_P1.00mm_Vertical_SMD_Pin1Left*
	- [ ] - *PinHeader_1x03_P1.00mm_Vertical_SMD_Pin1Right*
- 3D **??**
## LED
**BL-BEG204-7-E**
- Symbol: *zelf maken*
- Footprint zit al in KiCad:
	- *LED_D5.0mm-3*
	- *LED_D5.0mm-3_Horizontal_O3.81mm_Z3.0mm
	- Pads rond maken **??**
> - 5mm LED (5.7mm base diameter)
> - 3 pinnen (0.5mm), 2.45mm spacing
> - Red cathode - common anode - green cathode
> 		--------|<-------* -------->|------- 
## Hall sensors
**DRV5032DULPGM**
- Footprint, 3D: [Snapeda](https://www.snapeda.com/parts/DRV5032DULPGM/Texas%20Instruments/view-part/?ref=search&t=DRV5032DULPGM&ab_test_case=b)
- Symbol, footprint, 3D: [Mouser](https://www.mouser.be/ProductDetail/Texas-Instruments/DRV5032DULPGM?qs=OlC7AqGiEDk9MwfBkgsRPw%3D%3D)
## ST-link
TLINK-V3MINIE
**Card Edge Connector 009159010603906
- Dual Row Inverted 
- 2x5pos
- 2.0 mm pitch
- Polarized

Symbol, footprint, 3D: [Mouser](https://www.mouser.be/ProductDetail/KYOCERA-AVX/009159010603906?qs=ST9lo4GX8V1Mnrfaz2Mt1w%3D%3D)

# To do
### Zit al in KiCad
- [x] EEC chip
- [x] STM32
- [x] E-ink header footprints
- [x] SD module header footprints
- [x] Servo pinheader footprint
- [x] LED footprint
### Downloaden
- [x] LoRa
- [x] GPS
- [x] FRAM
- [x] EEC chip
- [x] BMS - li-ion lader
- [x] BMS - 3,3V buck-boost
- [x] BMS - 3,3V LDO regulator
- [x] BMS - 5V boost footprint
- [x] Hall effect sensor
- [x] ST-link header
### Maken
- [x] E-ink header​ symbol
	%%Baseren op hall effect sensor (DRV5032DULPGM)
	Uitbreiden naar 8%%
- [-] E-ink footprint pinnen juiste richting (JST PH 8)
- [ ] Accelerometer module symbol
	%%Baseren op FRAM (FM24V01A-GTR)%%
- [ ] Accelerometer module footprint
- [ ] SD-kaart​ module header symbol
	%%Baseren op E-ink header symbool%%
- [ ] BMS - 5V boost symbol
	%%Baseren op FRAM (FM24V01A-GTR)
	Pin 4 en 5 weg%%
- [ ] Servo pinheader symbol
	%%Baseren op hall effect sensor (DRV5032DULPGM)%%
- [ ] LED symbol
	%%Baseren op hall effect sensor (DRV5032DULPGM)%%
### Geimporteerd in KiCad
##### Bestaand
- [v] STM32 **STM32L431CCT6TR
- [v] LoRa **RAK11720**
- [v] EEC chip **ATECC608B-SSHDA-T**
##### Gedownload
- [v] GPS **Quectel LC76GPAMD**
- [v] FRAM **FM24V01A-GTR**
- [v] BMS - li-ion lader **BQ25630YBGR**
- [v] BMS - 3,3V buck-boost **RAA2361052GNP#HC5**
- [v] BMS - 3,3V LDO regulator **TCR3UG33A,LF**
- [v] Hall effect sensor **DRV5032DULPGM**
- [v] ST-link header **009159010603906**
##### Gemaakt
- [v] E-ink​ module **Waveshare 1.54” module**
- [ ] Accelerometer​ **LIS2DW12 module**
- [ ] SD-kaart​ module  **SD adapter module**
- [ ] BMS - 5V boost **TPS61253F**
- [ ] Servo pinheader **Pin header female ( 1x3 2.54mm)**
- [ ] LED **BL-BEG204-7-E**
# Snapeda: How to import to Kicad 
#### Symbols
Using the _*.kicad_sym_ file:
1. Extract the content of the downloaded _*.zip_ file.
2. In KiCad, go to _Preferences._
3. Click on _Manage Symbol Libraries._
4. On the _Global Libraries_ tab, click on _Browse Libraries_ (the _small folder icon_)
5. Select the _.kicad_sym_ file, then click _Open._
6. The library will appear, click _OK._
7. Click on _Symbol Editor_.
8. Type on the filter search field, and navigate to the symbol you imported.  
    Double-click over it to open the file.
#### Footprints
Using the _*.kicad_mod_ file:
1. Extract the content of the downloaded _*.zip_ file.
2. In KiCad, go to _Preferences_.
3. No, in footprint editor or footprint assignment tool
4. Click on _Manage Footprint Libraries_.
5. On the _Global Libraries_ tab, click on _Browse Libraries_ (the _small folder icon_)
6. Navigate to the _Folder_ where the _.kicad_mod_ file is located. Then click _Select Folder_.
%%**Note:** You will not normally see the _.kicad_mod_ file on this step because you need to _select the folder where it is located_.%%
7. The library will appear, click _OK_.
8. Click on _Footprint Editor_.
9. Type on the filter search field, and navigate to the footprint you imported.  
    Double-click over it to open the file.
    