# Bikera — Footprint Files Explained (Prototype Build)

**Companion to `01_library_audit.md`.** That doc said *what* to fetch and *what* to draw. This doc explains the **contents** of the actual `.kicad_mod` and `.kicad_sym` files for every non-stock part on the prototype board — what's inside them, what the dimensions mean, how to spot-check them before fab, and what to do when verification fails.

The order below matches the audit's section numbering, but skips sections that are stock-only (1 MCU passives, 3 LoRa antenna FPC-off-board, 4 BLE antenna FPC-off-board, 13 servo, 14 LED, 17 passives roll-up).

## Repository convention

```
hardware/kicad/
├── bikera.kicad_pro
├── bikera.kicad_sch
├── bikera.kicad_pcb
├── custom_lib/
│   ├── bikera_custom.kicad_sym           ← custom symbols (ePaper, LIS2DW12, SD module)
│   └── BikeraCustom.pretty/              ← (empty for prototype — no custom footprints needed)
├── third_party_lib/
│   ├── rakwireless/                      ← official RAK lib (RAK11720)
│   ├── snapeda/                          ← per-part subdirs
│   │   ├── BQ25630YBGR/
│   │   ├── LC76GPAMD/
│   │   ├── RT6150B/
│   │   ├── TCR3UG33A/
│   │   ├── TPS61253F/
│   │   ├── FM24V01A-GTR/
│   │   ├── DRV5032DULPGM/
│   │   ├── USBLC6-2SC6/
│   │   └── GCT_USB4105-GF-A-060/
│   ├── ultralibrarian/
│   │   └── LC76GPAMD/                    ← alternate source for verification
│   ├── coilcraft/                        ← official Coilcraft inductor lib
│   ├── hirose/                           ← U.FL receptacle
│   └── kyocera_avx/                      ← card edge connector
├── 3d/
│   ├── RAK11720.step
│   ├── LC76GPAMD.step
│   ├── BQ25630YBGR.step
│   ├── 009159010603906.step
│   └── ...
└── datasheets/                           ← keep alongside the libs
    ├── STM32L431CC_rev7.pdf
    ├── RAK11720_datasheet_rev1.7.pdf
    ├── LC76G_hardware_design_rev1.pdf
    ├── BQ25630_datasheet.pdf
    ├── RT6150B_datasheet.pdf
    ├── TCR3UG33A_datasheet.pdf
    ├── TPS61253F_datasheet.pdf
    ├── FM24V01A_datasheet.pdf
    ├── ATECC608B_summary.pdf
    ├── DRV5032_datasheet.pdf
    └── UM2910_STLINK_V3MINIE.pdf
```

**Why colocate datasheets:** when you're verifying a footprint two months from now and the SnapEDA page has been updated, you want the exact datasheet revision the original footprint was drawn from. The KiCAD library lives or dies on whether its dimensions match what the manufacturer is currently shipping.

## How to load these libraries in KiCAD 9

1. **Preferences → Manage Symbol Libraries → Project Specific**
   - Add row: nickname `bikera_custom`, path `${KIPRJMOD}/hardware/kicad/custom_lib/bikera_custom.kicad_sym`
   - Add one row per third-party `.kicad_sym` (e.g. `rakwireless`, `snapeda_bq25630`, etc.)
2. **Preferences → Manage Footprint Libraries → Project Specific**
   - Add row: nickname `BikeraCustom`, path `${KIPRJMOD}/hardware/kicad/custom_lib/BikeraCustom.pretty`
   - Add one row per third-party `.pretty` folder
3. **3D model paths** reference `${KIPRJMOD}/hardware/kicad/3d/<file>.step` so the project is portable across team machines.

---

## Section 2 — RAK11720 (LoRa + BLE module, MHF4 variant)

**Source preference:** RAKwireless official KiCAD library at `https://downloads.rakwireless.com/3D_File/WisDuo/` — same page hosts the 3D STEP. SnapEDA is the fallback.

### What's inside the symbol

The RAK11720 MHF4 variant has ~30 pins exposed on its castellated edge. **Critically, the two RF nets do NOT appear as routable pins** on the MHF4 variant — they are pre-routed inside the module to the two MHF4 connector jacks. The pins you wire on your PCB are:

- Power: VBAT (typ. 3.3 V), VDD_IO, multiple GND pins
- UART0: TXD, RXD (for AT commands to host MCU)
- Optional UART1
- Reset (NRESET), BOOT pin
- GPIO breakouts (some unused)
- I²C, SPI optional breakouts
- Status pins (LED outputs from module's internal logic)

**Pin type assignments in the symbol matter for ERC.** Power pins must be `power_in`; the unused module pins are `passive` or `not_connected`. Leave the GPIOs that you don't use as `passive` and tie them to the `~/NC` marker in the schematic so ERC doesn't warn.

### What's inside the footprint

A castellated half-hole pattern around three sides of a ~15.0 × 23.5 mm module body:

- Castellated pads ~0.6 mm wide × ~1.2 mm long, on roughly 1.1 mm pitch on two of the sides
- Body silkscreen outline + pin 1 dot
- An under-module copper keepout — the RAK11720 MHF4 variant has the MHF4 jacks on the top side and a ground reference on the bottom side, so the keepout under the module is for the antenna routing **inside the module**, not for your traces. You can place stitching vias under the module but NOT signal traces
- Two MHF4 connector body locations marked on F.Fab for clearance reference (where the antenna pigtails will exit)
- 3D STEP reference matching the module + MHF4 connectors

### Verification checklist

1. **Print the footprint at 1:1** (F.Cu + Edge.Cuts + F.SilkS + F.Fab). KiCAD: File → Plot → PDF, scale 1. Lay an actual RAK11720 module on it. Pads should align ±0.05 mm with the module's half-holes.
2. **Verify the MHF4 jack positions** — your enclosure design must allow the antenna pigtails to exit cleanly. The MHF4 jacks sit at specific Y positions on the module; the antenna cables exit perpendicular to the module's long axis.
3. **Check the under-module keepout extent.** The RAK11720 datasheet sec. 6 specifies it. Get this wrong and your stitching vias short the module's internal ground plane to your traces.

### If verification fails

- Pad positions off by <0.1 mm → acceptable for prototype, document and proceed
- Pad positions off by 0.1–0.3 mm → assembly will be painful; consider re-fabbing
- Wrong RF pad/MHF4 position → this matters less than for the RF-pinout variant because the RF doesn't leave the module via PCB traces. Cosmetic if your enclosure has space

---

## Section 5 — ATECC608B-SSHDA-T (ECC secure element, SOIC-8)

**Source preference:** KiCAD 9.x stock library (`Security_IC` or similar). SnapEDA as backup if you want the 608B-specific symbol metadata.

### What's inside the symbol

8 pins:
1. NC (sometimes — verify with datasheet)
2. NC
3. NC
4. GND
5. SDA
6. SCL
7. NC
8. VCC

The ATECC608B has 8 physical pins but only 4 are functional (VCC, GND, SDA, SCL). Pin 1 marker placement matters for soldering orientation.

### What's inside the footprint

Standard 8-SOIC, 1.27 mm pitch, 3.9 × 4.9 mm body — KiCAD stock `Package_SO:SOIC-8_3.9x4.9mm_P1.27mm`. Pin 1 indicator dot on F.SilkS at the upper-left corner (datasheet convention).

### Verification

Stock SOIC-8. Already verified by millions of designs. The only watch-out is pin 1 orientation in your placement.

### If using a SOIC-8 ZIF socket for prototype

The socket's footprint is **not** stock SOIC-8 — sockets have through-holes at the corners for retention, and the pin pads are slightly wider to accept the socket's pins. Download the specific socket's footprint from the supplier (Aliexpress sockets vary in dimensions — check before locking).

**Recommendation:** skip the socket. Solder bare chips. A SOIC-8 reflow joint takes 30 seconds with a hot-air station; the socket adds €5 and 4 mm of vertical height for no real prototype benefit.

---

## Section 6 — Quectel LC76GPAMD (GPS module)

**Source preference:** Ultra Librarian or SnapEDA both work well.

### What's inside the symbol

11 pins (LC76G "AMD" pinout):
- Power: VDD (3.3 V), VBACKUP (RTC + ephemeris backup), GND
- UART: TXD, RXD (default; optional I²C/SPI mode pins via reconfiguration)
- 1PPS output (precision timing pulse, 1 Hz)
- RESET_N
- ANT (RF input, single-ended 50 Ω from the U.FL receptacle)
- A few status/optional pins (JAM_IND, 3D_FIX, GEOFENCE per architecture sheet)

**Pin numbering** must match the LC76G Hardware Design doc rev 1.x sec. 3.1 *exactly*. The "AMD" suffix in the part number indicates a specific pin map — there's also "GAMD" and "BAMD" variants with different pin layouts. **The BOM specifies "LC76GPAMD" — make sure SnapEDA / Ultra Librarian show that exact suffix.**

### What's inside the footprint

Half-hole castellated module, ~10.1 × 9.7 mm body, 11 castellated pads on three sides:
- Pad dimensions: castellations ~1.1 × 0.6 mm on 1.5 mm pitch (verify against datasheet sec. 7.2)
- Mandatory **under-module copper keepout** — Quectel specifies a ground keepout under the antenna feed area to prevent interference with the internal LNA path. **Do not place vias or signal tracks under this keepout.** A solid ground plane is OK and required for the antenna's RF performance
- Body silkscreen + pin 1 mark
- 3D STEP referencing the module case

### Verification checklist

1. **Print 1:1 and lay an actual LC76GPAMD on it.** Castellations should engage the pads cleanly.
2. **Check pin 1 corresponds to VDD** (or whatever the datasheet says — confirm against Quectel hardware design doc fig. 6). SnapEDA occasionally has pin 1 marked on the wrong corner.
3. **Confirm the keepout zone is on the right layer set.** It should include B.Cu (back copper) to prevent ground-stitching vias from clipping into the area. Open the .kicad_mod, find the keepout zone, verify its layer list.

---

## Section 7 — U.FL / IPEX-1 receptacle (GPS antenna connector)

**Source preference:** SnapEDA (Hirose U.FL-R-SMT-1) or KiCAD stock `Connector_Coaxial:U.FL`.

### What's inside the symbol

2 pins:
1. Signal (RF)
2. GND (shield)

Trivial symbol. The complexity is in the footprint, not the symbol.

### What's inside the footprint

The U.FL is a vertical mate (the antenna cable plugs straight down onto the receptacle). The footprint has:
- 1× signal pad, ~0.6 × 1.0 mm
- 2× GND pads (or one large U-shape) around the signal pad
- 2× mechanical retention pads (sometimes — depends on the specific receptacle variant)
- Body silkscreen showing the receptacle's ~3 × 2.6 × 1.25 mm body outline
- **No keepout under the receptacle** — the receptacle's mating face is on top, ground is on bottom

### Verification

The Hirose U.FL is one of the most-built footprints in existence — SnapEDA or KiCAD stock are reliable. The watch-out is the **trace impedance approaching the receptacle**:
- The signal pad needs a controlled 50 Ω trace
- The GND pads need solid ground connection
- The trace transition from your routing to the pad should not introduce impedance discontinuity (no sudden width changes within 5× the trace width of the pad)

This is a layout concern, not a footprint concern — covered in `04_pcb_layout_guide.md`.

---

## Section 8 — ePaper 8-pin JST PH connector (custom symbol, stock footprint)

### What's inside the symbol

`bikera_custom:EPAPER_HEADER` — 8 pins labelled with the Waveshare 1.54" e-Paper module's pinout:

| Pin | Function | Net (suggested) |
|---|---|---|
| 1 | VCC (3.3 V) | +3V3 |
| 2 | GND | GND |
| 3 | DIN (MOSI) | SPI_MOSI |
| 4 | CLK (SCK) | SPI_SCK |
| 5 | CS | EPAPER_CS |
| 6 | DC (Data/Command select) | EPAPER_DC |
| 7 | RST | EPAPER_RST |
| 8 | BUSY | EPAPER_BUSY |

Verify pinout against the Waveshare wiki page for the 1.54" e-Paper Module before committing — there are revisions of the module (V1, V2) with different pinouts at pin 8 in particular.

### What's inside the footprint

Stock KiCAD: `Connector_JST:JST_PH_B8B-PH-K_1x08_P2.00mm_Vertical`. Already verified.

The Notes/Symbols and footprints.md file lists three other JST PH 8-pin variants:
- `JST_PH_S8B-PH-K_1x08_P2.00mm_Horizontal` — horizontal mate
- `JST_PH_S8B-PH-SM4-TB_1x08-1MP_P2.00mm_Horizontal` — SMD horizontal
- `JST_PH_B8B-PH-SM4-TB_1x08-1MP_P2.00mm_Vertical` — SMD vertical

For the prototype with a typical ePaper module location (recessed inside the lock enclosure), **vertical THT is fine** — the cable bends 90° to exit the enclosure. If your enclosure is shallow, switch to horizontal so the cable exits sideways. Both have stock footprints.

### Cable adaptation

The Waveshare module ships with a JST PH cable terminating in 8 individual Dupont female connectors (per `Notes/Symbols and footprints.md`). Two options:

1. **Re-crimp the cable into a JST PH 8-pin male housing** — buy JST PH crimps + housing (Aliexpress, ~€2). Allows the cable to mate with `JST_PH_B8B-PH-K_1x08`. Vibration-resistant.
2. **Use 8× 2.54 mm pin headers on PCB** — `PinHeader_1x08_P2.54mm_Vertical` (×1 or ×8 individual). Dupont connectors plug directly. Cheaper, faster to prototype, but **not vibration-resistant** — Dupont connectors loosen under shock.

`Bikera.xlsx` doesn't enforce a choice. Pick one and document in the assembly drawing. **Recommendation: re-crimp.**

### Verification

The JST PH footprint is stock. Only verify:
- Cable polarity (which pin is pin 1) — JST PH housings are polarised but the **wire colour mapping** is up to the crimper. Document which colour goes to which signal in your assembly notes.

---

## Section 9 — LIS2DW12 breakout module headers (custom symbol, stock footprint)

### What's inside the symbol

`bikera_custom:LIS2DW12_MODULE` — two 1×4 connector symbols grouped under one component reference, with these pin assignments per the typical Tinytronics LIS2DW12 module:

**Header A (typically the "I²C/power" header):**
1. VCC (3.3 V)
2. GND
3. SDA
4. SCL

**Header B (typically the "interrupt/SPI" header):**
1. INT1
2. INT2
3. SDO/SA0 (I²C address select)
4. CS (tie high for I²C mode)

**Critical:** Tinytronics has shipped LIS2DW12 modules from multiple sources (DFRobot Fermion DFR0904, generic clones, occasional Sparkfun). **Each has a different pinout.** Open the actual product page for the exact SKU you're buying and verify pin order before locking the symbol's pin assignments. Getting the I²C lines swapped between two adjacent headers is one of those bugs you only catch after first flash.

### What's inside the footprint

Two 4-pin stock female header footprints (`Connector_PinHeader_2.54mm:PinHeader_1x04_P2.54mm_Vertical`) placed at the module's mounting-hole spacing. The DFR0904 module has its two header rows 12.7 mm apart — **measure with calipers on the actual board** before locking.

**Mounting-hole footprints** (optional but recommended): two M2.5 NPTH (non-plated through holes) at the module's corner mounting points so the breakout doesn't flap around under vibration.

### Verification

Measure the actual breakout with calipers. Specifically:
- Header-to-header centre-to-centre distance
- Pin-to-pin pitch within each header (always 2.54 mm but confirm)
- Pin 1 orientation marker (which corner)
- Mounting-hole positions if you're adding NPTHs

If the actual module differs from what you draw, edit the placement of the two header footprints in the PCB editor — the symbol doesn't change.

---

## Section 10 — SD adapter module header (custom symbol, stock footprint)

### What's inside the symbol

`bikera_custom:SD_ADAPTER_MODULE` — single 2×8 connector symbol with paired pins (per `Notes/Symbols and footprints.md` "SD-kaart PinHeader_2x08 footprint: pinnen aanpassen (in paren)"). Half the pins are duplicates of the other half — useful as a strain-relief / redundancy feature on the module.

**Typical Tinytronics SD module pinout** (verify per actual SKU):

| Pair | Function | Net |
|---|---|---|
| 1, 2 | GND | GND |
| 3, 4 | VCC (3.3 V or 5 V) | +3V3 |
| 5, 6 | MISO | SPI_MISO |
| 7, 8 | MOSI | SPI_MOSI |
| 9, 10 | SCK | SPI_SCK |
| 11, 12 | CS | SD_CS |
| 13, 14 | (sometimes "CD" card detect, sometimes NC) | SD_CD or NC |
| 15, 16 | (varies) | varies |

### What's inside the footprint

Stock `Connector_PinHeader_2.54mm:PinHeader_2x08_P2.54mm_Vertical` (or `_Horizontal` if the module mounts sideways). 16 pins total.

### Verification

Measure with calipers, confirm pin pairing convention. **The pairing matters for the firmware too** — you can short-jumper a paired pair together at the breakout side to halve the wire count if dev tooling needs it.

---

## Section 11 — FM24V01A-GTR (FRAM, SOIC-8)

Stock `Package_SO:SOIC-8_3.9x4.9mm_P1.27mm`. SnapEDA symbol pull only. No footprint verification needed beyond pin 1 orientation check at placement time.

---

## Section 12a — BQ25630YBGR (charger, DSBGA)

**The hardest footprint on the board.** DSBGA = die-size ball-grid array. Per **TI datasheet SLUSFN0A (verified)**: **30 balls** arranged 6 rows (A–F) × 5 columns (1–5) at 0.4 mm pitch under a **2.3 × 2.4 mm body**. (Earlier drafts of this guide said 25 balls 5×5 in a 2.5 × 2.5 body — that was wrong; the YBG variant is 30 balls.)

### What's inside the symbol (30 pins, grouped by function, per TI datasheet Table 6-1)

- **Power input:** VBUS (A1, B1), PMID (A2, B2)
- **Switching node:** SW (A3, B3, C3) — the inductor's switching node, high-dV/dt
- **Power ground:** PGND (A4, B4, C4)
- **Gate-drive supply:** REGN (A5) — needs 4.7 µF 10V cap
- **High-side bootstrap:** BTST (B5) — needs 47 nF cap to SW
- **Charge enable:** CE (C1)
- **Open-drain status:** PG (C2), INT (C5)
- **System rail output:** SYS (D1, D2, D3)
- **Wake/reset button input:** QON (D4)
- **I²C clock:** SCL (D5)
- **Battery pack +:** BAT (E1, E2, E3)
- **Thermistor:** TS (E4)
- **I²C data:** SDA (E5)
- **Battery Kelvin sense:** BATP (F1)
- **USB BC1.2 data lines:** D+ (F2), D- (F3) — leave NC, USB-C data goes to CP2102N
- **USB-C config channels:** CC1 (F4), CC2 (F5)

### What's inside the footprint

- 30× SMD pads (1 per ball), round, on 0.4 mm pitch in 6×5 grid
- F.Mask openings sized per TI datasheet sec. 12 (Mechanical, Packaging, and Orderable Information) — SMD (solder-mask defined) or NSMD (non-solder-mask defined). **The datasheet tells you which.** Get this wrong and your first reflow either won't wet the balls or will short adjacent balls
- No silkscreen on the pads themselves (mask openings are too small for silkscreen registration)
- Body outline marking + ball A1 indicator on F.SilkS — A1 is the **upper-left** corner of the 6×5 grid in TI's orientation diagram

### Verification checklist (this is the one that matters most)

1. **Open `datasheets/BQ25630_datasheet.pdf`, find the package mechanical drawing (sec. 12).** Confirm:
   - Pitch is 0.4 mm
   - 30 balls in 6×5 grid, NOT 25 in 5×5 — if your symbol or footprint shows 25 you have a wrong variant
   - Body dimensions 2.3 mm × 2.4 mm
   - Ball diameter (typically 0.25 mm)
   - Pad type (SMD vs NSMD) matches what the footprint has
2. **Print the recommended PCB layout from the datasheet at 1:1.** Print your footprint at 1:1. Overlay them on a backlit window. They should match.
3. **Check stencil aperture sizing.** For 0.4 mm pitch BGA your stencil is typically 0.1–0.125 mm thick with 1:1 apertures. The footprint .kicad_mod should generate F.Paste openings that match the pads. **Look at F.Paste in the footprint editor.**
4. **Check the routing layer assumptions.** BGAs require fan-out vias for inner balls. The TI EVM gerbers show one routing approach; copy it. **If your board is 2 layers you cannot fan out inner balls.** TI's BQ25630EVM uses a 4-layer board. Plan PCB stackup accordingly (see `04_pcb_layout_guide.md`).

### If verification fails

The BQ25630 is the part most likely to need a board respin. Mitigations:
- **Buy a TI EVM** (~$60) and confirm the chip works at all, before betting your custom layout on it
- **Reflow with a hot plate**, not hot air — air at any reasonable flow moves 0.25 mm balls around. The Bikera project explicitly mentions sourcing a reflow hot plate
- **Have a backup charger** with an easier package on a parallel BOM line. The BQ25895RTWR (QFN) was deselected in `Bikera.xlsx` for lacking USB-C detection, but if BGA-reflow proves impossible it's the escape hatch — accept manual USB-C handling

---

## Section 12b — RT6150B (3.3 V buck-boost, WDFN-10L)

**Source preference:** SnapEDA.

### What's inside the symbol

10 pins + thermal pad, **per Richtek datasheet DS6150A/B-04 (verified)**:
- Pin 1: VOUT (output, connect to output cap)
- Pin 2: LX2 (second switch node, connects to inductor)
- Pin 3: GND
- Pin 4: LX1 (first switch node, connects to inductor)
- Pin 5: VIN (power input, ≥10 µF cap to GND)
- Pin 6: EN (enable, active high)
- Pin 7: PS (PSM control — **low = PSM mode, high = forced PWM**)
- Pin 8: VINA (analog supply for control circuit; tie to VIN directly per typical app)
- Pin 9: GND
- Pin 10: FB (feedback for external resistor divider)
- Pin 11 / Exposed Pad: GND (thermal — solder to ground plane)

Earlier draft of this guide had pins out of order (had VIN at pin 1, EN at pin 2 — wrong). **Verify by opening the SnapEDA-imported symbol and cross-checking against the datasheet pin diagram before placing on the schematic.**

### What's inside the footprint

WDFN-10L 2.5 × 2.5 mm body, 0.5 mm pitch with a thermal pad (per datasheet "Outline Dimension" section, "W-Type 10L DFN 2.5×2.5 Package"):
- 10× side pads (pad b = 0.20–0.30 mm wide)
- 1× centre thermal pad — datasheet D2 dimension on the 2.5×2.5 variant
- F.Mask opening on thermal pad sized to ~80% of pad area
- 4× sub-apertures on F.Paste (a 2×2 paste grid on the thermal pad to prevent solder float)

### Verification

1. **Confirm pin order matches the verified table above.** Mistakes in SnapEDA-imported symbols are not uncommon.
2. **Confirm thermal pad dimensions** against Richtek datasheet — getting this wrong leaves the chip thermally floating, and at 800 mA output it WILL heat up (θJA = 40.9 °C/W on the 2.5×2.5 variant)
3. **Confirm paste sub-apertures exist on F.Paste** — a single rectangular paste opening on a thermal pad will cause the part to tombstone or float
4. **Print 1:1 and overlay with datasheet "Layout Considerations" recommended PCB layout** — the layout figure shows input/output cap and inductor placement; mirror that placement on your PCB

---

## Section 12c — TCR3UG33A,LF (3.3 V LDO, WCSP4F)

### What's inside the footprint

4 bumps on 0.4 mm pitch in a 2 × 2 grid, body 0.94 × 0.94 mm. Tiny — you can't reasonably hand-solder this.

- 4× round SMD pads, ~0.25 mm
- F.SilkS body outline only (silkscreen this small is illegible anyway; keep the ball-1 marker outside the body)

### Verification

1. Print at scale 5:1 (because 1:1 is unreadable) and confirm pitch + bump diameter match Toshiba datasheet fig. 9-2
2. Confirm pad layout matches the LDO's pin map (1=Vin, 2=GND, 3=Vout, 4=Control). Wafer-level CSP doesn't have a marked pin 1 on the package — you locate by die orientation under microscope. The footprint's pin 1 indicator on F.SilkS must match the die's actual pin 1 position when oriented correctly

---

## Section 12d — TPS61253F (5 V boost, DSBGA-9)

### What's inside the footprint

9 bumps in a 3 × 3 grid at 0.4 mm pitch, 1.235 × 1.235 mm body. Same construction principles as Section 12c but bigger.

- 9× round SMD pads
- F.Mask openings per TI datasheet sec. 9.1
- F.SilkS body outline + ball A1 marker

### Verification

Same as TCR3UG33A — 5:1 print + datasheet overlay.

### Inductor selection

The TPS61253F needs ~1 µH, 4.5 A saturation per the BOM Opmerking. Coilcraft XAL4030-102 or XAL5030-102 fit. Pull the Coilcraft KiCAD lib and pick a specific part — its footprint includes the side-fillet pad shape which is non-trivial.

---

## Section 15 — DRV5032DULPGM (Hall sensor, TO-92)

**Source preference:** SnapEDA. The Mouser CAD download for this exact suffix is also good.

### What's inside the symbol

3 pins:
1. VCC
2. GND
3. OUT

The DRV5032 family symbol on SnapEDA is well-built. The "DULPGM" suffix means:
- DU: 50 mT typical detect threshold (unipolar Z-pole / S-pole)
- L: low-power mode (~1.8 µA average per architecture sheet)
- PGM: TO-92 package (per architecture sheet)

### What's inside the footprint

Standard TO-92 3-lead THT footprint:
- 3× through-hole pads in a triangular pattern, 1.27 mm pitch typical
- Pad drill ~0.8 mm, annular ring ~1.6 mm
- Body silkscreen showing the flat side of the TO-92 case (so you know which way to insert)

### Verification

TO-92 footprint is extremely standard. Verify only:
- Lead pitch matches TI datasheet (usually 1.27 mm but verify for the specific package suffix)
- Lead bend allowance — TO-92 leads can be straight or pre-bent. If you bend them for mechanical fit, you may need more space on the board for the body

### Two-sensor placement note

The prototype uses **two identical DRV5032DULPGM** sensors (per architecture sheet's "Hall effect sensor" row). Both detect the south pole. Place them on the schematic as U10 and U11; on the PCB, place them physically at the locations corresponding to the lock's beugel (shackle) and pin positions per the mechanical design.

> **Anti-tamper note for the production design:** the `Keuze finaal` selection switches to one N-pole-detecting sensor and one S-pole-detecting sensor (SL1613SH + SL1623SH) so an attacker can't fool the lock by flipping a single magnet over. **The prototype does not have this anti-tamper feature** — don't market the prototype as tamper-resistant.

---

## Section 16 — KYOCERA-AVX 009159010603906 (ST-link BTB card edge connector)

**Source preference:** Mouser CAD download for the exact part number.

### What's inside the symbol

10 pins arranged in a 2×5 (dual row) connector symbol. Per STLINK-V3MINIE UM2910 Table 3 "Pads on board to CN2 BTB card edge connector":

| Pin | Function | Net (suggested) |
|---|---|---|
| 1 | T_VCC (sense) | +3V3 (from target) |
| 2 | GND | GND |
| 3 | T_JTCK/SWCLK | SWCLK |
| 4 | T_JTMS/SWDIO | SWDIO |
| 5 | T_JTDO/SWO | SWO |
| 6 | T_NRST | NRST |
| 7 | T_RX (target receives, ST-link transmits) | DEBUG_RX |
| 8 | T_TX (target transmits, ST-link receives) | DEBUG_TX |
| 9 | GND | GND |
| 10 | (NC or extra) | NC |

**Verify against UM2910 Table 3** — pin assignments differ between the BTB option and the STDC14 cable option, even though both expose the same 14 signals on the ST-link side.

### What's inside the footprint

This is **NOT a through-hole or surface-mount connector** in the normal sense. It's a **card edge connector** — the STLINK-V3MINIE PCB itself has gold-plated fingers along one edge, and the AVX connector grips those fingers. So the footprint on YOUR PCB needs:

- The AVX connector's body footprint (the connector solders onto your PCB)
- **Card-edge gold finger area** on the STLINK-V3MINIE side — NOT on your board
- 10× SMT pads where the AVX connector's pins solder to your board
- Through-hole(s) or SMT anchor pad(s) for mechanical retention of the AVX body
- Polarisation key — the AVX connector is polarised so the STLINK-V3MINIE can only be inserted one way

The AVX vendor library handles all of this automatically. Just place the footprint and rotate as needed.

### Verification

1. **Confirm the pad pattern matches the AVX 009159010603906 datasheet** — KYOCERA-AVX's CAD page provides recommended PCB layout figures
2. **Confirm the polarisation key faces the correct way** for your enclosure — you want the STLINK-V3MINIE to enter from a side that's accessible during debug, not from inside a tight enclosure
3. **Confirm clearance** for the STLINK-V3MINIE body to physically plug in — the probe is 15 × 42 mm and protrudes when mated

### Alternative

If the BTB card edge connector proves hard to source or hand-solder, fall back to **STDC14 ribbon** (stock KiCAD footprint `Connector_PinHeader_1.27mm:PinHeader_2x07_P1.27mm_Vertical_SMD`). The STLINK-V3MINIE supports both methods — you choose between them at PCB design time, not at probe purchase time.

---

## Section 17 — CP2102N UART-to-USB bridge (QFN-24)

**Source preference:** SnapEDA (Silicon Labs publishes the part there). Mouser CAD download is also clean.

### What's inside the symbol

24 pins. Most are NC or set-and-forget; the ones you actually wire:
- VDD (×2 — one for IO supply, one for regulator), VREGIN, VBUS, VIO, GNDs
- D+, D− (USB transceiver pins, internally biased)
- TXD, RXD (UART to MCU)
- RTS, CTS, DTR, DSR (optional flow control / Arduino-style reset)
- SUSPEND, SUSPEND# (USB suspend status outputs — useful as MCU wake-up triggers)
- RST# (chip reset — pull high via 10 kΩ or tie to a button)

The CP2102N's GPIO pins (GPIO.0 to GPIO.3) overlap with the flow-control pins — pick one role per pin during configuration. For prototype: use TXD/RXD only, leave the rest NC.

### What's inside the footprint

Standard QFN-24, 4 × 4 mm body, 0.5 mm pitch + a thermal pad in the centre:
- 24× side pads ~0.25 × 0.5 mm
- 1× thermal pad ~2.5 × 2.5 mm (per Silicon Labs datasheet sec. 9, fig. 9.1)
- F.Mask opening on thermal pad sized to ~80% of pad area (or per datasheet)
- 4–9× sub-apertures on F.Paste (a 2×2 or 3×3 paste grid on the thermal pad to prevent solder float)

### Verification

1. Print the footprint at 1:1 and compare against Silicon Labs datasheet sec. 9 (package drawing)
2. Confirm thermal pad dimensions — the thermal pad must connect to GND on the PCB through multiple vias (≥4) for thermal relief and electrical ground reference
3. Confirm paste sub-apertures — single big paste opening on the thermal pad causes the chip to tombstone or float

### USB signal integrity

The CP2102N D+ and D− pads receive USB Full Speed (12 Mbit/s) signals. Routing rules:
- Differential pair routed together, matched length within 1 mm
- 90 Ω differential impedance — for 4-layer board with ~0.2 mm dielectric, traces ~0.4 mm wide with 0.2 mm gap
- No vias if avoidable; if necessary, both members of the pair via together
- Ground reference on the adjacent layer (L2 plane on this board) must be solid under the USB trace pair

This is the second RF-ish trace on the board (after the GPS U.FL). The CP2102N is more forgiving than the GPS because USB Full Speed timing has more margin than GPS antenna sensitivity, but treat both with care.

## Verification methodology (universal)

For every non-stock footprint on the board, before sending to fab, run this checklist:

1. **Print the footprint at 1:1** (F.Cu + F.SilkS + Edge.Cuts). KiCAD: File → Plot → PDF, scale 1.
2. **Compare to the datasheet's recommended PCB layout** by laying both on a backlit window or overlaying in a PDF editor.
3. **Physically check against the real part** when it arrives — DSBGA you can't do this for, but most parts you can.
4. **Run `Footprint Editor → Check Footprint`** in KiCAD. This flags missing pin 1 markers, off-grid pads, courtyard violations.
5. **Run DRC on the full board** before fab. DRC catches inter-component issues the per-footprint check won't.

## When verification fails

Cheap fixes (edit and re-fab nothing):
- Pad offsets <0.1 mm → adjust in `.kicad_mod` text editor and proceed; the assembly process tolerates this.
- Silkscreen registration off → cosmetic, ignore for prototype.

Expensive fixes (board respin):
- Pad pitch wrong → respin.
- Pad layout (rotated, mirrored) wrong → respin.
- BGA fan-out impossible on chosen stackup → respin.

The BQ25630YBGR DSBGA is the single highest respin-risk on this board. The MHF4 antenna positioning is the second-highest (mechanical clearance, not electrical). Build a partial board (power section only) and verify the BQ25630 works before fully populating.

## What to do next

This document and `01_library_audit.md` are static reference. The next two docs walk through the active process:

- **`03_schematic_capture_guide.md`** — order of capture, sheet hierarchy, net naming, around-the-IC passive values, ERC settings
- **`04_pcb_layout_guide.md`** — stackup, placement priorities, U.FL trace routing, ground-plane strategy, DRC rules, manufacturing prep
