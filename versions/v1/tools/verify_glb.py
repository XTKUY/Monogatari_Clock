"""Round-trip the exported GLB through Blender and render a quick visual check."""

from pathlib import Path

import bpy


root = Path(__file__).resolve().parents[1]
glb_path = root / "models/monogatari-clock.glb"
preview_path = root / "renders/clock-glb-roundtrip.png"

# Keep the look-development camera/lights, but remove the original clock.
clock_collection = bpy.data.collections["Clock | export this collection"]
for obj in list(clock_collection.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.import_scene.gltf(filepath=str(glb_path))
names = {obj.name for obj in bpy.data.objects}
for required in (
    "Monogatari_Clock | 30 cm",
    "dial | printed face",
    "hour_hand_pivot",
    "minute_hand_pivot",
):
    assert required in names, f"Missing exported node: {required}"

dial = bpy.data.objects["dial | printed face"]
assert dial.data.uv_layers, "Dial lost its UV mapping"
assert any(
    node.type == "TEX_IMAGE" and node.image and node.image.size[:] == (4096, 4096)
    for material in dial.data.materials if material and material.use_nodes
    for node in material.node_tree.nodes
), "Dial lost its embedded 4096 px texture"

scene = bpy.context.scene
scene.render.resolution_percentage = 50
scene.cycles.samples = 24
scene.render.filepath = str(preview_path)
bpy.ops.render.render(write_still=True)
print(f"GLB ROUNDTRIP OK: {len(names)} scene objects, preview {preview_path}")
