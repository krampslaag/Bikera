# BIKERA PCB LAYOUT ANCHOR NOTE
## Step 1: Compact Board Geometry

**BOARD OUTLINE & LAYERS**
- Dimensions: 50.0 mm (W) × 30.0 mm (H)
- Layer stack: 4 layers (FR4, standard)
- Layer assignment: L1 (top signal), L2 (inner GND plane), L3 (inner power), L4 (bottom signal)
- Origin: (0,0) at bottom-left corner (KiCad standard)

**MOUNTING HOLES (M3, plated through)**
- TL: (2.5, 27.5)
- TR: (47.5, 27.5)
- BL: (2.5, 2.5)
- BR: (47.5, 2.5)
- Hole diameter: 3.2 mm (M3 clearance), pad ~4.5 mm

**CONNECTORS & FIXED MECHANICAL (Position | Function | Notes)**
- **USB-C (Bottom edge, 50-30 boundary)**: Charging + data. Header at Y≈2mm. Centered X.
- **JST-PH (Battery input)**: X≈5mm, Y≈5mm. 2-pin, vertical orientation preferred for low profile.
- **SD-Card Module Header**: Edge placement (parallel to board edge, prefer bottom or left edge). Header pins at 2.54mm pitch.
- **LoRa Antenna (MHF4 connector)**: U9 (RAK11720) footprint defines position. Reserve antenna keep-out: 5mm clearance minimum from board edge.
- **GPS Antenna Connector**: U6 (Quectel LC76GPAMD). FPC connector, ~10–15mm cable. Position TBD in layout (typically near opposite edge from LoRa).
- **BLE Antenna (FPC, 10cm)**: Abracon AANI-FB-0086. Flexible placement on side.

**TEST POINTS**
- Required per thesis: VDD test points for critical power rails
- Placement: Clustered near bulk capacitors or IC power pins
- Suggested positions: Near U3 (MCU), U9 (LoRa), U6 (GPS), BMS ICs
- Size: 0.8 mm–1.0 mm via pads for probe access

**RESTRICTED ZONES**
1. **RF Keep-outs** (50 Ω antenna traces, no digital noise):
   - LoRa antenna (MHF4) → antenna route: min 2mm traces, keep-out 10mm radius around connector foot
   - GPS antenna → separate 50 Ω stub, keep-out 8mm radius
2. **Digital/Analog Separation**:
   - Analog ground island (GPS, sensors) isolated until single point at bulk GND plane
   - MCU digital side (left half) ⊥ RF/analog side (right half)
3. **Battery & High-Current Paths**:
   - JST-PH traces: low inductance, thick (>0.5mm), direct to BMS
   - USB charging path: short, isolated from signal layers until PD controller
4. **Thermal zones**:
   - Avoid component placement directly above/below voltage converter (BMS) if heat dissipation ≥0.5W
   - Leave ~10mm air gap if needed

**DECOUPLING CAP PROXIMITY REQUIREMENTS**
- **STM32L431 (U3, LQFP-48)**:
  - VDD caps (3×100nF C14/C15/C16, 1×4.7µF C41): ≤5mm pad-to-pin distance
  - VDDA caps (1µF C17, 10nF C18, 100nF C40): ≤3mm to analog pins
  - Ferrite bead FB1 on VDDA: inline, ≤2mm before MCU
- **RAK11720 (U9, MHF4 breakout)**:
  - VDD caps (10µF C37, 1µF C38, 100nF C39): ≤4mm cluster near breakout pads
- **Quectel LC76GPAMD (U6)**:
  - VCC caps (10µF C29, 100nF C30, 33pF C31): ≤4mm cluster
  - V_BCKP caps (4.7µF C33, 100nF C34): ≤3mm cluster
- **ATECC608B (U5, SOIC-8)**:
  - 100nF C27: ≤2mm pad-to-pin

**POWER DISTRIBUTION SUMMARY**
- **+3V3** (main digital): LDO regulated, routes to MCU, LoRa, GPIO peripherals
- **+3V3_GPS**: Isolated LDO for GPS/GNSS module (low-noise requirement)
- **+5V**: USB input or boost output (if needed for future modules)
- **+BATT** (raw battery ~3.7–4.2V from JST): BMS input, high-current sense point
- **+SYS**: Post-BMS regulated (derived from +3V3 or isolated converter)
- **GND**: Single-point star at bulk cap cluster, radiates to layer 2 (ground plane)

**CRITICAL PATHS (minimum width/via rules)**
- Battery input & charging: 0.5mm+ (≥2A expected)
- Power distribution (+3V3, +5V): 0.35mm+ (multi-via at source)
- Signal high-speed (SPI to GPS/LoRa): 0.2mm, 50 Ω where diff-pair used
- Standard signal: 0.2mm
- Ground vias: 0.3mm drill minimum, cluster 5–10 vias per power source

**NET CLASSES (from KiCad .kicad_pro)**
- **Default**: Track 0.2mm | Clearance 0.2mm | Via Ø0.6mm / drill 0.3mm
- **Power**: (assign if needed) Track 0.5mm | Clearance 0.25mm | Via Ø0.8mm / drill 0.4mm
- **HighSpeed**: (for GPS/LoRa SPI) Track 0.2mm | Clearance 0.2mm | Via Ø0.4mm / drill 0.2mm
- **Diff-Pair**: Width 0.2mm | Gap 0.25mm | Via Ø0.4mm

**COMPONENT PLACEMENT ZONES (Spatial allocation)**
- **Zone A (Left, 0–15mm X)**: MCU U3 (LQFP-48 center), Reset button SW1, Boot button SW2, MCU decoupling caps
- **Zone B (Center-Left, 15–32mm X)**: ECC chip U5 (SOIC-8), GPS module U6, GPS caps, ferrite bead FB1
- **Zone C (Center-Right, 32–42mm X)**: LoRa module U9 (RAK11720), LoRa caps C37/C38/C39, pullup/pulldown resistors (R24, R25)
- **Zone D (Right, 42–50mm X)**: Battery connector (JST-PH), resistor divider (R18/R19 for VBAT_SENSE), bulk caps
- **Zone E (Bottom edge, Y ≤ 5mm)**: USB-C connector, SD-card module header
- **Antennas**: FPC feed-through at edges, preferably top edge LoRa, bottom/right edge BLE/GPS

---

**DESIGN NOTES FOR LAYOUT TOOL**
- Fab spec: PCBWay/JLCPCB/Eurocircuits (standard 4-layer, 1.6mm FR-4)
- Min trace/space: 6/6 mil (0.15mm) conservative for 4-layer
- Via tenting: solder mask both sides for reliability
- Silkscreen: Reference designators (0.8mm text), layer indicators
- Edge clearance: Keep traces ≥0.5mm from board edge (except connectors)
- Solder mask: No mask between fine-pitch pads (QFP, SOIC) for reflow control

