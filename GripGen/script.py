"""
blender --background --python script.py -- --scale 1.5 --output ./output


This Script scales the main objects in the comps.blend and exports stl and obj files to the output directory
the input arguments are:
--scale <float> - the scale factor for the main objects
--output <path> - the path to the output directory

The process is as follows:
1. Load the comps.blend file (We never change the main file)
2. Select the main objects (The main objects are in the "Prints" and "Optical" Collections)
3. Scale the objects by the scale factor relative to the world origin
    a. for the "motor_mount" named main object, instead of scaling normally, 
    We first scale in y direction by half the scale factor.
    we scale all the vertices with positive z coordinates by the scale factor in x and z direction,
    however, vertices with negative z coordinates are only scaled in the x direction. z remains the same.
    b. "motor_link" named main object is only scaled in the z direction.

4. There is a third collection called "Cuts", each obect in this collection is a cutout for the main objects.
    a. Some cutouts' name start with "cut_fixed_{corresponding_main_object_name}" with maybe .001 numbers appended to the end. These are directly subtrated from the main object without any extra scaling or transfomarion.
    b. Some cutouts' name start with "cut_float_{corresponding_main_object_name}" with maybe .001 numbers appended to the end. These objects's position is first scaled to the scale factorand then subtracted from the corresponding main object. The geometry is not changed, just the position is scaled.
    c. some cutouts' name start with "cut_scale_z_{corresponding_main_object_name}" with maybe .001 numbers appended to the end. These objects are scaled in the z direction only (Geometry is changed).
5. Make sure to apply the boolean operation to the main objects and then remove the "Cuts" collection with all its objects.
5. Export the Main objects separately as stl and obj files to the output directory in separate folders for objs and stls. (The name should have the collection name as a prefix)
6. Save the dimensiton of the "pad" pbject in a text file in the output directory with the name "pad_dimensions.txt"
7. Save the comps.blend file in the output directory with the name "gripper_scaled_<scale_factor>.blend"
7. Exit the script
"""

import bpy # type: ignore
import sys
import os
import re
import argparse
from pathlib import Path


def parse_args():
    """Parse command line arguments after '--'"""
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []
    
    parser = argparse.ArgumentParser(description="Scale gripper components and export")
    parser.add_argument("--scale", type=float, required=True, help="Scale factor for the main objects")
    parser.add_argument("--output", type=str, required=True, help="Path to the output directory")
    
    return parser.parse_args(argv)


def get_main_object_name(cut_name, prefix):
    """Extract the main object name from a cut object name"""
    # Remove the prefix (cut_fixed_ or cut_float_)
    name_without_prefix = cut_name[len(prefix):]
    # Remove any .001, .002 suffixes
    base_name = re.sub(r'\.\d+$', '', name_without_prefix)
    return base_name


def find_main_object(base_name, main_objects):
    """Find the main object that matches the base name (with or without .001 suffix)"""
    # First try exact match
    for obj in main_objects:
        obj_base = re.sub(r'\.\d+$', '', obj.name)
        if obj_base == base_name or obj.name == base_name:
            return obj
    return None


def get_objects_from_collections(collection_names):
    """Get all mesh objects from specified collections"""
    objects = []
    for col_name in collection_names:
        if col_name in bpy.data.collections:
            collection = bpy.data.collections[col_name]
            for obj in collection.objects:
                if obj.type == 'MESH':
                    objects.append(obj)
    return objects


def scale_object_from_origin(obj, scale_factor):
    """Scale an object relative to the world origin"""
    # Scale the location
    obj.location *= scale_factor
    # Scale the object itself
    obj.scale *= scale_factor


def scale_motor_mount(obj, scale_factor):
    """
    Special scaling for motor_mount object:
    - First scale all vertices in y direction by half the scale factor
    - Vertices with positive z: scale in x and z directions
    - Vertices with negative z: scale only in x direction, z unchanged
    """
    import bmesh # type: ignore
    
    # Scale the location like other objects
    obj.location *= scale_factor
    
    # Apply current transforms first to work in world space
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    
    # Get the mesh data
    mesh = obj.data
    
    # Create a bmesh to edit vertices
    bm = bmesh.new()
    bm.from_mesh(mesh)
    
    # Half scale factor for y
    half_scale = 1 + (scale_factor - 1) / 2
    
    # Scale each vertex
    for vert in bm.verts:
        # First: scale y by half the scale factor (all vertices)
        vert.co.y *= half_scale
        
        if vert.co.z >= 0:
            # Positive z: scale in x and z directions
            vert.co.x *= scale_factor
            vert.co.z *= scale_factor
        else:
            # Negative z: scale only x, z unchanged
            vert.co.x *= scale_factor
            # z remains unchanged
    
    # Update the mesh
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def scale_motor_link(obj, scale_factor):
    """
    Special scaling for motor_link object:
    - Only scale in the z direction
    """
    import bmesh # type: ignore
    
    # Scale only z component of location
    obj.location.z *= scale_factor
    
    # Apply current transforms first
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    
    # Get the mesh data
    mesh = obj.data
    
    # Create a bmesh to edit vertices
    bm = bmesh.new()
    bm.from_mesh(mesh)
    
    # Scale only z coordinate of each vertex
    for vert in bm.verts:
        vert.co.z *= scale_factor
    
    # Update the mesh
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def scale_object_z_only(obj, scale_factor):
    """
    Scale an object's geometry in the z direction only.
    Used for cut_scale_z_ objects.
    """
    import bmesh # type: ignore
    
    # Apply current transforms first
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    
    # Get the mesh data
    mesh = obj.data
    
    # Create a bmesh to edit vertices
    bm = bmesh.new()
    bm.from_mesh(mesh)
    
    # Scale only z coordinate of each vertex
    for vert in bm.verts:
        vert.co.z *= scale_factor
    
    # Update the mesh
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()


def apply_boolean_modifier(main_obj, cut_obj, modifier_name):
    """Apply a boolean difference modifier to main_obj using cut_obj"""
    # Add boolean modifier
    bool_mod = main_obj.modifiers.new(name=modifier_name, type='BOOLEAN')
    bool_mod.operation = 'DIFFERENCE'
    bool_mod.object = cut_obj
    bool_mod.solver = 'EXACT'
    
    # Apply the modifier
    bpy.context.view_layer.objects.active = main_obj
    bpy.ops.object.modifier_apply(modifier=modifier_name)


def process_cuts(cut_objects, main_objects, scale_factor):
    """Process all cut objects and apply boolean operations"""
    for cut_obj in cut_objects:
        cut_name = cut_obj.name
        
        if cut_name.startswith("cut_fixed_"):
            # Fixed cuts - subtract directly without transformation
            base_name = get_main_object_name(cut_name, "cut_fixed_")
            main_obj = find_main_object(base_name, main_objects)
            
            if main_obj:
                apply_boolean_modifier(main_obj, cut_obj, f"bool_{cut_name}")
                
        elif cut_name.startswith("cut_float_"):
            # Float cuts - scale position first, then subtract
            base_name = get_main_object_name(cut_name, "cut_float_")
            main_obj = find_main_object(base_name, main_objects)
            
            if main_obj:
                # Scale only the position, not the geometry
                cut_obj.location *= scale_factor
                apply_boolean_modifier(main_obj, cut_obj, f"bool_{cut_name}")
                
        elif cut_name.startswith("cut_scale_z_"):
            # Scale Z cuts - scale geometry in z direction only
            base_name = get_main_object_name(cut_name, "cut_scale_z_")
            main_obj = find_main_object(base_name, main_objects)
            
            if main_obj:
                # Scale the cut object's geometry in z direction only
                scale_object_z_only(cut_obj, scale_factor)
                apply_boolean_modifier(main_obj, cut_obj, f"bool_{cut_name}")


def remove_cuts_collection():
    """Remove the Cuts collection and all its objects"""
    if "Cuts" in bpy.data.collections:
        cuts_collection = bpy.data.collections["Cuts"]
        
        # Remove all objects in the collection
        for obj in list(cuts_collection.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        
        # Remove the collection
        bpy.data.collections.remove(cuts_collection)


def get_object_collection_name(obj):
    """Get the first collection name for an object"""
    for collection in obj.users_collection:
        if collection.name not in ["Scene Collection"]:
            return collection.name
    return "Unknown"


def export_objects(main_objects, output_dir):
    """Export objects as STL and OBJ files"""
    stl_dir = os.path.join(output_dir, "stls")
    obj_dir = os.path.join(output_dir, "objs")
    
    os.makedirs(stl_dir, exist_ok=True)
    os.makedirs(obj_dir, exist_ok=True)
    
    for obj in main_objects:
        # Deselect all
        bpy.ops.object.select_all(action='DESELECT')
        
        # Select only this object
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        
        # Get collection name for prefix
        collection_name = get_object_collection_name(obj)
        export_name = f"{collection_name}_{obj.name}"
        
        # Export STL (Blender 4.0+ uses wm.stl_export)
        stl_path = os.path.join(stl_dir, f"{export_name}.stl")
        bpy.ops.wm.stl_export(filepath=stl_path, export_selected_objects=True)
        print(f"Exported STL: {stl_path}")
        
        # Export OBJ
        obj_path = os.path.join(obj_dir, f"{export_name}.obj")
        bpy.ops.wm.obj_export(filepath=obj_path, export_selected_objects=True)
        print(f"Exported OBJ: {obj_path}")


def save_pad_dimensions(main_objects, output_dir):
    """Save the dimensions of the 'pad' object to a text file"""
    # Find the pad object
    pad_obj = None
    for obj in main_objects:
        obj_base_name = re.sub(r'\.\d+$', '', obj.name)
        if obj_base_name == "pad":
            pad_obj = obj
            break
    
    if pad_obj is None:
        print("Warning: 'pad' object not found, skipping dimension export")
        return
    
    # Get the dimensions (bounding box size) and convert to mm
    dimensions = pad_obj.dimensions
    x_mm = int(round(dimensions.x * 1000))
    y_mm = int(round(dimensions.y * 1000))
    z_mm = int(round(dimensions.z * 1000))
    
    # Write to file
    dim_file = os.path.join(output_dir, "pad_dimensions.txt")
    with open(dim_file, 'w') as f:
        f.write(f"Pad Dimensions (mm)\n")
        f.write(f"===================\n")
        f.write(f"X: {x_mm}\n")
        f.write(f"Y: {y_mm}\n")
        f.write(f"Z: {z_mm}\n")
    
    print(f"Saved pad dimensions: {dim_file}")


def main():
    # Parse arguments
    args = parse_args()
    scale_factor = args.scale
    output_dir = args.output
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.realpath(__file__))
    blend_file = os.path.join(script_dir, "comps.blend")
    
    # Load the blend file
    bpy.ops.wm.open_mainfile(filepath=blend_file)
    print(f"Loaded: {blend_file}")
    
    # Get main objects from Prints and Optical collections
    main_collections = ["Prints", "Optical"]
    main_objects = get_objects_from_collections(main_collections)
    print(f"Found {len(main_objects)} main objects")
    
    # Scale main objects relative to world origin
    for obj in main_objects:
        # Check if this is a special object (with or without .001 suffix)
        obj_base_name = re.sub(r'\.\d+$', '', obj.name)
        if obj_base_name == "motor_mount":
            scale_motor_mount(obj, scale_factor)
            print(f"Applied special scaling to motor_mount: {obj.name}")
        elif obj_base_name == "motor_link":
            scale_motor_link(obj, scale_factor)
            print(f"Applied z-only scaling to motor_link: {obj.name}")
        else:
            scale_object_from_origin(obj, scale_factor)
    print(f"Scaled main objects by factor: {scale_factor}")
    
    # Get cut objects
    cut_objects = get_objects_from_collections(["Cuts"])
    print(f"Found {len(cut_objects)} cut objects")
    
    # Process cuts and apply boolean operations
    process_cuts(cut_objects, main_objects, scale_factor)
    print("Applied boolean operations")
    
    # Remove Cuts collection
    remove_cuts_collection()
    print("Removed Cuts collection")
    
    # Apply all transformations to main objects
    for obj in main_objects:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    
    # Export objects
    export_objects(main_objects, output_dir)
    print("Exported all objects")
    
    # Save pad dimensions to text file
    save_pad_dimensions(main_objects, output_dir)
    
    # Save the blend file
    output_blend = os.path.join(output_dir, f"gripper_scaled_{scale_factor}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=output_blend)
    print(f"Saved: {output_blend}")
    
    print("Script completed successfully!")


if __name__ == "__main__":
    main()
