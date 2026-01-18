"""
blender scene_render.blend --background --python render_loop.py
scene_render.blend is the blender file that contains the scene to be rendered.
We loop over how much the gripper opens in the x direction from 4 mm to 40 mm in steps of 4 mm.
For each step:
-we change the x location of the object with the name finger_1 to the current step value / 2.
- we change the x location of the object with the name finger_2 to the negative of the current step value / 2.
- we render the scene and save the rendered image to the output directory.
- the output directory is "output" which is in the same directory as this script.
- the rendered image is saved as "render_<step_value>.png".
- the rendered image is saved as a png file.
"""

import bpy # type: ignore
import os

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# Create output directory if it doesn't exist
output_dir = os.path.join(script_dir, "output")
os.makedirs(output_dir, exist_ok=True)

# Set render settings for PNG output
bpy.context.scene.render.image_settings.file_format = 'PNG'

# Get references to the finger objects
finger_1 = bpy.data.objects["finger_1"]
finger_2 = bpy.data.objects["finger_2"]

# Loop over gripper opening values from 4mm to 40mm in steps of 4mm
for step_value in range(4, 44, 4):
    # Convert mm to Blender units (assuming 1 unit = 1 mm)
    offset = step_value / 2.0
    
    # Set finger positions
    finger_1.location.x = offset / 1000
    finger_2.location.x = -offset / 1000
    
    # Set output path for this render
    output_path = os.path.join(output_dir, f"render_{step_value}.png")
    bpy.context.scene.render.filepath = output_path
    
    # Render the scene
    bpy.ops.render.render(write_still=True)
    
    print(f"Rendered: {output_path}")

print("Rendering complete!")
