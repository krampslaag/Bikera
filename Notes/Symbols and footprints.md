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
	- *JST_PH_S8B-PH-K_1x08_P2.00mm_Horizontal*
	- *JST_PH_S8B-PH-SM4-TB_1x08-1MP_P2.00mm_Horizontal*
	- *JST_PH_B8B-PH-K_1x08_P2.00mm_Vertical*
	- *JST_PH_B8B-PH-SM4-TB_1x08-1MP_P2.00mm_Vertical*
- 3D: pin header
## Accelerometer
**LIS2DW12**
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
### 3.3V buck-boost
**RAA2361052GNP#HC5**

### 3.3V LDO
**TCR3UG33A,LF**
### 5V boost
**TPS61253F**

## Servo motor
TD-8120MG Digital Servo
**Pin header female (2.54mm)**


## LED
**BL-BEG204-7-E**


## Hall sensors
**DRV5032DULPGM**


## ST-link
TLINK-V3MINIE
**Card Edge Connector**
- Dual Row Inverted 
- 2x5pos
- 2.0 mm pitch
- Polarized

Symbol, footprint, 3D: [Mouser](https://www.mouser.be/ProductDetail/KYOCERA-AVX/009159010603906?qs=ST9lo4GX8V1Mnrfaz2Mt1w%3D%3D)

# To do
### Zit al in KiCad
- [x] EEC chip
- [x] STM32
- [ ] E-ink header footprints
- [ ] SD module header footprints
### Downloaden
- [x] LoRa
- [x] GPS
- [x] FRAM
- [x] EEC chip
- [ ] BMS - li-ion lader
- [ ] BMS - 3,3V buck-boost
- [ ] BMS - 3,3V LDO regulator
- [ ] BMS - 5V boost
- [ ] Motor
- [ ] LED
- [ ] Hall effect sensor
- [x] ST-link header
### Maken
- [ ] E-ink​ symbol
- [ ] E-ink​ footprint
- [ ] Accelerometer module symbol
- [ ] Accelerometer module footprint
- [ ] SD-kaart​ module symbol
- [ ] SD-kaart​ module footprint
### Geimporteerd in KiCad
- [x] STM32
- [x] LoRa
- [x] EEC chip
- [ ] GPS
- [ ] E-ink​ module
- [ ] Accelerometer​
- [ ] SD-kaart​ module 
- [ ] FRAM
- [ ] BMS - li-ion lader
- [ ] BMS - 3,3V buck-boost
- [ ] BMS - 3,3V LDO regulator
- [ ] BMS - 5V boost
- [ ] Motor header
- [ ] LED
- [ ] Hall effect sensor
- [ ] ST-link header
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
    