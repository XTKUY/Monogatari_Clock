"""Restore the second-hand Blender snapshot and make it obvious on opening.

The existing disk states are copied under versions/repair-2026-09-23 first.
Run: blender -b versions/repair-2026-09-23/v2-with-second.blend \
       --python tools/repair_blend_view.py
"""

from pathlib import Path

import bpy


root = Path(__file__).resolve().parents[1]
output = root / "models/monogatari-clock.blend"

required = (
    "second_hand_pivot",
    "second_hand | fine satin steel needle",
    "second_hand | polished centerline",
    "second_hand | circular counterweight",
    "second_hand | polished center pin",
)
for name in required:
    assert name in bpy.data.objects, f"The source snapshot is missing {name}"

for screen in bpy.data.screens:
    if screen.name != "Layout":
        continue
    for area in screen.areas:
        if area.type != "VIEW_3D":
            continue
        space = area.spaces.active
        space.shading.type = "MATERIAL"
        space.overlay.show_overlays = False
        space.region_3d.view_perspective = "CAMERA"
        space.region_3d.view_camera_zoom = 18.0

bpy.ops.object.select_all(action="DESELECT")
second = bpy.data.objects["second_hand | fine satin steel needle"]
second.select_set(True)
bpy.context.view_layer.objects.active = second
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
print(f"Restored visible second hand in {output}")
