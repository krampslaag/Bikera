# BIKERA PCB LAYOUT ANCHOR NOTE
## Step 3: Minimal Netlist (Critical Nets Only)

**SCOPE**: Power distribution, high-speed data interfaces, and differential pairs only. Excludes standard GPIO and debug nets.

---

## POWER NETS (Global Labels, Routed on L2/L3 Planes & Dedicated Traces)

### Primary Power Rails
| Net | Voltage | Source | Destination | Routing Strategy |
|-----|---------|--------|-------------|------------------|
| +3V3 | 3.3V | LDO (TCR3UG33A) | MCU (U3 VDD), LoRa (U9 VDD), GPIO rails | Main signal supply. Multi-layer routing: L1 fine traces, L2 plane spur. Min 0.35mm track width. Via cluster at bulk cap. |
| +3V3_GPS | 3.3V isolated | Dedicated LDO for GPS | U6 (Quectel VCC only) | Separate LDO to reduce noise into GPS. Do not share return until star-point GND. Min 0.35mm. |
| +5V | 5V | USB or boost (RT6158A?) | Possible future ePaper module, USB device | Currently low-traffic. Run on L1, 0.3mm wide. |
| +BATT | 3.7–4.2V (raw) | JST-PH connector | BMS input (RT6158A, BQ25630) | **High-current path**: ≥0.5mm L4 traces, multi-via sink. Direct from JST connector, no intermediate pads. |
| +SYS | 3.3V (gated) | Post-BMS rail (from RT6158A output) | Backup supply for GPS (V_BCKP), optional future modules | Derived from +BATT via RT6158A. Secondary importance. 0.3mm typical. |
| GND | 0V (reference) | Multi-point star | All ICs, connectors | **L2 ground plane** (continuous under entire board except antenna keep-out). Return vias at every power IC output. |

### Power Net Specifics
- **+3V3 to U3 (MCU)**: C41 (4.7µF bulk) + C14/C15/C16 (100nF x3) cluster. Route: L1 top layer from C41 pad, ≤3mm to any U3 VDD pin.
- **+3V3_GPS to U6**: C29 (10µF) + C30 (100nF) cluster. Separate LDO output; do NOT cross-connect +3V3 rail until after bulk cap junction.
- **+BATT direct to JST**: No intermediate protection resistor in critical path. Single 0.5mm trace on L4, OR use L1 with ≥4 vias at each end.
- **GND star point**: Converge all power IC returns (LDO, BMS, charger) at a single spot near bulk cap cluster (approx. X=44mm, Y=5mm). Fan out to L2 plane via multi-via (≥5 vias, 0.3mm dia).

---

## CRITICAL DATA NETS (High-Speed Interfaces)

### I²C Bus (MCU U3 ↔ Sensors/ECC)
**Participants**: U3 (STM32L431 I²C1), U5 (ATECC608B), U6 (Quectel GPS optional I²C), LIS2DW12 accelerometer
```
Net:    SDA_I2C1
Pin:    U3.PB9 ↔ U5.SDA (and optionally U6.SDA if GPS I²C mode)
Length: ≤100mm total trace + stubs
Width:  0.2mm (standard signal)
Layer:  L1 (top), shield with adjacent GND traces ≥0.5mm away
Termination: 4.7K pull-ups (R_SDA_PU) to +3V3, located at MCU cluster, ≤10mm from MCU

Net:    SCL_I2C1
Pin:    U3.PB8 ↔ U5.SCL
Length: ≤100mm total
Width:  0.2mm
Layer:  L1
Termination: 4.7K pull-ups (R_SCL_PU) to +3V3
Note:   Avoid running SDA/SCL across high-speed SPI traces. Separate paths if on same layer.
```

### SPI Bus (MCU U3 ↔ LoRa U9, optionally GPS U6)
**Primary SPI: LoRa (RAK11720)**
```
Net:    SPI_MOSI
Pin:    U3.PA7 (MOSI) ↔ U9.MOSI
Width:  0.2mm, controlled impedance ≈50Ω preferred (not critical for SPI, but good practice)
Layer:  L1 top surface only (no buried vias)
Length: ≤50mm direct, no stubs
Shielding: Run GND trace adjacent (≥0.3mm spacing), or use GND plane (L2) directly below (via every 2–3mm)

Net:    SPI_MISO
Pin:    U3.PA6 (MISO) ↔ U9.MISO
Width:  0.2mm
Layer:  L1
Length: ≤50mm
Shielding: Same as MOSI

Net:    SPI_CLK
Pin:    U3.PA5 (SCK) ↔ U9.SCK
Width:  0.2mm (or 0.25mm for lower skew)
Layer:  L1, clock-tree preferred (minimal fanout, no Y-junctions)
Length: ≤50mm
Slew rate: Keep 10–30 ns rise time (buffer if needed, typically not)

Net:    SPI_CS_LoRa (chip select)
Pin:    U3.PB6 (or GPIO) ↔ U9.NSS
Width:  0.2mm
Layer:  L1
Length: ≤50mm
Control: Active-low, ensure no glitch during power-up
```

**Optional Secondary SPI: GPS Module (if SPI mode used instead of UART)**
```
Net:    SPI_CS_GPS (chip select for GPS)
Pin:    U3.PA4 (or GPIO) ↔ U6.CS
Width:  0.2mm
Layer:  L1
Length: ≤80mm (GPS may be farther away)
Note:   Use if Quectel in SPI mode. UART mode does NOT use these nets.
```

### UART (MCU U3 ↔ GPS/LoRa, Debug)
**Primary UART: GPS Telemetry**
```
Net:    UART1_RXD (GNSS data input)
Pin:    U3.PA10 ↔ U6.TX (Quectel transmits)
Width:  0.2mm (single-ended logic)
Layer:  L1 (standard signal layer)
Length: ≤100mm, allow routing flexibility
Termination: No series R (standard UART). If noise concerns, add 100Ω series at U3.PA10

Net:    UART1_TXD (GNSS command output)
Pin:    U3.PA9 ↔ U6.RX (Quectel receives)
Width:  0.2mm
Layer:  L1
Length: ≤100mm
Note:   Low-speed UART (4800–9600 baud typical for GPS). No impedance control needed.
```

**Debug UART (MCU ↔ External USB-UART or debugger)**
```
Net:    UART_DEBUG_TX (U3.PA2 or similar)
Net:    UART_DEBUG_RX (U3.PA3 or similar)
Width:  0.2mm
Layer:  L1
Length: Not routed to connector on this board (reserved for future)
```

---

## ANTENNA & RF NETS (50Ω Controlled Impedance)

### LoRa RF Trace
```
Net:    ANT_LoRa
Pin:    U9.ANT_RF ↔ MHF4 connector (breakout pad)
Impedance:  50Ω nominal (IMPORTANT for LoRa 863–870 MHz)
Width:  Calculate from PCB stackup: 
        - Assume 2mm trace on L1, L2 solid GND below → ~50Ω for ~0.8–1.0mm width
        - Use trace width = 0.8mm on L1 for ~50Ω
        OR verify with calculator if your stackup differs
Layer:  L1 top surface ONLY
Length: ≤10mm to MHF4 pad
Via Rule: Minimize to vias only at connector pad (≤2 vias). No mid-trace transitions.
Keep-out: 10mm radius around MHF4 connector — NO ground plane or traces inside this zone
End Termination: 0Ω resistor (jumper) at antenna pad if matching network needed. TBD in schematic ERC.
Return Path: Ground return for LoRa RF is via separate GND net (see GND details below).
```

### GPS/GNSS RF Trace
```
Net:    ANT_GPS
Pin:    U6.ANT_RF ↔ GPS FPC connector or SMA
Impedance:  50Ω nominal (GPS L1 band, 1.575 GHz)
Width:  ~0.8–1.0mm on L1
Layer:  L1 top only
Length: ≤8mm to antenna connector
Keep-out: 8mm radius around connector
Via Rule: Connector pad only, min 1–2 vias
Stub: Minimize antenna stub cap (if any); prefer on module itself
```

---

## DIFFERENTIAL PAIRS (if used; currently none planned)

**Note**: Standard Bikera design does NOT use differential pairs for power or signal integrity. LoRa and GPS are single-ended RF traces. If future BLE antenna or USB3 is added, differential pairs may be introduced.

**Potential future differential nets**:
- USB 3.1 (if USB HUB future): D+/D- pair, 90Ω differential
- LoRa diff-pair antenna (if advanced RF module): Paired +ANT_LoRa and ANT_LoRa_N

---

## GROUND RETURN PATHS (GND Net)

### L2 Ground Plane (Continuous, Lowest Impedance)
- **Extent**: Cover entire board (50×30mm) except:
  - 10mm keep-out radii around LoRa and GPS antenna connectors (no GND plane inside)
  - 1–2mm clearance at board edges (no plane)
- **Connectivity**: Multiple solder vias (0.3mm dia, ≥5 total) at:
  - Star point near bulk caps (X≈44mm, Y≈5mm)
  - MCU cluster (X≈7.5mm, Y≈15mm)
  - LoRa cluster (X≈37mm, Y≈18mm)
  - GPS cluster (X≈25mm, Y≈12mm)

### L4 Ground Layer (Bottom Signal Layer)
- Secondary return path for high-frequency edges
- Via-stitching: every 2–3mm along high-speed signal traces (e.g., SPI)
- Not a continuous plane; allows routing of power and signal traces on L4 where needed

### Specific GND Nets (from schematic; all merged at star point)
- **U3.VSS** (MCU ground): 2–3 pins, via cluster to L2 plane
- **U9.GND** (LoRa module): 1 pin or multi-pin, via cluster (isolated path, keep ≥10mm from MCU digital GND until star point)
- **U6.GND** (GPS module): 1 pin, via cluster (isolated analog path)
- **U5.GND** (ECC chip): 1 pin, via cluster
- **Connector GND** (USB, JST-PH): Multi-via to L2 plane
- **Test point GND**: TP_GND (X≈5mm, Y≈25mm and Y≈5mm)

---

## NET CLASS ASSIGNMENT SUMMARY

| Net Class | Nets | Track Width (mm) | Clearance (mm) | Via Dia / Drill (mm) | Diff-Pair Gap (mm) |
|-----------|------|------------------|-----------------|----------------------|-------------------|
| Default | All GPIO, low-speed logic | 0.2 | 0.2 | 0.6 / 0.3 | N/A |
| Power | +3V3, +5V, +BATT (bulk) | 0.5 | 0.25 | 0.8 / 0.4 | N/A |
| HighSpeed_SPI | SPI_MOSI, MISO, CLK, CS | 0.2 | 0.2 | 0.4 / 0.2 | N/A |
| HighSpeed_RF | ANT_LoRa, ANT_GPS (50Ω) | 0.8–1.0 | 0.5 | 0.4 / 0.2 | N/A |
| GND | All ground nets (L2 plane) | N/A (continuous) | 0.2 (edge) | 0.3 / 0.15 | N/A |

---

## PRIORITY ROUTING ORDER

1. **Power delivery**: JST-PH → BMS → LDO → +3V3 bulk cap → MCU/LoRa/GPS
2. **Ground star point**: Converge all returns here, then fan out to L2 plane
3. **RF antennas**: LoRa and GPS traces, 50Ω routing, keep-out zones
4. **SPI bus**: MCU ↔ LoRa (and optionally GPS), shield with GND, minimize trace length
5. **I²C bus**: MCU ↔ ECC/GPS/Accel, low-speed but noise-sensitive
6. **UART**: GPS telemetry, general purpose (lowest priority)
7. **GPIO**: Buttons, LED, IO connectors (absolute lowest priority)

---

## NOTES FOR LAYOUT TOOL

- All critical nets should have **design rules checks (DRC)** enabled:
  - Minimum clearance: 0.2mm (KiCad default)
  - Track-to-via spacing: 0.2mm min
  - Antenna keep-outs: manual visual inspection (KiCad constraint system may not enforce 10mm radius)
- Use KiCad's **"Highlight Net"** feature to validate each critical net before routing
- Export netlist in CSV format for cross-reference with this anchor note

