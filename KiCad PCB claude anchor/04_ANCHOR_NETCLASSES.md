# BIKERA PCB LAYOUT ANCHOR NOTE
## Step 4: Net Class Constraints & Design Rules

**SOURCE**: KiCad project file (.kicad_pro) baseline + refined rules for Bikera's specific RF/IoT requirements.

---

## NET CLASS DEFINITIONS

### Class 1: Default (Standard Digital Logic & GPIO)
**Assigned Nets**: All GPIO, logic signals not in other classes (LED, buttons, debug, servo control, etc.)

| Parameter | Value | Unit | Notes |
|-----------|-------|------|-------|
| **Track Width (minimum)** | 0.2 | mm | KiCad default; conservative for 4-layer, acceptable for low-frequency GPIO |
| **Track Width (typical)** | 0.25 | mm | Use for general signal routing (better via landing, more robust) |
| **Clearance (minimum)** | 0.2 | mm | Same net to different net; enforced by DRC |
| **Clearance (pad-to-trace)** | 0.2 | mm | Pad to adjacent trace clearance |
| **Via Diameter (finished)** | 0.6 | mm | Hole size 0.3mm, pad annular ring ≥0.15mm each side |
| **Via Drill Diameter** | 0.3 | mm | Standard PTH via for signal transition |
| **Via Spacing** | 0.4 | mm | Via-to-via minimum (center-to-center) |
| **Diff-Pair Gap** | N/A | – | Not used for this class |
| **Matched Trace Length** | N/A | – | Not enforced |

**Applicable nets**:
- Button inputs (SW1_RESET, SW2_BOOT)
- LED outputs (LED_RED, LED_GREEN)
- Debug UART (UART_DEBUG_TX/RX, if routed)
- Servo control (EN_5V_SERVO)
- Hall effect sensor (DRV5032 output)
- ePaper module (EPAPER_DC, EPAPER_CS, EPAPER_RST, EPAPER_BUSY)
- GPS auxiliary (GPS_RESET, GPS_EN, GPS_PPS)
- LoRa auxiliary (LORA_BOOT, LORA_RESET)
- Charger control (CHRG_INT, CHRG_PG, CHRG_CE)
- Battery sense (VBAT_SENSE analog-to-digital input, routed as single-ended logic trace)

---

### Class 2: Power (Supply Rails & Distribution)
**Assigned Nets**: +3V3, +3V3_GPS, +5V, +BATT, +SYS, GND (return paths only; actual GND plane is Class 6)

| Parameter | Value | Unit | Notes |
|-----------|-------|------|-------|
| **Track Width (minimum)** | 0.5 | mm | Heavy copper for ≤2A expected current |
| **Track Width (typical)** | 0.75–1.0 | mm | Use for main +BATT path and LDO outputs |
| **Clearance (minimum)** | 0.25 | mm | Slightly relaxed vs. signal (power distribution less noise-sensitive) |
| **Clearance (pad-to-trace)** | 0.25 | mm | Same as above |
| **Via Diameter (finished)** | 0.8 | mm | Larger pad for current spreading |
| **Via Drill Diameter** | 0.4 | mm | Support higher current density |
| **Via Spacing (bulk cap to IC)** | 0.5 | mm | Cluster ≥4–5 vias at bulk cap connections |
| **Diff-Pair Gap** | N/A | – | Not used |
| **Thermal Relief** | 0.4 | mm | Spoke width on pads; reduces thermal bridging during solder |

**Applicable nets**:
- +BATT (JST-PH input to BMS): highest priority, use 1.0mm+ trace on L4, or L1 + multi-via
- +3V3 (LDO output to MCU/LoRa/GPIO bulk): 0.75mm minimum
- +3V3_GPS (isolated GPS LDO output): 0.5mm, separate path from main +3V3 until star-point
- +5V (USB or boost output, low-current for now): 0.5mm
- +SYS (backup/post-BMS rail): 0.5mm, low-current secondary

**Specific Routing Rules for Power**:
1. **JST-PH to BMS input**: Direct trace, no intermediate components. Use L4 bottom layer (away from RF keep-out zones). Width ≥0.5mm, ideally 1.0mm. Multi-via (≥3) at connector pad and BMS IC pad.
2. **BMS output to LDO input**: Route on L1 if space allows (keeps heat off inner layers), or L3 if dedicated power plane. Min 0.5mm width.
3. **LDO output to bulk cap**: ≤5mm copper length, ≥4 vias. This is the critical star point where all returns merge.
4. **Bulk cap to MCU/LoRa/GPS VDD**: Tree-like distribution from star point. Use L1 fine traces (0.35mm) to reach each IC.
5. **GND returns**: All ICs' VSS pins multi-via (≥3 each) directly to L2 ground plane near star point. Converge all returns here before fanning to rest of board.

---

### Class 3: HighSpeed_SPI (MCU ↔ LoRa, optionally GPS)
**Assigned Nets**: SPI1_MOSI, SPI1_MISO, SPI1_SCK, SPI1_CS (LoRa); optionally SPI1_CS_GPS if GPS in SPI mode

| Parameter | Value | Unit | Notes |
|-----------|-------|------|-------|
| **Track Width (minimum)** | 0.2 | mm | Match impedance for controlled routing (see RF class for ANT nets) |
| **Track Width (typical)** | 0.2 | mm | Standard SPI speed (MHz, not GHz), impedance matching not critical but recommended |
| **Clearance (minimum)** | 0.2 | mm | SPI is single-ended; standard clearance |
| **Clearance (pad-to-trace)** | 0.2 | mm | Same as above |
| **Via Diameter (finished)** | 0.4 | mm | Smaller vias reduce stub length (SPI transitions between L1 and L4 if necessary) |
| **Via Drill Diameter** | 0.2 | mm | Fine drill for SPI vias |
| **Via Spacing** | 0.3 | mm | Keep transitions compact |
| **GND Shielding** | Every 2–3mm along trace | Requirement | Run ground trace parallel to each SPI signal, or use L2 via-stitching below |
| **Trace Length Matching** | ±5mm | – | Not critical for SPI (MHz clock), but good practice within MCU ↔ LoRa cluster |
| **Skew Control** | <1 ns | – | Keep SPI clock (SCK) fastest; data (MOSI/MISO) can lag slightly |

**Specific Routing Rules for SPI**:
1. **Clock (SPI1_SCK)**: Route first, minimize branches. No stubs at intermediate chips (LoRa only). Use 0.2mm width.
2. **Data (MOSI/MISO)**: Can route after clock. Equal length to clock preferred (±5mm tolerance).
3. **Chip Select (CS)**: Route last (lowest priority). Active-low, ensure ~1ns setup time before SCK edge.
4. **Layer**: L1 (top) exclusively for MCU ↔ LoRa SPI. Do NOT route on L4 (bottom) if MCU is top-side.
5. **Shielding**: Option A: Adjacent ground trace (0.5mm parallel spacing, connected to GND net every 5–10mm via small via). Option B: Via-stitching (via array on both sides of signal trace at 2–3mm pitch, all tied to L2 GND plane).
6. **Stub length**: Minimize at LoRa breakout pad. If multi-drop required (GPS SPI + LoRa), use active buffer or tree topology (MCU → buffer → GPS & LoRa).

**Applicable Nets**:
- SPI1_MOSI (MCU PA7 → LoRa U9.MOSI, optionally GPS U6.MOSI)
- SPI1_MISO (LoRa U9.MISO → MCU PA6, optionally GPS U6.MISO)
- SPI1_SCK (MCU PA5 → LoRa U9.SCK & optionally GPS U6.SCK)
- SD_CS (MCU GPIO → SD-card module breakout, header-based)
- (optional) SPI1_CS_LoRa (MCU PB6 → LoRa U9.NSS, active-low)
- (optional) SPI1_CS_GPS (MCU PA4 → Quectel U6.CS, if SPI mode enabled; default is UART)

---

### Class 4: HighSpeed_I2C (MCU ↔ ECC, Sensors, optional GPS)
**Assigned Nets**: I2C_SDA, I2C_SCL (MCU I²C1 / PB9 & PB8)

| Parameter | Value | Unit | Notes |
|-----------|-------|------|-------|
| **Track Width (minimum)** | 0.2 | mm | Open-drain bus, no characteristic impedance needed |
| **Track Width (typical)** | 0.25 | mm | I²C is slow (MHz), so trace width is non-critical; larger pads help with pull-ups |
| **Clearance (minimum)** | 0.2 | mm | Standard digital clearance |
| **Clearance (pad-to-trace)** | 0.2 | mm | Same as above |
| **Via Diameter (finished)** | 0.5 | mm | I²C is low-frequency; standard via acceptable |
| **Via Drill Diameter** | 0.25 | mm | No high-speed transitions required |
| **Via Spacing** | 0.3 | mm | Normal spacing |
| **Pull-up Resistor Value** | 4.7K | Ω | Standard I²C termination; locate at MCU (PB8/PB9 cluster), ≤10mm from MCU pins |
| **Pull-up Voltage** | +3V3 | V | Tied to +3V3 rail at MCU cluster |
| **Max Trace Length** | ≤100 | mm | I²C is low-speed (100 kHz standard, 400 kHz fast-mode); trace length not critical. Capacitance limit ~200pF total. |
| **Stub Length** | ≤20 | mm | Keep stubs to sensors (ECC, GPS optional, accel) short (<20mm each). Root hub at MCU. |

**Specific Routing Rules for I²C**:
1. **Bus topology**: Star or near-star from MCU cluster. Root: MCU PB8 (SCL) + PB9 (SDA) + two 4.7K pull-ups to +3V3.
2. **Pull-up placement**: Locate pull-up resistors (R_SDA_PU, R_SCL_PU) within 10mm of MCU I²C pins. Use 0603 SMD, place on L1 near MCU.
3. **Device drops**: Branch to each I²C slave:
   - U5 (ATECC608B): ~5mm stub
   - U6 (Quectel GPS, if I²C mode): ~40mm stub (farther away)
   - LIS2DW12 accel module: ~15mm stub
4. **Layer**: L1 top surface preferred. May transition to L4 via via-stitching if needed to route around power components.
5. **Noise protection**: Run I²C traces ≥5mm away from high-speed SPI traces if on same layer. If coexisting, use adjacent ground traces or separate to different layers.

**Applicable Nets**:
- I2C_SDA (MCU PB9 → U5.SDA, U6.SDA (if enabled), LIS2DW12.SDA)
- I2C_SCL (MCU PB8 → U5.SCL, U6.SCL (if enabled), LIS2DW12.SCL)

---

### Class 5: HighSpeed_RF (Antenna Traces, 50Ω Controlled Impedance)
**Assigned Nets**: ANT_LoRa, ANT_GPS (feed-point to antenna connectors, MHF4 and FPC respectively)

| Parameter | Value | Unit | Notes |
|-----------|-------|------|-------|
| **Track Width (critical)** | 0.8–1.0 | mm | **Impedance-controlled**: Must target 50Ω characteristic impedance. See stackup calculation below. |
| **Clearance (minimum, to GND)** | 0.8–1.0 | mm | Keep GND traces/plane ≥0.8mm away from RF trace edges. Widening the trace narrows the clearance needed. |
| **Clearance (to other signal)** | 1.0 | mm | RF traces should not run adjacent to digital logic. Minimum 1.0mm gap. |
| **Via Diameter (finished)** | 0.4 | mm | Keep vias small to minimize impedance discontinuity. Transition vias only at antenna pad. |
| **Via Drill Diameter** | 0.2 | mm | Fine drill to reduce stub |
| **Via Count at Antenna Pad** | 1–2 | – | Minimize vias; use tented (solder mask both sides) to prevent moisture ingress. |
| **Trace Length (ANT_LoRa)** | <10 | mm | From U9.ANT_RF pad to MHF4 connector on board edge. Short trace = less insertion loss. |
| **Trace Length (ANT_GPS)** | <8 | mm | From U6.ANT_RF pad to FPC connector. Even shorter preferred for high-frequency GPS (1.575 GHz). |
| **Keep-out Zone (ANT_LoRa)** | 10 | mm radius | No GND plane, no other traces inside 10mm radius around MHF4 connector foot. Antenna space to radiate. |
| **Keep-out Zone (ANT_GPS)** | 8 | mm radius | Similar; GPS frequency higher, so smaller keep-out acceptable. |
| **Return Path (GND)** | Dedicated via-stitched ground return | – | Separate GND return from RF trace (not through main power GND star point) if possible. For small board, may be unavoidable—route GND return directly to L2 plane via multi-via at antenna pad. |
| **Matching Network** | 0Ω jumper (optional) | – | If antenna impedance deviates from 50Ω (e.g., FPC cable adds 5Ω), place matching stub or series element at antenna pad. Calibrate via S-parameter measurement (future work). For now, assume 50Ω match. |

**Specific Routing Rules for RF Antennas**:
1. **Impedance Calculation** (for your 4-layer stackup):
   - Assume typical PCB: 1.6mm total thickness, L1 ↔ L2 spacing ~0.2mm, L2 solid GND plane below L1
   - 50Ω target width: ~0.8–1.0mm on L1 with GND plane at 0.2mm distance
   - **Action**: Use 0.9mm width for both ANT_LoRa and ANT_GPS, verify with online microstrip calculator if actual stackup differs
   - If stackup varies (e.g., 0.15mm spacing), adjust width proportionally: narrower spacing → narrower trace for same Z₀

2. **LoRa Antenna (ANT_LoRa)**:
   - Source: U9.ANT_RF pad (RAK11720 MHF4 breakout)
   - Destination: MHF4 connector (on board right edge, ~X=48mm, Y≈15mm)
   - Width: 0.9mm (50Ω target)
   - Layer: L1 top only. No via transitions mid-trace.
   - Length: Prefer straight line, <10mm total etch
   - Keep-out: 10mm no-GND zone around MHF4 connector. Actual antenna on module will radiate outside this keep-out.
   - Return GND: Multi-via (≥2) at MHF4 connector pad, tied to L2 GND plane. Keep via cluster ≥2mm away from RF trace (outside 10mm keep-out).
   - Via-stitching: Optional along ANT_LoRa trace edges (every 3–5mm) to stabilize impedance, but not critical for <10mm line.

3. **GPS Antenna (ANT_GPS)**:
   - Source: U6.ANT_RF pad (Quectel LC76GPAMD, may be on FPC breakout)
   - Destination: FPC connector or SMA (prefer top edge, ~Y=29mm)
   - Width: 0.9mm (50Ω target)
   - Layer: L1 top only
   - Length: <8mm (GPS is higher frequency, lower tolerance for insertion loss)
   - Keep-out: 8mm no-GND zone
   - Return GND: Multi-via (≥2) at FPC connector, tied to L2 GND plane
   - Note: Quectel LC76G datasheet recommends "keep antenna away from digital circuits". Use keep-out zone to enforce.

4. **Antenna Connector Selection**:
   - LoRa: MHF4 (half-hole) breakout on PCB, external FPC or wire antenna off-board (or on-board as separate component)
   - GPS: FPC connector on PCB, external passive antenna (Quectel YFGA003AA or equivalent)
   - Both: Minimize connector loss by choosing low-loss subminiature connectors (MHF4 ≈0.5dB, SMA ≈0.2dB, FPC ≈1dB)

**Applicable Nets**:
- ANT_LoRa (U9.ANT_RF → MHF4 connector, RAK11720 breakout)
- ANT_GPS (U6.ANT_RF → FPC or SMA connector, Quectel GPS module)

---

### Class 6: GND (Ground Plane & Returns, Continuous L2 Plane)
**Assigned Nets**: GND (single global net, not a trace class but a plane distribution structure)

| Parameter | Value | Unit | Notes |
|-----------|-------|------|-------|
| **Layer** | L2 (inner layer) | – | Solid ground plane, continuous under entire board |
| **Coverage** | ~95% of board area | – | Exceptions: antenna keep-out zones (10mm LoRa, 8mm GPS), 1–2mm clearance at board edges |
| **Via Stitching (GND)** | Every 2–3mm | spacing | Along high-speed signal traces (SPI, I²C) and around sensitive analog circuits (GPS, ECC). Use 0.3mm via diameter. |
| **Star Point Location** | (X≈44mm, Y≈5mm) | mm | Convergence point for all power IC returns (BMS, LDO, charger). Fan-out to L2 plane via ≥5 vias (0.3mm dia). |
| **Return Vias per IC** | ≥3 per IC | – | MCU (3× VSS pins → 3 vias), LoRa (1–2 vias), GPS (1 via), ECC (1 via), charger (1–2 vias) |
| **GND Plane Thickness (typical)** | 35 µm (1oz copper) | – | Standard PCB thickness; no custom spec needed |
| **Thermal Relief Spokes** | 0.4mm width | – | On pads connected to GND plane (reduces thermal bridging during reflow) |

**Specific Routing Rules for GND**:
1. **Plane creation**: In PCB editor, create L2 as a single GND polygon covering 95% of usable board area. Exclude antenna keep-out zones.
2. **Antenna Keep-outs**: Draw small ground-free zones (10mm LoRa, 8mm GPS) centered on antenna pads. These are "no GND plane" areas, not routed traces.
3. **Star Point**: All power IC VSS/GND pins route to star point via via cluster. From star point, single multi-via set connects to L2 plane.
4. **Via-stitching for signals**: Around MCU (SPI/I²C), use via-stitching (0.3mm vias every 2–3mm) to:
   - Ground the SPI data and clock traces
   - Reduce EMI coupling into sensitive analog circuits
   - Support controlled impedance (50Ω for RF, ~50Ω for SPI shield)
5. **Return paths**: Every signal net must have a clear, low-impedance GND return. Preferred: GND plane (L2) directly below via via-stitching. Worst case: run a parallel GND trace on same layer.

---

## LAYER ASSIGNMENT SUMMARY

| Layer | Name | Use | Net Classes Allowed |
|-------|------|-----|-------------------|
| L1 | Top signal | High-speed signals, fine-pitch SMD pads, antenna traces | Default, HighSpeed_SPI, HighSpeed_I2C, HighSpeed_RF, Power (fine distribution only) |
| L2 | GND plane | Continuous ground reference, return paths, shielding | GND (continuous plane) |
| L3 | Power plane | Dedicated +3V3 or internal routing (optional; may be signal layer if unused) | Power (bulk), optional LoRa/GPS local supplies |
| L4 | Bottom signal | Power distribution, secondary signal routing, component placement | Default, Power, HighSpeed_SPI (via transitions), HighSpeed_I2C (via transitions) |

---

## DESIGN RULE CHECKLIST (KiCad DRC Settings)

Enable the following DRC checks in KiCad → Inspect → Design Rule Checker:

1. **Clearance Rules**:
   - ✅ Minimum clearance: 0.2mm (all nets vs. all nets)
   - ✅ Copper-to-edge: 0.5mm (traces stay ≥0.5mm from board edge)
   - ✅ Via-to-via: 0.3mm center-to-center minimum

2. **Trace Width Rules**:
   - ✅ Minimum trace width: 0.15mm (conservative for 4-layer)
   - ✅ Apply net class track widths: Default 0.2mm, Power 0.5mm, SPI 0.2mm, RF 0.9mm

3. **Via Rules**:
   - ✅ Minimum via diameter: 0.4mm (finished; 0.2mm drill)
   - ✅ Via annular ring: ≥0.15mm all sides

4. **Antenna Keep-outs** (manual inspection, not DRC):
   - ⚠️ **Visual check**: Verify 10mm no-GND-plane zone around LoRa MHF4 connector
   - ⚠️ **Visual check**: Verify 8mm no-GND-plane zone around GPS FPC connector

5. **High-Speed Signal Integrity** (manual inspection):
   - ⚠️ **Check**: SPI traces (MOSI/MISO/SCK) do not run adjacent to I²C or power traces; minimum 1mm spacing or separate layer
   - ⚠️ **Check**: RF antenna traces (ANT_LoRa, ANT_GPS) are isolated, kept on L1 only, with via-stitched ground returns
   - ⚠️ **Check**: Pull-up resistors for I²C are within 10mm of MCU I²C pins

---

## MANUFACTURING & ASSEMBLY SPECIFICATIONS

| Item | Specification | Notes |
|------|---------------|-------|
| **PCB Fabrication** | 4-layer, 1.6mm FR-4, 1oz copper (35µm) each layer | Standard spec; no custom requirements |
| **Solder Mask** | Both sides, green or blue | No mask between fine-pitch pads (QFP, SOIC) for reflow control |
| **Silkscreen** | Top side (L1) only, 0.8mm text | Reference designators, manufacturer logo, test point labels |
| **Trace Width / Spacing** | Min 6mil (0.15mm) / 6mil conservative | Fab tolerance: ±0.1mm typical |
| **Via Tenting** | Solder mask both sides | Protects via holes during assembly; easier rework |
| **Edge Clearance** | ≥0.5mm copper from edge | Trace/via clearance; pads/connectors may touch edge |
| **Panelization** | Single board, no mouse bites | If panelized, use 3–5mm between boards |
| **Test Coupon** | Optional (recommend if high-reliability required) | Includes trace/space, via samples, material coupons |

---

## FUTURE ENHANCEMENTS & NET CLASSES (Not Yet Implemented)

If future board revisions add the following features, create additional net classes:

| Feature | New Nets | Suggested Class | Key Rules |
|---------|----------|-----------------|-----------|
| USB 3.1 Type-C | D+/D- differential | USB3_Diff | 90Ω differential Z₀, ±3mm length match, via-less routing, low-loss material |
| Advanced BLE antenna | BLE_RF (differential or single-ended) | HighSpeed_RF_2400 | Similar to LoRa (50Ω), but 2.4 GHz (tighter tolerances) |
| High-speed sensor interface (e.g., QSPI) | SPI data + clock | HighSpeed_QSPI | 50Ω for each line, source-series termination, matched delays |
| Low-noise analog (if ADC upgraded) | Analog_VRef, Analog_IN | AnalogHighZ | Guard traces, isolated ground, no digital switching near |

---

## VALIDATION CHECKLIST (Pre-Fabrication)

- [ ] Export netlist from KiCad and cross-reference all nets with Step 3 anchor (Minimal Netlist)
- [ ] Run DRC; resolve all errors (goal: 0 errors, 0 warnings after cleanup)
- [ ] Verify antenna keep-out zones are ≥10mm (LoRa) / ≥8mm (GPS) with no GND plane inside
- [ ] Check that all power IC returns converge at star point (X≈44mm, Y≈5mm)
- [ ] Confirm SPI traces have GND shielding or via-stitching along entire route
- [ ] Verify I²C pull-up resistors are ≤10mm from MCU I²C pins and tied to +3V3
- [ ] Inspect Layer stack: L1 (signals) → L2 (GND plane) → L3 (power plane or signal) → L4 (signals & power distribution)
- [ ] Generate Gerber files and review in Gerber viewer (e.g., KiCad's built-in viewer or gerbv)
- [ ] Measure trace impedance (if RF is critical) using stackup calculator or VNA measurement on test coupon

