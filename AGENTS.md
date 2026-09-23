# Monogatari Clock project guidance

This repository contains a Blender clock model and frontend-ready GLB. Read `README.md` and `versions/README.md` before changing the assets.

## Asset contract

- Keep `models/monogatari-clock.blend` editable and `models/monogatari-clock.glb` self-contained, with the 4096 px dial texture embedded in the GLB.
- The GLB faces +Z, has +Y at 12 o'clock, is centered at the origin, and has a 0.30 m outer diameter.
- Preserve independent `hour_hand_pivot`, `minute_hand_pivot`, and `second_hand_pivot` nodes. The raised inner index circle has a white upper half and black lower half.
- `art/dial.svg` is editable artwork; `art/dial-4096.png` is the texture used by the model. Keep both in sync with `tools/make_dial.py`.
- The `Presentation | render only` collection is for Blender previews. Export only `Clock | export this collection` to GLB.

## Protect existing work

- `versions/v1/` is the complete first version. Do not overwrite or delete it. Its `SHA256SUMS.txt` records the backup contents.
- Before replacing the current `.blend`, `.glb`, art, or scripts, make a dated copy under `versions/` and verify it. Inspect the current `.blend` first: it may contain Blender GUI edits that differ from the scripts or GLB.
- On 2026-09-23, a later save left the main `.blend` without the second hand while the GLB and `.blend1` still had it. The states were preserved in `versions/repair-2026-09-23/`; the main `.blend` was restored. Check the actual scene objects, not only file names or render previews.
- A Blender window already open on a file does not automatically reload external disk changes. Check for unsaved edits before reloading that window.

## Build and verify

- `tools/make_dial.py` needs Pillow and a CJK serif font. The model was built with Blender 5.2.2 at `/Applications/Blender.app/Contents/MacOS/Blender`.
- `tools/build_clock.py` regenerates the model, GLB, and front/angle previews. Its saved Layout view should open in camera view with material shading, so the fine second hand and dial art are visible.
- After changes, inspect both `renders/clock-preview.png` and `renders/clock-angle-preview.png`, then run `tools/verify_glb.py` against the saved `.blend` to reimport and check the GLB.
- Verify the final `.blend` itself contains the visible second hand and all three pivots. Do not infer this from a successful GLB export; the two files can diverge.
