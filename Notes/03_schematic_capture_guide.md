# Bikera — Schematic Capture & Readability Guide

**Authoritative source for all values and pin assignments:** `BIKERA_SCHEMATIC_PROMPT.md`  
**Authoritative source for component selection:** `Bikera.xlsx` → Keuze prototype = TRUE (BOM wins over architecture diagram where they disagree)  
**KiCAD version:** 9 (schematic format 20231120)

---

## Layout rules — apply to every sheet

Four rules that make a schematic readable without knowing the design:

1. **Power flows top → bottom.** Power symbols (+3V3, +5V_SERVO, +SYS) sit above the IC. GND symbols sit below. A reader can scan vertically and immediately see the supply chain.
2. **Signal flows left → right.** Inputs and incoming labels enter from the left edge. Outputs and outgoing labels exit from the right edge. Cross-sheet nets use net labels, not long wire runs.
3. **No diagonal wires.** Every wire segment must be horizontal or vertical. A diagonal wire in KiCAD schematic mode usually means two endpoints that don't actually share a net — it looks connected but isn't.
4. **Decoupling caps hang vertically from the supply pin.** Place the cap immediately below the VCC/supply pin (or immediately to one side if space is tight). Both orientations work; pick one and keep it consistent. Connect pin 1 (top) to the supply net, pin 2 (bottom) to GND.

---

## Net names used across sheets

These labels must be spelled identically on every sheet — KiCAD treats them as global connections only within a hierarchical sheet set, so a typo creates a silent open circuit.

| Net | Source sheet | Consumer sheets |
|---|---|---|
| `+VBAT` | 01_power | 02_mcu (VBAT_SENSE divider) |
| `+SYS` | 01_power | 01_power (internal: feeds U2, U3, U4) |
| `+3V3` | 01_power | 02, 03, 05, 06, 07, 08, 09 |
| `+3V3_GPS` | 01_power (via U3) | 04_gps |
| `+5V_SERVO` | 01_power (via U4) | 07_actuator |
| `GND` | everywhere | everywhere |
| `I2C_SDA` | 02_mcu | 01_power (BQ25630), 05_storage (FRAM), 06_sensors (LIS2DW12), 08_secure (ATECC608B) |
| `I2C_SCL` | 02_mcu | same as SDA |
| `SPI1_SCK` | 02_mcu | 05_storage (SD + ePaper) |
| `SPI1_MISO` | 02_mcu | 05_storage (SD) |
| `SPI1_MOSI` | 02_mcu | 05_storage (SD + ePaper) |
| `USB_DP` | 01_power (J1) | 09_bridge |
| `USB_DN` | 01_power (J1) | 09_bridge |
| `USB_VBUS` | 01_power (J1) | 09_bridge (sense divider only) |
| `BRIDGE_TX` | 09_bridge | 02_mcu (LPUART1 RX, PC1) |
| `BRIDGE_RX` | 09_bridge | 02_mcu (LPUART1 TX, PC0) |
| `DEBUG_TX` | 02_mcu | 02_mcu (to J11 BTB pin 10) |
| `DEBUG_RX` | 02_mcu | 02_mcu (from J11 BTB pin 9) |
| `LORA_TX` | 02_mcu | 03_radio |
| `LORA_RX` | 02_mcu | 03_radio |
| `LORA_RESET` | 02_mcu | 03_radio |
| `LORA_BOOT` | 02_mcu | 03_radio |
| `GPS_TX` | 02_mcu | 04_gps |
| `GPS_RX` | 02_mcu | 04_gps |
| `GPS_RESET` | 02_mcu | 04_gps |
| `GPS_EN` | 02_mcu | 01_power (TCR3UG33A CONTROL) |
| `GPS_PPS` | 04_gps | 02_mcu |
| `CHRG_CE` | 02_mcu | 01_power |
| `CHRG_PG` | 01_power | 02_mcu |
| `CHRG_INT` | 01_power | 02_mcu |
| `EN_5V_SERVO` | 02_mcu | 01_power (TPS61253F EN) |
| `VBAT_SENSE` | 01_power | 02_mcu |
| `SERVO_PWM` | 02_mcu | 07_actuator |
| `SERVO_ISENSE` | 07_actuator | 02_mcu |
| `LED_RED` | 02_mcu | 07_actuator |
| `LED_GREEN` | 02_mcu | 07_actuator |
| `HALL_BEUGEL` | 06_sensors | 02_mcu |
| `HALL_PIN` | 06_sensors | 02_mcu |
| `ACCEL_INT1` | 06_sensors | 02_mcu |
| `ACCEL_INT2` | 06_sensors | 02_mcu |
| `SD_CS` | 02_mcu | 05_storage |
| `EPAPER_CS` | 02_mcu | 05_storage |
| `EPAPER_DC` | 02_mcu | 05_storage |
| `EPAPER_RST` | 02_mcu | 05_storage |
| `EPAPER_BUSY` | 05_storage | 02_mcu |

---

## Sheet 01 — Power (`01_power.kicad_sch`)

**What this sheet does:** converts USB-C or battery voltage into the four regulated rails the rest of the board uses: `+3V3` (always on), `+3V3_GPS` (GPS-gated), `+5V_SERVO` (servo-gated), and `+SYS` (intermediate charger output that feeds the three regulators).

### Circuit topology

```
                    ┌──────────────────────────────────────────────────────────┐
USB-C J1            │  01_power.kicad_sch                                      │
VBUS ─────┐         │                                                           │
D+   ─┐   │         │  ┌─────────────┐    +SYS ──────────────────────────────┐ │
D-   ─┤   │         │  │ BQ25630 U1  │                                        │ │
CC1  ─┤   └─────────┼─►│ VBUS        │    ┌───────────────────────────────┐   │ │
CC2  ─┤   ┌─────────┼─►│ BAT    SYS ─┼───►│ RT6150B U2                    │   │ │
       │   │         │  │ SW──L1      │    │ VIN  VOUT ──► +3V3 (global)   │   │ │
       │   │ J2      │  │ BTST──47nF  │    └───────────────────────────────┘   │ │
       │   │ battery │  │ REGN──4.7µF │                                        │ │
       │   └─────────┼─►│ CC1         │    ┌───────────────────────────────┐   │ │
       │             │  │ CC2         │    │ TCR3UG33A U3                  │   │ │
       │             │  │ I2C──────── ┼────┤ VIN  VOUT ──► +3V3_GPS        │   │ │
       │             │  │ PG──────────┼───►│      CTRL ◄── GPS_EN          │   │ │
       │             │  │ INT─────────┼───►│                               │   │ │
       │             │  │ CE ─────────┼────┤ (GPS-gated LDO)               │   │ │
       │             │  │ BATP──100Ω─►│BAT+└───────────────────────────────┘   │ │
       │             │  │ D+ NC       │                                        │ │
       │             │  │ D- NC       │    ┌───────────────────────────────┐   │ │
       │             │  │ QON NC      │    │ TPS61253F U4                  │   │ │
       │             │  └─────────────┘    │ VIN──L3──SW    VOUT ──► +5V_SERVO │ │
       │             │                     │ EN ◄── EN_5V_SERVO             │   │ │
       └─────────────┼─► USB_DP (label to sheet 09)                        │   │ │
                     │  └─► through USBLC6 D1 first                        │   │ │
                     │  USB_DN (label to sheet 09)                         │   │ │
                     │  USB_VBUS (label to sheet 09)                       │   │ │
                     └──────────────────────────────────────────────────────┘   │
                                                                                │
                     +SYS feeds all three regulators above ─────────────────────┘
```

### Placement on the A4 page

Place components in three horizontal bands:

```
LEFT (x=20–80)          CENTER (x=80–160)         RIGHT (x=160–260)
─────────────────────────────────────────────────────────────────────
[J1 USB-C]              [U1 BQ25630]              [U2 RT6150B]
[D1 USBLC6]             [L1 inductor]             [L2 inductor]
                         [J2 battery]             [U3 TCR3UG33A]
                                                  [U4 TPS61253F]
                                                  [L3 inductor]
```

Power rails run as horizontal bus lines:
- `+SYS` as a horizontal wire at y≈60 connecting U1 SYS → U2 VIN, U3 VIN, U4 VIN
- `+3V3` as a power symbol on U2 VOUT (no long wire — let power symbols do the work)
- `+3V3_GPS` as a power symbol on U3 VOUT
- `+5V_SERVO` as a power symbol on U4 VOUT

### J1 — USB-C receptacle (GCT USB4105-GF-A-060)

```
J1 pin      → connects to
─────────────────────────────────────────────────────────
VBUS        → wire to D1 (USBLC6) VBUS in, then to U1 VBUS pins (A1, B1)
GND (×2)    → GND power symbol
CC1         → 5.1 kΩ resistor to GND, and wire to U1 CC1 (F4)
CC2         → 5.1 kΩ resistor to GND, and wire to U1 CC2 (F5)
D+          → D1 (USBLC6) D+ in → net label USB_DP (exits to sheet 09)
D-          → D1 (USBLC6) D- in → net label USB_DN (exits to sheet 09)
Shell       → GND
```

**CC pulldowns:** draw two 5.1 kΩ resistors from CC1 and CC2 to GND. Without these the BQ25630 cannot detect the USB-C source and will only pull 100 mA.

### D1 — USBLC6-2SC6 (ESD protection, SOT-23-6)

Place immediately right of J1. The USBLC6 sits between J1 and everything downstream — it must be first in the chain.

```
D1 pin      → connects to
─────────────────────────────────────────────────────────
VBUS        → VBUS from J1 (input, also feeds U1)
D+ (in)     → D+ from J1
D- (in)     → D- from J1
D+ (out)    → net label USB_DP
D- (out)    → net label USB_DN
GND         → GND
```

### U1 — BQ25630YBGR (Li-ion charger)

This IC has 30 pins in a 6×5 BGA. Group them by function in the symbol's connections:

```
U1 pin(s)   → connects to
─────────────────────────────────────────────────────────
VBUS (A1,B1)     → from D1 VBUS out / J1 VBUS. Add 1 µF ceramic to GND close to these pins.
PMID (A2,B2)     → 10 µF + 100 nF ceramic to GND (these two caps in parallel)
SW (A3,B3,C3)    → one side of L1 (1 µH power inductor, ≥5 A saturation)
PGND (A4,B4,C4)  → GND
REGN (A5)        → 4.7 µF ceramic (10 V rated) to GND
BTST (B5)        → 47 nF ceramic to the SW node (connect across BTST and the L1 junction)
CE (C1)          → net label CHRG_CE (comes from MCU PC3). Drive low = charge enabled.
PG (C2)          → net label CHRG_PG (goes to MCU PA11). Pull-up: 2.2 kΩ to +3V3.
SW_3 (C3)        → ties to other SW pins (same node as L1)
PGND_3 (C4)      → GND
INT (C5)         → net label CHRG_INT (goes to MCU PA12). Pull-up: 10 kΩ to +3V3.
SYS (D1,D2,D3)  → net +SYS. Add 20 µF ceramic to GND (use 22 µF E12 value, 0805).
QON (D4)         → NC (no-connect flag)
SCL (D5)         → net label I2C_SCL. Pull-up: 10 kΩ to +3V3 (place the pull-up ONLY HERE).
BAT (E1,E2,E3)  → J2 battery pin 1 (+). Add 10 µF ceramic to GND close to BAT pins.
TS (E4)          → 103AT-2 thermistor (or 10 kΩ to REGN + 10 kΩ to GND fixed divider for bench bring-up)
SDA (E5)         → net label I2C_SDA. Pull-up: 10 kΩ to +3V3 (place the pull-up ONLY HERE).
BATP (F1)        → 100 Ω resistor in series to J2 battery pin 1 (Kelvin sense — separate from the BAT power path)
D+ (F2)          → NC
D- (F3)          → NC
CC1 (F4)         → J1 CC1 and 5.1 kΩ to GND
CC2 (F5)         → J1 CC2 and 5.1 kΩ to GND
```

**Inductor L1:** place between the SW pins junction and a node that connects back to VBUS/PMID. One terminal → SW pins (A3,B3,C3 tied), other terminal → PMID/VBUS node. Keep this loop physically small on the PCB.

**I²C pull-ups:** the 10 kΩ pull-ups on SDA and SCL go here on this sheet only. Do NOT add another set on any other sheet — duplicate pull-ups halve the effective resistance and cause glitches.

### J2 — Battery connector (JST PH 2.0 mm, 2-pin)

```
J2 pin 1 (BAT+) → U1 BAT pins (E1,E2,E3) and U1 BATP via 100 Ω
J2 pin 2 (GND)  → GND
```

### U2 — RT6150B (3.3 V buck-boost)

```
U2 pin      → connects to
─────────────────────────────────────────────────────────
VIN (5)     → +SYS net. Add 10 µF ceramic to GND close to this pin.
VOUT (1)    → +3V3 power symbol. Add 20 µF ceramic (22 µF E12) to GND.
LX1 (4)     → one end of L2 (2.2 µH, ≥1.6 A saturation)
LX2 (2)     → other end of L2
EN (6)      → +SYS (tie high for always-on +3V3 rail)
PS (7)      → GND (PSM mode — efficient at light loads. Do NOT tie high.)
VINA (8)    → VIN pin (5) directly — no RC filter, just a short wire
FB (10)     → midpoint of R1 (487 kΩ, top) / R2 (86.6 kΩ, bottom) divider.
              R1 from FB to VOUT. R2 from FB to GND. This sets Vout = 3.3 V.
              Optional: 20 pF cap in parallel with R1 for better transient response.
GND (3,9)   → GND
EPAD (11)   → GND (thermal pad — must be soldered and via'd to ground plane)
```

### U3 — TCR3UG33A,LF (3.3 V LDO, GPS rail)

This LDO is deliberately separate from +3V3 so the MCU can gate GPS power off during sleep.

```
U3 pin      → connects to
─────────────────────────────────────────────────────────
VIN (A1)    → +SYS. Add 1 µF ceramic to GND.
VOUT (B2)   → +3V3_GPS power symbol. Add 1 µF ceramic to GND.
CONTROL (A2)→ net label GPS_EN (from MCU PB12). High = LDO on. Internal pull-down so GPS defaults OFF.
GND (B1)    → GND
```

### U4 — TPS61253F (5 V boost, servo rail)

The servo rail is gated — only live when EN_5V_SERVO is driven high by the MCU.

```
U4 pin      → connects to
─────────────────────────────────────────────────────────
VIN (A3)    → +SYS. Add 10 µF ceramic to GND close to this pin.
VOUT (A1,A2)→ +5V_SERVO power symbol. Add 22 µF ceramic to GND (0805, X7R).
SW (B1,B2)  → one end of L3 (1 µH, ≥4 A saturation). Other end of L3 → VIN.
EN (B3)     → net label EN_5V_SERVO (from MCU PA4). 
              Also add 100 kΩ from EN to GND (explicit low-side pull keeps rail
              off during MCU reset, redundant with internal pull-down but cheap).
MODE (C3)   → 100 kΩ resistor to VOUT (+5V_SERVO). This forces PWM mode.
              Do NOT leave MODE floating (that is ultrasonic mode, not PWM).
GND (C1,C2) → GND
```

### Battery sense divider

Draw this in the bottom-left of the power sheet, near J2:

```
+VBAT ── 220 kΩ ── VBAT_SENSE ── 100 kΩ ── GND
                        │
                     10 nF to GND (anti-aliasing)
                        │
                  net label VBAT_SENSE (to MCU PA0, ADC1_IN5)
```

---

## Sheet 02 — MCU (`02_mcu.kicad_sch`)

**What this sheet does:** houses the STM32L431CCT6TR with all decoupling, the SWD debug connector (J11), and the two tactile buttons (BOOT, RESET). All MCU-to-peripheral signals exit as net labels.

### Placement on the A4 page

```
TOP-LEFT              CENTER                    RIGHT
──────────────────────────────────────────────────────────
[SW1 BOOT button]     [STM32L431 U7]            [J11 BTB SWD]
[SW2 RESET button]    (center of sheet)
                      [decoupling caps
                       arranged around IC]
```

The MCU has 48 pins. In KiCAD the LQFP-48 symbol has pins on all four sides. Net labels exit from each side toward the sheet edge — left-side pins get left-pointing labels, right-side pins get right-pointing labels. This prevents wires crossing over the IC body.

### U7 — STM32L431CCT6TR

All connections below use net labels, not wires running across the page.

**Power pins (place power symbols directly on pin, no label):**

```
Pin 1  VBAT  → +3V3 power symbol
Pin 6  BOOT0 → see button section below (not a power pin, but listed here for reference)
Pin 7  NRST  → see button section below
Pin 8  VSSA  → GND power symbol
Pin 9  VDDA  → filtered +3V3 via ferrite bead FB1 (600 Ω @ 100 MHz)
               Then: 1 µF X7R to VSSA (bulk), 100 nF X7R to VSSA (HF)
Pin 36 VSS   → GND
Pin 37 VDD   → +3V3. Decoupling: 100 nF X7R immediately to GND.
Pin 46 VSS   → GND
Pin 47 VDD   → +3V3. Decoupling: 100 nF X7R immediately to GND.
Pin 48 VSS   → GND
```

**Ferrite bead FB1 for VDDA:**
```
+3V3 ── [FB1 600Ω@100MHz, 0603] ── VDDA (pin 9)
                                         │
                                     100 nF to VSSA (pin 8)
                                         │
                                       1 µF to VSSA
```
Place FB1 and both VDDA caps physically close together in your PCB layout, closest to pin 9.

**Signal pins — complete assignment:**

| MCU pin | Net label | Direction | Goes to |
|---|---|---|---|
| PA0 (10) | `VBAT_SENSE` | in | Battery divider on sheet 01 |
| PA1 (11) | `SERVO_PWM` | out | Sheet 07 servo J9 |
| PA2 (12) | `LORA_RX` | out | Sheet 03 RAK11720 UART_RX (PA2=USART2_TX, MCU transmits to module's RX line) |
| PA3 (13) | `LORA_TX` | in | Sheet 03 RAK11720 UART_TX (PA3=USART2_RX, MCU receives from module's TX line) |
| PA4 (14) | `EN_5V_SERVO` | out | Sheet 01 TPS61253F EN |
| PA5 (15) | `SPI1_SCK` | out | Sheet 05 SD + ePaper |
| PA6 (16) | `SPI1_MISO` | in | Sheet 05 SD |
| PA7 (17) | `SPI1_MOSI` | out | Sheet 05 SD + ePaper |
| PA8 (18) | `LED_GREEN` | out | Sheet 07 LED green cathode resistor |
| PA9 (19) | `DEBUG_TX` | out | J11 BTB pin 10 (ST-Link receives) |
| PA10 (20) | `DEBUG_RX` | in | J11 BTB pin 9 (ST-Link transmits) |
| PA11 (21) | `CHRG_PG` | in | Sheet 01 BQ25630 PG |
| PA12 (22) | `CHRG_INT` | in | Sheet 01 BQ25630 INT |
| PA13 (23) | `SWDIO` | bidir | J11 BTB pin 3 |
| PA14 (24) | `SWCLK` | in | J11 BTB pin 5 |
| PA15 (25) | `SD_CS` | out | Sheet 05 SD chip select |
| PB3 (26) | `SWO` | out | J11 BTB pin 7 |
| PB4 (27) | `HALL_BEUGEL` | in | Sheet 06 DRV5032 #1 OUT2 |
| PB5 (28) | `HALL_PIN` | in | Sheet 06 DRV5032 #2 OUT2 |
| PB6 (29) | `I2C_SCL` | out | I²C bus (pull-up on sheet 01) |
| PB7 (30) | `I2C_SDA` | bidir | I²C bus (pull-up on sheet 01) |
| PB8 (32) | `GPS_RESET` | out | Sheet 04 LC76GPAMD RESET_N |
| PB9 (33) | `GPS_PPS` | in | Sheet 04 LC76GPAMD 1PPS |
| PB10 (34) | `GPS_TX` | out | Sheet 04 LC76GPAMD RXD |
| PB11 (35) | `GPS_RX` | in | Sheet 04 LC76GPAMD TXD |
| PB12 (38) | `GPS_EN` | out | Sheet 01 TCR3UG33A CONTROL |
| PB13 (39) | `ACCEL_INT1` | in | Sheet 06 LIS2DW12 INT1 |
| PB14 (40) | `ACCEL_INT2` | in | Sheet 06 LIS2DW12 INT2 |
| PB15 (41) | `LORA_BOOT` | out | Sheet 03 RAK11720 BOOT |
| PC0 (42) | `BRIDGE_RX` | out | Sheet 09 CP2102N RXD |
| PC1 (43) | `BRIDGE_TX` | in | Sheet 09 CP2102N TXD |
| PC2 (44) | `SERVO_ISENSE` | in | Sheet 07 Rsense tap |
| PC3 (45) | `CHRG_CE` | out | Sheet 01 BQ25630 CE |
| PC13 (2) | `EPAPER_CS` | out | Sheet 05 ePaper CS |
| PC14 (3) | `EPAPER_DC` | out | Sheet 05 ePaper DC |
| PC15 (4) | `EPAPER_RST` | out | Sheet 05 ePaper RST |
| PH0 (5) | `EPAPER_BUSY` | in | Sheet 05 ePaper BUSY |
| PH1 (6) | NC | — | No-connect flag |
| BOOT0 (31) | — | — | See SW1 below |

### SW1 — BOOT button

```
+3V3
  │
[SW1 momentary NO]
  │
BOOT0 (MCU pin 31) ── 10 kΩ ── GND
```
This 10 kΩ pull-down keeps BOOT0 low (normal boot) at all times. Pressing SW1 momentarily pulls BOOT0 high. Do this during a RESET to enter STM32 system bootloader — useful for flashing via UART without the ST-Link.

No additional capacitor needed on BOOT0 — just the 10 kΩ pull-down and the button.

### SW2 — RESET button

```
NRST (MCU pin 7) ── 100 nF ── GND
       │
     [SW2 momentary NO]
       │
      GND
```
The STM32L431 NRST pin has an internal pull-up (~40 kΩ). The only external component needed is a 100 nF cap for noise immunity. Pressing SW2 momentarily shorts NRST to GND, resetting the MCU. No external pull-up resistor needed (adding one wastes current and slows reset release).

### J11 — KYOCERA-AVX 009159010603906 (ST-Link BTB)

Place in the top-right of the sheet. Wires from J11 to MCU are short because the SWD pins (PA13, PA14, PB3) are in one corner of the LQFP-48.

> **Note:** The pinout below is the assignment used in the generated schematic (source: BIKERA_SCHEMATIC_PROMPT.md). The 009159010603906 pin numbers (1–10) do **not** map 1-to-1 to the UM2910 BTB pad numbers — verify physical alignment against the STLINK-V3MINIE hardware before PCB layout.

```
J11 pin → connects to
─────────────────────────────────────────────────────────
1  VTGT   → +3V3 (tells ST-Link what voltage the target uses)
2  GND    → GND
3  SWDIO  → net label SWDIO (MCU PA13)
4  GND    → GND
5  SWCLK  → net label SWCLK (MCU PA14)
6  NRST   → NRST (MCU pin 7, same node as SW2 and 100nF cap)
7  SWO    → net label SWO (MCU PB3)
8  GND    → GND
9  RX     → net label DEBUG_RX (MCU PA10 receives from ST-Link)
10 TX     → net label DEBUG_TX (MCU PA9 transmits to ST-Link)
```

---

## Sheet 03 — Radio (`03_radio.kicad_sch`)

**What this sheet does:** connects the RAK11720 LoRa+BLE module. No RF traces on the PCB — the MHF4 variant routes RF internally to its two MHF4 connectors. This sheet is therefore only UART, power, and control signals.

### Placement on the A4 page

```
LEFT                    CENTER                     RIGHT
─────────────────────────────────────────────────────────
Net labels              [RAK11720 U5]              Net labels
LORA_RX ──────────────► UART_RX                   LORA_ANT ──► (MHF4 J3)
LORA_TX ◄────────────── UART_TX                   BLE_ANT  ──► (MHF4 J4)
LORA_RESET ───────────► NRESET
LORA_BOOT ────────────► BOOT0

+3V3 ─────────────────► VBAT (+ decoupling cluster top-right)
                         GND
```

### U5 — RAK11720

```
U5 function pin  → connects to
─────────────────────────────────────────────────────────
VBAT             → +3V3. Decoupling: 10 µF + 1 µF + 100 nF in parallel close to pin.
VDD_REF (VIO)    → +3V3. Extra 100 nF nearby.
GND (all)        → GND
UART_TX (module out) → net label LORA_TX (to MCU PA3, USART2_RX — MCU receives)
UART_RX (module in)  → net label LORA_RX (from MCU PA2, USART2_TX — MCU transmits)
NRESET           → net label LORA_RESET (from MCU PB1). 10 kΩ pull-up to +3V3.
BOOT0            → net label LORA_BOOT (from MCU PB15). 10 kΩ pull-down to GND.
LORA_ANT         → net label LORA_ANT (to MHF4 connector J3)
BLE_ANT          → net label BLE_ANT (to MHF4 connector J4)
all other GPIO   → NC flags
```

**NRESET pull-up:** 10 kΩ from NRESET to +3V3. This holds the module in normal operation. MCU drives NRESET low to reset the module.

**BOOT0 pull-down:** 10 kΩ from BOOT0 to GND. Normal boot. MCU drives high only for module firmware update.

### Decoupling cluster

Draw the three VBAT decoupling caps in a vertical stack to the right of VBAT:

```
+3V3 power symbol
  │
  ├── 10 µF (1206 or 0805, X5R) to GND   ← handles TX peak current (87 mA at +20 dBm LoRa)
  ├── 1 µF (0603, X7R) to GND
  └── 100 nF (0603, X7R) to GND
```

---

## Sheet 04 — GPS (`04_gps.kicad_sch`)

**What this sheet does:** connects the LC76GPAMD GNSS module including its VCC decoupling stack (required by Quectel HW Design), the V_BCKP backup power circuit (keeps RTC alive during main-power-off), and the RF antenna chain to the U.FL connector.

### Placement on the A4 page

```
LEFT                    CENTER                     RIGHT
─────────────────────────────────────────────────────────────────────────────
Net labels              [LC76GPAMD U6]             [U.FL J5]
GPS_TX ──────────────── RXD                        ▲
GPS_RX ──────────────── TXD                      RF_IN ── [D2 TVS] ── J5 SIG
GPS_RESET ────────────── RESET_N               
GPS_EN → (via U3        VCC ── VCC decoupling        J5 GND → GND
  on sheet 01)               stack (below)

+3V3_GPS ─────────────► VCC

BOTTOM-LEFT: V_BCKP backup circuit
```

### VCC decoupling stack (Quectel fig. 4 — mandatory)

This exact combination is required. Place all four close to the VCC pin:

```
+3V3_GPS
  │
  ├── Q1 (SMBJ5.0CA TVS, bidirectional) to GND  ← surge/ESD protection
  ├── 10 µF (0805, X5R) to GND                  ← bulk
  ├── 100 nF (0603, X7R) to GND                 ← HF
  └── 33 pF (0603, C0G) to GND                  ← very HF (LNA reference)
              │
              └──► U6 VCC pin
```

Draw this as a vertical stack to the left of U6. The TVS sits at the top (closest to the incoming rail), then 10µF, 100nF, 33pF in order down to GND.

### U6 — LC76GPAMD

```
U6 pin          → connects to
─────────────────────────────────────────────────────────
VCC             → +3V3_GPS (via decoupling stack above)
GND (all)       → GND
TXD             → net label GPS_RX (to MCU PB11, USART3_RX — GPS sends, MCU receives)
RXD             → net label GPS_TX (from MCU PB10, USART3_TX — MCU sends to GPS)
RESET_N         → net label GPS_RESET (from MCU PB8). Pull-up: 10 kΩ to +3V3_GPS.
1PPS            → net label GPS_PPS (to MCU PB9). Push-pull output, no pull-up.
V_BCKP         → V_BCKP net (from backup circuit below)
D_SEL           → 10 kΩ to GND (selects UART mode at startup, per Quectel Table 8)
ANT_ON          → NC flag
WAKEUP          → NC flag
RF_IN           → antenna chain (D2 TVS → J5 U.FL)
GEOFENCE        → NC flag
JAM_IND         → NC flag
3D_FIX          → NC flag
RESERVED        → NC flags
```

### V_BCKP backup circuit (Quectel fig. 5)

Place in the bottom-left of the sheet. This circuit maintains GPS RTC and ephemeris data across main-power-off events, reducing cold-start from ~30 s to ~5 s warm-start.

```
Circuit topology:
                    ┌── 1 kΩ ──┬── supercap (0.1 F) ── GND
                    │           │
+3V3_GPS            │         BCKP_CAP node
     │              │           │
     └──────────────┤      D4 BAT54C (dual Schottky, common-cathode)
                    │      Anode A ◄── +3V3_GPS
                    │      Anode B ◄── BCKP_CAP
                    │      Cathode ──► V_BCKP
                    │                    │
                    │              Decoupling:
                    │              4.7 µF + 100 nF + 33 pF to GND
                    └──────────────────► U6 V_BCKP pin
```

Drawn in KiCAD:
1. +3V3_GPS power symbol → 1 kΩ resistor → BCKP_CAP net junction
2. BCKP_CAP net → supercap C_SC (0.1 F) → GND
3. D4 BAT54C anode A: +3V3_GPS. Anode B: BCKP_CAP. Cathode: V_BCKP net
4. V_BCKP net → 4.7 µF to GND, 100 nF to GND, 33 pF to GND
5. V_BCKP net → U6 V_BCKP pin

### Antenna chain (right side of sheet)

```
U6 RF_IN ── wire ── [D2 SMF05C RF TVS to GND] ── wire ── J5 SIG pin
                                                           J5 GND → GND (via)
```

The D2 TVS (SMF05C or PESD5V0X1BSF) sits in shunt from the antenna signal line to GND. Its job is ESD protection. **Never use SMBJ family here** — their junction capacitance (50–500 pF) detunes the antenna and kills GPS sensitivity. The SMF05C has <2 pF.

Leave optional pi-network footprint pads (C1, C2) in the chain but mark them DNI (do not install). They allow RF tuning on first prototype without a PCB respin.

---

## Sheet 05 — Storage (`05_storage.kicad_sch`)

**What this sheet does:** connects the FRAM (I²C), SD card breakout (SPI), and ePaper module connector (SPI). SD and ePaper share MOSI and SCK.

### Placement on the A4 page

```
LEFT                    CENTER                     RIGHT
─────────────────────────────────────────────────────────────────────────────
[U8 FM24V01A FRAM]      [J6 SD adapter 2×8]       [J7 ePaper 8-pin JST]
I2C_SDA ──────────►  SDA
I2C_SCL ──────────►  SCL
                        SPI1_SCK ◄── label          SPI1_SCK ◄── label
                        SPI1_MISO ──► label         (ePaper no MISO)
                        SPI1_MOSI ◄── label         SPI1_MOSI ◄── label
                        SD_CS ◄── label            EPAPER_CS ◄── label
```

### U8 — FM24V01A-GTR (FRAM, SOIC-8)

```
U8 pin      → connects to
─────────────────────────────────────────────────────────
VCC (8)     → +3V3. Decoupling: 100 nF directly to GND.
GND (4)     → GND
SDA (5)     → net label I2C_SDA
SCL (6)     → net label I2C_SCL
A0 (1)      → NC flag (internal pull-down → address 0x50)
A1 (2)      → NC flag (internal pull-down)
A2 (3)      → NC flag (internal pull-down)
WP (7)      → NC flag (internal pull-down → write-enabled)
```

No external pull-down resistors needed on A0/A1/A2/WP — the datasheet confirms internal pull-downs. Do NOT add external pull-downs; they're redundant.

### J6 — SD adapter module (2×8 pin header)

The Tinytronics SD module duplicates each pin into a pair (for strain-relief). Wire each pair to the same net.

```
J6 pin pair → connects to
─────────────────────────────────────────────────────────
1,2  GND        → GND
3,4  VCC        → +3V3
5,6  MISO       → net label SPI1_MISO
7,8  MOSI       → net label SPI1_MOSI
9,10 SCK        → net label SPI1_SCK
11,12 CS        → net label SD_CS
13,14 CD        → NC flag (or to spare GPIO if card-detect needed)
15,16 (varies)  → NC flag
```

**SPI pull-ups on the SD side (add on this sheet):**
- 10 kΩ from MISO to +3V3
- 10 kΩ from CS to +3V3
These ensure the SD card enters SPI mode correctly on cold start.

### J7 — ePaper connector (JST PH B8B, 8-pin)

```
J7 pin  → connects to
─────────────────────────────────────────────────────────
1  VCC  → +3V3
2  GND  → GND
3  DIN  → net label SPI1_MOSI (shared with SD)
4  CLK  → net label SPI1_SCK (shared with SD)
5  CS   → net label EPAPER_CS (from MCU PC13)
6  DC   → net label EPAPER_DC (from MCU PC14)
7  RST  → net label EPAPER_RST (from MCU PC15)
8  BUSY → net label EPAPER_BUSY (to MCU PH0)
```

---

## Sheet 06 — Sensors (`06_sensors.kicad_sch`)

**What this sheet does:** connects the LIS2DW12 accelerometer breakout (I²C) and two DRV5032DULPGM Hall effect sensors (GPIO, push-pull output).

### Placement on the A4 page

```
LEFT                         RIGHT
──────────────────────────────────────────────────────
[J8 LIS2DW12 breakout]       [U10 DRV5032 #1 beugel]
Header A: power + I2C
Header B: interrupts + mode   [U11 DRV5032 #2 pin]
```

### J8 — LIS2DW12 breakout (2× 1×4 pin header)

The module has two 4-pin headers. **Verify the pinout of your specific Tinytronics SKU before wiring — different breakout sources have different header assignments.**

Typical wiring (confirm against actual module):

```
Header A (power + I²C):
  Pin 1 VCC   → +3V3
  Pin 2 GND   → GND
  Pin 3 SDA   → net label I2C_SDA
  Pin 4 SCL   → net label I2C_SCL

Header B (interrupt + mode select):
  Pin 1 INT1  → net label ACCEL_INT1 (to MCU PB13)
  Pin 2 INT2  → net label ACCEL_INT2 (to MCU PB14)
  Pin 3 SDO/SA0 → GND (selects I²C address 0x18; tie to +3V3 for 0x19)
  Pin 4 CS    → +3V3 (forces I²C mode; per LIS2DW12 datasheet sec. 6.2)
```

CS must be tied to +3V3 (not left floating) when using I²C mode. The internal pull-up (~50 kΩ) would hold it, but the datasheet explicitly recommends an explicit tie.

### U10 — DRV5032DULPGM (Hall sensor #1, beugel/shackle)

The DU variant has **4 pins** in a TO-92 package — not 3. OUT1 detects north pole, OUT2 detects south pole. The prototype wires only OUT2 (south pole detection).

```
U10 pin     → connects to
─────────────────────────────────────────────────────────
Pin 1 VCC   → +3V3. Decoupling: 100 nF immediately to GND.
Pin 2 OUT1  → NC flag (north-pole output, unused in prototype)
Pin 3 GND   → GND
Pin 4 OUT2  → net label HALL_BEUGEL (to MCU PB4)
```

No pull-up resistor on OUT2 — the DRV5032DU has push-pull output.

### U11 — DRV5032DULPGM (Hall sensor #2, locking pin)

Identical wiring to U10, except OUT2 → net label HALL_PIN (to MCU PB5).

---

## Sheet 07 — Actuator (`07_actuator.kicad_sch`)

**What this sheet does:** connects the servo motor connector, current-sense shunt, bulk decoupling, and the status LED with its current-limit resistors.

### Important layout note for this sheet

The servo section and LED section are logically separate. Divide the sheet into two horizontal zones:
- **Top half:** servo and current sense
- **Bottom half:** LED

Do NOT mix components from the two sections or let wires from one cross through the other. This was the source of diagonal-wire problems in the generated version.

### Placement on the A4 page

```
TOP (servo section, y = 40–110)
─────────────────────────────────────────────────────────────────────────────
LEFT                         CENTER                       RIGHT
[C70 470µF]                  [J9 servo connector]
[C71 100nF]                        │
       │                      Pin 2 GND
       │                           │
+5V_SERVO ──────────────────► Pin 1 V+
                              Pin 3 SIG ◄──── SERVO_PWM

                         Pin 2 GND ── R70 (0.05Ω) ── GND (board)
                                          │
                                    SERVO_ISENSE label


BOTTOM (LED section, y = 130–190)
─────────────────────────────────────────────────────────────────────────────
LED_RED ── R71 (470Ω) ──┐
                         ├── [D3a red cathode] ── [D3b green cathode] ── R72 (330Ω) ── LED_GREEN
                         │
                    +3V3 ── common anode of both LEDs
```

### J9 — Servo connector (JST PH B3B, 1×3)

```
J9 pin      → connects to
─────────────────────────────────────────────────────────
Pin 1 V+    → +5V_SERVO power symbol (red wire on TD-8120MG cable)
Pin 2 GND   → one side of R70 (shunt resistor). The other side goes to board GND.
Pin 3 SIG   → net label SERVO_PWM (from MCU PA1, TIM2_CH2)
```

**Pin order matters.** The TD-8120MG cable is: Pin 1 = red = V+, Pin 2 = brown = GND, Pin 3 = orange = signal. If the connector symbol has a different ordering, check it carefully before wiring.

### R70 — Current-sense shunt (0.05 Ω, 2 W, 2512 package)

This resistor sits in the servo's GND return path. It creates a small voltage drop proportional to servo current, which the MCU reads as an analogue signal.

```
Servo GND return path:
J9 Pin 2 (GND) ─── R70 (0.05 Ω) ─── GND (board ground plane)
                         │
                   SERVO_ISENSE ──► net label to MCU PC2 (ADC1_IN3)
```

Tap SERVO_ISENSE from the junction between J9 pin 2 and R70 pin 1 (the servo side, i.e. the HIGH side of the shunt relative to GND). At 2 A stall current: 2 A × 0.05 Ω = 100 mV, which the ADC reads as code ~124 out of 4095. Coarse but sufficient to detect stall.

Add a 100 nF filter cap from SERVO_ISENSE to GND close to the MCU ADC pin (place on this sheet, not the MCU sheet, to show intent).

### Bulk decoupling (servo rail)

Place C70 and C71 close together near J9. Both connect between +5V_SERVO and GND.

```
+5V_SERVO power symbol
  │
  ├── C70 (22 µF X7R, 0805) to GND   ← per BIKERA_SCHEMATIC_PROMPT.md
  └── C71 (100 nF ceramic, 0603) to GND
```

These handle the large current pulses the servo draws during motion — without them the 5 V rail dips and can brownout the MCU. Note: the generated KiCad sheet currently has C70 = 470 µF electrolytic. If you want to keep the larger value for extra headroom, that is electrically fine but conflicts with the BOM spec. 22 µF is the spec.

### LED section — D3 (BL-BEG204-7-E)

This is a **common-anode** bicolor LED: one shared anode, separate red and green cathodes. Wire it as two separate LED sub-symbols (or use the LED_DUAL_KAK symbol if available).

**Critical layout rule:** keep the resistors and LEDs on the **same horizontal line**. The LED K pin and the resistor must be at the same y-coordinate so the connecting wire is perfectly horizontal. This avoids diagonal wires.

```
Correct horizontal layout:

LED_RED label ─── R71 (470 Ω) ─── [LED red cathode → red anode] ─── +3V3
                                                                (common anode)
LED_GREEN label ── R72 (330 Ω) ── [LED green cathode → green anode] ─── +3V3
```

Drawn in KiCAD:
- Place R71 at, say, (50, 160). It is horizontal (rotated 90°), so pin 1 is left, pin 2 is right.
- Place LED D3a with K pin at the same y-coordinate as R71 pin 2 (rightward, horizontal).
- Connect R71 pin 2 → D3a K with a horizontal wire.
- Connect D3a A → +3V3 power symbol (above).
- R71 pin 1 → net label LED_RED (going left).

Do the same for the green channel at y = 175 (or whatever keeps the two rows separate without overlapping).

**Resistor values:**
- R71 (red): 470 Ω → ~2.8 mA with Vf = 2.0 V. Visible indoors.
- R72 (green): 330 Ω → ~3.3 mA with Vf = 2.2 V. Balanced brightness.
- For outdoor use swap to 180 Ω (red) and 150 Ω (green) for ~8 mA.

---

## Sheet 08 — Secure (`08_secure.kicad_sch`)

**What this sheet does:** connects the ATECC608B ECC secure element. This is one of the simplest sheets: just the chip, a decoupling cap, and I²C labels.

### Placement on the A4 page

Place U12 in the center. Net labels on the left, power symbols on the right. This sheet already follows the correct layout pattern.

### U12 — ATECC608B-SSHDA-T (SOIC-8)

```
U12 pin     → connects to
─────────────────────────────────────────────────────────
VCC (8)     → +3V3 power symbol. Decoupling: 100 nF ceramic immediately below to GND.
GND (4)     → GND power symbol
SDA (5)     → net label I2C_SDA (entering from left)
SCL (6)     → net label I2C_SCL (entering from left)
NC (1,2,3,7)→ NC flags on all four
```

I²C address: 0x60 (factory default). No configuration needed.

No pull-ups on this sheet — they live on sheet 01 (next to the BQ25630).

---

## Sheet 09 — Bridge (`09_bridge.kicad_sch`)

**What this sheet does:** connects the CP2102N USB-to-UART bridge, which gives the host PC a virtual COM port to the MCU that is independent of the ST-Link VCP. D+/D− come from the USB-C receptacle through the USBLC6 on sheet 01.

### Placement on the A4 page

```
LEFT                         CENTER                       RIGHT
─────────────────────────────────────────────────────────────────────────────────
Net labels                   [U13 CP2102N QFN-24]         Net labels
USB_DP ──────────────────►   D+                           BRIDGE_TX ──►
USB_DN ──────────────────►   D-                           BRIDGE_RX ◄──
                             VBUS (sense only,
USB_VBUS ── divider ──────►    not power)
                             VDD/VREGIN/VIO ◄── +3V3
                             GND / EPAD  → GND
Decoupling caps cluster on right side of U13
```

### U13 — CP2102N-A02-GQFN24

```
U13 function        → connects to
─────────────────────────────────────────────────────────
D+                  → net label USB_DP. No series resistor — CP2102N has integrated termination.
D-                  → net label USB_DN. Same.
VBUS (sense pin)    → see VBUS divider below. NOT a power pin. NOT 5 V direct.
VDD                 → +3V3. Decoupling: 4.7 µF + 100 nF to GND (both caps, right next to pin).
VREGIN              → +3V3 (tied to VDD, internal 5 V regulator unused).
                       Decoupling: 4.7 µF + 100 nF to GND.
VIO                 → +3V3 (same rail). Decoupling: 4.7 µF + 100 nF to GND.
GND + EPAD          → GND. At least 4 thermal vias through EPAD to ground plane.
RSTb                → 1 kΩ pull-up to +3V3 (VIO). No reset button needed.
TXD                 → net label BRIDGE_TX (to MCU PC1, LPUART1_RX)
RXD                 → net label BRIDGE_RX (from MCU PC0, LPUART1_TX)
RTS, CTS, DSR, DTR  → NC flags
SUSPEND, SUSPEND#   → NC flags
GPIO.0 – GPIO.3     → NC flags
all others          → NC flags
```

**Total decoupling: 3 pairs × (4.7 µF + 100 nF) = 6 capacitors.** This is per the Silicon Labs datasheet requirement "4.7 µF and 0.1 µF bypass capacitors required for each power pin." Missing even one pair can cause USB enumeration failures.

### VBUS sense divider

The CP2102N uses its VBUS pin as a digital input to detect when USB is connected — NOT as a power supply. The pin cannot tolerate 5 V directly (absolute max = VIO + 2.5 V = 5.8 V, but VIH = 2.7 V). A resistor divider scales 5 V → ~3.4 V.

```
USB_VBUS (5 V) ─── 22.1 kΩ ─── VBUS sense node ─── 47.5 kΩ ─── GND
                                       │
                               to U13 VBUS pin
```

With 5 V in: sense node = 5 × 47.5/(22.1+47.5) = 3.41 V. Above VIH (2.7 V), below absolute max (5.8 V). Connect this divider with short wires immediately next to U13.

---

## Cross-check before opening KiCAD

Before touching the KiCAD files, run through this checklist mentally:

| Item | Correct value |
|---|---|
| 3.3 V buck-boost | RT6150B (prototype). NOT RAA2361052 (that's Keuze finaal). |
| BQ25630 RPG pull-up | 2.2 kΩ — not 10 kΩ |
| BQ25630 CREGN | 4.7 µF 10 V — not 100 nF |
| BQ25630 CBTST | 47 nF between BTST and SW — often missing |
| RT6150B PS pin | Tie LOW (GND) = PSM mode. HIGH = forced PWM. Do not confuse. |
| RT6150B VINA | Connects directly to VIN, no RC filter |
| TPS61253F MODE | Tie HIGH (100 kΩ to VOUT) = forced PWM. Do not leave floating. |
| I²C pull-ups | 10 kΩ on SDA and SCL on sheet 01 ONLY — no duplicates on other sheets |
| LED R (red) | 470 Ω → ~2.8 mA |
| LED R (green) | 330 Ω → ~3.3 mA |
| Servo pin 1 | V+ (+5V_SERVO), pin 2 GND (via Rsense), pin 3 PWM |
| SERVO_ISENSE | Tap at the servo-side of Rsense (between J9 pin 2 and R70 pin 1) |
| USB D+/D- | Go to CP2102N (sheet 09), NOT to BQ25630. BQ25630 D+/D- pins = NC. |
| USBLC6 | Sits between J1 D+/D- and everything downstream (sheet 01, close to J1) |
