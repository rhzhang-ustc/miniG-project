import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js";

const viewer = document.getElementById("gripper-viewer");
const slider = document.getElementById("gripper-size");
const sizeValue = document.getElementById("gripper-size-value");
const sizeReadout = document.getElementById("gripper-overall-size");
const padDimsReadout = document.getElementById("gripper-pad-dims");
const opennessSlider = document.getElementById("gripper-openness");
const opennessValue = document.getElementById("gripper-openness-value");
const label = document.getElementById("gripper-part-label");
const labelName = document.getElementById("gripper-part-name");

if (
  !viewer ||
  !slider ||
  !sizeValue ||
  !sizeReadout ||
  !padDimsReadout ||
  !opennessSlider ||
  !opennessValue ||
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
  { file: "Prints_base", label: "Base", color: "#94a3b8" },
  { file: "Prints_motor_mount", label: "Motor mount", color: "#64748b" },
  { file: "Prints_motor_link", label: "Motor link", color: "#475569" },
  { file: "Prints_fingerRack", label: "Finger rack (left)", color: "#1e293b" },
  { file: "Prints_fingerRack.001", label: "Finger rack (right)", color: "#0f172a" },
  { file: "Prints_gear", label: "Gear", color: "#f59e0b" },
  { file: "Prints_camera_housing", label: "Camera housing", color: "#f97316" },
  { file: "Prints_led_cap", label: "LED cap (left)", color: "#fb7185" },
  { file: "Prints_led_cap.001", label: "LED cap (right)", color: "#f43f5e" },
  { file: "Optical_shell_locked", label: "Optical shell (left)", color: "#38bdf8" },
  { file: "Optical_shell_locked.001", label: "Optical shell (right)", color: "#0ea5e9" },
  { file: "Optical_led", label: "Optical LED (left)", color: "#22c55e" },
  { file: "Optical_led.001", label: "Optical LED (right)", color: "#16a34a" },
  { file: "Optical_pad", label: "Optical pad (left)", color: "#14b8a6" },
  { file: "Optical_pad.001", label: "Optical pad (right)", color: "#0d9488" },
];

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
controls.minDistance = 0.5;
controls.maxDistance = 20;

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
        const material = new THREE.MeshStandardMaterial({
          color: part.color,
          roughness: 0.45,
          metalness: 0.05,
        });
        obj.userData.label = part.label;
        obj.userData.partFile = part.file;
        applyMaterial(obj, material, part.label);
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
  const distance = maxDim * 2.2;
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

  const loader = new OBJLoader();
  const results = await Promise.all(
    PARTS.map((part) => loadPart(loader, size, part, currentToken))
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

  const missing = results.filter((loaded) => !loaded).length;
  if (missing > 0) {
    console.warn(`Size ${size} missing ${missing} part(s).`);
  }
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

  const hits = raycaster.intersectObjects(group.children, true);
  if (!hits.length) return;

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
setSizeByIndex(SIZES.indexOf("1.5"));
applyOpenness(0);
animate();
