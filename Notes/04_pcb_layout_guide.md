# Bikera — PCB Layout Guide (Prototype Build)

**Companion to `01_library_audit.md`, `02_footprints_explained.md`, and `03_schematic_capture_guide.md`.** Schematic capture is complete and ERC is clean. This doc covers what happens after `Tools → Update PCB from Schematic`: stackup, board outline, placement priorities, routing rules, RF considerations, DRC settings, and manufacturing file prep.

**Prerequisites before opening the PCB editor:**
- Schematic ERC clean, BOM matches `Bikera.xlsx` Keuze prototype = TRUE rows
- `Update PCB from Schematic` executed; all footprints landed in the PCB editor
- Decisions made on the items listed in §1 audit "What's NOT in Keuze prototype but you may want anyway"
- Enclosure dimensions known (board outline, mounting hole positions, antenna pigtail exit points, USB-C accessibility)
- Fab house picked (JLCPCB / PCBWay / Aisler / Eurocircuits) — their minimum DRC values affect your design rules

## Stackup decision

The BQ25630YBGR DSBGA is the single component that drives the stackup decision. A 0.4 mm pitch, 5×5 ball BGA has 9 inner balls that cannot fan out on 2 layers. Two stackup options:

### Option A — 4-layer (recommended)

```
Top (L1)      ── signal + components ────────────────  35 µm (1 oz) Cu
              ── prepreg ──────────────────────────── ~150 µm FR4
Inner 1 (L2)  ── solid ground plane ─────────────────  17 µm (½ oz) Cu
              ── core ─────────────────────────────── ~1100 µm FR4
Inner 2 (L3)  ── power distribution + low-speed sig.   17 µm (½ oz) Cu
              ── prepreg ──────────────────────────── ~150 µm FR4
Bottom (L4)   ── signal + components ────────────────  35 µm (1 oz) Cu
```

Total thickness ~1.6 mm. Standard JLCPCB / PCBWay 4-layer offering, ~€50 for 5 boards at 100×100 mm.

**Why this layout works:**
- L1 carries most signals and all RF
- L2 solid ground gives 50 Ω microstrip impedance reference for the GPS U.FL trace
- L3 routes the power rails (+3V3, +3V3_GPS, +5V_SERVO, +SYS, +VBAT)
- L4 hosts the BQ25630YBGR inner-ball fan-out vias landing on L4 traces
- BGA fan-out: drill 0.2 mm vias from inner balls down to L4, route on L4

### Option B — 2-layer (don't recommend, but documented)

2 layers can't host the BQ25630YBGR's 9 inner balls. Workarounds:
- Use BGA's outer 16 balls only — but several power/ground pins are inner balls, defeating purpose
- Switch to a non-BGA charger (BQ25895RTWR QFN — was deselected for USB-C reasons)
- Use blind/buried vias on a 2-layer board — fab pricing approaches 4-layer cost anyway

**For the prototype, go 4-layer.** The €50 incremental cost is worth not respinning.

## Board outline

The Bikera lock enclosure size determines the PCB outline. From `Readme.md`:
- Prototype is a development board (not production-size constrained)
- Mounting holes for M3 standoffs at four corners
- USB-C accessible from one edge
- Battery (Li-ion 18650 ×2-4 per Readme — but `Keuze prototype` only shows 1-cell capable charger; verify with project lead) connected via JST PH cable
- Antenna FPCs exit via MHF4 pigtails — flexible placement
- Servo connected externally via JST PH cable

**Suggested initial outline:** 80 × 100 mm rectangle, M3 mounting holes at corners (3.2 mm holes, 6 mm copper-free annular ring). Plenty of room to spread the layout out; later revisions can shrink.

```
KiCAD PCB Editor → File → Page Settings: A4, landscape
Edge.Cuts layer: rectangle 80×100 mm
M3 mounting holes (4): `MountingHole:MountingHole_3.2mm_M3` at (5,5), (75,5), (5,95), (75,95)
```

## Placement order

Place big or constrained-position parts first, then fill in around them:

### Step 1 — Constrained-position parts

These parts have to go in specific places relative to the board edge or enclosure:

1. **USB-C receptacle (J1)** — at one edge of the board, oriented for cable insertion. The PCB edge must align with the receptacle's mating face. **Place the CP2102N (U11) within 15 mm of the receptacle** so the D+/D− differential pair stays short — the bridge is the consumer of D+/D−, the charger only needs the CC pins via shorter routes.
2. **Battery connector (J2)** — near the BQ25630 to minimise BAT-pin trace impedance.
3. **Servo connector (J7)** — at the opposite edge from USB-C, so servo cable doesn't tangle with the charge cable. **The 2512 Rsense shunt sits in the GND return path between J7 pin 1 and the board ground plane** — place it within 5 mm of J7, with one pad tied to a small isolated GND-side island (the `SERVO_GND_HIGH` net) and the other pad tied to the main ground plane.
4. **ST-link BTB card edge (J3)** — at one edge with clearance for the STLINK-V3MINIE to plug in. The probe is 15 × 42 mm; reserve at least 50 mm × 25 mm of "air space" around the connector on the keep-out diagram.
5. **BOOT and RESET buttons (SW1, SW2)** — on the edge near the ST-link card edge connector for easy access during debug. If the enclosure has button cutouts elsewhere, place them there instead.
6. **GPS U.FL receptacle (J4)** — near the LC76GPAMD module. Goal: minimise the U.FL trace length (ideally <10 mm).
7. **GPS V_BCKP supercap** — within 10 mm of the LC76GPAMD V_BCKP pin. The supercap is bulky (typical 0.1 F radial supercap is ~6 mm diameter, ~5 mm tall) — reserve a footprint placement square accordingly.
8. **RAK11720 MHF4 jacks** — already on the module itself. The module placement decides where the antenna pigtails exit. **The MHF4 jacks must face the side of the board where the antenna FPCs will be mounted in the enclosure.**
9. **ePaper connector (J6)** — adjacent to where the ePaper module will be visible through the enclosure window. The 8-pin JST PH cable can route across the board, so this isn't tightly constrained — but keep it >20 mm from the RAK11720 to avoid SPI noise coupling into the radio.
10. **Status LED (D2)** — near a viewing window in the enclosure. Edge placement common.
11. **Hall sensors (U8, U9)** — at the lock's mechanical sensing positions. **Mechanical engineering decides** these positions, not PCB engineering. Place per the mech drawing.

### Step 2 — Power section (place as a tight cluster)

The power section should be a tight, well-organised cluster to minimise loop areas in the switching converters.

1. **BQ25630YBGR (U1)** — central. Per verified TI datasheet sec. 9.4 (Layout) plus pin grid: VBUS pins are A1/B1 (top edge), SW pins are A3/B3/C3 (top middle column), BAT pins are E1/E2/E3 (bottom edge), SYS pins are D1/D2/D3 (bottom middle column).
   - **Critical loop 1 (VBUS → PMID):** place the 1 µF VBUS cap and 10 µF PMID cap immediately adjacent to columns 1–2 of the package, on the **same side**, with returns through the closest PGND ball (column 4)
   - **Critical loop 2 (SW → inductor → SYS):** route the SW node (the high-dv/dt net) as short and wide as possible to the inductor, then back to the SYS pins. Keep the loop area minimum — this loop area determines EMI behaviour
   - **47 nF BTST cap:** between BTST (B5) and the SW node; very close to the package
   - **REGN 4.7 µF cap:** very close to REGN ball (A5) with a short GND return
2. **RT6150B (U2)** — close to BQ25630 SYS output, ideally within 10 mm. Its inductor (L2) between LX1 (pin 4) and LX2 (pin 2), kept short. The VOUT (pin 1) and FB (pin 10) trace to R1/R2 divider stays close and away from the LX node.
3. **TCR3UG33A (U3)** — close to the LC76GPAMD. The whole point of a separate LDO for GPS is low noise, which means short connection between LDO and load.
4. **TPS61253F (U4)** — close to the servo connector (J7). Its inductor (L3) within 3 mm of SW pin. Its output cap (22 µF) within 5 mm of VOUT.
5. **Bulk caps:** each switching converter's bulk cap (10–22 µF) within 5 mm of the chip's power pin.
6. **Thermal vias under BQ25630 PGND balls (A4, B4, C4):** at least one via per ball into L2 ground pour. The 30-ball DSBGA has limited heat-spreading area; missing thermal vias means the chip enters thermal regulation prematurely at high charge currents.
7. **Thermal vias under RT6150B EPAD:** a 2×2 or 3×3 via grid stitched to L2 ground pour. The 2.5×2.5 package has θJA = 40.9 °C/W — at 800 mA × ~0.3 W power dissipation, junction temperature rises 12 °C above ambient with a good thermal pad. Without proper EPAD soldering, that becomes 50+ °C and the chip enters thermal shutdown.

### Step 3 — MCU section

1. **STM32L431 (U7)** — central. Per-pin decoupling caps within 2 mm of each VDD pin pair (one cap per VDD pin, on the same layer if possible). Note: reference designators are illustrative; in your KiCAD project the MCU may be U1 or any other number — keep the BQ25630 charger and the MCU on **different** references to avoid confusion in BOMs.
2. **VDDA decoupling cluster** (100 nF + 10 nF + 1 µF) within 5 mm of the VDDA pin.
3. **CP2102N (U11)** placement was decided in Step 1 (near USB-C). Its TXD/RXD signals route to MCU LPUART1 pins (PC0/PC1) — keep this trace pair under 80 mm to avoid signal integrity issues. The pair is just a UART (max 921600 baud), not USB Full Speed, so it's not impedance-critical.
4. **MCU adjacent to RAK11720** — short UART traces matter less than I²C bus length (lower frequency) but a tidy layout still helps signal integrity.

### Step 4 — Sensor / interface section

1. **FRAM (U7)** — anywhere on the I²C bus path. Stock SOIC-8, no special constraints.
2. **ATECC608B (U10)** — same. Adjacent to FRAM is convenient.
3. **LIS2DW12 module** — flexibility here. If the project plans to use the accelerometer for tamper detection, place it physically close to where vibration originates (lock body). For a dev board, position it where it can be visible during debug.
4. **SD card breakout** — anywhere convenient; SPI tolerates moderate trace lengths.

## Routing

### Layer assignment policy

- **L1 (Top):** signals (preferred), all RF (mandatory), components (SMD top)
- **L2 (GND):** solid ground plane — **do NOT route signals on L2 unless absolutely necessary, and never break the plane under RF traces**
- **L3 (PWR):** power rails as area fills:
  - `+3V3` fill covering most of the MCU + sensor + storage region
  - `+SYS` fill near the power section
  - `+3V3_GPS` smaller fill near GPS
  - `+5V_SERVO` small fill near servo connector
  - `+VBAT` small fill near charger and battery connector
  - Each fill is a polygon zone, ground-stitched at boundaries
- **L4 (Bottom):** secondary signals, BGA fan-out routing, components (SMD bottom — minimise; ideally all components on L1)

### Track widths

| Net | Min width (mm) | Typical width (mm) | Reason |
|---|---|---|---|
| Digital signals | 0.15 | 0.2 | Standard hobbyist fab capability (JLCPCB minimum 0.1 mm, with safety margin) |
| I²C bus | 0.15 | 0.2 | Same |
| SPI bus | 0.15 | 0.2 | Same |
| UART (RAK11720, GPS) | 0.15 | 0.2 | Same |
| `+3V3` | 0.5 (area fill preferred) | — | ~500 mA peak |
| `+3V3_GPS` | 0.4 | — | ~50 mA continuous |
| `+5V_SERVO` | 0.8 | — | Servo can pull >2 A peak |
| `+SYS` | 0.8 | — | Up to charger 5 A capability |
| `+VBAT` | 1.0 | — | Up to charge current 5 A from cell |
| `GND` | area fill (L2) | — | Continuous plane |
| BAT to charger | 1.5 | — | 5 A continuous |
| **Inductor SW node** (BQ25630, RT6150B, TPS61253F) | 0.5 | 0.8 | Minimize loop area; this is the high-dV/dt node |
| **U.FL trace to GPS** | calculated 50 Ω | see below | RF impedance match |

### Via sizes

| Use | Drill (mm) | Diameter (mm) | Notes |
|---|---|---|---|
| Standard signal via | 0.3 | 0.6 | JLCPCB minimum 0.2 mm; safety margin |
| Power via | 0.4 | 0.8 | For >500 mA paths |
| BGA fan-out via | 0.2 | 0.4 | Required for BQ25630 inner balls — must specify "0.2 mm minimum drill" to fab |
| Ground stitching | 0.3 | 0.6 | Place every 5–10 mm along ground edges, especially around RF |

### GPS U.FL trace — the most critical RF route

The trace from LC76GPAMD's ANT pin to the U.FL receptacle's signal pin must be 50 Ω controlled impedance.

**On a 4-layer board with L1 signal and L2 ground reference, 1.6 mm overall thickness:**
- Top dielectric thickness ~0.2 mm (prepreg between L1 and L2)
- L1 copper thickness ~35 µm
- FR4 εr ≈ 4.3

Using the standard microstrip formula (or KiCAD's built-in calculator: `Tools → Calculator → TransLine → Microstrip Line`):
- **For 50 Ω at these dimensions: trace width ≈ 0.36 mm**

Verify in KiCAD's calculator with your actual fab's stackup (each fab publishes their layer thicknesses).

**Routing rules for the U.FL trace:**
1. Keep it as short as possible — target <10 mm, hard limit 20 mm
2. Straight or single 45° bend, no sharp 90° corners
3. No other signals within 3× trace-width spacing on the same layer
4. Solid ground on L2 directly underneath, no breaks
5. Stitching vias every 3 mm on both sides of the trace, connecting L2 ground to top-side ground fill (creates a coplanar waveguide grounded structure for better isolation)
6. The receptacle's GND pads connected directly to L2 plane with multiple vias (≥4 vias)
7. **The low-capacitance RF TVS (SMF05C or PESD5V0X1BSF)** sits in series-shunt along this trace: signal continues through to the receptacle, TVS sits as a shunt to GND. Place it **close to the U.FL receptacle** (within 3 mm) — TVS protects against discharge events on the antenna side, so it needs to clamp before the energy reaches the LC76G. Its GND pad goes directly to L2 with its own via, no shared via with anything else.
8. **C1/C2 π-network pads (NM):** place the pads in the BOM layout but mark "DNI" / "NM" on F.Fab. Even if not populated, having pads on the PCB makes RF tuning possible without a respin.

If the trace must be longer than 20 mm, switch from microstrip to coplanar waveguide with ground (CPWG) — narrower trace, ground fill on the same layer with controlled gap. KiCAD calculator's "Coplanar Line" mode does this calc.

### USB D+/D− pair — second critical route

The differential pair from the USB-C receptacle to the CP2102N bridge is USB Full Speed (12 Mbit/s). USB-FS has a lot of timing margin compared to the GPS RF, but bad routing still causes enumeration failures or intermittent drops.

**Routing rules:**
1. Route as a differential pair, both halves on the same layer
2. **Target 90 Ω differential impedance.** On 4-layer stackup with L2 ground reference: traces ~0.4 mm wide, 0.2 mm spacing — verify with KiCAD's calculator (`Tools → Calculator → TransLine → Coupled Microstrip Line`)
3. Length-matched within 1 mm (USB-FS tolerates much more but it's good practice)
4. No vias if avoidable; if necessary, both halves of the pair via together at the same point
5. Total length under 80 mm
6. Ground reference on L2 must be solid under the entire pair — no splits
7. Keep at least 0.4 mm clear from other signals on the same layer (3× pair spacing)

The CP2102N has internal D+/D− termination, so external 27 Ω series resistors are NOT needed. Add `~/NC` flags if your schematic has placeholder resistors so they don't end up in the BOM.

### Switching converter loops

For BQ25630, RT6150B, and TPS61253F, minimize the high-dI/dt loop:
- Input cap → IC VIN pin → IC GND pin → back to input cap
- IC SW pin → inductor → output cap → back to IC GND

These two loops should both be small in area and close to the chip. The architecture rule: **input cap, output cap, and IC ground pins should share a contiguous ground pour with vias to L2 plane within 2 mm of each cap.**

For the BQ25630YBGR DSBGA specifically: TI's BQ25630 EVM gerbers show one good layout. Open those gerbers in a viewer and reference them. Don't reinvent the loop geometry.

### Sharing of SPI bus

The SD card and ePaper share `SPI_MOSI` and `SPI_SCK`. Route the bus as a daisy chain:
- MCU → ePaper connector → SD module connector
- Or: MCU → branch → ePaper + SD module

For SPI at L431's typical 8 MHz, either topology works. Daisy chain has slightly better signal integrity (no stub effects); branch is shorter total. Prototype: branch is fine.

### I²C bus routing

The I²C bus has 4 slaves: BQ25630, FRAM, LIS2DW12, ATECC608B.

- Route as a single trace pair (SDA, SCL) visiting each slave
- Total bus length kept under 50 mm (typical "short bus" rule)
- Pull-ups at the bus master (MCU) end
- No stubs longer than 5 mm from the main trace to each slave

## Ground plane strategy

The L2 plane is **continuous ground** with no breaks except where vias punch through.

- Stitch the top-side ground fill to L2 with vias every 5–10 mm
- **Around the RAK11720 module**: dense stitching (vias every 2–3 mm) along the module's GND castellations to ensure good ground reference for the module's internal RF
- **Around the U.FL receptacle and the GPS trace**: dense stitching to maintain coplanar waveguide ground
- **Under the BQ25630 DSBGA**: every ball that is GND should have its own via to L2 (no shared via clusters — each ball's via straight down)

**Do NOT split ground into AGND and DGND** on this prototype. The single-plane approach is robust and easier to debug. If the LC76GPAMD shows excessive noise on first bring-up, address it with shielding (RF can) over the GPS section, not with a split plane.

## DRC configuration

**File → Board Setup → Design Rules**

### Net classes

Define classes that match the track widths above:

| Class | Members | Clearance | Track | Via Hole | Via Diameter |
|---|---|---|---|---|---|
| Default | (most digital signals) | 0.15 mm | 0.2 mm | 0.3 mm | 0.6 mm |
| Power | +3V3, +3V3_GPS, +SYS | 0.2 mm | 0.5 mm | 0.4 mm | 0.8 mm |
| HighCurrent | +VBAT, +5V_SERVO, BAT, charger SW nets | 0.25 mm | 0.8 mm | 0.4 mm | 0.8 mm |
| RF | (GPS U.FL trace) | 0.4 mm | 0.36 mm | 0.3 mm | 0.6 mm |
| Differential | USB_DP, USB_DN (to CP2102N bridge) | 0.15 mm | 0.4 mm matched, 0.2 mm pair gap | 0.3 mm | 0.6 mm |

Assign each net to its class via the **Net Classes** tab.

### Constraints

- **Min clearance:** 0.15 mm (matches fab capability with margin)
- **Min track width:** 0.15 mm
- **Min via hole:** 0.2 mm (BGA fan-out); set 0.3 mm as min for standard vias
- **Min via diameter:** 0.4 mm (BGA); 0.6 mm for standard
- **Min annular ring:** 0.13 mm

### Other settings

- **Solder mask expansion:** 0.05 mm (fab default; can override per-footprint for DSBGA)
- **Silkscreen min text height:** 0.8 mm (smaller may be unreadable on fab silkscreen)

## DRC iteration

Run DRC. Iterate to clean. Common errors and fixes:

| Error | Likely cause | Fix |
|---|---|---|
| Clearance violation | Two parts too close | Move one |
| Track too narrow | Power net routed at default width | Reassign to Power class, redraw |
| Via too small | Default via on a BGA | Manually override to small via on BGA fan-out tracks only |
| Unconnected net | Forgot a wire | Find net, route it |
| Hole-to-hole clearance | Two through-holes overlapping | Move one |
| Silkscreen on pad | Silkscreen text overlaps a pad | Move text or shorten |
| Courtyard overlap | Two components physically occupy the same space | Move one |

**Iterate until 0 errors and only acceptable warnings.** Document any warnings you choose to ignore (e.g. "silkscreen on copper at U1 corner — accepted, just a courtyard touch").

## Mechanical and 3D check

After DRC clean:

1. **View → 3D Viewer.** Inspect the board with all components rendered.
2. Verify clearance: USB-C receptacle protrudes from the edge, ST-link card edge connector has space for the probe, MHF4 cables can exit without colliding with components.
3. Verify the battery connector can mate with the battery's cable.
4. Verify mounting hole positions match your enclosure CAD.
5. Export STEP: **File → Export → STEP**. Open in FreeCAD or Onshape with the enclosure model. Verify everything fits.

## Manufacturing file generation

When DRC is clean and 3D check passes:

1. **File → Plot.** Output format: Gerber. Layers: F.Cu, B.Cu, In1.Cu, In2.Cu, F.Mask, B.Mask, F.SilkS, B.SilkS, F.Paste, B.Paste, Edge.Cuts. Drill file: **Generate Drill File** with PTH and NPTH separated, Excellon format.
2. Pack the gerbers + drill files into a ZIP.
3. **Upload to fab** (JLCPCB / PCBWay / Eurocircuits). Verify their viewer shows the board correctly — pay particular attention to:
   - 4 layers correctly stacked
   - Outline visible on Edge.Cuts
   - Mounting holes drilled
   - BGA pads visible and correctly sized
4. **BOM file:** export from KiCAD (Tools → Generate BOM). Format depending on fab: for JLCPCB assembly, use their template; otherwise CSV with reference, value, footprint, MPN.
5. **CPL (centroid placement) file:** Tools → Generate Position File. Format: CSV, mm, top + bottom separately.

## Pre-fab checklist

Before clicking "place order":

**Component presence:**
- [ ] DRC clean
- [ ] All `Keuze prototype = TRUE` parts present in the BOM
- [ ] USB-C receptacle present (not in original BOM but required)
- [ ] U.FL receptacle present for GPS antenna
- [ ] USBLC6 ESD protection on USB-C present
- [ ] CC1 / CC2 pulldowns present (2× 5.1 kΩ to GND)
- [ ] **CP2102N UART-to-USB bridge present** (per architecture diagram) with D+/D− routed from USB-C receptacle to bridge (NOT to BQ25630)
- [ ] **GPS V_BCKP backup circuit present** (BAT54C + 0.1 F supercap + 1 kΩ + 4.7 µF + 100 nF + 33 pF + SMBJ5.0CA TVS) — OR explicitly omitted if accepting cold-start every boot
- [ ] **GPS VCC decoupling triplet present** (10 µF + 100 nF + 33 pF + SMBJ5.0CA TVS — per LC76G HW Design fig. 4)
- [ ] **GPS antenna RF TVS present** (low-cap SMF05C or PESD5V0X1BSF — NOT SMBJ family) between LC76G ANT pin and U.FL signal
- [ ] **Servo Rsense present** (0.05 Ω 2 W 2512 SMD shunt in GND return path of J7) with SERVO_ISENSE to MCU ADC (PC2)
- [ ] **BOOT and RESET buttons present** (two physical tactile, per architecture diagram "Drukknoppen"). RESET = 0.1 µF cap to GND only (NRST internal pull-up makes external 10 kΩ redundant). BOOT0 = 10 kΩ pull-down to GND (no internal pull on BOOT0)
- [ ] 4 M3 mounting holes

**Critical passive values (per verified datasheets):**
- [ ] BQ25630 CVBUS = 1 µF (NOT 10 µF — datasheet table 7-3)
- [ ] BQ25630 CPMID = 10 µF + 100 nF parallel
- [ ] BQ25630 CSYS = 20 µF (22 µF E12 acceptable)
- [ ] BQ25630 CBAT = 10 µF
- [ ] BQ25630 CREGN = **4.7 µF 10 V** (NOT 1 µF or 100 nF)
- [ ] BQ25630 CBTST = **47 nF** between BTST and SW (this is the bootstrap cap — missing it stops switching)
- [ ] BQ25630 RPG = 2.2 kΩ pull-up (NOT 10 kΩ — datasheet specifies 2.2 kΩ)
- [ ] BQ25630 RINT, RSDA, RSCL = 10 kΩ pull-ups
- [ ] BQ25630 RBATP = 100 Ω series to battery+ (Kelvin sense)
- [ ] BQ25630 TS thermistor = 103AT-2 10 kΩ (or fixed divider for bench bring-up only)
- [ ] BQ25630 L = 1 µH, ≥5 A saturation
- [ ] RT6150B CIN = 10 µF, COUT = 20 µF
- [ ] RT6150B L = 2.2 µH, ≥1.6 A saturation, between LX1 and LX2
- [ ] RT6150B FB divider: R1 = 487 kΩ, R2 = 86.6 kΩ (sets Vout = 3.3 V)
- [ ] RT6150B PS pin tied **LOW** (PSM mode for efficient low-load — earlier draft had this backwards)
- [ ] RT6150B VINA pin tied to VIN directly (per datasheet typical app)

**Footprint verification:**
- [ ] BQ25630YBGR = **30-ball DSBGA**, 2.3 × 2.4 mm, 6×5 grid (NOT 25-ball 5×5 — verify against TI datasheet SLUSFN0A sec. 12)
- [ ] RT6150B = WDFN-10L 2.5 × 2.5 mm, pin 1 = VOUT (top-left), pins 3/9/11 = GND (verify against Richtek DS6150A/B-04 outline)
- [ ] TCR3UG33A WCSP4F = 4-bump 2×2 grid, 0.94 × 0.94 mm
- [ ] TPS61253F DSBGA-9 = 3×3 grid, 1.235 × 1.235 mm
- [ ] CP2102N QFN-24 = 4 × 4 mm with central thermal pad
- [ ] U.FL receptacle pads match the specific MFR you'll buy (Hirose U.FL-R-SMT-1 is the standard)

**Final review:**
- [ ] 3D viewer check passes
- [ ] STEP exported and overlaid with enclosure model — no collisions
- [ ] Gerber viewer (fab side) shows the board correctly
- [ ] BOM cross-references match `Bikera.xlsx` Keuze prototype = TRUE rows PLUS architecture-diagram additions
- [ ] Project files committed to git with a tag corresponding to this fab order

## After fab arrives

1. **Visual inspection** — solder mask, silkscreen, no obvious damage. Compare bare PCB against your gerber viewer image.
2. **Power section first** — assemble ONLY: BQ25630, USB-C receptacle, USBLC6, charger inductor, CC pulldowns, charger decoupling caps, RT6150B, RT6150B inductor and caps. **Don't assemble the rest yet.**
3. **First power-up:**
   - Plug a battery into J2 (~3.7 V Li-ion)
   - **Don't connect USB-C yet**
   - Measure SYS and +3V3 — both should be present
4. **USB-C charging test:**
   - Connect USB-C charger (5 V, ≥1 A)
   - I²C read BQ25630 status register — confirm USB-C source detected and charging
5. **If power section works:** assemble the rest of the board, but **do NOT assemble the RAK11720 yet.**
6. **MCU bring-up (RAK11720 still NOT assembled):**
   - Plug in STLINK-V3MINIE via the BTB card edge connector
   - Flash a blinky on the LED
   - Verify MCU clock + GPIO basics
7. **Peripheral bring-up in order (RAK11720 still NOT assembled):** LED → button (NRST) → I²C scan → UART loopback test → GPS → ePaper → FRAM → SD → accelerometer → hall sensors → servo
8. **RAK11720 bring-up — MUST attach antennas first:**
   - Per RAK datasheet: "Make sure that an antenna is always connected. Using these transceivers without an antenna can damage the module."
   - **Solder the RAK11720 to the board AFTER all other peripherals are validated.**
   - **Before powering the board with RAK11720 mounted: plug in both MHF4 pigtails to FPC antennas (or 50 Ω terminators).**
   - Power on, query the module via UART AT commands (`AT` should return `OK`).
   - Run a low-power TX test before any high-power TX. The first LoRa TX at full +20 dBm into an unconnected antenna can permanently damage the PA.

This staged bring-up catches BQ25630 DSBGA reflow issues, RT6150B issues, MCU issues, peripheral issues, and RAK11720 antenna-mishap issues separately — much faster than full-board assembly followed by debugging "nothing works", and much safer for the €12 RAK module.

## When something doesn't work

Common prototype failures and their likely causes:

| Symptom | Likely cause | First check |
|---|---|---|
| No SYS rail | BQ25630 not soldered properly (DSBGA balls not wetting) | X-ray or rework with hot plate; reflow at higher temp |
| SYS present but +3V3 not | RT6150B issue: WDFN thermal pad not soldered, or EN pin not high | Measure RT6150B EN pin voltage; check thermal pad continuity to ground |
| +3V3 present but MCU dead | NRST stuck low, or VDD not actually 3.3 V | Measure NRST; check all 3 VDD pins independently |
| MCU runs, no I²C ACK from any device | I²C bus pull-ups missing or wrong value | Measure SDA/SCL rest voltage (should be ~3.3 V) |
| GPS doesn't lock | GPS antenna issue, U.FL trace impedance bad, or VBACKUP issue | Measure GPS output power on antenna pin with sniffer / replace antenna |
| RAK11720 doesn't respond to AT | UART crossed, or module BOOT/RESET stuck | Check BOOT pulled low, RESET pulled high, swap TX/RX if needed |
| Servo doesn't move | TPS61253F not enabled (MCU GPIO low), or PWM signal not generated | Measure +5V_SERVO when EN_5V_SERVO is high |
| Host PC doesn't see virtual COM port from bridge | CP2102N D+/D− miswiring, or VBUS sense not connected | Measure VBUS at CP2102N pin; verify USB enumeration with `dmesg` (Linux) or Device Manager (Windows). If chip not enumerating at all: D+/D− may be swapped — check schematic vs PCB
| Bridge enumerates but no data | UART crossed between bridge and MCU | Probe bridge TXD pin with scope while host sends data — if data present but MCU sees nothing, swap BRIDGE_TX and BRIDGE_RX on MCU side |
| Hall sensors always read same value | Sensor orientation wrong, magnet polarity wrong, or sensor variant mismatch | Apply magnet to sensor face directly; rotate magnet to find correct polarity |

## Forward path to `Keuze finaal` design

Once the prototype is validated and you transition to the production design, expect these PCB-level changes:

1. **RAK11720 MHF4 → RF pinout variant:** add controlled-impedance traces from module RF pads to antenna feeds. Build keepouts. Add PCB trace antenna or wire antenna feed pads.
2. **3.3 V buck-boost RT6150B → RAA2361052GNP#HC5:** different DFN-10 pinout, board respin.
3. **Hall sensors DRV5032 ×2 → SL1613SH + SL1623SH:** SMD parts instead of THT, different footprints, board respin. Anti-tamper N-pole / S-pole arrangement.
4. **Antennas FPC → PCB trace + wire dipole:** changes board outline (need clear area for PCB IFA antenna) and adds wire antenna feed pads.
5. **Skip ePaper:** remove the 8-pin JST header and the SPI bus's ePaper branch.

Each of these is a separate audit + footprint check + schematic edit + layout iteration. Reusing the prototype board layout is not viable for the `Keuze finaal` design — plan a full PCB rev 2 cycle when you make the pivot.

## Documentation to keep

After the first board is built and validated, archive:
- The gerbers + drill files used for this fab order
- The KiCAD project files at the matching git tag
- The BOM as ordered (with substitutions documented)
- Photos of the assembled board (top + bottom, high-res)
- Bring-up notes: what worked first try, what needed rework, voltage measurements at key test points
- Any datasheet errata you discovered during bring-up

This documentation is what makes board rev 2 fast. Without it, you'll rediscover the same issues.
