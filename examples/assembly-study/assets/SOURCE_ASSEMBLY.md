# Assemble one RevC fidget counter

These steps describe **V1, the premade-ring base**. For the new individual-magnet base, first follow the separate [V2 carrier/polarity assembly steps](mechanical/variants/V2_discrete_magnets/README.md), then reuse the unchanged PCB, cell, bearing and cap steps here. V2 requires its own base and carrier, not the V1 ring seat.

Use the current RevC CR2450 PCB, Stationary_Base and one matching Cap. This is the rotation-only, two-print push-fit pilot. Its current compact cap gives16.4mm overall phone-contact height. The base and bearing/encoder interfaces match the preceding push-fit pilot. It has no cap button, spring, top screw, nut or separate bearing retainer.

![Actual assembled, cutaway and exploded CAD](previews/bearing-layout.png)

## 1. Lay out parts and tools

| Part | Per unit |
| --- | ---: |
| Printed Stationary_Base | 1 |
| Printed Cap, one chosen style | 1 |
| Assembled RevC PCBA, including soldered C7525448 CR2450 holder and five-pin JST-SH header | 1 |
| 6808-ZZ/61808-2Z bearing,40×52×7mm | 1 |
| M2×4mm nylon PCB screw, head no larger thanØ3.8×1.3mm | 2 |
| CR2450 primary3V cell,24.5×5mm | 1 |
| Supplier-specific magnetic ring,OD54×ID45.8×1.9mm | 1 |
| Diametrically magnetized encoder disc,Ø5×1.5mm | 1 |

Have the correct screw driver, calipers, print-cleanup tools, a qualified PETG/magnet adhesive, a multimeter, the five-way straight-through JST-SH cable and a SWD programmer. Adhesive and reusable tools are not unit parts. The bearing internals shown in the CAD are representative.

## 2. Qualify the print fit first

Print the ten bearing-fit coupons, then the base and one circular cap, following [PRINTING.md](mechanical/printing/PRINTING.md). The provisional process is PETG,0.4mm nozzle,0.15mm layers, four walls and the listed support/orientation settings. Re-slice for the actual printer.

Remove support remnants from both bearing seats, the base ring pocket and the encoder pocket. Clean loose plastic from screw pilots. Measure the actual bearing and both fits. The nominal shaftØ40.05 and cap boreØ51.95 intentionally give0.05mm diametral interference; a printer may not reproduce that fit.

Dry-test with light hand pressure only. Stop if loose, tight, distorted or rubbing a shield. Recalibrate the interface rather than scaling the entire part. Do not hammer, use a vise to force the assembled cap, or transfer pressing force through the bearing balls. Keep chips and adhesive out of the bearing.

**This joint has no positive axial lock.** Before a batch, measure seating and pull-off forces with the chosen bearing and printer, including repeated service and PETG creep. No retention-force limit or screw torque has yet been physically qualified.

## 3. Bond the two magnet assemblies

Check the purchased ring's dimensions and its working face against the phone/case. Dry-fit it in the underside annular seat. Bond with the qualified adhesive and nominal0.10mm bondline; keep the ring flat, fully seated and clear of the rim. The alternate1.0mm ring is not a drop-in substitute for this1.9mm seat.

Seat the Ø5×1.5mm **diametric** encoder magnet in the cap against its integral stop. Apply adhesive to the sidewall only. Do not put a glue layer beneath the magnet; that changes the sensor gap. An ordinary axially magnetized disc will not provide the intended XY rotation signal.

Program the boards in step4 while the bonds cure. Let both bonds cure fully according to the selected adhesive's instructions before fitting or loading the magnets. No adhesive has yet been qualified for this PETG/magnet coating. Keep magnet debris away from the bearing and electronics.

## 4. Prepare and program the PCBA

Inspect the board for solder bridges, damaged components and a properly attached holder/header. Confirm BT1 is the complete C7525448 holder on the bottom side and its positive contact agrees with the board polarity. The loose coin cell is fitted later.

Keep the **CR2450 out**. Use the [firmware build/artifact instructions](firmware/README.md) and [programming guide](PROGRAMMING.md). Set the linked programmer to3V3 with all cables unpowered, verify straight-through contact continuity, then confirm the supplied voltage. Never select5V.

Program the complete RevC HEX and require a successful write **and verify** result. The flash script checks nRF52810 identity before writing. A generic DK image is unsuitable: this board has no LED/button/UART and uses different I2C pins.

With the board still powered from the programmer, scan for Fidget Counter in Nordic nRF Connect or the supplied desktop client and read its status. A sensor-fault flag is expected while the bonded cap magnet is away from the board. Complete the magnetic/count tests after fitting the cap in step7.

Power off and disconnect the programming cable before fitting the battery.

## 5. Fit the battery and board

Insert the CR2450 into the holder with polarity confirmed from the holder drawing and board markings. Use no rechargeable LIR2450 substitute. Check that the cell is captured, its contacts are not deformed and no exposed conductor bridges its terminals.

With the base on the phone-contact face, lower the PCBA/holder/cell through the hollow fixed shaft. Align the antenna toward the corresponding CAD orientation and all four board holes with the four posts. The cell/holder must clear the floor without force. The nominal cell/floor clearance is0.5mm; confirm it on the real unit.

Fit the **two opposite M2×4 nylon screws** at the45° and225° mounting positions, matching the [cutaway](previews/bearing-layout.png). Leave the other two holes/posts unscrewed. Do not add metal washers, longer screws or larger heads. Tighten only until the PCB seats flat; stop if a post strips or the board bends. Set a repeatable torque only after testing the printed posts.

## 6. Fit the bearing and cap

Support the cap's bearing seat and seat the bearing fully into the cap using the previously qualified light hand fit. Force acts on the outer race for this operation; do not push the inner race to force a tight outer fit.

Lower the cap/bearing assembly squarely onto the fixed shaft. Apply light, even pressure near the axis. If it requires appreciable force through the complete bearing, stop and revise the fit or use suitable race-specific tooling. More force on the cap is not a fit correction.

Confirm full seating without contact between stationary and moving parts. Rotate slowly through360° in each direction. Check drag, wobble, rubbing and unintended lift. There is no press-to-reset action.

## 7. Check the finished device

1. Connect by BLE, read status and enable State notifications. Require sensor/storage fault flags clear once the cap is seated.
2. Reset from the client. Make ten complete turns in one direction and ten in the other; total must increase by20. Direction labels follow the sensor and may not correspond to the viewing direction.
3. Test partial backtracking:180° forward then180° back must add zero. Check stationary jitter and the0°/360° boundary. Any sample-gap flag means unfinished travel was discarded and needs investigation.
4. Send SAVE and wait for unsaved=false. Disconnect BLE, remove/reinsert the cell using the service procedure, and verify saved counts return.
5. Check both magnet bonds, phone/case attachment and cap pull-off retention on a protected surface. Measure forces; do not approve the joint by feel alone.
6. For the pilot release, compare at least100 turns in each direction against a reference at several speeds up to10turns/s. Repeat with the final steel bearing, ring, intended phone and case. Test connection/reconnection/reset/save, idle/shock, cap removal, current consumption and contact reliability.

The firmware's radio and magnetic behavior, clock accuracy, runtime, printed retention, screw strength and adhesive aging require real prototypes. A successful digital build and flash verification do not establish those results. Record assembly touch time, cure time and rework separately in [the timing sheet](mechanical/ASSEMBLY_TIME_STUDY.csv) before the10–50-unit batch.

## Battery replacement and service

Send SAVE and wait for confirmation before removing power where practical. Pull the cap evenly straight off. The bearing may remain on the base or in the cap; support the appropriate race when removing it. Remove the two PCB screws, lift the PCBA/holder and replace the cell.

For reprogramming, remove the cell before applying programmer power. Reassemble in the same order. Repeated cap removal can loosen PETG; if retention and service cannot both pass the measured load tests, use a positively retained revision before production.
