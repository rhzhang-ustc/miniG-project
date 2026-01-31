import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/MTLLoader.js";

THREE.Cache.enabled = true;

const viewer = document.getElementById("gripper-viewer");
const slider = document.getElementById("gripper-size");
const sizeValue = document.getElementById("gripper-size-value");
const sizeReadout = document.getElementById("gripper-overall-size");
const padDimsReadout = document.getElementById("gripper-pad-dims");
const opennessSlider = document.getElementById("gripper-openness");
const opennessValue = document.getElementById("gripper-openness-value");
const label = document.getElementById("gripper-part-label");
const labelName = document.getElementById("gripper-part-name");
const tactileImage = document.getElementById("gripper-tactile-image");
const componentList = document.getElementById("gripper-component-list");

if (
  !viewer ||
  !slider ||
  !sizeValue ||
  !sizeReadout ||
  !padDimsReadout ||
  !opennessSlider ||
  !opennessValue ||
  !tactileImage ||
  !componentList ||
  !label ||
  !labelName
) {
  throw new Error("Gripper viewer elements not found in the DOM.");
}

const SIZES = [
  "1.0",
  "1.1",
  "1.2",
  "1.3",
  "1.4",
  "1.5",
  "1.6",
  "1.7",
  "1.8",
  "1.9",
  "2.0",
];

const PARTS = [
  { file: "Prints_base", label: "Base", color: "#cbd5e1" },
  { file: "Prints_motor_mount", label: "Motor mount", color: "#b6c1d1" },
  { file: "Prints_motor_link", label: "Motor link", color: "#a7b3c4" },
  { file: "Prints_fingerRack", label: "Finger rack (left)", color: "#97a4b8" },
  { file: "Prints_fingerRack.001", label: "Finger rack (right)", color: "#8795aa" },
  { file: "Prints_gear", label: "Gear", color: "#76869c" },
  { file: "Prints_camera_housing", label: "Camera housing", color: "#6b7c92" },
  { file: "Prints_led_cap", label: "LED cap (left)", color: "#5f7188" },
  { file: "Prints_led_cap.001", label: "LED cap (right)", color: "#55677f" },
  { file: "Optical_shell_locked", label: "Optical shell (left)", color: "#8fa2b9" },
  { file: "Optical_shell_locked.001", label: "Optical shell (right)", color: "#8094ac" },
  { file: "Optical_led", label: "Optical LED (left)", color: "#22d3ee" },
  { file: "Optical_led.001", label: "Optical LED (right)", color: "#0ea5e9" },
  { file: "Optical_pad", label: "Optical pad (left)", color: "#aebfd1" },
  { file: "Optical_pad.001", label: "Optical pad (right)", color: "#9fb1c4" },
];

const componentVisibility = new Map(PARTS.map((part) => [part.file, true]));
const componentObjects = new Map();
const COMPONENT_GROUPS = {
  "Left finger": [
    "Prints_fingerRack",
    "Prints_led_cap",
    "Optical_shell_locked.001",
    "Optical_led",
    "Optical_pad",
  ],
  "Right finger": [
    "Prints_fingerRack.001",
    "Prints_led_cap.001",
    "Optical_shell_locked",
    "Optical_led.001",
    "Optical_pad.001",
  ],
  Base: ["Prints_base", "Prints_motor_mount", "Prints_motor_link", "Prints_gear", "Prints_camera_housing"],
};

// Track fruit visibility state (user toggle overrides auto-visibility)
let fruitUserOverride = {
  strawberry: null, // null = auto, true/false = user override
  apple: null,
};
let currentGripperSize = "1.5";
const groupExpanded = new Map(Object.keys(COMPONENT_GROUPS).map((name) => [name, false]));

const LEFT_FINGER_PARTS = new Set([
  "Optical_led",
  "Prints_led_cap",
  "Optical_pad",
  "Prints_fingerRack",
  "Optical_shell_locked.001",
]);
const RIGHT_FINGER_PARTS = new Set([
  "Optical_led.001",
  "Prints_led_cap.001",
  "Optical_shell_locked",
  "Optical_pad.001",
  "Prints_fingerRack.001",
]);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
viewer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.3;
controls.maxDistance = 12;

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(6, 8, 6);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
fillLight.position.set(-6, 4, -5);
scene.add(fillLight);

const group = new THREE.Group();
scene.add(group);
const axesHelper = new THREE.AxesHelper(1);
scene.add(axesHelper);

const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();

// Reference fruit objects for scale visualization
let strawberryObject = null;
let appleObject = null;
let fruitsLoaded = false;

// Fruit configuration - scale to match gel pad sizes
// Smallest gel pad (1.0x): Y=27mm, Z=31mm
// Largest gel pad (2.0x): Y=54mm, Z=62mm
const FRUIT_CONFIG = {
  strawberry: {
    objPath: "mesh_strawberry/Strawberry_ST3E1WL.obj",
    mtlPath: "mesh_strawberry/Strawberry_ST3E1WL.mtl",
    texturePath: "mesh_strawberry/Strawberry_ST3E1WL/Strawberry_MatSG_baseColor.png",
    scale: 0.005, // Scale to match smallest gel pad (~30mm)
    targetSize: "1.0", // Visible with smallest gripper
    label: "Strawberry (reference)",
    yOffset: 0.025,
    fallbackColor: 0xe63946, // Bright red
  },
  apple: {
    objPath: "mesh_apple/apple_ST8R5TY.obj",
    mtlPath: "mesh_apple/apple_ST8R5TY.mtl",
    texturePath: "mesh_apple/apple_ST8R5TY/red_apple_Mat_baseColor.png",
    scale: 0.01, // Scale to match largest gel pad (~55mm)
    targetSize: "2.0", // Visible with largest gripper
    label: "Apple (reference)",
    yOffset: 0.04,
    fallbackColor: 0xc1121f, // Deep apple red
  },
};

const textureLoader = new THREE.TextureLoader();

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let lastHitPoint = null;
let lastLabel = "";
let loadToken = 0;
const openAxis = new THREE.Vector3(1, 0, 0);
let leftFinger = [];
let rightFinger = [];
let fingerOpenDistance = 0;
const modelSize = new THREE.Vector3();
const TACTILE_RENDER_BASE = "tactile_render/output";
const TACTILE_STEPS = Array.from({ length: 10 }, (_, index) => (index + 1) * 4);

function resizeRenderer() {
  const rect = viewer.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function updateLabelPosition() {
  if (!lastHitPoint) return;
  const rect = viewer.getBoundingClientRect();
  const projected = lastHitPoint.clone().project(camera);

  if (projected.z < -1 || projected.z > 1) {
    label.classList.remove("visible");
    label.setAttribute("aria-hidden", "true");
    return;
  }

  const x = (projected.x * 0.5 + 0.5) * rect.width;
  const y = (-projected.y * 0.5 + 0.5) * rect.height;
  label.style.transform = `translate(${x}px, ${y}px)`;
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateLabelPosition();
  renderer.render(scene, camera);
}

function applyMaterial(object, material, labelText) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.material = material;
      child.userData.label = labelText;
    }
  });
}

function loadPart(loader, size, part, token) {
  return new Promise((resolve) => {
    const url = `GripGen/output/${size}/objs/${part.file}.obj`;
    loader.load(
      url,
      (obj) => {
        if (token !== loadToken) {
          resolve(false);
          return;
        }
        const isOpticalShell =
          part.file === "Optical_shell_locked" || part.file === "Optical_shell_locked.001";
        const isOpticalPad = part.file === "Optical_pad" || part.file === "Optical_pad.001";
        const material = new THREE.MeshStandardMaterial({
          color: part.color,
          roughness: isOpticalShell ? 0.2 : isOpticalPad ? 0.25 : 0.45,
          metalness: isOpticalPad ? 0.7 : 0.05,
          transparent: isOpticalShell,
          opacity: isOpticalShell ? 0.45 : 1,
        });
        obj.userData.label = part.label;
        obj.userData.partFile = part.file;
        applyMaterial(obj, material, part.label);
        componentObjects.set(part.file, obj);
        obj.visible = componentVisibility.get(part.file) !== false;
        group.add(obj);
        resolve(true);
      },
      undefined,
      () => resolve(false)
    );
  });
}

function frameObject() {
  const box = new THREE.Box3().setFromObject(group);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return;

  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  modelSize.copy(size);

  group.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = maxDim * 1.4;
  camera.position.set(distance, distance, distance);
  controls.target.set(0, 0, 0);
  controls.update();

  sizeReadout.textContent = `${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}`;
}

function resetLabel() {
  lastHitPoint = null;
  lastLabel = "";
  label.classList.remove("visible");
  label.setAttribute("aria-hidden", "true");
}

function collectFingerGroups() {
  leftFinger = [];
  rightFinger = [];
  fingerOpenDistance = 0;

  group.children.forEach((child) => {
    const partFile = child.userData.partFile;
    if (LEFT_FINGER_PARTS.has(partFile)) {
      leftFinger.push(child);
    } else if (RIGHT_FINGER_PARTS.has(partFile)) {
      rightFinger.push(child);
    }
  });

  if (!leftFinger.length || !rightFinger.length) return;

  const leftBox = new THREE.Box3();
  leftFinger.forEach((child) => leftBox.expandByObject(child));
  const size = new THREE.Vector3();
  leftBox.getSize(size);
  fingerOpenDistance = Math.max(size.x, 0);
}

async function loadSize(size) {
  const currentToken = ++loadToken;
  resetLabel();
  group.clear();
  componentObjects.clear();

  const results = await Promise.all(
    PARTS.map((part) => loadPart(objLoader, size, part, currentToken))
  );

  if (currentToken !== loadToken) return;
  frameObject();
  group.traverse((child) => {
    if (child.parent === group) {
      child.userData.basePosition = child.position.clone();
    }
  });
  collectFingerGroups();
  applyOpenness(Number(opennessSlider.value) / 100);
  await updatePadDimensions(size, currentToken);

  // Update fruit visibility based on current size
  updateFruitVisibility(size);
  positionFruits();

  const missing = results.filter((loaded) => !loaded).length;
  if (missing > 0) {
    console.warn(`Size ${size} missing ${missing} part(s).`);
  }

  prefetchAdjacentSizes(size);
}

async function updatePadDimensions(size, token) {
  try {
    const response = await fetch(`GripGen/output/${size}/pad_dimensions.txt`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Missing pad_dimensions.txt for size ${size}`);
    }
    const text = await response.text();
    if (token !== loadToken) return;
    const parsed = parsePadDimensions(text);
    if (parsed) {
      sizeReadout.textContent = `${(parsed.y * parsed.z).toFixed(1)} mm²`;
      padDimsReadout.textContent = `Y: ${parsed.y} mm, Z: ${parsed.z} mm`;
    } else {
      sizeReadout.textContent = "Pad size unavailable";
      padDimsReadout.textContent = "Y: -- mm, Z: -- mm";
    }
  } catch (error) {
    if (token !== loadToken) return;
    sizeReadout.textContent = "Pad size unavailable";
    padDimsReadout.textContent = "Y: -- mm, Z: -- mm";
  }
}

function parsePadDimensions(text) {
  const match = text.match(/X:\s*([0-9.]+)\s*[\r\n]+Y:\s*([0-9.]+)\s*[\r\n]+Z:\s*([0-9.]+)/i);
  if (!match) return null;
  return { x: match[1], y: match[2], z: match[3] };
}

function updateTactileImage(openness) {
  const stepIndex = Math.round(openness * (TACTILE_STEPS.length - 1));
  const clampedIndex = Math.min(Math.max(stepIndex, 0), TACTILE_STEPS.length - 1);
  const step = TACTILE_STEPS[clampedIndex];
  tactileImage.src = `${TACTILE_RENDER_BASE}/render_${step}.png`;
  tactileImage.alt = `Gripper internal view at ${Math.round(openness * 100)}% open`;
}

function prefetchAdjacentSizes(size) {
  const index = SIZES.indexOf(size);
  if (index === -1) return;
  const prev = SIZES[index - 1];
  const next = SIZES[index + 1];
  if (prev) prefetchSizeAssets(prev);
  if (next) prefetchSizeAssets(next);
}

function prefetchSizeAssets(size) {
  PARTS.forEach((part) => {
    const url = `GripGen/output/${size}/objs/${part.file}.obj`;
    fetch(url, { cache: "force-cache" }).catch(() => {});
  });
}

async function loadFruitModel(config) {
  return new Promise((resolve) => {
    // Try to load with texture directly for best results
    const loader = new OBJLoader();
    
    loader.load(
      config.objPath,
      (obj) => {
        obj.scale.setScalar(config.scale);
        obj.userData.label = config.label;
        obj.userData.isFruit = true;
        
        // Try to load the base color texture
        textureLoader.load(
          config.texturePath,
          (texture) => {
            // Texture loaded successfully
            texture.colorSpace = THREE.SRGBColorSpace;
            const material = new THREE.MeshStandardMaterial({
              map: texture,
              roughness: 0.5,
              metalness: 0.05,
            });
            obj.traverse((child) => {
              if (child.isMesh) {
                child.material = material;
                child.userData.label = config.label;
              }
            });
            resolve(obj);
          },
          undefined,
          () => {
            // Texture failed, apply fallback colors
            applyFallbackColors(obj, config);
            resolve(obj);
          }
        );
      },
      undefined,
      () => resolve(null)
    );
  });
}

function applyFallbackColors(obj, config) {
  if (config === FRUIT_CONFIG.strawberry) {
    // Strawberry: red body with green leaves at top
    const strawberryBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xe63946, // Bright strawberry red
      roughness: 0.5,
      metalness: 0.05,
    });
    const strawberryLeavesMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d6a4f, // Forest green for leaves
      roughness: 0.6,
      metalness: 0.0,
    });
    
    // Find the overall bounding box to determine leaf threshold
    let globalMaxY = -Infinity;
    let globalMinY = Infinity;
    obj.traverse((child) => {
      if (child.isMesh && child.geometry && child.geometry.attributes.position) {
        const positions = child.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const y = positions.getY(i);
          globalMaxY = Math.max(globalMaxY, y);
          globalMinY = Math.min(globalMinY, y);
        }
      }
    });
    
    const height = globalMaxY - globalMinY;
    const leafThreshold = globalMinY + height * 0.78; // Top ~22% is leaves/calyx
    
    obj.traverse((child) => {
      if (child.isMesh) {
        child.userData.label = config.label;
        const geometry = child.geometry;
        
        if (geometry && geometry.attributes && geometry.attributes.position) {
          const positions = geometry.attributes.position;
          
          // Calculate how many vertices are in the "leaf" region
          let leafVertices = 0;
          for (let i = 0; i < positions.count; i++) {
            if (positions.getY(i) > leafThreshold) {
              leafVertices++;
            }
          }
          
          // If more than 30% of vertices are in leaf region, it's likely leaves
          if (leafVertices / positions.count > 0.3) {
            child.material = strawberryLeavesMaterial;
          } else {
            child.material = strawberryBodyMaterial;
          }
        } else {
          child.material = strawberryBodyMaterial;
        }
      }
    });
  } else if (config === FRUIT_CONFIG.apple) {
    // Apple: red body with brown stem
    const appleBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xc1121f, // Deep apple red
      roughness: 0.3,
      metalness: 0.1,
    });
    const appleStemMaterial = new THREE.MeshStandardMaterial({
      color: 0x5c4033, // Brown stem
      roughness: 0.8,
      metalness: 0.0,
    });
    
    // Find global bounds
    let globalMaxY = -Infinity;
    obj.traverse((child) => {
      if (child.isMesh && child.geometry && child.geometry.attributes.position) {
        const positions = child.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          globalMaxY = Math.max(globalMaxY, positions.getY(i));
        }
      }
    });
    
    obj.traverse((child) => {
      if (child.isMesh) {
        child.userData.label = config.label;
        const geometry = child.geometry;
        
        if (geometry && geometry.attributes && geometry.attributes.position) {
          const positions = geometry.attributes.position;
          
          // Check if this is a small mesh at the very top (stem)
          let avgY = 0;
          let minLocalY = Infinity;
          for (let i = 0; i < positions.count; i++) {
            avgY += positions.getY(i);
            minLocalY = Math.min(minLocalY, positions.getY(i));
          }
          avgY /= positions.count;
          
          // Stem: small mesh, mostly at top, thin
          if (positions.count < 1000 && minLocalY > globalMaxY * 0.85) {
            child.material = appleStemMaterial;
          } else {
            child.material = appleBodyMaterial;
          }
        } else {
          child.material = appleBodyMaterial;
        }
      }
    });
  }
}

async function loadFruits() {
  if (fruitsLoaded) return;

  const [strawberry, apple] = await Promise.all([
    loadFruitModel(FRUIT_CONFIG.strawberry),
    loadFruitModel(FRUIT_CONFIG.apple),
  ]);

  if (strawberry) {
    strawberryObject = strawberry;
    strawberryObject.visible = false;
    scene.add(strawberryObject);
  }

  if (apple) {
    appleObject = apple;
    appleObject.visible = false;
    scene.add(appleObject);
  }

  fruitsLoaded = true;
}

function updateFruitVisibility(size) {
  currentGripperSize = size;
  if (!fruitsLoaded) return;

  // Check user override, otherwise use auto-visibility based on size
  if (strawberryObject) {
    const autoVisible = size === FRUIT_CONFIG.strawberry.targetSize;
    strawberryObject.visible = fruitUserOverride.strawberry !== null 
      ? fruitUserOverride.strawberry 
      : autoVisible;
  }
  if (appleObject) {
    const autoVisible = size === FRUIT_CONFIG.apple.targetSize;
    appleObject.visible = fruitUserOverride.apple !== null 
      ? fruitUserOverride.apple 
      : autoVisible;
  }

  // Update component list checkboxes
  updateFruitCheckboxes();
}

function updateFruitCheckboxes() {
  const strawberryCheckbox = document.getElementById("fruit-strawberry-checkbox");
  const appleCheckbox = document.getElementById("fruit-apple-checkbox");
  
  if (strawberryCheckbox && strawberryObject) {
    strawberryCheckbox.checked = strawberryObject.visible;
  }
  if (appleCheckbox && appleObject) {
    appleCheckbox.checked = appleObject.visible;
  }
}

function positionFruits() {
  if (!fruitsLoaded) return;

  // Position fruit in the center of the gripper grasp area
  // The gripper is centered at origin after framing
  if (strawberryObject) {
    strawberryObject.position.set(0, FRUIT_CONFIG.strawberry.yOffset, 0);
  }
  if (appleObject) {
    appleObject.position.set(0, FRUIT_CONFIG.apple.yOffset, 0);
  }
}

function setPartVisibility(partFile, visible) {
  componentVisibility.set(partFile, visible);
  const obj = componentObjects.get(partFile);
  if (obj) {
    obj.visible = visible;
  }
}

function buildComponentList() {
  componentList.innerHTML = "";
  
  // Add fruit reference section first
  const fruitSection = document.createElement("div");
  fruitSection.className = "gripper-component-group gripper-fruit-section";
  
  const fruitHeader = document.createElement("div");
  fruitHeader.className = "gripper-component-group-header gripper-fruit-header";
  
  const fruitTitle = document.createElement("span");
  fruitTitle.textContent = "Size Reference";
  fruitTitle.style.fontWeight = "600";
  fruitHeader.appendChild(fruitTitle);
  fruitSection.appendChild(fruitHeader);
  
  const fruitItems = document.createElement("div");
  fruitItems.className = "gripper-component-items gripper-fruit-items";
  
  // Strawberry toggle
  const strawberryItem = document.createElement("label");
  strawberryItem.className = "gripper-component-item";
  const strawberryCheckbox = document.createElement("input");
  strawberryCheckbox.type = "checkbox";
  strawberryCheckbox.id = "fruit-strawberry-checkbox";
  strawberryCheckbox.checked = strawberryObject ? strawberryObject.visible : false;
  strawberryCheckbox.addEventListener("change", () => {
    fruitUserOverride.strawberry = strawberryCheckbox.checked;
    if (strawberryObject) strawberryObject.visible = strawberryCheckbox.checked;
    // If showing strawberry, hide apple (only one fruit at a time)
    if (strawberryCheckbox.checked && appleObject) {
      appleObject.visible = false;
      fruitUserOverride.apple = false;
      const appleChk = document.getElementById("fruit-apple-checkbox");
      if (appleChk) appleChk.checked = false;
    }
  });
  const strawberryLabel = document.createElement("span");
  strawberryLabel.innerHTML = "Strawberry <small style='opacity:0.7'>(for 1.0x)</small>";
  strawberryItem.appendChild(strawberryCheckbox);
  strawberryItem.appendChild(strawberryLabel);
  fruitItems.appendChild(strawberryItem);
  
  // Apple toggle
  const appleItem = document.createElement("label");
  appleItem.className = "gripper-component-item";
  const appleCheckbox = document.createElement("input");
  appleCheckbox.type = "checkbox";
  appleCheckbox.id = "fruit-apple-checkbox";
  appleCheckbox.checked = appleObject ? appleObject.visible : false;
  appleCheckbox.addEventListener("change", () => {
    fruitUserOverride.apple = appleCheckbox.checked;
    if (appleObject) appleObject.visible = appleCheckbox.checked;
    // If showing apple, hide strawberry (only one fruit at a time)
    if (appleCheckbox.checked && strawberryObject) {
      strawberryObject.visible = false;
      fruitUserOverride.strawberry = false;
      const strawberryChk = document.getElementById("fruit-strawberry-checkbox");
      if (strawberryChk) strawberryChk.checked = false;
    }
  });
  const appleLabel = document.createElement("span");
  appleLabel.innerHTML = "Apple <small style='opacity:0.7'>(for 2.0x)</small>";
  appleItem.appendChild(appleCheckbox);
  appleItem.appendChild(appleLabel);
  fruitItems.appendChild(appleItem);
  
  fruitSection.appendChild(fruitItems);
  componentList.appendChild(fruitSection);
  
  // Add gripper component groups
  Object.entries(COMPONENT_GROUPS).forEach(([groupName, partFiles]) => {
    const groupWrapper = document.createElement("div");
    groupWrapper.className = "gripper-component-group";

    const header = document.createElement("label");
    header.className = "gripper-component-group-header";

    const title = document.createElement("span");
    title.textContent = groupName;

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "gripper-component-toggle";
    const isExpanded = groupExpanded.get(groupName) === true;
    toggleButton.setAttribute("aria-expanded", String(isExpanded));
    toggleButton.textContent = isExpanded ? "Hide" : "Show";

    const groupCheckbox = document.createElement("input");
    groupCheckbox.type = "checkbox";
    const allChecked = partFiles.every((file) => componentVisibility.get(file) !== false);
    const anyChecked = partFiles.some((file) => componentVisibility.get(file) !== false);
    groupCheckbox.checked = allChecked;
    groupCheckbox.indeterminate = !allChecked && anyChecked;
    groupCheckbox.addEventListener("change", () => {
      partFiles.forEach((file) => setPartVisibility(file, groupCheckbox.checked));
      buildComponentList();
    });

    header.appendChild(groupCheckbox);
    header.appendChild(title);
    header.appendChild(toggleButton);
    groupWrapper.appendChild(header);

    const items = document.createElement("div");
    items.className = `gripper-component-items${isExpanded ? "" : " is-collapsed"}`;
    toggleButton.addEventListener("click", () => {
      const isHidden = items.classList.toggle("is-collapsed");
      toggleButton.textContent = isHidden ? "Show" : "Hide";
      toggleButton.setAttribute("aria-expanded", String(!isHidden));
      groupExpanded.set(groupName, !isHidden);
    });

    partFiles.forEach((file) => {
      const part = PARTS.find((entry) => entry.file === file);
      if (!part) return;

      const item = document.createElement("label");
      item.className = "gripper-component-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = componentVisibility.get(part.file) !== false;
      checkbox.addEventListener("change", () => {
        setPartVisibility(part.file, checkbox.checked);
        buildComponentList();
      });

      const name = document.createElement("span");
      name.textContent = part.label;

      item.appendChild(checkbox);
      item.appendChild(name);
      items.appendChild(item);
    });

    groupWrapper.appendChild(items);
    componentList.appendChild(groupWrapper);
  });
}

function applyOpenness(openness) {
  const perFingerOffset = fingerOpenDistance * 0.5 * openness;
  group.children.forEach((child) => {
    const base = child.userData.basePosition;
    if (!base) return;
    child.position.copy(base);
  });

  leftFinger.forEach((child) => {
    const base = child.userData.basePosition;
    if (!base) return;
    child.position.copy(base).addScaledVector(openAxis, perFingerOffset);
  });
  rightFinger.forEach((child) => {
    const base = child.userData.basePosition;
    if (!base) return;
    child.position.copy(base).addScaledVector(openAxis, -perFingerOffset);
  });

  const labelText = openness >= 0.95 ? "Open" : openness <= 0.05 ? "Closed" : "Partial";
  opennessValue.textContent = labelText;
  updateTactileImage(openness);
}

function setSizeByIndex(index) {
  const clamped = Math.min(Math.max(index, 0), SIZES.length - 1);
  const size = SIZES[clamped];
  slider.value = String(clamped);
  sizeValue.textContent = `${size}x`;
  slider.setAttribute("aria-valuetext", `${size}x`);
  loadSize(size);
}

function findLabelForObject(object) {
  let current = object;
  while (current) {
    if (current.userData && current.userData.label) {
      return current.userData.label;
    }
    current = current.parent;
  }
  return null;
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // Include both gripper parts and fruit objects
  const objectsToCheck = [...group.children];
  if (strawberryObject && strawberryObject.visible) objectsToCheck.push(strawberryObject);
  if (appleObject && appleObject.visible) objectsToCheck.push(appleObject);

  const hits = raycaster.intersectObjects(objectsToCheck, true);
  if (!hits.length) {
    resetLabel();
    return;
  }

  const hit = hits[0];
  const labelText = findLabelForObject(hit.object);
  if (!labelText) return;

  lastHitPoint = hit.point.clone();
  lastLabel = labelText;
  labelName.textContent = lastLabel;
  label.classList.add("visible");
  label.setAttribute("aria-hidden", "false");
  updateLabelPosition();
});

slider.addEventListener("input", () => {
  const index = Number(slider.value);
  setSizeByIndex(index);
});

opennessSlider.addEventListener("input", () => {
  applyOpenness(Number(opennessSlider.value) / 100);
});

window.addEventListener("resize", () => {
  resizeRenderer();
});

slider.min = "0";
slider.max = String(SIZES.length - 1);
slider.step = "1";
opennessSlider.min = "0";
opennessSlider.max = "100";
opennessSlider.step = "1";
opennessSlider.value = "0";

resizeRenderer();
buildComponentList();
loadFruits(); // Load fruit reference objects
setSizeByIndex(SIZES.indexOf("1.5"));
applyOpenness(0);
animate();
