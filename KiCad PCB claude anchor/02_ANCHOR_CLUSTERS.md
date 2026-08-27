# BIKERA PCB LAYOUT ANCHOR NOTE
## Step 2: Component Functional Clusters

**CLUSTER ORGANIZATION BY SCHEMATIC SUBSYSTEM**

---

### CLUSTER A: STM32L431 MCU & CORE SUPPLY (Zone A: X=0–15mm)
**Primary IC**: U3 (STM32L431CCT6TR, LQFP-48)
**Bypass Capacitors** (must be ≤5mm from VDD pins, ideally ≤3mm pad-to-pad):
- C14, C15, C16: 100nF 0603 (VDD decoupling, 3× for three separate VDD pins)
- C41: 4.7µF 0603 (bulk VDD, C41 closest)
- C17: 1µF 0603 (VDDA analog supply)
- C18: 10nF 0603 (VDDA anti-alias)
- C40: 100nF 0603 (VREF, technically VDDA)

**Ferrite Bead**: FB1 (BLM18KG601SN1D, 600Ω@100MHz, 0603) — inline between +3V3 and VDDA, ≤2mm before C17

**Support Components**:
- R17: 10K pulldown (Boot button SW2)
- R18, R19: 220K/100K resistor divider (VBAT_SENSE → MCU PA0)
- C28: 10nF anti-alias on VBAT_SENSE input
- C19: 100nF (Reset circuit)
- SW1: Reset button (SPST momentary 6×6mm THT)
- SW2: Boot button (SPST momentary 6×6mm THT)

**Critical Routing**:
- Boot/Reset buttons: low-noise, keep signal traces ≥0.3mm away from high-speed digital
- VBAT_SENSE: run on L1 or L4 (bottom), shield with ground plane nearby (L2)
- VSS (Ground) pins: multi-via (≥5 vias) direct to L2 ground plane

**PCB Placement Strategy**:
- U3 center at ~(7.5mm, 15mm)
- Decap cluster surrounds all four sides (top, bottom, left, right)
- C41 (bulk) on bottom side of PCB, ≤5mm from U3
- C14/C15/C16 distributed around U3 pads (one per physical VDD cluster)
- Buttons on left edge, well away from sensitive analog traces

---

### CLUSTER B: POWER MANAGEMENT & CHARGING (Zone D: X=42–50mm)
**Primary ICs** (from thesis & BOM):
- BMS system: RT6158A (buck-boost converter)
- Charger: BQ25630YBGR (USB-C PD-aware, 1-cell 5A charger)
- LDO: TCR3UG33A (300mA low-dropout for +3V3)

**Bulk Capacitors** (≤5mm from IC pin):
- Input filter (after JST-PH connector): 10–47µF 0603–1210, ceramic X5R
- RT6158A output: 47–100µF 1206 (bulk), ≤4mm from output pin
- BQ25630 VDD: 10µF 0603 (bus decoupling)
- LDO output: 10µF 0603 (bulk), ≤3mm from LDO output pin

**Charging Path**:
- USB-C connector → BQ25630 (USB PD controller)
- BQ25630 output → 1–2Ω sense resistor → RT6158A input
- RT6158A → regulated +3V3_MAIN bus

**High-Current Traces** (≥0.5mm width minimum):
- JST-PH to BMS: use L4 (bottom layer) if possible, or L1 with heavy via array
- BMS output to LDO: thick traces or wide copper
- +3V3 distribution: 0.35mm typical, but multi-layer routing preferred

**Diodes & Protection**:
- TVS diodes on USB VBUS (if ESD protection needed)
- Load-sharing diodes between battery and USB (TBD in schematic)

**PCB Placement Strategy**:
- BMS cluster at bottom-right corner (high-current node)
- JST-PH connector at (5mm, 2.5mm) — bottom edge, left of center
- RT6158A at ~(45mm, 5mm)
- BQ25630 at ~(47mm, 12mm)
- TCR3UG33A LDO at ~(42mm, 18mm)
- All three in a line with short interconnects

---

### CLUSTER C: LoRa RADIO (RAK11720, Zone C: X=32–42mm)
**Primary IC**: U9 (RAK11720-8-SM-I, MHF4 connector for antenna)
**Bypass Capacitors** (≤4mm from U9 pads):
- C37: 10µF 0603 (bulk VDD)
- C38: 1µF 0603 (intermediate)
- C39: 100nF 0603 (local decap)

**Support Components**:
- R24: 10K pullup (#RST pin)
- R25: 10K pulldown (SWO debug line)
- Antenna: MHF4 connector breakout, 50Ω trace to antenna pad

**Critical Routing**:
- VDD rail: isolated until joins main +3V3 at bulk cap
- Antenna feed: 50Ω impedance controlled, min 2mm trace width
- SPI interface (MOSI/MISO/CLK to MCU): run on L1, shield with GND vias
- Antenna pad: keep-out 10mm radius (no GND plane directly below until >15mm away)

**PCB Placement Strategy**:
- U9 at ~(37mm, 18mm) (right-center)
- C37/C38/C39 cluster immediately adjacent (below on L4 preferred)
- MHF4 connector on top or bottom right edge, with FPC routing to off-board antenna
- SPI traces to MCU: L1 top layer, minimum etch

---

### CLUSTER D: GPS/GNSS (Quectel LC76GPAMD, Zone B: X=15–32mm)
**Primary IC**: U6 (Quectel LC76GPAMD, UART/SPI interface)
**Bypass Capacitors** (≤4mm from U6 pads):
- C29: 10µF 0603 (VCC bulk)
- C30: 100nF 0603 (VCC bypass)
- C31: 33pF 0603 (oscillator/tank)
- C33: 4.7µF 0603 (V_BCKP backup supply)
- C34: 100nF 0603 (V_BCKP bypass)

**Support Components**:
- TVS diode (SMBJ5.0CA or similar, if not already in module)
- Antenna connector (GPS FPC or SMA, separate from LoRa)

**Critical Routing**:
- VCC and V_BCKP: separate power domains, only join at bulk cap
- UART (RXD/TXD) or SPI to MCU: standard signal integrity (0.2mm traces, ≤10pF capacitance)
- GPS antenna: 50Ω stub trace, keep-out 8mm radius from pad (no GND plane immediately adjacent)

**PCB Placement Strategy**:
- U6 at ~(25mm, 12mm) (center-left)
- C29/C30/C31 cluster on bottom side near U6
- C33/C34 (V_BCKP) cluster slightly away (~5mm), since backup supply is separate
- Antenna connector on top edge, with FPC routing

---

### CLUSTER E: CRYPTOGRAPHIC ELEMENT (ATECC608B, Zone B: X=15–32mm)
**Primary IC**: U5 (ATECC608B-SSHDA-T, SOIC-8)
**Socket Option**: DIP-8 socket (1-2199298-2) for swappable ECC development

**Bypass Capacitors** (≤2mm from U5 pads):
- C27: 100nF 0603 (VCC decoupling)

**Support Components**:
- DIP-8 socket pads if breakout used
- I²C pull-up resistors (≤5mm from MCU, not at ECC itself — usually in MCU cluster)

**Critical Routing**:
- I²C bus (SDA/SCL): low-noise, 50Ω approximate, short stubs <5mm
- VCC: isolated until bulk cap
- No high-speed digital nearby (keep RF/SPI traces ≥10mm away)

**PCB Placement Strategy**:
- U5 at ~(20mm, 10mm) (left-center, separate from LoRa noise)
- C27 directly adjacent (same side as decap)
- I²C traces routed on L1, then down via to MCU on L4
- Socket option: if populated, use DIP-8 adapter + IC socket for reliability

---

### CLUSTER F: ACCELEROMETER (LIS2DW12, Zone A or B)
**Primary IC**: Tinytronics breakout module (LIS2DW12, I²C or SPI)
**Bypass Capacitors**: (module likely includes own decap, but check):
- 10µF + 100nF cascade if bare chip used

**Critical Routing**:
- I²C (SDA/SCL) or SPI: short, ≤5pF trace capacitance
- INT pins: run to MCU GPIO on L1, shield with GND

**PCB Placement Strategy**:
- Keep accelerometer ≤30mm from mechanical center (for accurate motion sensing)
- Breakout module on L1 surface, leave ≥10mm clearance around for motion freedom
- Suggested position: ~(10mm, 8mm) (near MCU, lower-left)

---

### CLUSTER G: STORAGE (SD-Card Module & FRAM)
**SD-Card Module Header**:
- 6–7 pin SPI interface (MOSI/MISO/CLK/CS/GND/+3V3)
- Placed at board edge (Y ≤ 3mm or at left edge)
- Breakout header format (requires external adapter)

**FRAM** (F-RAM FM24V01A, if populated):
- I²C interface (SDA/SCL + VCC + GND)
- 100nF decap immediate
- Placement: ~(12mm, 6mm), near MCU I²C bus

**Critical Routing**:
- SD card SPI: L1 only, clock traces carefully routed (min jitter)
- FRAM I²C: shared bus with ATECC608B, pull-ups at MCU cluster

---

### CLUSTER H: LED INDICATOR & GPIO
**LED** (BL-BEG204-7-E, common-cathode red-green THT):
- Anode pins to GPIO (via strobing/PWM)
- Cathode to GND through current-limiting resistor (e.g., 100–330Ω 0603)
- Placement: ~(3mm, 28mm) (top-left corner, visible when assembled)

**GPIO Resistor Network** (if used):
- Pull-ups/pull-downs for external buttons or sensors: collocate near associated GPIO pin

---

### CLUSTER I: TEST POINTS
**Location & Purpose**:
- **TP_+3V3**: bulk cap cluster, left side Y≈20mm
- **TP_+3V3_GPS**: GPS LDO output, Y≈12mm
- **TP_+SYS**: backup/sys rail, Y≈8mm
- **TP_GND**: multiple GND vias (e.g., Y≈5mm, Y≈25mm)
- **TP_VBAT_SENSE**: resistor divider node, ~(45mm, 18mm)

**Via Probe Format**: 0.8–1.0mm diameter vias, exposed on both L1 & L4 for oscilloscope/multimeter probes

---

## SUMMARY TABLE: CRITICAL CAP-TO-IC DISTANCES

| IC | Ref | Pin Type | Cap Ref | Value | Max Distance (mm) | Placement |
|----|-----|----------|---------|-------|-------------------|-----------|
| U3 | STM32L431 | VDD | C14/C15/C16 | 100nF | ≤5 | Surrounding pads |
| U3 | STM32L431 | VDD | C41 | 4.7µF | ≤5 | L4 underside |
| U3 | STM32L431 | VDDA | C17/C18/C40 | 1µF/10nF/100nF | ≤3 | Adjacent, L1 top |
| U9 | RAK11720 | VDD | C37/C38/C39 | 10µF/1µF/100nF | ≤4 | Cluster L4 |
| U6 | Quectel GPS | VCC | C29/C30 | 10µF/100nF | ≤4 | L4 cluster |
| U6 | Quectel GPS | V_BCKP | C33/C34 | 4.7µF/100nF | ≤4 | Separate ≥5mm away |
| U5 | ATECC608B | VCC | C27 | 100nF | ≤2 | L1 adjacent |

---

**DESIGN DECISIONS EMBEDDED**
1. **Analog/Digital separation** via placement: Sensors (GPS, accel) on left; RF (LoRa) on right
2. **Power distribution**: Star-point bulk cap at bottom-right → radiates upward to MCU, sideways to LoRa
3. **Signal layers**: L1 (top) for all high-speed digital (MCU, LoRa SPI); L4 (bottom) for power return paths & GND vias
4. **Thermal**: No active heat dissipation required (all ICs <500mW); use standard SMD layout practices

