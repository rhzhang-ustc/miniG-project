"""
We want to loop through the scale factors from 1 to 2 in steps of 0.1 and run the script.py script for each scale factor.
The output directory should be "output/<scale_factor>" for each scale factor. The output directory is in the same directory as the script.py file.

"""

import subprocess
import os

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.realpath(__file__))
blender_script = os.path.join(script_dir, "script.py")

# Loop through scale factors from 1.0 to 2.0 in steps of 0.1
scale_factors = [round(1.0 + i * 0.1, 1) for i in range(11)]

for scale in scale_factors:
    output_dir = os.path.join(script_dir, "output", str(scale))
    
    print(f"\n{'='*50}")
    print(f"Running with scale factor: {scale}")
    print(f"Output directory: {output_dir}")
    print(f"{'='*50}\n")
    
    # Run blender with the script
    cmd = [
        "blender",
        "--background",
        "--python", blender_script,
        "--",
        "--scale", str(scale),
        "--output", output_dir
    ]
    
    subprocess.run(cmd)

print("\n" + "="*50)
print("All scale factors processed!")
print("="*50)