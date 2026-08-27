# Bikera devboard — generated PCB layout (2026-07-05)

Generated from the anchor notes (00–04) + `Bikera PCB devboard.net`.
All 110 netlist components + 4 mounting holes placed, zero courtyard overlaps,
every pad net-assigned and cross-checked against the netlist (0 mismatches).

## Files
| File | What |
|---|---|
| `Bikera PCB devboard.kicad_pcb` | The layout (also saved as `..._GENERATED_BACKUP.kicad_pcb`) |
| `Bikera PCB devboard.kicad_dru` | Custom DRC rules (RF width 0.85–0.95 mm, +BATT ≥0.5 mm, Power ≥0.35 mm) |
| `Bikera PCB devboard.kicad_pro` | Patched: 6 net classes + 24 net patterns (original in `.bak_before_netclasses`) |
| `layout_top_plan.png` / `layout_bottom_plan.png` | Placement plans with courtyards |
| `layout_pads_verification.png` | Pad-level render of the emitted file |

**KiCad was open while I wrote these** (lock files present). If KiCad is still open:
close it WITHOUT saving the PCB or project, then reopen. If it saved over anything,
restore from `..._GENERATED_BACKUP.kicad_pcb` and `.bak_before_netclasses`.

## ⚠ Board size: 60×40 mm (not 50×30)
50×30 cannot hold this BOM: through-hole parts alone (SD header, ST-LINK area, DIP-8
socket, JSTs, buttons, 470 µF radial, USB-C…) block ~1100 mm² on *both* sides; with
SMD courtyards the top side needed ~125% of a 50×30 board. You approved 60×40
(~78%/72% utilization). Anchor zones were kept, scaled: MCU center-left, GPS+antenna
top-left, LoRa (bottom side) center-left, power column right edge, connectors on edges.
Mounting holes M3 at (3.5, 3.5) from each corner. KiCad coords: origin top-left, Y down.

## Placement highlights
- **U3 MCU** top, center (24, 26.2); C14/C15/C16 at VDD pins, C41 bulk adjacent,
  VDDA group (FB1, C17, C18, C40) at pin 9, all within anchor distances.
- **U9 RAK11720** on the **bottom side** (18.1, 24.5) — it's UART-only in the real
  netlist (not SPI as the anchors assumed), so routing is easy; C37–C39 + R24/R25 beside it.
- **U6 GPS** top-left, RF pin facing **AE1 (U.FL)** in the top-left corner; feed is
  ~5 mm. R28/C50/C49/D3 sit in the feed path. V_BCKP backup cluster (D2/D4/C32/U8)
  on the bottom under the GPS area.
- **Power column** on the right edge, top→bottom: L3, U4 (boost), U2 (GPS LDO),
  L1, IC2 (charger, BATT pads toward battery), L2, U1 (buck-boost). BT1 battery JST
  exits the right edge; TH1 next to it. **Star point**: bottom-right of the column,
  near (53, 33) — R16 servo shunt is right there.
- **J3 ST-LINK** is on the **bottom side** (debug adapter mates from below).
  **H3 SD header** lies along the bottom edge; **J7 ePaper** along the top edge;
  **H4 servo** bottom-right; **H2 accel header** vertical, left side.
- **IC1/IC3 hall sensors** are at the left/right board edges as placeholders —
  position them to match your magnet mechanics before routing.

## ⚠ Schematic bugs found in the netlist (fix in Eeschema)
1. **H3 pin 12** is in both `SPI1_MOSI` (pinfunction MOSI_12) and `SPI1_SCK`
   (SCK_12). I assigned it to **SPI1_MOSI** (pairs 11/12 = MOSI). Fix the SD
   adapter symbol/wiring.
2. **J7 pin 3** is in both `EPAPER_RST` and `SPI1_MOSI` (DIN_3). I assigned it to
   **SPI1_MOSI**; `EPAPER_RST` currently reaches no J7 pin on the board — it should
   probably be J7 pin 7 (pin 7 is absent from the netlist entirely).
3. **U9.12 (LORA_RF) and U9.33 (BLE_RF) are unconnected** in the netlist — the
   anchors describe a 50 Ω LoRa feed that doesn't exist in the schematic. If the
   RAK11720 needs a board-level antenna feed, add it and re-import.

## RF keep-out — deliberate deviation from anchor 04
The anchors demand *no GND plane* in an 8 mm radius around the GPS antenna connector,
but also a 0.9 mm/50 Ω microstrip — which *requires* the L2 GND reference underneath.
Since AE1 is a U.FL to an **off-board** antenna (no on-board radiator), I kept
**L2 (In1.Cu) solid** under the feed and applied the 8 mm copper-pour keep-out to
**In2.Cu (power plane) and B.Cu** only (`GPS_ANT_KEEPOUT` zone). If you want the full
anchor behaviour, edit the rule area and add In1.Cu — but then re-calculate the feed
width (it will no longer be 50 Ω against L2).

## Zones (drawn, not yet filled)
- `GND_PLANE_L2` on In1.Cu (whole board), `PWR_PLANE_L3` (+3V3) on In2.Cu,
  `GND_POUR_B` on B.Cu. Press **B** in pcbnew to fill.
- +BATT / +SYS / +5V / +3V3_GPS are *not* on the plane — route them as ≥0.5 mm traces
  (the .kicad_dru enforces widths).

## Suggested next steps
1. Close KiCad (if open), reopen the project. The board opens as a v6 file and
   KiCad 10 will upgrade it on first save — that's expected.
2. Schematic → fix the three netlist bugs above → **Update PCB from Schematic (F8)**
   with "Re-link footprints" off. Expect it to be clean apart from the H3/J7 fixes,
   the 4 mounting holes (board-only), and possibly the J1 pad-name mapping
   (netlist `A1_B12` vs footprint pads `A1`+`B12` — KiCad handles this the same way I did).
3. Fill zones, then route in anchor priority order: +BATT→IC2→U1→star point,
   GPS RF feed (0.9 mm, no vias), SPI (SD/ePaper), I²C, UART, GPIO.
4. Run DRC (the .kicad_dru rules load automatically).
5. A few non-critical resistors sit 10–17 mm from their ICs (R5–R9 charger status/TS
   network, R13, R26) — scoot them closer if you re-arrange anything.
