# Bikera devboard — routing session (2026-07-06)

## What happened
Continued from the 2026-07-05 generated layout. Your two schematic fixes (H3.12,
J7.3→pin 7) were verified present in the saved PCB; U9's open RF pins are fine
(MHF4 on module). The stale `.net` export doesn't matter — the PCB is ground truth.

## Files
| File | What |
|---|---|
| `Bikera PCB devboard_ROUTED.kicad_pcb` | **The routed board** (your saved board + 1386 tracks + 179 vias). Original `Bikera PCB devboard.kicad_pcb` untouched. |
| `Bikera PCB devboard.kicad_pro` | Net classes re-added (they had been lost): Default/Power/BATT/HighSpeed_RF/USB/Plane + 24 patterns. Default clearance now **0.15 mm**. |
| `Bikera PCB devboard.kicad_dru` | Amended: RF width rule now 0.45–0.95 (opt 0.5), WCSP neck-down exceptions for IC2/U1/U2/U4 courtyards. |
| `routed_top.png` / `routed_bottom.png` | Renders of the routed state. |

**To adopt:** open `..._ROUTED.kicad_pcb`, check it, then Save-As over the main
board file (or rename). Fill zones (B) before DRC.

## What is routed
- GND / +3V3 served by In1/In2 planes: every SMD pad stitched with a via (or
  bridged to a nearby plane-connected point); TH pads connect via zone fill.
- WCSP fan-outs (IC2 charger, U1 buck-boost, U2 GPS LDO, U4 boost): same-net ball
  clusters linked, perimeter escapes + radial flares, all 0.4 mm pitch.
- GPS RF feed (U6 → R28/C50/C49/D3 → AE1) on F.Cu, no vias, 0.5 mm wide.
- USB D+/D− (J1 → U7 ESD), +BATT (0.5 mm), power rails (0.35 mm), most signals.

## ⚠ Deliberate deviations
1. **RF feed is 0.5 mm, not the anchors' 0.9 mm.** A 0.9 mm trace cannot attach to
   the 0402 matching network (pads 0.5 mm wide, 1 mm apart) without gross clearance
   violations — the original 0.9 spec is geometrically unsatisfiable there. At
   ~4 mm total feed length the impedance penalty at 1.575 GHz is negligible for RX.
   The `.kicad_dru` and net class were updated to match.
2. **Default clearance 0.15 mm** (was 0.2). Any 4-layer fab handles this (JLC min
   0.09). Needed to fan out the 0.5 mm QFP and 0.4 mm WCSPs.
3. **IC2 balls E4 (TS) and C2 (CHRG_PG)** exit through ~0.05 mm-clearance squeeze
   corridors between balls — unavoidable on a full-matrix 0.4 mm WCSP without
   microvias. Covered by a dru exception inside the courtyards; **confirm your fab
   accepts it or plan to tweak by hand.**

## ⚠ Still unrouted (~27 nets have a missing link; ratsnest will show them)
Power: +5V, +SYS (2 links), +VBUS, Net-(L2-Pad1/2) (U1↔L2!), Net-(IC2-SW_1) (C7 snubber), Net-(D1-K2)
Charger satellites: CHRG_CE/INT/PG, Net-(IC2-TS) (TH1/R8/R9)
Buses/signals: I2C_SCL/SDA (some branches), SPI1_SCK/MOSI (J7/H3 branches), SD_CS,
GPS_RX, GPS_RESET (1 branch), GPS_EN, EN_5V_SERVO, EPAPER_BUSY, SWO, ACCEL_INT1,
GRN LED, HALL_PIN/HALL_BEUGEL, one GND cap (C15).

These sit in the two densest zones (U3 QFP perimeter, IC2/U1 power cluster). KiCad's
push-and-shove router handles them interactively in a few minutes — or I can
continue programmatically next session.

## Suggested order next
1. Open ROUTED board, **fill zones (B)**, run DRC with the .kicad_dru loaded.
2. Route the ratsnest leftovers (push-and-shove, 0.15 clearance).
3. Re-check the two IC2 squeeze corridors and the RF feed width decision.
4. Hall sensors IC1/IC3 are still edge placeholders — you said route anyway;
   re-route their two nets if you move them.
