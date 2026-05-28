## Verschillen tussen materiaallijst en google sheets
22/05/26
### Componentverschillen

| Onderdeel             | Sheet                                  | Gids                                              | Conclusie                                                                                                                                                                                      |
| --------------------- | -------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3,3V buck-boost IC    | ==RT6158AWSC (DFN-10)==                | RT6150B (WDFN-10L)                                | **Sheet behouden** — RT6158AWSC is de gekozen component; de gids-notities zijn verouderd op dit punt. FB-weerstanden in de sheet (1 MΩ / 294 kΩ) zijn correct voor RT6158AWSC (VFB = 0,765 V). |
| GPS VCC TVS           | ESD9B5.0ST5G (SOD-923)                 | ==SMBJ5.0CA (SMB)==                               | **Gids gevolgd** — ESD9B is alleen geschikt voor signaalniveau ESD; SMBJ5.0CA (600 W piek) is correcte keuze voor een vermogensrail.                                                           |
| GPS V_BCKP TVS        | ESD9B5.0ST5G (SOD-923)                 | ==SMBJ5.0CA (SMB)==                               | **Gids gevolgd** — zelfde redenering als VCC TVS.                                                                                                                                              |
| GPS antenne TVS       | ==ESD7C5.0ST5G (<0,6 pF)==             | SMF05C / PESD5V0X1BSF                             | **Sheet behouden** — beide zijn lage-capacitantie RF TVS (<2 pF); ESD7C5.0ST5G voldoet.                                                                                                        |
| LED stroomweerstanden | ==rood 150 Ω / groen 130 Ω (~8,5 mA)== | 470 Ω / 330 Ω (normaal) of 180 Ω / 150 Ω (buiten) | **Sheet behouden** — iets helderder dan de buitenwaarden van de gids, ruim binnen de 20 mA limiet.                                                                                             |
| Servo stroom-shunt    | ==0,1 Ω / 1 W / 2010==                 | 0,05 Ω / 2 W / 2512                               | **Sheet behouden** — 0,1 Ω geeft 2× betere ADC-resolutie (200 mV bij 2 A stall); 1 W-rating is voldoende.                                                                                      |

### Ontbrekende onderdelen (niet in sheet, wel vereist door gids)

Onderdelen die geen rij hadden in Componenten:
- USB-C receptacle (USB4105-GF-A-060)
- USB ESD bescherming (USBLC6-2SC6)
- CC1 + CC2 pull-down weerstanden (2× 5,1 kΩ) — vereist voor USB-C brondetectie door BQ25630
- GPS V_BCKP backup supercap (CPH3225A-LF, 0,1 F)
- GPS U.FL RF receptacle (U.FL-R-SMT-1(10)) — bestaande placeholder-rij bijgewerkt
- Ferrite bead VDDA MCU (FB1, 600 Ω @ 100 MHz)
- Batterijconnector (S2B-PH-K-S(LF)(SN), JST PH 2.0 mm)
- Batterijspanningsdeler (220 kΩ + 100 kΩ + 10 nF, MCU PA0)
- Servo rail bulk condensatoren (22 µF 0805 + 100 nF 0603)

CP2102N UART-naar-USB bridge: **niet toegevoegd** — bewust weggelaten om veiligheidsredenen; externe ST-link wordt gebruikt.

## Wijzigingen doorgevoerd in de sheet
**In-place bijgewerkt:**
- Rij 29 (GPS VCC TVS): ESD9B5.0ST5G → SMBJ5.0CA, pakket SOD-923 → SMB
- Rij 33 (GPS V_BCKP TVS): ESD9B5.0ST5G → SMBJ5.0CA, pakket SOD-923 → SMB
- Rij 35 (GPS antenne connector): ingevuld als U.FL-R-SMT-1(10), type/pakket/footprint bijgewerkt

**Nieuw toegevoegd (rijen 88–98, daarna handmatig op juiste plek gezet):**
- USB-C: receptacle, USBLC6-2SC6, CC-pulldowns
- GPS/GNSS: supercap 0,1 F
- STM32: ferrite bead FB1, batterijspanningsdeler (220 kΩ + 100 kΩ + 10 nF)
- Batterij: JST PH 2.0 mm connector
- Motor: servo rail bulk caps (22 µF + 100 nF)