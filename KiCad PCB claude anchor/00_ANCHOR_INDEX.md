# BIKERA PCB LAYOUT ANCHOR NOTE — MASTER INDEX

## Purpose
This is a **minimal, token-efficient dataset** extracted from your Bikera project files for automated KiCad PCB layout generation using a deep-thinking model (Claude Fable).

**Key principle**: All four pillars are compressed into dense markdown, designed to be pinned as cached context in an LLM. Avoids re-parsing KiCad files, BOM spreadsheets, and schematics on each layout iteration.

---

## 4 PILLARS (Read in Order)

### **01_ANCHOR_GEOMETRY.md** — Board Outline, Mounting, Fixed Components
- Board dimensions (50×30 mm), layer count (4), layer stack assignment
- Mounting holes (4× M3, corner positions with exact X/Y coordinates)
- Fixed connectors & mechanical: USB-C, JST-PH battery, SD-card header, antenna connectors
- Restricted zones (RF keep-outs, digital/analog separation, thermal zones)
- Decoupling capacitor proximity rules (distance from IC pin to bypass cap, critical for power integrity)
- Power distribution summary and critical path rules (trace width, via count)
- Net classes baseline (Default, Power, HighSpeed, Diff-Pair; via sizes & clearances)

**Use this to**: Establish the physical PCB template, define placement zones (A–E), allocate space for connectors.

---

### **02_ANCHOR_CLUSTERS.md** — Component Functional Groups & IC Proximity
- **9 functional clusters** (MCU, Power, LoRa, GPS, ECC, Accelerometer, Storage, LED, Test Points)
- Each cluster lists:
  - Primary IC reference designator & package
  - Bypass capacitor part numbers & values
  - Max distance rules (≤5mm, ≤3mm, ≤2mm cap-to-pin)
  - Support components (resistors, ferrite beads, diodes, buttons)
  - Critical routing constraints (SPI shielding, isolated power domains, etc.)
  - Suggested PCB placement coordinates (approximate)
- Summary table: IC → Cap → Max Distance mapping (quick reference)

**Use this to**: Place components relative to each other, cluster decoupling caps immediately around each IC, enforce power domain isolation (e.g., +3V3_GPS separate until star-point).

---

### **03_ANCHOR_NETLIST.md** — Critical Nets Only (Power, High-Speed, Differential)
- **Power nets** table: +3V3, +3V3_GPS, +5V, +BATT, +SYS, GND; voltage, source, destination, routing strategy
- **I²C bus** (MCU ↔ ECC, sensors, GPS):
  - SDA_I2C1 & SCL_I2C1 nets
  - Pin mappings (U3.PB9, U3.PB8)
  - Pull-up resistor placement (4.7K, ≤10mm from MCU)
  - Length limits (≤100mm), shielding guidance
- **SPI bus** (MCU ↔ LoRa, optionally GPS):
  - SPI1_MOSI, SPI1_MISO, SPI1_CLK, SPI1_CS nets
  - Pin mappings, length limits (≤50mm), GND shielding strategy
- **UART** (MCU ↔ GPS telemetry):
  - UART1_RXD / UART1_TXD nets
  - Low-speed, flexible routing (≤100mm stubs)
- **Antenna RF traces** (50Ω controlled impedance):
  - ANT_LoRa (≤10mm, 0.9mm width, 10mm keep-out zone)
  - ANT_GPS (≤8mm, 0.9mm width, 8mm keep-out zone)
- **GND return paths**: L2 plane continuity, star-point convergence, via-stitching rules
- **Net class assignment table**: Which net class each critical net belongs to

**Use this to**: Route power, data, and RF traces. Implement length rules, impedance targets, and shielding. Enforce antenna keep-out zones.

---

### **04_ANCHOR_NETCLASSES.md** — Design Rules & Constraints by Net Class
- **6 net classes defined**:
  1. Default (GPIO, low-speed logic) — 0.2mm track, 0.2mm clearance, 0.6mm via dia
  2. Power (+3V3, +5V, +BATT) — 0.5mm track, 0.25mm clearance, 0.8mm via dia
  3. HighSpeed_SPI (LoRa/GPS SPI) — 0.2mm track, GND shielding every 2–3mm
  4. HighSpeed_I2C (ECC/GPS/Accel I²C) — 0.2mm track, 4.7K pull-ups at MCU, ≤100mm bus length
  5. HighSpeed_RF (ANT_LoRa, ANT_GPS, 50Ω) — 0.9mm width, 10mm/8mm keep-outs, via-stitched GND returns
  6. GND (L2 continuous plane) — 95% board coverage, antenna exclusions, star-point return
- **Layer assignment** (L1 signals, L2 GND plane, L3 power plane, L4 signals/power distribution)
- **Impedance calculation** (50Ω target for RF: 0.9mm trace width on 0.2mm L1–L2 spacing)
- **Manufacturing specs** (1.6mm FR-4, 1oz copper, 6mil min trace/space, solder mask both sides)
- **DRC checklist** (clearance, trace width, via rules; antenna keep-outs manual inspection)
- **Validation checklist** (pre-fabrication sign-off tasks)

**Use this to**: Apply DRC rules in KiCad, assign net classes to each net, measure final trace impedances (RF critical), approve board for fabrication.

---

## HOW TO USE WITH FABLE (Deep-Thinking Model)

### **Workflow**
1. **Pinned Context** (token-efficient):
   - Save this anchor note set as 4 short markdown files (each ≤15KB)
   - In your deep-thinking prompt, include these files as cached context ("pin" or "remember" in the system message)
   - Each file is independently useful; together they define the complete layout constraint set

2. **Fable Prompt Template**:
   ```
   # TASK: Auto-generate KiCad PCB layout for Bikera devboard
   
   **CONTEXT (cached, these 4 files):**
   - 00_ANCHOR_INDEX.md (this file)
   - 01_ANCHOR_GEOMETRY.md
   - 02_ANCHOR_CLUSTERS.md
   - 03_ANCHOR_NETLIST.md
   - 04_ANCHOR_NETCLASSES.md
   
   **INPUTS:**
   - Schematic netlist: [paste KiCad netlist.net export]
   - Component footprints: [paste list of references + footprint names]
   
   **TASK:**
   Generate a KiCad layout (.kicad_pcb file) that:
   1. Places components in clusters A–E (01_ANCHOR_GEOMETRY)
   2. Routes all critical nets per 03_ANCHOR_NETLIST
   3. Applies design rules from 04_ANCHOR_NETCLASSES
   4. Enforces antenna keep-out zones (10mm LoRa, 8mm GPS)
   5. Implements GND star-point at (44mm, 5mm)
   6. Reports any DRC violations found
   
   **CONSTRAINTS:**
   - Board: 50×30 mm, 4-layer
   - Minimize trace length (SPI ≤50mm, I²C ≤100mm)
   - Keep decaps ≤5mm from IC VDD pins
   - RF traces 50Ω impedance (0.9mm width on L1)
   ```

3. **Fable Output**:
   - `.kicad_pcb` file (human-readable, text-based KiCad layout format)
   - Trace dump report (success/failures for each net)
   - DRC violations (if any)

4. **Manual Review**:
   - Import generated `.kicad_pcb` into KiCad PCBnew
   - Run KiCad's DRC (target: 0 errors)
   - Visually inspect antenna keep-outs, GND plane continuity, trace routing
   - Iterate with Fable if needed ("move component X to (10, 15); re-route SPI bus")

---

## QUICK REFERENCE

### Cluster Placement (Zones)
| Zone | X range (mm) | Components | Purpose |
|------|-------------|-----------|---------|
| A | 0–15 | U3 (MCU), SW1, SW2, C14/C15/C16 (decaps) | Core MCU and logic |
| B | 15–32 | U6 (GPS), U5 (ECC), accel breakout, C29/C30, C27 | Sensors & crypto |
| C | 32–42 | U9 (LoRa), C37/C38/C39, MHF4 antenna | RF module |
| D | 42–50 | JST-PH, BMS chips (RT6158A, BQ25630), LDO, C41 (bulk) | Power management |
| E | Y≤5mm | USB-C, SD-card header | Connectors |

### Critical Distances
- **MCU VDD caps**: ≤5mm pad-to-pin (C14/C15/C16 to U3 VDD pins)
- **MCU VDDA caps**: ≤3mm pad-to-pin (C17/C18/C40 to U3 VDDA pins)
- **LoRa VDD caps**: ≤4mm (C37/C38/C39 to U9 VDD)
- **GPS VDD/V_BCKP caps**: ≤4mm (C29/C30 and C33/C34 to U6 pins)
- **I²C pull-ups**: ≤10mm from MCU I²C pins (U3.PB8/PB9)

### Antenna Keep-Outs (No GND Plane)
- **LoRa MHF4**: 10mm radius, center at MHF4 connector pad
- **GPS FPC**: 8mm radius, center at FPC connector pad

### Power Star-Point
- **Location**: (44mm, 5mm) — bulk cap cluster bottom-right
- **Convergence**: All power IC returns (BMS, LDO, charger) via multi-via (≥5× 0.3mm vias) to L2 GND plane
- **Fan-out**: From star-point, +3V3 and +3V3_GPS trees radiate upward/leftward to MCU and LoRa clusters

### Net Classes (Summary)
| Class | Track Width | Clearance | Via Dia | Key Nets |
|-------|------------|-----------|---------|----------|
| Default | 0.2 | 0.2 | 0.6 | GPIO, buttons, LED, debug |
| Power | 0.5 | 0.25 | 0.8 | +3V3, +BATT, +5V, +SYS |
| SPI | 0.2 | 0.2 | 0.4 | SPI1_MOSI/MISO/CLK/CS |
| I²C | 0.2 | 0.2 | 0.5 | I2C_SDA/SCL |
| RF | 0.9 | 0.5 | 0.4 | ANT_LoRa, ANT_GPS (50Ω) |
| GND | N/A (plane) | 0.2 (edge) | 0.3 | L2 continuous plane |

---

## FILE LOCATIONS
All files saved to: `D:\Obsidian git\AI\AI collaboration\KiCad PCB anchor`

```
00_ANCHOR_INDEX.md                 ← You are here
01_ANCHOR_GEOMETRY.md              ← Board outline, zones, connectors
02_ANCHOR_CLUSTERS.md              ← Component grouping, cap proximity
03_ANCHOR_NETLIST.md               ← Critical nets (power, SPI, I²C, RF)
04_ANCHOR_NETCLASSES.md            ← Design rules, trace widths, clearances
Bikera PCB devboard.net
```

---

## MAINTENANCE & UPDATES

**If you change the schematic (add/remove components)**:
1. Re-extract the component list from `D:\Obsidian git\AI\AI collaboration\Files\Bikera.xlsx` sheet "Componenten"
2. Update clusters in `02_ANCHOR_CLUSTERS.md` (add/remove ICs and caps)
3. Update net names in `03_ANCHOR_NETLIST.md` (grep the new `.kicad_sch` files)
4. Re-run KiCad DRC to validate net classes in `04_ANCHOR_NETCLASSES.md`

**If you change the board size or layer count**:
1. Update board dimensions in `01_ANCHOR_GEOMETRY.md`
2. Recalculate RF trace width (0.9mm assumes 4-layer with 0.2mm L1–L2 spacing; may differ for 2-layer or 6-layer)
3. Adjust zones (A–E) accordingly

**If you add RF modules (e.g., BLE antenna on 2.4 GHz)**:
1. Add new RF net class to `04_ANCHOR_NETCLASSES.md` (e.g., HighSpeed_RF_2400MHz with tighter tolerance)
2. Document antenna keep-out zone (smaller for higher frequency)
3. Add to `03_ANCHOR_NETLIST.md` netlist

---

## NEXT STEPS

1. **Immediate**: Share these 4 anchor files (00–04) with Fable as cached context
2. **Short-term**: Export KiCad netlist (File → Export → Netlist), pass to Fable with anchor files
3. **Layout generation**: Fable generates `.kicad_pcb` file; import into KiCad PCBnew
4. **Validation**: Run DRC, inspect antenna zones, verify GND plane continuity
5. **Iteration**: If Fable-generated layout has issues, adjust anchor constraints and re-generate

---

**Created**: 2026-07-05  
**Project**: Bikera PCB devboard (50×30 mm, 4-layer, STM32L431 + LoRa + GPS)  
**Target Tool**: KiCad 10.0 (or later)  
**Model**: Claude Fable 5 (deep-thinking, layout generation)  

---

## NOTES FOR FABLE

When generating the layout:
- **Respect zones**: Don't place MCU (U3) in Zone C or D; keep it in Zone A
- **Antenna isolation**: Treat 10mm/8mm keep-outs as hard constraints; no exceptions
- **Power first**: Route +BATT → BMS → LDO → bulk cap → MCU before routing signals
- **Layer assignment**: All SPI on L1; I²C can flex to L4 via vias if needed; RF never leaves L1
- **Via-stitching**: Implement along SPI traces (GND via every 2–3mm for shielding)
- **Report each stage**: After placement, after power routing, after signal routing—so we can catch issues early

---

**Good luck with the layout!** 🎯

