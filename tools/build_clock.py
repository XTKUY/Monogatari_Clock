"""Create the editable Blender clock, preview render, and frontend GLB.

Run with Blender 5.x: blender -b --factory-startup --python tools/build_clock.py
The clock faces Blender -Y; glTF export maps that to frontend +Z and keeps +Y up.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
BLEND_PATH = ROOT / "models/monogatari-clock.blend"
GLB_PATH = ROOT / "models/monogatari-clock.glb"
PREVIEW_PATH = ROOT / "renders/clock-preview.png"
ANGLE_PREVIEW_PATH = ROOT / "renders/clock-angle-preview.png"
TEXTURE_PATH = ROOT / "art/dial-4096.png"
SEGMENTS = 384
WORLD_RADIUS_M = 0.15  # 30 cm overall diameter


def make_material(name: str, rgba, metallic: float, roughness: float):
    material = bpy.data.materials.new(name)
    material.diffuse_color = rgba
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = rgba
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return material


def make_dial_material():
    material = make_material("Dial | printed matte enamel", (1, 1, 1, 1), 0.0, 1.0)
    image = bpy.data.images.load(str(TEXTURE_PATH), check_existing=True)
    image.name = "Dial art | 4096 px"
    image.colorspace_settings.name = "sRGB"
    nodes = material.node_tree.nodes
    texture = nodes.new("ShaderNodeTexImage")
    texture.name = "Printed dial texture"
    texture.image = image
    texture.interpolation = "Linear"
    shader = nodes.get("Principled BSDF")
    shader.inputs["Specular IOR Level"].default_value = 0.0
    material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    return material


def mesh_object(name, vertices, faces, material, collection, material_indices=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    if material_indices is not None:
        for poly, index in zip(mesh.polygons, material_indices):
            poly.material_index = index
    return obj


def lathe(name, profile, material, collection, segments=SEGMENTS):
    """Revolve a clockwise radial/depth cross section around Blender Y."""
    vertices = []
    for radius, depth in profile:
        for i in range(segments):
            angle = 2 * math.pi * i / segments
            vertices.append((radius * math.sin(angle), depth, radius * math.cos(angle)))
    faces = []
    count = len(profile)
    for j in range(count):
        next_j = (j + 1) % count
        for i in range(segments):
            next_i = (i + 1) % segments
            faces.append((j * segments + i, next_j * segments + i,
                          next_j * segments + next_i, j * segments + next_i))
    obj = mesh_object(name, vertices, faces, material, collection)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def dial_disc(collection, front_material, edge_material):
    radius = 0.916
    front_y, back_y = -0.067, -0.059
    vertices = [(0, front_y, 0), (0, back_y, 0)]
    for depth in (front_y, back_y):
        for i in range(SEGMENTS):
            angle = 2 * math.pi * i / SEGMENTS
            vertices.append((radius * math.sin(angle), depth, radius * math.cos(angle)))
    front_start, back_start = 2, SEGMENTS + 2
    faces = []
    indices = []
    for i in range(SEGMENTS):
        next_i = (i + 1) % SEGMENTS
        faces.append((0, front_start + next_i, front_start + i))
        indices.append(0)
        faces.append((1, back_start + i, back_start + next_i))
        indices.append(1)
        faces.append((front_start + i, front_start + next_i,
                      back_start + next_i, back_start + i))
        indices.append(1)
    obj = mesh_object("dial | printed face", vertices, faces, front_material, collection, indices)
    obj.data.materials.append(edge_material)
    uv_layer = obj.data.uv_layers.new(name="Dial UV")
    for poly in obj.data.polygons:
        for loop_index in poly.loop_indices:
            co = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            uv_layer.data[loop_index].uv = (0.5 + co.x / (2 * radius),
                                            0.5 + co.z / (2 * radius))
    return obj


def arc_ring(name, start_angle, end_angle, inner_radius, outer_radius,
             front_y, material, collection, segments=192):
    """Create a shallow raised half-circle with a precise color seam at 3/9."""
    back_y = front_y + 0.0012
    vertices = []
    for i in range(segments + 1):
        angle = start_angle + (end_angle - start_angle) * i / segments
        x, z = math.sin(angle), math.cos(angle)
        vertices.extend([
            (inner_radius * x, front_y, inner_radius * z),
            (outer_radius * x, front_y, outer_radius * z),
            (inner_radius * x, back_y, inner_radius * z),
            (outer_radius * x, back_y, outer_radius * z),
        ])
    faces = []
    for i in range(segments):
        a, b = 4 * i, 4 * (i + 1)
        faces.extend([
            (a, b, b + 1, a + 1),       # front, facing camera (-Y)
            (a + 2, a + 3, b + 3, b + 2),
            (a + 1, b + 1, b + 3, a + 3),
            (a, a + 2, b + 2, b),
        ])
    faces.extend([(0, 1, 3, 2),
                  (4 * segments, 4 * segments + 2,
                   4 * segments + 3, 4 * segments + 1)])
    return mesh_object(name, vertices, faces, material, collection)


def hand_mesh(name, silhouette, front_y, material, edge_material, collection,
              thickness=0.008, bevel_width=0.002):
    """Give a flat tapered design hand real thickness and a tiny bevel."""
    back_y = front_y + thickness
    count = len(silhouette)
    vertices = [(x, front_y, z) for x, z in silhouette]
    vertices += [(x, back_y, z) for x, z in silhouette]
    faces = [tuple(reversed(range(count))), tuple(range(count, count * 2))]
    indices = [0, 1]
    for i in range(count):
        next_i = (i + 1) % count
        faces.append((i, next_i, count + next_i, count + i))
        indices.append(1)
    obj = mesh_object(name, vertices, faces, material, collection, indices)
    obj.data.materials.append(edge_material)
    if bevel_width:
        bevel = obj.modifiers.new("soft machined edge", "BEVEL")
        bevel.width = bevel_width
        bevel.segments = 2
        bevel.affect = "EDGES"
    return obj


def root_empty(name, collection):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.15
    collection.objects.link(obj)
    return obj


def sphere(name, material, collection, scale, depth, radial_z=0.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=24, radius=1,
                                          location=(0, depth, radial_z))
    obj = bpy.context.object
    obj.name = name
    for old_collection in list(obj.users_collection):
        old_collection.objects.unlink(obj)
    collection.objects.link(obj)
    obj.scale = scale
    obj.data.materials.append(material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def area_light(name, location, energy, size, collection, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.location = location
    direction = -obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj


def configure_layout_view():
    """Open the saved project on its dial, with the dial art visible."""
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


def main():
    for path in (BLEND_PATH.parent, GLB_PATH.parent, PREVIEW_PATH.parent):
        path.mkdir(parents=True, exist_ok=True)
    if not TEXTURE_PATH.is_file():
        raise FileNotFoundError(f"Generate the dial texture first: {TEXTURE_PATH}")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != bpy.context.scene.collection.name:
            bpy.data.collections.remove(collection)

    clock = bpy.data.collections.new("Clock | export this collection")
    bpy.context.scene.collection.children.link(clock)
    presentation = bpy.data.collections.new("Presentation | render only")
    bpy.context.scene.collection.children.link(presentation)

    silver = make_material("Case | polished silver", (0.72, 0.75, 0.73, 1), 0.82, 0.20)
    gasket = make_material("Bezel | dark charcoal", (0.012, 0.016, 0.013, 1), 0.28, 0.34)
    back_metal = make_material("Back | satin alloy", (0.28, 0.30, 0.29, 1), 0.7, 0.42)
    hour_white = make_material("Hour | satin ivory lacquer", (0.93, 0.925, 0.91, 1), 0.10, 0.38)
    hour_edge = make_material("Hour | brushed silver edge", (0.57, 0.60, 0.58, 1), 0.52, 0.34)
    minute_white = make_material("Minute | polished white lacquer", (0.98, 0.975, 0.96, 1), 0.16, 0.22)
    minute_edge = make_material("Minute | bright machined edge", (0.75, 0.78, 0.76, 1), 0.50, 0.24)
    hand_highlight = make_material("Hands | raised enamel spine", (0.99, 0.99, 0.98, 1), 0.10, 0.18)
    second_silver = make_material("Seconds | satin silver blade", (0.53, 0.57, 0.55, 1), 0.74, 0.28)
    second_edge = make_material("Seconds | shaded steel edge", (0.23, 0.26, 0.24, 1), 0.66, 0.36)
    second_glint = make_material("Seconds | polished centerline", (0.93, 0.95, 0.92, 1), 0.50, 0.18)
    ring_white = make_material("Index circle | upper ivory", (0.91, 0.93, 0.90, 1), 0.0, 1.0)
    ring_black = make_material("Index circle | lower black", (0.004, 0.006, 0.004, 1), 0.0, 1.0)
    for material in (ring_white, ring_black):
        material.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0.0
    hub_white = make_material("Hub | white ceramic", (0.96, 0.955, 0.945, 1), 0.04, 0.22)
    face = make_dial_material()

    root = root_empty("Monogatari_Clock | 30 cm", clock)
    root.scale = (WORLD_RADIUS_M,) * 3
    root["diameter_m"] = 0.30
    root["asset_version"] = 2
    root["front_direction_glTF"] = "+Z"
    root["art_reference"] = "art/reference.png"

    # A rounded metal shell with a real inner recess, plus the dark inner lip.
    shell = lathe("case | rounded silver shell", [
        (0.895, 0.103), (0.952, 0.103), (0.980, 0.084),
        (0.998, 0.048), (1.000, -0.024), (0.995, -0.054),
        (0.977, -0.085), (0.952, -0.101), (0.920, -0.101),
        (0.916, -0.092), (0.913, -0.078), (0.913, -0.055),
        (0.905, -0.051), (0.905, 0.087),
    ], silver, clock)
    shell.parent = root
    inner_lip = lathe("bezel | recessed black ring", [
        (0.925, -0.096), (0.919, -0.103), (0.909, -0.098),
        (0.905, -0.084), (0.905, -0.064), (0.916, -0.064),
    ], gasket, clock)
    inner_lip.parent = root
    back = lathe("back | simple closed panel", [
        (0.001, 0.101), (0.895, 0.101), (0.900, 0.108),
        (0.001, 0.108),
    ], back_metal, clock, segments=192)
    back.parent = root
    dial = dial_disc(clock, face, gasket)
    dial.parent = root

    # This is a separate, slightly raised circle rather than a bezel highlight.
    upper_circle = arc_ring("index_circle | upper white", -math.pi / 2, math.pi / 2,
                            0.888, 0.895, -0.069, ring_white, clock)
    upper_circle.parent = root
    lower_circle = arc_ring("index_circle | lower black", math.pi / 2, 3 * math.pi / 2,
                            0.888, 0.895, -0.069, ring_black, clock)
    lower_circle.parent = root

    # The three independently rotating hands sit on successive physical levels.
    hour_pivot = root_empty("hour_hand_pivot", clock)
    hour_pivot.parent = root
    hour_pivot.rotation_euler.y = math.radians(216.0)
    hour_pivot["clockwise_degrees_from_12"] = 216.0
    hour = hand_mesh("hour_hand | tapered white blade", [
        (-0.021, -0.036), (-0.023, 0.070), (-0.016, 0.235),
        (-0.010, 0.340), (-0.002, 0.470), (0.002, 0.470),
        (0.010, 0.340), (0.016, 0.235), (0.023, 0.070),
        (0.021, -0.036),
    ], -0.081, hour_white, hour_edge, clock)
    hour.parent = hour_pivot
    hour_spine = hand_mesh("hour_hand | raised enamel spine", [
        (-0.006, 0.071), (-0.006, 0.220), (-0.003, 0.397),
        (0.000, 0.435), (0.003, 0.397), (0.006, 0.220),
        (0.006, 0.071),
    ], -0.086, hand_highlight, hour_edge, clock,
                           thickness=0.003, bevel_width=0.0008)
    hour_spine.parent = hour_pivot

    minute_pivot = root_empty("minute_hand_pivot", clock)
    minute_pivot.parent = root
    minute_pivot.rotation_euler.y = math.radians(20.0)
    minute_pivot["clockwise_degrees_from_12"] = 20.0
    minute = hand_mesh("minute_hand | long white blade", [
        (-0.022, -0.036), (-0.022, 0.075), (-0.016, 0.315),
        (-0.011, 0.555), (-0.007, 0.868), (-0.006, 0.881),
        (0.006, 0.881), (0.007, 0.868), (0.011, 0.555),
        (0.016, 0.315), (0.022, 0.075), (0.022, -0.036),
    ], -0.094, minute_white, minute_edge, clock)
    minute.parent = minute_pivot
    minute_spine = hand_mesh("minute_hand | raised enamel spine", [
        (-0.006, 0.073), (-0.005, 0.300), (-0.003, 0.680),
        (-0.002, 0.825), (0.000, 0.855), (0.002, 0.825),
        (0.003, 0.680), (0.005, 0.300), (0.006, 0.073),
    ], -0.100, hand_highlight, minute_edge, clock,
                             thickness=0.003, bevel_width=0.0007)
    minute_spine.parent = minute_pivot

    hub_rim = lathe("hub | faint silver edge", [
        (0.062, -0.104), (0.073, -0.104), (0.076, -0.096),
        (0.072, -0.088), (0.062, -0.088),
    ], silver, clock, segments=96)
    hub_rim.parent = root
    hub = sphere("hub | rounded white cap", hub_white, clock,
                 (0.069, 0.026, 0.069), -0.103)
    hub.parent = root

    second_pivot = root_empty("second_hand_pivot", clock)
    second_pivot.parent = root
    second_pivot.rotation_euler.y = math.radians(340.0)
    second_pivot["clockwise_degrees_from_12"] = 340.0
    second = hand_mesh("second_hand | fine satin steel needle", [
        (-0.006, -0.160), (-0.006, -0.105), (-0.004, -0.018),
        (-0.004, 0.350), (-0.0025, 0.790), (-0.001, 0.840),
        (0.001, 0.840), (0.0025, 0.790), (0.004, 0.350),
        (0.004, -0.018), (0.006, -0.105), (0.006, -0.160),
    ], -0.136, second_silver, second_edge, clock,
                       thickness=0.004, bevel_width=0.0007)
    second.parent = second_pivot
    second_spine = hand_mesh("second_hand | polished centerline", [
        (-0.0015, 0.066), (-0.0012, 0.450), (-0.0007, 0.805),
        (0.0007, 0.805), (0.0012, 0.450), (0.0015, 0.066),
    ], -0.1405, second_glint, second_silver, clock,
                              thickness=0.0015, bevel_width=0.0003)
    second_spine.parent = second_pivot
    counterweight = sphere("second_hand | circular counterweight", second_silver,
                           clock, (0.020, 0.004, 0.020), -0.140, radial_z=-0.140)
    counterweight.parent = second_pivot
    second_pin = sphere("second_hand | polished center pin", second_glint,
                        clock, (0.017, 0.008, 0.017), -0.146)
    second_pin.parent = second_pivot

    # A neutral wall and large softboxes serve only the included preview.
    wall_material = make_material("Preview wall | muted sage", (0.67, 0.71, 0.66, 1), 0, 1)
    wall = mesh_object("preview wall", [
        (-0.45, 0.026, -0.45), (0.45, 0.026, -0.45),
        (0.45, 0.026, 0.45), (-0.45, 0.026, 0.45),
    ], [(0, 3, 2, 1)], wall_material, presentation)
    wall.visible_glossy = False

    camera_data = bpy.data.cameras.new("Reference-style camera")
    camera = bpy.data.objects.new("Reference-style camera", camera_data)
    presentation.objects.link(camera)
    camera.location = (0.0, -1.0, 0.0)
    camera.rotation_euler = (math.pi / 2, 0, 0)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 0.432
    camera_data.shift_x = 0.010
    bpy.context.scene.camera = camera

    area_light("key | upper right softbox", (0.36, -0.44, 0.43), 1.50, 0.40, presentation)
    area_light("fill | left softbox", (-0.44, -0.37, 0.20), 0.67, 0.50, presentation)
    area_light("lower rim reflection", (0.16, -0.27, -0.37), 0.58, 0.24, presentation)
    world = bpy.data.worlds.new("Soft neutral ambience")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.75, 0.78, 0.74, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    bpy.context.scene.world = world

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1456
    scene.render.resolution_y = 1242
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.film_transparent = False
    scene.unit_settings.system = "METRIC"

    # Pack the source texture into the blend while retaining the loose PNG art.
    configure_layout_view()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in clock.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH), export_format="GLB", use_selection=True,
        export_yup=True, export_extras=True,
    )
    bpy.ops.render.render(write_still=True)

    # An oblique view makes the stepped hand stack and thicker metal rim clear.
    camera.location = (0.58, -0.85, 0.11)
    camera.rotation_euler = (-camera.location).to_track_quat("-Z", "Z").to_euler()
    camera_data.ortho_scale = 0.46
    camera_data.shift_x = 0.0
    scene.render.resolution_percentage = 75
    scene.cycles.samples = 40
    scene.render.filepath = str(ANGLE_PREVIEW_PATH)
    bpy.ops.render.render(write_still=True)
    print(f"SAVED {BLEND_PATH}\nSAVED {GLB_PATH}\n"
          f"SAVED {PREVIEW_PATH}\nSAVED {ANGLE_PREVIEW_PATH}")


if __name__ == "__main__":
    main()
