# KiCAD Library Audit — Bikera Smart Lock Prototype (development board)

**Source:** `Bikera.xlsx` → sheet `Basiscomponenten`, filtered on column **Keuze prototype = TRUE**
**Target:** KiCAD 9.x (stock libraries). Notes for KiCAD 8.x added where coverage differs.
**Goal:** Per BOM line, classify symbol + footprint as **STOCK** (in KiCAD's bundled libs), **3RD-PARTY** (SnapEDA / Ultra Librarian / vendor download), or **CUSTOM** (must be drawn by you).

Use this as the checklist before opening the schematic. Fetch all 3rd-party libs first, draw all CUSTOM symbols first, then capture in one pass. Around-the-IC passives (decoupling caps, pull-ups, LED resistors) are not enumerated in `Bikera.xlsx` — they ride on the generic stock symbols (`Device:R`, `Device:C`, `Device:LED`) with values set per the reference designs in each part's datasheet. Calculate them once during schematic capture (see `03_schematic_capture_guide.md`).

This is the **prototype** audit. The `Keuze finaal` design diverges in five places (RAK11720 RF-pinout instead of MHF4, wire/PCB antennas instead of FPC, no ePaper, RAA2361052 instead of RT6150B, SL1613SH/SL1623SH instead of DRV5032). When that pivot lands, redo this audit; the schematic and PCB guides will need rev-2 sections.

## Reconciliation with the architecture diagram

The drawio architecture diagram (`architectuur_design.jpg`) and `Bikera.xlsx` Keuze prototype rows disagree in two places:

| What | Diagram shows | BOM Keuze prototype shows | Authoritative |
|---|---|---|---|
| Charger | BQ25895RTWR (QFN-24, no USB-C detect) | BQ25630YBGR (DSBGA, USB-C detect) | **BOM (BQ25630YBGR)** |
| 3.3 V buck-boost | RAA2361052GNP#HC5 (DFN-10) | RT6150B (WDFN-10L) | **BOM (RT6150B)** |

The diagram appears to predate the BOM update. **The BOM is the source of truth** — when the diagram is regenerated to match BOM rev-current, update its blocks for the charger and buck-boost.

The diagram does contribute four real architectural details that are NOT obvious from `Bikera.xlsx` alone and that this audit picks up below:

1. **UART-to-USB bridge** as a separate component between USB-C D+/D− and the MCU (independent of the ST-link's VCP) — see Section 18
2. **Two physical push-buttons** for BOOT and RESET (not a BOOT jumper header) — covered in Section 1
3. **GPS backup power circuit** for V_BCKP — covered in Section 6
4. **Servo external current-sense resistor (Rsense)** with sense signal back to MCU ADC — covered in Section 13

## Legend

- **Symbol** column = the schematic symbol (the part's pinout drawing)
- **Footprint** column = the PCB land pattern
- "Generic" = use one of KiCAD's canonical generic symbols (e.g. `Device:R`, `Device:C`) with the BOM MPN entered as the `Value` or `MPN` field
- 3rd-party recommendation: **SnapEDA** is preferred (free, KiCAD-native exports). **Ultra Librarian** as fallback. **Vendor** (RAKwireless, Coilcraft, Mouser-AVX) where they ship official KiCAD libs.

---

## Section 1 — MCU

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| U1 | STMicroelectronics **STM32L431CCT6TR** | **STOCK** `MCU_ST_STM32L4:STM32L431CCTx` | **STOCK** `Package_QFP:LQFP-48_7x7mm_P0.5mm` | Both stock. Verify pin 1 marking corner against ST datasheet rev. 7 fig. 14 before locking. The `T` suffix = LQFP-48; `R` suffix would be UFQFPN-32 — make sure the symbol variant matches the BOM's `CCT6TR` ordering code |
| Decoupling | Generic 100 nF 0603 (×4) + 1 µF 0603 (×1) + 10 nF 0603 (×1) | **STOCK** `Device:C` | **STOCK** `Capacitor_SMD:C_0603_1608Metric` | Per ST AN2867 / datasheet sec 6.1.6: one 100 nF per VDD pin (3 pairs on LQFP-48), one 100 nF on VDDA, one 10 nF on VDDA in parallel (HF), one 1 µF bulk on VDDA |
| Reset / boot buttons (×2) | SPST momentary tactile, 6×6 mm THT or 4.5×4.5 mm SMD | **STOCK** `Switch:SW_Push` | **STOCK** `Button_Switch_THT:SW_Tactile_SPST_Angled_PTS645Vx39-2LFS` or `Button_Switch_SMD:SW_SPST_TL3342` | Two buttons per the architecture diagram's "Drukknoppen" block: one labelled **BOOT** (pulls BOOT0 high momentarily for system bootloader entry), one labelled **RESET** (pulls NRST low). Per STM32L431 datasheet Figure 30, the NRST pin has an **internal pull-up**, so the recommended external circuit is just a 0.1 µF cap to GND — **no external 10 kΩ pull-up needed**. Add 10 kΩ pull-down on BOOT0 (no internal pull on BOOT0 in the L431). Stock everything |

**Verdict:** all stock. No downloads needed for this section.

---

## Section 2 — LoRa + BLE module (MHF4 variant)

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| U2 | RAKwireless **RAK11720 (MHF4 connector variant)** | **3RD-PARTY** | **3RD-PARTY** | SnapEDA has this part: search "RAK11720". **Critical:** the MHF4 and RF-pinout variants share most of the footprint but differ in their RF I/O — the MHF4 variant has the antenna connector pre-soldered on the module, so on your PCB the RF lands as routed signals to the module's edge are **not used**. Make sure SnapEDA's variant matches the `Keuze prototype` selection. The RAKwireless official KiCAD lib at `https://downloads.rakwireless.com/3D_File/WisDuo/` is the cleanest source — same lib hosts the 3D STEP. **Pin headers along the module edge are still routed to the MCU** even though the RF doesn't exit through them |

> **Variant matters:** `Bikera.xlsx` selected the **MHF4 connector** variant for the prototype. This means each antenna (LoRa, BLE) plugs onto the module's MHF4 jack via a U.FL/MHF4 pigtail to a separate FPC antenna — there are no RF traces between the module and the antennas on the PCB. The advantage for prototype: no controlled-impedance routing on your board. The disadvantage for production: extra parts (two MHF4 cables, two FPC antennas + adhesive). The `Keuze finaal` design switches to the RF-pinout variant — when you go to rev 2 this section changes substantially.

> **⚠ Build/assembly warning (per RAK datasheet):** "Make sure that an antenna is always connected. Using these transceivers without an antenna can damage the module." During bring-up, **plug in both antennas (or 50 Ω terminators) before powering the board for the first time.** Don't power-on a bare RAK11720 to "test the rails first" — the LoRa PA stage can self-damage if it transmits into an open circuit. Add this to the bring-up checklist in `04_pcb_layout_guide.md`.

> **Default UART config:** UART0 at 115200 baud, 8N1. AT command protocol per RAKwireless's "RAK11720 AT Command Manual". Default firmware = RUI3. Other UART settings configurable post-factory via AT commands. Sleep current ~2.37 µA per RAK datasheet — important for battery-life calculations.

### Decoupling

| What | Per RAKwireless datasheet sec. 4.2 |
|---|---|
| 10 µF (1206) + 100 nF (0603) | On VBAT input |
| 1 µF (0603) + 100 nF (0603) | On VDD_IO |

All stock `Device:C` symbol + stock 0603/1206 footprints.

**Verdict:** 1 SnapEDA or RAKwireless lib pull. Rest stock.

---

## Section 3 — LoRa antenna (FPC, off-board)

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| ANT1 | Farnell **L000551-05 FPC antenna** (2.2 dBi, 868 MHz, MHF4 cable) | n/a (off-board — connects to U2's MHF4 jack via the included pigtail) | n/a | Documented in BOM only; no schematic symbol, no PCB footprint. The antenna is a flexible PCB part that adheres to the inside of the lock enclosure with its supplied adhesive; the MHF4 connector mates with the RAK11720's RF jack |

> **Mechanical note:** the FPC antenna ships with a 5/10/15 cm cable option. Pick **before ordering** based on enclosure size — too long means antenna performance loss in the coil; too short means you can't reach the mounting position. The prototype enclosure size determines this choice.

**Verdict:** nothing in KiCAD. Track in BOM and assembly drawing.

---

## Section 4 — BLE antenna (FPC, off-board)

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| ANT2 | Digikey **AANI-FB-0086-0100W** (100 mm FPC, multi-band including 2.4 GHz, MHF4 cable) | n/a (off-board) | n/a | Same approach as ANT1 — plugs into the second MHF4 jack on the RAK11720 |

> **Datasheet caveat:** this antenna is marketed as a Wi-Fi 6E/7 tri-band antenna. The 2.4 GHz band is included in its operating range, but its tuning is optimised across the full Wi-Fi band span (2.4 / 5 / 6 GHz). For BLE-only use it's overkill but works fine. If first build shows weak BLE range, this antenna is a candidate for swap-out before suspecting anything else.

**Verdict:** nothing in KiCAD. Track in BOM.

---

## Section 5 — ECC secure element

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| U3 | Microchip **ATECC608B-SSHDA-T** | **STOCK** `Security_IC:ATECC608A-SSH` (or similar — KiCAD's `Security_IC` library has the ATECC family). Verify A vs B variant in symbol description | **STOCK** `Package_SO:SOIC-8_3.9x4.9mm_P1.27mm` | KiCAD 9.x stock library has ATECC608 family symbols. **The 608A and 608B differ in some internal features (TempKey behaviour, OTP commands) but are pin-compatible** — using the 608A symbol with the value set to "ATECC608B-SSHDA-T" is acceptable. SnapEDA also has dedicated 608B symbols if you want exact-match metadata |
| Socket (prototype) | DIP/SOIC-8 ZIF socket | **CUSTOM** symbol (just a 1×8 header) | **CUSTOM** footprint matching the socket's pin pitch | Per `Readme.md`: "EEC chip: Met socket". A SOIC-8 socket lets you swap pre-provisioned chips without resoldering — invaluable during firmware development of the ECDSA signing flow in `bikera.ino`. The socket footprint is just an SOIC-8 land pattern with through-holes at the corners for retention; you can search "SOIC-8 ZIF socket" on Aliexpress / Digikey to find the specific part and download its drawing. Alternative: solder the bare SOIC-8 chip directly and accept that chip swap means hot-air reflow |
| Decoupling | 100 nF 0603 | **STOCK** `Device:C` | **STOCK** 0603 | One next to VCC |

**Verdict:** STOCK symbol + STOCK footprint for the bare chip. If you go with the socket, that's one custom item — but the **bare chip is the safer prototype choice** because sockets add height, cost, and another mechanical failure point. The chip is €0.76; if you brick a chip during provisioning, throw it away and reflow another. The socket is only worth it if you expect to swap >5 chips during development.

---

## Section 6 — GPS module

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| U4 | Quectel **LC76GPAMD** | **3RD-PARTY** | **3RD-PARTY** | Ultra Librarian: search `LC76GPAMD` ([direct link from `Notes/Symbols and footprints.md`](https://app.ultralibrarian.com/details/e7452cf1-f8e7-11ed-b159-0a34d6323d74/Quectel-Wireless-Solutions/LC76GPAMD)). SnapEDA also covers it for the 3D STEP. Half-hole castellated PCB module — the footprint must include the castellation cutouts AND the under-module copper keepout per Quectel's "LC76G Hardware Design" doc sec. 7.2 |
| VCC decoupling | TVS + 10 µF + 100 nF + 33 pF | **STOCK** | **STOCK** | Per LC76G Hardware Design fig. 4 (VCC input reference circuit). The 33 pF cap is HF decoupling — don't omit it; it suppresses RF noise at the LC76G's internal LNA reference. The TVS on VCC is SMBJ5.0CA or equivalent low-capacitance bidirectional TVS (NOT SMBJ58CA — that's 58 V standoff, far too high for a 3.3 V rail). See Section 19 for TVS selection |
| VBACKUP backup-power circuit | Schottky diode-OR + supercap + TVS + 4.7 µF + 100 nF + 33 pF | **STOCK** | **STOCK** | The architecture diagram shows a "GPS backup power circuit" as a separate block feeding V_BCKP. Per LC76G Hardware Design fig. 5 (V_BCKP input reference), the decoupling triplet is **4.7 µF + 100 nF + 33 pF** (note: 4.7 µF, not 10 µF — the V_BCKP current is lower) plus a TVS. Combine with the diode-OR: 1× BAT54C dual Schottky (`Diode:BAT54C`, stock `Package_TO_SOT_SMD:SOT-23`) diode-OR-ing from `+3V3_GPS` and a 0.1 F supercap, the supercap charging from `+3V3` via a 1 kΩ resistor. **If you want simpler bring-up first**, leave V_BCKP NC and accept cold-start on every boot — the schematic stays cleaner. The backup circuit can be added in rev 2 without affecting anything else |
| GPS antenna RF protection | TVS on antenna line | **3RD-PARTY** | **STOCK** SOD-323 | LC76G Hardware Design fig. 17 (passive antenna reference) shows a TVS diode on the RF line between the antenna connector and the module RF pin. Use a low-capacitance ESD TVS specifically rated for RF (e.g. SMF05C, PESD5V0X1BSF, or similar — junction capacitance <2 pF, breakdown >5 V). **Do NOT use SMBJ family TVS on the RF line** — their junction capacitance (50–500 pF) detunes the antenna match. SMBJ family is OK for power-rail protection only |
| RF matching / SAW filter | π-network or SAW filter, optional | n/a | n/a | LC76G Hardware Design fig. 17 shows C1/C2 (marked NM = not mounted) and an optional SAW filter. For prototype with FPC passive antenna: **leave NM, skip the SAW**. Add only if first build shows poor sensitivity or interference from on-board sources |
| D_SEL strap | Pulled low for UART | **STOCK** `Device:R` | **STOCK** 0603 | Per LC76G Hardware Design Table 8: D_SEL low at startup = UART interface (which is what we want). Tie D_SEL to GND via 10 kΩ — don't leave floating, don't tie directly to GND (preserves option to override via MCU GPIO later) |

**Verdict:** 1 Ultra Librarian or SnapEDA pull. Verify castellation pads with the printed-footprint method (see `02_footprints_explained.md`).

---

## Section 7 — GPS antenna (FPC, off-board)

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| ANT3 | Quectel **YFGA003AA** (10 cm FPC, RF1/IPEX-1 connector) | n/a (off-board) | n/a | The RF-1 (IPEX MHF/U.FL-1, 1st gen) connector is the GPS antenna's mate. The LC76GPAMD module exposes the RF pin as a half-hole pad, not a connector — so you need either (a) an IPEX-1 jack on your PCB next to the module + the antenna's cable plugs into it, or (b) a soldered pigtail from the LC76GPAMD's RF pad to the antenna's connector |
| J-gps-ant | IPEX MHF1 / U.FL receptacle (on PCB) | **3RD-PARTY** | **3RD-PARTY** | SnapEDA: search "U.FL" or "Hirose UFL-LP-068". Stock KiCAD has `Connector_Coaxial:U.FL` which is generic — fine if you accept the placeholder footprint, but check pad dimensions against the specific receptacle you buy. **Architecture sheet refers to this as "RF 1 connector"** — same thing |

> **Routing critical:** the trace from the LC76GPAMD RF pad to the U.FL receptacle must be 50 Ω controlled impedance. On standard 1.6 mm FR4 with 1 oz copper and a solid ground plane on layer 2, a 50 Ω microstrip is ~2.85 mm wide — too wide for a typical 1 mm half-hole pad. **Use a coplanar waveguide with ground (CPWG) instead** — narrower trace (~1.2 mm) with ground flooded on the same layer, stitched with vias. See `04_pcb_layout_guide.md`.

**Verdict:** 1 SnapEDA pull (U.FL receptacle). FPC antenna itself is BOM-only.

---

## Section 8 — ePaper display

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| MOD1 | Waveshare **1.54" e-Paper Module** (8-pin JST PH 2.0 mm input) | **CUSTOM** symbol — header carrier | **STOCK** `Connector_JST:JST_PH_B8B-PH-K_1x08_P2.00mm_Vertical` (per `Notes/Symbols and footprints.md`) | The module itself is off-board, sitting in the lock enclosure connected via the 8-pin JST PH cable supplied. On your PCB you mount one JST PH 8-pin header; the module's cable plugs into it. **Custom symbol** = an 8-pin connector with the Waveshare pinout labelled correctly (VCC, GND, DIN, CLK, CS, DC, RST, BUSY) so the schematic reads cleanly |

> **Cable variant:** the Waveshare module ships with the JST PH cable terminating in **8 individual Dupont connectors** by default (per `Notes/Symbols and footprints.md`). For the prototype, either (a) re-crimp the cable into a JST PH housing, or (b) use 8× 2.54 mm pin header on the PCB to match the Dupont ends. The Notes file shows both options were considered — pick one and document. **Recommendation: use the JST PH receptacle on PCB and re-crimp the cable** — Dupont connectors flap loose under bike vibration

### MOSI/SCK sharing

The ePaper SPI bus shares MOSI and SCK with the SD card module (per the architecture sheet). On the schematic, both peripherals connect to the same `SPI_MOSI` and `SPI_SCK` nets; each has its own CS line. Don't accidentally draw separate SPI buses — the MCU has only 3 SPI peripherals total and you want to leave at least one for the accelerometer's SPI mode option.

**Verdict:** custom 8-pin header symbol, stock JST footprint.

---

## Section 9 — Accelerometer (breakout module)

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| MOD2 | Tinytronics **LIS2DW12 module** (DFRobot Fermion DFR0904 or equivalent breakout) | **CUSTOM** symbol — 2× 1×4 headers | **STOCK** `Connector_PinHeader_2.54mm:PinHeader_1x04_P2.54mm_Vertical` (×2) | Two 4-pin headers per the architecture sheet. On the schematic it shows up as a pair of 1×4 headers; on the PCB it's two `PinHeader_1x04_P2.54mm_Vertical` footprints aligned to the module's hole pattern. Pin assignment per the module's actual pinout (verify against the Tinytronics product page — different breakout sources have different pinouts) |

**Module power note (per detail sheet):** the LIS2DW12 breakout module includes its own onboard 3.3 V LDO (typically **ME6206A33M3G** or similar). The board takes higher voltage at VCC and regulates it internally to 1.8/3.3 V for the bare chip. **Wire the breakout's VCC to `+3V3` directly** — the onboard LDO will pass through (it's a low-dropout part). Some clones omit the LDO and feed VCC straight to the chip — verify before buying. If your specific breakout has no LDO, the LIS2DW12 chip itself accepts 1.62–3.6 V at VDD so `+3V3` is still fine, just don't apply >3.6 V.

**CS pin (per LIS2DW12 datasheet Table 1 footnote + Table 2):** the LIS2DW12 has internal pull-ups on **both** SDO/SA0 AND CS pins (typical 50 kΩ at 1.8 V Vdd_IO, dropping to ~20 kΩ at 3.6 V). Earlier draft of this guide stated CS had no internal pull-up — **that was wrong; the AN5038 application note and datasheet Table 1 footnote both confirm CS is pulled up internally**. Practical implications:

| Option | Wiring | Notes |
|---|---|---|
| Leave CS floating (internal pull-up holds it high) | NC on the header | Works for I²C mode, but ST recommends an explicit external tie for noise immunity |
| Tie CS to Vdd_IO (=`+3V3` on this breakout) | Direct connection at header | **Recommended for production.** Per datasheet sec. 6.2: "When using the I²C, CS must be tied high (i.e. connected to Vdd_IO)" |
| Pull-up CS via 10 kΩ + MCU GPIO override | 10 kΩ to `+3V3` + GPIO | Preserves SPI mode option. Costs 1 GPIO and 1 resistor |

**Recommendation for the Bikera prototype:** tie CS directly to the breakout's VCC pin via a short trace at the header. I²C is the chosen interface and there's no compelling reason to keep SPI as a runtime option. If you want the flexibility, route to a spare GPIO instead — both approaches are documented in AN5038.

**Pin assignment** (typical, but VERIFY for your specific module):

Header A: VCC, GND, SDA, SCL
Header B: INT1, INT2, SDO/SA0, CS

> **I²C vs SPI mode:** the LIS2DW12 supports both. In I²C mode, CS=high, SA0 selects address (0x18 / 0x19). In SPI mode, CS becomes the chip-select. The architecture sheet shows both — the prototype defaults to I²C for fewer wires. SPI is an option if I²C bus loading becomes an issue, but the bus only has 4 slaves (ECC, FRAM, accelerometer, charger) at relaxed I²C speeds, so I²C is fine

**Verdict:** custom pair of header symbols + STOCK footprints. Verify the breakout's actual pin spacing with calipers.

---

## Section 10 — SD card breakout

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| MOD3 | Tinytronics **SD adapter module** (8×2 pin header per `Readme.md` / Notes file) | **CUSTOM** symbol — 2×8 header | **STOCK** `Connector_PinHeader_2.54mm:PinHeader_2x08_P2.54mm_Vertical` or `_Horizontal` | The Tinytronics SD module specified in `Bikera.xlsx` row 27 is the 3.3V/5V variant with built-in level shifter. It exposes 8 pins per row (pairs) — per `Notes/Symbols and footprints.md` "SD-kaart PinHeader_2x08 footprint: pinnen aanpassen (in paren)". Half the pins are duplicates (each functional pin has a paired duplicate) so the symbol shows 8 nets, 16 pads |
| R-sd | 4.7–10 kΩ pull-ups on CS, MOSI, MISO | **STOCK** `Device:R` | **STOCK** 0603 (×3) | Standard SD SPI practice. Required even if the module has its own pull-ups — module pull-ups don't always engage until SD is in SPI mode |

**Verdict:** custom symbol (one-time draw), stock footprint. Measure the actual breakout to verify the 2×8 pitch and which pins are paired.

---

## Section 11 — FRAM

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| U5 | Infineon (Cypress) **FM24V01A-GTR** | **3RD-PARTY** | **STOCK** `Package_SO:SOIC-8_3.9x4.9mm_P1.27mm` | SnapEDA: [FM24V01A-GTR](https://www.snapeda.com/parts/FM24V01A-GTR/Cypress%20Semiconductor/view-part/) for the symbol. The footprint is stock SOIC-8 — you could skip the SnapEDA pull for the footprint and just use the stock one; the SnapEDA symbol is the value-add. Address pins A0/A1 (A2 is no-connect per datasheet sec. 3.1) |
| Decoupling | 100 nF 0603 | **STOCK** | **STOCK** | One next to VDD |
| R-wp | Optional — pin internally pulled down per datasheet | **STOCK** `Device:R` | **STOCK** 0603 | The FM24V01A-GTR datasheet explicitly states WP "is pulled down internally" (same for A0, A1, A2). **You can leave WP NC and the chip defaults to write-enabled.** If you want write-protect under firmware control, route WP to a MCU GPIO. If you want write-protect always on, tie WP directly to VDD (no resistor). My earlier draft had an external 10 kΩ pull-down — redundant with the internal one. Drop it |
| Addressing | A0, A1, A2 internally pulled down — defaults to 0x50 | n/a | n/a | Same internal pull-down. Default address 0x50 is what you want with a single FRAM on the bus. No external pull-downs needed |

**Verdict:** SnapEDA for the symbol only; stock footprint.

---

## Section 12 — Battery management

### 12a — Li-ion charger

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| U6 | Texas Instruments **BQ25630YBGR** | **3RD-PARTY** | **3RD-PARTY** | TI's CAD download page (under "Quality & Packaging") provides the official symbol/footprint; SnapEDA also has it. **DSBGA (YBG) package — verified per TI datasheet SLUSFN0A:** 30-ball wafer-level BGA, **2.3 × 2.4 mm**, 0.4 mm pitch, 6 rows (A-F) × 5 columns (1-5). **NOT 25-ball, NOT 2.5 × 2.5** — earlier drafts of this guide had that wrong. **This is hand-solder-unfriendly.** It is the only ball-grid part in the prototype BOM. You will need reflow (hot plate or hot air). **Do not skip footprint verification — DSBGA footprints are the #1 source of unbuildable prototype boards** |
| L-charger | 1 µH power inductor, 5 A saturation | **STOCK** `Device:L` | **3RD-PARTY** — specific Coilcraft/TDK part | Per BQ25630 datasheet sec. 7.3 Recommended Operating Conditions, inductor range is **0.68 µH to 2.2 µH**. 1 µH is a good middle choice. Saturation current must be ≥ 5 A (charge current target). Switching frequency is **1.5 MHz** fixed. Coilcraft XGL4020-102, XGL4030-102, or TDK SPM4030 family. Pull from Coilcraft's official KiCAD lib |
| Decoupling — VBUS | 1 µF ceramic | **STOCK** `Device:C` | **STOCK** 0603 | Per BQ25630 datasheet table 7-3: CVBUS = 1 µF (without de-rating). Place close to VBUS pin. **Note:** I had 10 µF here previously — the datasheet actually puts the 10 µF on PMID, not VBUS |
| Decoupling — PMID | 10 µF + 100 nF ceramic | **STOCK** `Device:C` | **STOCK** 0603 | Per BQ25630 datasheet sec. 6 Pin Functions (PMID row): "Typical value: 10 µF in parallel with 0.1 µF ceramic capacitor". Place both close to PMID pin |
| Decoupling — SYS | 20 µF ceramic (or 22 µF E12 standard) | **STOCK** `Device:C` | **STOCK** 0603/0805 | Per BQ25630 datasheet table 7-3: CSYS = 20 µF (without de-rating). 22 µF is the closest E12 standard value. **A 22 µF 0805 X7R is the typical choice** — 0603 22 µF parts are X5R and lose significant capacitance at the SYS rail voltage |
| Decoupling — BAT | 10 µF ceramic | **STOCK** `Device:C` | **STOCK** 0603 | Per BQ25630 datasheet sec. 6 Pin Functions (BAT row): "Connect a 10 µF ceramic capacitor closely to the BAT pin and GND" |
| Decoupling — REGN | **4.7 µF ceramic, 10 V or higher** | **STOCK** `Device:C` | **STOCK** 0603 | Per BQ25630 datasheet sec. 6 Pin Functions (REGN row): "Connect a 10 V or higher rating 4.7 µF ceramic capacitor from REGN to power ground. The capacitor must be close to the IC." **My earlier draft had 100 nF here — wrong.** REGN supplies the internal MOSFET gate drivers, so it carries fast switching current spikes |
| BTST bootstrap cap | **47 nF ceramic** between BTST and SW | **STOCK** `Device:C` | **STOCK** 0402/0603 | Per BQ25630 datasheet sec. 6 Pin Functions (BTST row): "Connect a 47 nF bootstrap capacitor from SW to BTST." **I omitted this entirely in earlier drafts.** Without it the high-side MOSFET driver has no boot strap supply and the regulator won't switch correctly |
| TS thermistor | **103AT-2** 10 kΩ NTC β=3380K | **3RD-PARTY** | **3RD-PARTY** | Per BQ25630 datasheet sec. 6 Pin Functions (TS row): "Recommend a 103AT-2 10 kΩ thermistor." In a prototype without a real battery thermistor, you can substitute a fixed 10 kΩ + 10 kΩ resistor divider from REGN to GND with the midpoint as TS — this fakes a 25 °C reading. **For production**, use the real thermistor next to the battery cell. The 103AT-2 has specific β characteristics; substituting other 10 kΩ NTCs may push the JEITA temperature window out of spec |
| CE pull-up | 10 kΩ to logic rail OR direct GPIO | **STOCK** `Device:R` | **STOCK** 0603 | Per datasheet: "CE pin must be pulled HIGH or LOW, do not leave floating." Drive from a MCU GPIO (CHRG_CE on PC3 per pin table) with no external resistor required — the MCU enforces the level |
| INT pull-up | 10 kΩ to `+3V3` (open-drain output) | **STOCK** `Device:R` | **STOCK** 0603 | Per BQ25630 datasheet sec. 6 Pin Functions (INT row): "Open Drain Active Low Interrupt Output — Connect /INT to the logic rail via a 10 kΩ resistor." |
| PG pull-up | **2.2 kΩ** to `+3V3` (open-drain output) | **STOCK** `Device:R` | **STOCK** 0603 | Per BQ25630 datasheet sec. 6 Pin Functions (PG row): "Connect to the pull up rail via a 2.2 kΩ resistor." **NOT 10 kΩ** — earlier draft generalised. PG is faster than INT and needs the lower resistance for clean edges |
| SDA/SCL pull-ups | 10 kΩ each to `+3V3` | **STOCK** `Device:R` | **STOCK** 0603 | Per BQ25630 datasheet sec. 6 Pin Functions (SDA/SCL rows): "Connect SDA/SCL to the logic rail through a 10 kΩ resistor." For the shared I²C bus on this board, **10 kΩ is fine for relaxed 100/400 kHz** with 4 slaves; if bus capacitance exceeds ~250 pF or speed exceeds 400 kHz, lower to 4.7 kΩ. Verify on first board with a scope |
| BATP series resistor | 100 Ω in series to battery+ | **STOCK** `Device:R` | **STOCK** 0603 | Per BQ25630 datasheet sec. 6 Pin Functions (BATP row): "Positive Battery Voltage Sense — Kelvin connect to positive battery terminal. Place 100 Ω series resistance between this pin and the battery positive terminal." Kelvin sense ensures battery voltage reading isn't corrupted by IR drop in the charge path |
| J-usb | USB-C receptacle | **3RD-PARTY** | **3RD-PARTY** | **NOT explicitly in `Keuze prototype` rows** but required — BQ25630's USB-C detection only works with the CC pulldowns through a real receptacle. Add one to the BOM. GCT USB4105-GF-A-060 is the popular option (SnapEDA + Ultra Librarian both have it). Würth 632723300011 is a hand-solderable alternative |
| R-cc | 5.1 kΩ × 2 | **STOCK** `Device:R` | **STOCK** 0603 | One on each of CC1 and CC2, to GND. Advertises as default 3 A capable UFP |
| TVS-usb | USBLC6-2SC6 or SP3010 | **3RD-PARTY** | **STOCK** SOT-23-6 | ESD protection on USB-C D+/D−/CC. SnapEDA has both. Strongly recommended on any USB-C input |
| J-batt | 2-pin JST PH or screw terminal for Li-ion cell | **STOCK** `Connector_Generic:Conn_01x02` | **STOCK** `Connector_JST:JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical` | Stock |

**Verdict:** ~4 SnapEDA/vendor pulls + 1 missing-from-BOM USB-C receptacle to add. The DSBGA is the highest-difficulty part on the board for manual assembly.

### 12b — 3.3 V buck-boost (PROTOTYPE: RT6150B, NOT RAA2361052)

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| U7 | Richtek **RT6150B** | **3RD-PARTY** | **3RD-PARTY** | SnapEDA: [RT6150B](https://www.snapeda.com/) — search the exact MPN. **WDFN-10L 2.5×2.5 mm** package (per architecture sheet). 10-pin DFN with thermal pad. 800 mA output is plenty for the prototype's digital loads |

> **Why RT6150B for prototype, not RAA2361052:** `Bikera.xlsx` row 36 explains: "Minder energiezuinig, ok voor prototype" — less efficient but acceptable for prototype. The RT6150B is easier to source and has SnapEDA coverage; the RAA2361052GNP#HC5 is occasionally out of stock at Mouser. The two chips are **not pinout-compatible** (different DFN-10 packages, different pin assignments) — if you transition to the `Keuze finaal` design later, this is a board-respin, not a chip-swap

| What | Detail |
|---|---|
| Vin | SYS rail from BQ25630 (1.8–5.5 V — within RT6150B range) |
| Vout | +3V3 set via external FB divider. **The RT6150B is NOT internally fixed** — per Richtek datasheet DS6150A/B-04, all variants use an external resistor divider on the FB pin (VFB = 0.5 V typical). Datasheet's typical app circuit for 3.3 V: **R1 = 487 kΩ, R2 = 86.6 kΩ** (giving Vout = 0.5 × (1 + 487/86.6) = 3.31 V). For better transient response, add a feedforward cap in parallel with R1: Cff ≈ 20 pF |
| Input cap | **10 µF** ceramic on VIN (per datasheet sec. Input Capacitor Selection — minimum 10 µF, ceramic, X7R, placed close to VIN pin) |
| Output cap | **20 µF** ceramic on VOUT (per datasheet typical app — actual value 20 µF; 22 µF E12 is acceptable). X7R 0805 strongly recommended |
| Inductor | **2.2 µH** per RT6150B datasheet typical app circuit. Recommended range 1.5–4.7 µH. Choose saturation current ≥ 1.6 A (datasheet ILIM spec). Connect between LX1 (pin 4) and LX2 (pin 2) |
| EN pin (pin 6) | Tie high (always-on) for prototype, or to MCU GPIO if rail switching planned. Tie high for now — `+3V3` is the always-on rail in this design |
| PS pin (pin 7) | Mode select. **Per datasheet: pull LOW for Power Save Mode (PSM, light-load efficient), pull HIGH for forced fixed-frequency PWM.** Earlier draft had this backwards. Quiescent current is only 60 µA in PSM. **Tie LOW for the always-on `+3V3` rail** so battery lasts longest — the MCU + peripherals draw <10 mA most of the time, and PSM keeps efficiency high there |
| VINA pin (pin 8) | **Separate analog supply for the control circuit.** Per datasheet typical app circuit, **VINA ties directly to VIN** — no RC filter shown. Earlier drafts of this guide incorrectly suggested an RC filter; the datasheet typical app just connects them. Doing so couples the control reference to the input rail which is fine for this app |
| FB pin (pin 10) | Output voltage feedback — connect to the R1/R2 divider midpoint as described above. Place divider close to the FB pin, away from switching nodes |
| GND (pins 3, 9, 11/EPAD) | **All three GND pins plus the exposed pad must connect to the ground plane.** EPAD via grid is critical for thermal dissipation (θJA = 40.9 °C/W on WDFN-10L 2.5×2.5) |

**Verdict:** 1 SnapEDA pull + 1 Coilcraft inductor lib pull.

### 12c — 3.3 V LDO (GPS rail)

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| U8 | Toshiba **TCR3UG33A,LF** | **3RD-PARTY** | **3RD-PARTY** | SnapEDA: [TCR3UG33A,LF](https://www.snapeda.com/parts/TCR3UG33A,LF/Toshiba%20Semiconductor%20and%20Storage/view-part/). **WCSP4F (4-bump wafer-level CSP).** Tiny — 0.94×0.94 mm. Like the BQ25630, hand-soldering this is unpleasant; reflow strongly recommended. The "A" variant has auto-discharge per the BOM Opmerking |
| Decoupling | 1 µF ceramic in + 1 µF out | **STOCK** | **STOCK** 0603 | Per Toshiba datasheet sec. 5 |
| Control pin | Tie high or to MCU GPIO `GPS_EN` | **STOCK** `Device:R` | **STOCK** 0603 | Recommended: route to MCU GPIO for power-gating GPS in sleep. The L431 → LC76GPAMD power-down sequence saves significant battery |

**Verdict:** 1 SnapEDA pull.

### 12d — 5 V boost (servo rail)

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| U9 | Texas Instruments **TPS61253F** | **3RD-PARTY** | **3RD-PARTY** | SnapEDA. Per **TI datasheet JAJSD31E (verified)**: **9-ball DSBGA, 1.2 × 1.3 mm body, 0.4 mm pitch, 3 rows × 3 columns**. Pin map: A1=VOUT, A2=VOUT, A3=VIN, B1=SW, B2=SW, B3=EN, C1=GND, C2=GND, C3=MODE. Output is **5 V fixed** (the F suffix designates 5 V). Switching 3.8 MHz, up to 1.5 A continuous output, 4 A peak |
| L-boost | 1 µH, 4 A saturation | **STOCK** `Device:L` | **3RD-PARTY** Coilcraft | Per TI datasheet typical app. The BOM notes "4,5A spoelstroom" — pick an inductor with ≥4 A saturation. Coilcraft XAL4020-102 (1 µH, 5.4 A sat) or similar. Connects between VIN and SW pins (SW = B1+B2 tied) |
| Decoupling | 10 µF in (VIN) + 22 µF out (VOUT) | **STOCK** | **STOCK** 0805 | Per TI datasheet typical app circuit. Place close to VIN and VOUT respectively. X7R 6.3V or higher |
| EN pin (B3) | **Must connect to MCU GPIO** `EN_5V_SERVO` | **STOCK** `Device:R` | **STOCK** 0603 | Per datasheet: EN has internal pull-down to GND (chip off by default). The MCU drives EN high to enable the servo rail only during unlock cycles. Add 100 kΩ external pull-down for explicit safety on MCU reset — redundant with the internal pull-down but cheap insurance |
| MODE pin (C3) | Tie HIGH for forced PWM | **STOCK** `Device:R` | **STOCK** 0603 | Per datasheet: **MODE Low = Auto PFM** (efficient at light load), **MODE High = forced PWM** (constant 3.8 MHz across load range), **MODE Floating = ultrasonic** (>25 kHz to avoid audible noise). For a servo that draws large transient current during motion, **forced PWM is right** — avoids mode-transition glitches when servo current spikes. Pull to VOUT (5 V) via 100 kΩ, OR tie to MCU GPIO `SERVO_MODE` if you want runtime control |

**Verdict:** 1 SnapEDA pull + 1 Coilcraft inductor.

---

## Section 13 — Servo motor (off-board)

| Ref | What | Symbol | Footprint | Plan |
|---|---|---|---|---|
| MOT1 | **TD-8120MG Digital Servo** (off-board) | n/a (off-board) | n/a | Documented in BOM only |
| J-servo | 3-pin JST PH 2.0 mm female header (per Notes file) | **STOCK** `Connector_Generic:Conn_01x03` | **STOCK** `Connector_JST:JST_PH_B3B-PH-K_1x03_P2.00mm_Vertical` (already in KiCAD per Notes file) | The Readme proposes JST PH over Dupont/2.54 mm pin header for vibration resistance. **Cable colour code (TD-8120MG detail sheet):** Brown = GND (–), Red = V+ (4.8–8.4 V), Orange = Signal (PWM). PCB pin assignment: Pin 1 GND, Pin 2 +5V_SERVO, Pin 3 SERVO_PWM. **Signal pulse High = 3–5 V — the L431 GPIO at 3.3 V satisfies this threshold; no level shifter needed.** |
| R-sense | Current-sense resistor, 0.05 Ω, 2 W, low-side | **STOCK** `Device:R_Shunt` (or generic `Device:R` with `Sense` in description) | **STOCK** `Resistor_SMD:R_2512_6332Metric` | The architecture diagram shows this as **Rsense extern** — a shunt in the servo's GND return path. Voltage across it (proportional to servo current) goes back to a MCU ADC pin as `SERVO_ISENSE`. Use 0.05 Ω so at 2 A stall current you see 100 mV across the shunt — clean ADC reading, low power dissipation (0.2 W) |
| Op-amp (optional) | Current-sense amplifier (INA181, INA199, or generic) | **3RD-PARTY** | **STOCK** SOT-23-6 | Optional. The MCU's 12-bit ADC can read the shunt directly at 0–100 mV (sees codes 0–124 out of 4095 — coarse but workable). Adding an INA181 gives 50× gain → 0–5 V range → full ADC resolution. For prototype, **skip the op-amp** — read the shunt voltage directly via differential ADC, accept coarse resolution. Punt to rev 2 if firmware really needs finer current data |
| C-bulk | 470 µF electrolytic + 100 nF ceramic | **STOCK** `Device:CP` + `Device:C` | **STOCK** radial CP + 0603 | Bulk decoupling close to the servo connector. Servos pull large pulse currents — without local bulk, the 5 V rail dips and the MCU may brownout |

**Verdict:** all stock for the prototype (skipping the op-amp). The Rsense moves from "optional rev 2" in my earlier draft to "in prototype" per the architecture diagram.

---

## Section 14 — Visual indicator (LED)

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| D1 | American Bright **BL-BEG204-7-E** (dual red+green, common anode, 5 mm THT) | **STOCK** `Device:LED_DUAL_KAK` (per `Notes/Symbols and footprints.md`, already in KiCAD) | **STOCK** `LED_THT:LED_D5.0mm-3` or `LED_THT:LED_D5.0mm-3_Horizontal_O3.81mm_Z3.0mm` | Stock both. Pin order: red K — common A — green K. **Verify** against datasheet — some 3-pin duals are anode-cathode-anode (independent diodes), not common-anode. BL-BEG204-7-E is common-anode per its datasheet, but the symbol's pin assignment must match (`LED_DUAL_KAK` = "cathode-anode-cathode") |
| R-led | 2× current-limit resistors (one per colour) | **STOCK** `Device:R` | **STOCK** 0603 | Per BL-BEG204-7-E datasheet @ If=20 mA: green Vf typ 2.2 V (max 2.6 V), red Vf typ 2.0 V (max 2.6 V). Target ~8 mA at GPIO per architecture sheet. With 3.3 V GPIO source and typ Vf: R_green = (3.3 − 2.2)/0.008 = 138 Ω → **150 Ω**; R_red = (3.3 − 2.0)/0.008 = 163 Ω → **180 Ω**. Worst-case check (min Vf ~1.7 V from the Vf-vs-If curve): I_red_max = (3.3 − 1.7)/180 = 8.9 mA. Safely under the 20 mA datasheet limit. The LED is common-anode so MCU drives cathodes low to light — active-low control |

**Verdict:** all stock.

---

## Section 15 — Hall effect sensor (×2, prototype: identical DRV5032 parts)

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| U10, U11 | Texas Instruments **DRV5032DULPGM** ×2 | **3RD-PARTY** | **3RD-PARTY** | SnapEDA: [DRV5032DULPGM](https://www.snapeda.com/parts/DRV5032DULPGM/Texas%20Instruments/view-part/) (link from `Notes/Symbols and footprints.md`). **TO-92 THT package**. Per TI datasheet SLVSDC7H Table 5-1: the **"DU" variant is Unipolar with TWO output pins** (OUT1 responds to north-pole flux, OUT2 responds to south-pole flux), making this a **4-pin TO-92** package — pin 1 = VCC, pin 2 = OUT1 (N-pole), pin 3 = GND, pin 4 = OUT2 (S-pole). Push-pull outputs. Note: the related "FD" variant is Unipolar with only ONE output (3-pin), often confused with DU — verify the SnapEDA symbol has 4 pins, not 3 |
| Decoupling | 100 nF 0603 (×2, one per sensor) | **STOCK** | **STOCK** | One per sensor next to VCC, per datasheet recommended app circuit |
| Pull-up | NOT required — DRV5032DU has push-pull outputs per datasheet | n/a | n/a | If you accidentally pick the open-drain variant (FC, AJ, ZE), you'll need 10 kΩ pull-ups. The "DU" suffix confirms push-pull |

> **Design question — which OUT pin(s) to wire?** The architecture diagram shows one wire per sensor going to the MCU (`Hall 1` from the pin sensor, `Hall 2` from the beugel sensor), with comment "TO-92, zuidpool detectie" (south-pole detection). The DRV5032DU chip physically has **both OUT1 and OUT2** — so the architecture choice is to wire only **OUT2 (south pole)** and leave **OUT1 NC** on each chip. The trade-off:
> - **Wire OUT2 only (architecture choice):** one MCU GPIO per sensor, detects only S-pole. Simpler, matches arch diagram. **2 GPIOs total.**
> - **Wire both OUT1 and OUT2:** two MCU GPIOs per sensor, detects N AND S independently. More tamper-resistant — an attacker can't fool by flipping the magnet. **4 GPIOs total.**
> Recommend wiring **only OUT2** for prototype to match the architecture diagram and reduce GPIO pressure. Add `Keuze finaal` improvement: switch to dedicated N-pole + S-pole sensors per the BOM Opmerking row 50.

> **Prototype simplification:** `Bikera.xlsx` row 50 Opmerking: "2 dezelfde voor prototype, noord en zuid voor finaal ontwerp". The prototype uses **two identical DRV5032DU sensors, both wired to detect south pole only** (OUT2). Fine for first bring-up. The `Keuze finaal` design switches to one N-pole-specific + one S-pole-specific (SL1613SH + SL1623SH SMD parts) so an attacker can't fool the lock by flipping a single magnet over. **This security feature is not present in the prototype.** Don't claim anti-tamper robustness on the prototype build

**Verdict:** 1 SnapEDA pull, used twice (one symbol, two placements with different reference designators). The symbol must be the 4-pin TO-92 variant for the DRV5032DU specifically, not the 3-pin variant which is for FD/FA/etc.

---

## Section 16 — Debug / programming (ST-link BTB card edge)

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| J-swd | KYOCERA-AVX **009159010603906** (Card Edge, Dual Row Inverted, 2×5 pos, 2.0 mm pitch) | **3RD-PARTY** | **3RD-PARTY** | Mouser ([part page](https://www.mouser.be/ProductDetail/KYOCERA-AVX/009159010603906)) has the KiCAD CAD download. This is the **board-to-board (BTB) variant** of the STLINK-V3MINIE connection — the STLINK-V3MINIE has card-edge fingers on its own PCB that plug directly into this connector on your target board. This is NOT the 14-pin STDC14 ribbon-cable option |

> **Two ways to connect STLINK-V3MINIE:**
> 1. **STDC14 ribbon cable** (14-pin, 1.27 mm, 2×7) — included with the probe. Needs a `PinHeader_2x07_P1.27mm_Vertical_SMD` footprint on your PCB.
> 2. **BTB card edge** (10-pin via card edge connector 009159010603906) — the probe plugs directly into your board.
>
> `Bikera.xlsx` rows 52+53 selected the BTB option (row 53: "Card edge connector"). This is mechanically more compact but means the probe physically hangs off your PCB during debug. **Either works** — the BTB has fewer parts (no ribbon cable) but the STDC14 is more flexible (probe can sit on your desk). For prototype, BTB is fine; consider whether your enclosure design allows the probe to plug in at the chosen location.
>
> If you change your mind later: stock KiCAD has the STDC14 header footprint as well, and swapping is a footprint reassignment in the schematic.

### Pinout (BTB 2×5, per STLINK-V3MINIE UM2910)

The 10 pins of the BTB card edge expose: T_VCC, GND × 2, T_NRST, T_JTCK/SWCLK, T_JTMS/SWDIO, T_JTDO/SWO, T_RX, T_TX, GND. Verify exact pin assignment in the STLINK-V3MINIE user manual UM2910 Table 3 "Pads on board to CN2 BTB card edge connector".

**Verdict:** 1 Mouser-AVX CAD download. **The card edge gold-plated fingers on your PCB are part of the connector footprint** — don't forget them.

---

## Section 17 — UART-to-USB bridge (per architecture diagram)

The architecture diagram shows a **UART-to-USB bridge** block between the USB-C port's D+/D− pins and a MCU UART. This is a separate USB-to-serial converter IC giving the host PC a virtual COM port to the MCU — independent of the ST-link's VCP. Use cases for the prototype: console logging, AT command pass-through to the RAK11720 from the host PC, firmware bootloader access via STM32 USART boot mode without the ST-link.

| Ref | MPN | Symbol | Footprint | Plan |
|---|---|---|---|---|
| U-bridge | **CP2102N-A02-GQFN24** (or CH340N, or FT232RL) | **3RD-PARTY** | **3RD-PARTY** or **STOCK** | SnapEDA: search the exact MPN. **CP2102N-A02-GQFN24** is the modern choice (Silicon Labs, 4 mm × 4 mm QFN-24, 3.3 V single-supply, USB Full Speed). CH340N (3 mm × 3 mm SOP-8) is cheaper but has fewer features. **Recommendation: CP2102N** for reliable cross-platform drivers without third-party kernel modules. SnapEDA covers all three |
| C-bridge | **4.7 µF + 100 nF per power pin** (×3 power pins on QFN-24 variant = 3 × (4.7 µF + 100 nF) = 6 caps total) | **STOCK** `Device:C` | **STOCK** 0603 | Per CP2102N datasheet Figure 2.3 (Connection Diagram with Voltage Regulator Not Used) verified: "4.7 µF and 0.1 µF bypass capacitors required for each power pin placed as close to the pins as possible." On the QFN-24 variant the relevant power pins are: VREGIN (pin 8 — tie to VDD since we don't use the internal 5V regulator), VDD (pin 7), and VIO (pin 6). Each needs its own 4.7 µF + 100 nF pair. RSTb (pin 9) needs a 1 kΩ pull-up to VIO |
| R-usb-sig | NOT needed — CP2102N has internal D+ pull-up and proper output impedance | n/a | n/a | Per CP2102N datasheet sec. 4.1: "Integrated USB transceiver; no external resistors required." D+ has internal 1.5 kΩ pull-up and 28–44 Ω output impedance. Skip the external resistors |
| R-vbus-sense | 22.1 kΩ + 47.5 kΩ divider on VBUS pin | **STOCK** `Device:R` | **STOCK** 0603 (×2) | Per CP2102N datasheet Figure 2.6 (self-powered) verified: "A resistor divider on VBUS is required to meet these specifications" — the chip uses VBUS as a digital sense input to detect when USB is connected. With VIO at 3.3 V, the chip's VIH for VBUS = VIO – 0.6 = 2.7 V, and absolute max is VIO + 2.5 = 5.8 V. The 22.1 kΩ (top) / 47.5 kΩ (bottom) divider on a 5 V VBUS gives ~3.6 V at the sense pin — above VIH, below absolute max. **This is self-powered config** (our case, since `+3V3` for the bridge comes from the RT6150B/battery, not from USB) |

### Wiring overview

- USB-C D+ → bridge `D+` pin directly (no series resistor — CP2102N has internal termination)
- USB-C D− → bridge `D−` pin directly
- USB-C VBUS → 22.1 kΩ / 47.5 kΩ divider → bridge `VBUS` sense pin (NOT a power connection; just the connection-detect input). Place the divider close to the bridge
- Bridge VDD ← `+3V3` (self-powered config, internal 5V regulator unused, so VREGIN tied to VDD)
- Bridge VIO ← `+3V3` (same rail since MCU is also 3.3 V)
- Bridge RSTb → 1 kΩ pull-up to VIO (`+3V3`)
- Bridge `TX` → MCU USART (assign during schematic capture — `BRIDGE_RX` net, MCU receives)
- Bridge `RX` ← MCU USART (`BRIDGE_TX` net, MCU transmits)
- Bridge `RTS`, `CTS`, `DTR`, `DSR` → optional GPIO; useful if you want host-side flow control or auto-reset on Arduino-style boot

### Shared D+/D− with the BQ25630 USB-C input

This is the catch: **the USB-C port's D+/D− pair has to go to ONE place — either the BQ25630 (which uses them for BC1.2/USB-C source detection) or the UART bridge (which uses them as a USB data port).** They can't both own the lines.

Two architectures:

**A) Bridge wins, charger uses CC only:** Connect USB-C D+/D− to the bridge. The BQ25630 detects the source via CC pulldowns (5.1 kΩ each), not via BC1.2. This works because USB-C source advertisement happens entirely through CC signalling — the BQ25630 reads the CC voltage to know whether it's a default 3 A source or higher. **You lose BC1.2 detection of legacy USB-A chargers**, but with USB-C exclusively this isn't a real loss.

**B) Charger wins, no UART bridge:** Connect D+/D− to the BQ25630. Skip the UART bridge. Console logging happens via the ST-link's VCP through the BTB card edge (`DEBUG_TX`/`DEBUG_RX`) instead.

> **Recommendation for the prototype: Architecture A.** Wire the bridge to D+/D−. The CC-only detection works fine for USB-C-only charging. The UART bridge gives you a host PC console **even when the ST-link is unplugged** — useful for field debugging.

### USB hub on the same port?

Some designs add a 2-port USB hub IC so D+/D− goes to both the bridge AND the BQ25630's BC1.2 input. Overkill for the prototype. Skip.

**Verdict:** 1 SnapEDA pull (CP2102N or CH340N). Stock passives. **Add to BOM** — this is not in `Bikera.xlsx` Keuze prototype but is required to honour the architecture diagram.

---

## Section 18 — TVS protection (per LC76G Hardware Design + general practice)

The LC76G Hardware Design reference circuits show TVS diodes on three locations: VCC, V_BCKP, and the RF antenna line. Use the right variant for each — the SMBJ family alone covers two of the three but the antenna needs a different family.

| Location | Recommended TVS | Why | Footprint |
|---|---|---|---|
| `+3V3_GPS` rail (at LC76GPAMD VCC pin) | **SMBJ5.0CA** (5 V bidirectional, SMB package) | Power-rail protection. Bidirectional because the supercap discharge path can briefly raise voltage above ground reference on the diode-OR. 5 V standoff sits ~1.5 V above the rail = good headroom without false clamping | **STOCK** `Diode_SMD:D_SMB` |
| `V_BCKP` net | **SMBJ5.0CA** (same as above) | Same reasoning, same part — buy one reel, use for both | **STOCK** `Diode_SMD:D_SMB` |
| GPS antenna RF line | **SMF05C** or **PESD5V0X1BSF** (low-capacitance ESD, SOD-323 or DFN) | The SMBJ family has junction capacitance 50–500 pF — adding that across the antenna input detunes the antenna match dramatically (the LC76G's RF input expects ~50 Ω, the TVS capacitance turns it into a low-pass filter at GPS frequencies). RF-rated ESD TVS keeps junction capacitance <2 pF, invisible at 1.575 GHz | **STOCK** `Diode_SMD:D_SOD-323` |
| **USB-C VBUS, D+, D−, CC** | Use the dedicated **USBLC6-2SC6** (already in Section 12a) instead of discrete SMBJ | The USBLC6 integrates 4 ESD channels in SOT-23-6, low-capacitance — purpose-built for USB-C. Don't reinvent with SMBJ on D±/CC |

> **About the SMBJ58CA datasheet upload:** the 58 V variant is **wrong for every location on this board** — the highest standoff voltage on the board is 5 V (USB VBUS / `+5V_SERVO`), so a 58 V TVS would never clamp anything. Use `SMBJ5.0CA` from the same family (same datasheet, page 3 row 1 of the variant table). Other applicable variants: `SMBJ3.3CA` for protecting `+3V3` rails specifically (3.3 V standoff, tighter clamp), though `SMBJ5.0CA` is the common-stock choice and works fine on 3.3 V rails.

**TVS placement rule:** on every rail entering the board from outside (USB-C VBUS, battery connector, servo connector), place a TVS between the rail and GND, as close to the connector as physically possible. The TVS only protects what's downstream of itself.

**Verdict:** add SMBJ5.0CA (×2 minimum: VCC of GPS + V_BCKP) and one RF-rated TVS (SMF05C) to the BOM. Existing USBLC6 covers USB-C. Battery input could optionally get a SMBJ5.0CA too — Li-ion cells don't generate transients but a swap or hot-plug event can.

---

## Section 19 — Passives roll-up (across the whole board)

All passives use stock symbols and footprints. The audit's job is to make sure you have **footprint variants** available before capture, not to enumerate every R and C. Expected counts (rough):

| Footprint | Stock library | Expected count | Used for |
|---|---|---|---|
| `Capacitor_SMD:C_0603_1608Metric` | STOCK | 25–35 | Decoupling everywhere |
| `Capacitor_SMD:C_0805_2012Metric` | STOCK | 5–8 | Bulk on power rails (RT6150B, TPS61253F) |
| `Capacitor_SMD:C_1206_3216Metric` | STOCK | 2–3 | Charger input |
| `CP_Radial_D6.3mm_P2.50mm` (or similar) | STOCK | 1 | Servo bulk electrolytic |
| `Resistor_SMD:R_0603_1608Metric` | STOCK | 25–40 | Pull-ups, dividers, LED limiting, CC pulldowns |
| `Inductor_SMD:L_*` per Coilcraft lib | 3RD-PARTY | 3 | One per switching converter |
| `LED_THT:LED_D5.0mm-3` | STOCK | 1 | Status LED |
| Generic header footprints | STOCK | 5–6 | Breakouts, servo, battery |
| Test points | STOCK `Connector:TestPoint` | 6–10 | Power rails, key signals — add liberally for first bring-up |
| Mounting holes | STOCK `MountingHole:MountingHole_3.2mm_M3` | 4 | M3 standoffs at corners |

---

## Roll-up

### Downloads required (do these BEFORE starting schematic capture)

| # | Source | Parts |
|---|---|---|
| 1 | **SnapEDA** (free account) | RAK11720 (MHF4 variant), LC76GPAMD, FM24V01A-GTR (symbol only — footprint is stock), BQ25630YBGR, RT6150B, TCR3UG33A,LF, TPS61253F, U.FL / IPEX-1 receptacle (for GPS antenna), USBLC6-2SC6 (USB-C ESD), GCT USB4105-GF-A-060 (USB-C), **CP2102N-A02-GQFN24** (UART-to-USB bridge), **SMBJ5.0CA** (general TVS, also stock `Diode:TVS` works with MPN set), **SMF05C or PESD5V0X1BSF** (low-cap RF TVS for GPS antenna), **BAT54C** (dual Schottky for V_BCKP diode-OR — also stock `Diode:BAT54C`) |
| 2 | **Ultra Librarian** (free) | LC76GPAMD (alternate source if SnapEDA's footprint looks suspect) |
| 3 | **RAKwireless official KiCAD lib** (`https://downloads.rakwireless.com`) | RAK11720 — primary source, more reliable than SnapEDA for module castellation |
| 4 | **Coilcraft "Tools" page** | Power inductors for BQ25630 (~1 µH, 5 A sat), RT6150B (~2.2 µH), TPS61253F (~1 µH, 4.5 A sat) — pick exact parts during schematic capture |
| 5 | **Mouser CAD download** | KYOCERA-AVX 009159010603906 (card edge) — primary source |

### Custom symbols required

| # | Part | Risk | Mitigation |
|---|---|---|---|
| 1 | ePaper 8-pin connector symbol | LOW (one-time draw, stock JST footprint) | Use Waveshare's wiki page for the exact pinout |
| 2 | LIS2DW12 breakout module 2× 1×4 header symbol | LOW (stock 1×4 headers, verify spacing) | Measure the actual Tinytronics breakout with calipers |
| 3 | SD adapter module 2×8 header symbol | LOW | Measure the actual breakout, especially which pins are paired |

### Custom footprints required

**None.** Every footprint either has a stock equivalent or a SnapEDA/vendor source. The closest call is the BQ25630YBGR DSBGA — that's 3rd-party, not custom, but is the highest-risk footprint regardless of source (see `02_footprints_explained.md` sec. 12a).

### Stock-only sections

Section 1 (MCU), Section 13 (servo), Section 14 (LED), Section 17 (passives roll-up). Proceed without downloads.

---

## Cross-check against `bikera.ino` and the architecture sheet

The current firmware (`bikera.ino`) is written for the Arduino MKR WAN 1310 — different MCU. The migration to STM32L431 + RAK11720 means the firmware will be rewritten under STM32 HAL or LL libraries, but the **peripheral choices** the firmware makes should drive the schematic pin assignments:

- ATECC608B I²C address: 0x60 (default). Shared I²C bus with FRAM (0x50), LIS2DW12 (0x18/0x19), BQ25630 (0x6A).
- LoRa via UART AT commands (RAK11720 default), shared with MCU USART2 in the planned pin map.
- GPS via UART on MCU USART3.
- ECDSA signing happens in the ECC chip — MCU just sends commands. No heavy crypto math on the L431.

These are captured in the pin assignment table in `03_schematic_capture_guide.md`.

---

## What's NOT in `Keuze prototype` but you may want anyway

These items appeared in the architecture diagram or `Readme.md` as part of the prototype, but are not flagged `Keuze prototype = TRUE` in `Bikera.xlsx`. Some are now upgraded to "required" based on the architecture diagram review:

| What | Why it might matter | Status |
|---|---|---|
| **USB-C receptacle** | BQ25630's USB-C detection requires the CC pulldowns through a real receptacle. Without one you can't bench-charge via USB-C, only via direct VBAT cell | **Required.** Add GCT USB4105-GF-A-060 to the BOM |
| **USB-C ESD protection** | Standard practice on USB-C inputs. Without it, ESD on a charging cable insertion can damage the BQ25630 | **Strongly recommended.** Add 1× USBLC6-2SC6 SOT-23-6 on D+/D−/CC |
| **CP2102N UART-to-USB bridge** | The architecture diagram shows this as a distinct block. It gives the host PC a virtual COM port to the MCU independent of the ST-link's VCP — invaluable for field debugging and RAK11720 AT command pass-through | **Required per architecture diagram.** Add to BOM |
| **GPS V_BCKP backup circuit** | The architecture diagram shows a "GPS backup power circuit" block. Without V_BCKP, every GPS wake-up is a cold start (~30 s TTFF). With V_BCKP retained across main-power-off, warm-start is ~5 s | **Recommended per architecture diagram.** Add BAT54C + 0.1 F supercap + 1 kΩ. Can be omitted for first bring-up if you don't mind cold starts |
| **GPS U.FL receptacle** | The architecture diagram specifies "RF 1 connector" for the GPS antenna interface | **Required for the FPC antenna to connect** — add to BOM (Hirose U.FL-R-SMT, ~€0.50) |
| **Servo current sense resistor (Rsense)** | The architecture diagram shows Rsense as an external component with sense signal back to MCU ADC. `Readme.md` calls out "sense weerstand om blokkage overstroom te detecteren" | **Required per architecture diagram.** Add 0.05 Ω 2 W shunt (2512) — see Section 13 |
| **RTC backup cell/supercap (MCU VBAT)** | `Readme.md` mentions "Eventueel aparte (oplaadbare) knoopcel" wired to STM32 VBAT. Without it the MCU's RTC loses time on every power cycle. Note: this is separate from the GPS V_BCKP backup above — different chip, different RTC | Optional. Add a 0.5 F supercap + 1N5817 Schottky if RTC time accuracy is critical for rental-state logic. Punt to rev 2 otherwise |

---

## Recommended next move

Before opening KiCAD, three confirmations:

1. **KiCAD version?** This audit assumed 9.x. Different lib coverage on 8.x (notably some STM32L4 footprints and the security IC family).
2. **Add USB-C + U.FL + ESD protection to the BOM** before schematic capture, not during. Mid-capture additions break net naming and force re-validation.
3. **Decide on ECC socket vs. soldered.** This is a fab-time choice but it affects the footprint (socket needs through-holes for retention; bare chip is pure SMD). Default to **bare chip soldered** for prototype unless you genuinely expect to swap >5 chips during development.

Once those are settled, the next document is `02_footprints_explained.md` — the per-part footprint contents and verification methodology for every non-stock part.

Then `03_schematic_capture_guide.md` covers the order of capture, hierarchical sheet split, net naming, ERC config, and the around-the-IC passive values.

Then `04_pcb_layout_guide.md` covers placement, stack-up, the U.FL trace impedance, ground-plane strategy, and DRC settings.
