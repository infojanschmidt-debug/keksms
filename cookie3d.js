import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const stageEl = document.getElementById("k3dStage");
if (!stageEl) throw new Error("k3dStage fehlt");

const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

const PERF = (() => {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (mem <= 3 || cores <= 4) return "low";
  if (mem <= 6 || cores <= 6) return "mid";
  return "high";
})();

const DPR_CAP = PERF === "low" ? 1.25 : 1.5;

/* ---------- Renderer ---------- */
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
renderer.setSize(stageEl.clientWidth, stageEl.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
stageEl.appendChild(renderer.domElement);

/* ---------- Scene / Camera ---------- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, stageEl.clientWidth / stageEl.clientHeight, 0.1, 50);
camera.position.set(0, 0.22, 3.05);

/* ---------- Lights (Candy Premium) ---------- */
const key = new THREE.DirectionalLight(0xffffff, 1.05);
key.position.set(2.6, 3.1, 2.3);
scene.add(key);

const fill = new THREE.DirectionalLight(0xfff0f7, 0.70);
fill.position.set(-2.6, 1.4, 2.0);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.40);
rim.position.set(0, 2.1, -3.0);
scene.add(rim);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));

/* ---------- Ground + Shadow Blob ---------- */
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.15, PERF === "low" ? 48 : 64),
  new THREE.MeshStandardMaterial({ color: 0xfff7fb, roughness: 0.95, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.62;
scene.add(ground);

const shadowTex = makeShadowTexture();
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.2, 2.2),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.35, depthWrite: false })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -0.619;
scene.add(shadow);

/* ---------- Cookie Mesh (A/B for crossfade) ---------- */
const geo = makeCookieGeometry(PERF);
const matA = new THREE.MeshStandardMaterial({ color: 0xD7A36A, roughness: 0.78, metalness: 0 });
const matB = matA.clone();
matB.transparent = true;
matB.opacity = 0.0;

const cookieA = new THREE.Mesh(geo, matA);
const cookieB = new THREE.Mesh(geo, matB);
scene.add(cookieA, cookieB);

/* ---------- Deco (Instanced with per-instance color) ---------- */
const deco = makeDeco(PERF);
scene.add(deco.group);

/* ---------- Drag Rotate (2D drag => 3D feel) ---------- */
let isDown = false;
let lastX = 0;
let lastY = 0;
let rotY = 0;
let rotX = 0;
let velY = 0;
let velX = 0;

renderer.domElement.style.touchAction = "none";

renderer.domElement.addEventListener("pointerdown", (e) => {
  isDown = true;
  lastX = e.clientX;
  lastY = e.clientY;
  renderer.domElement.setPointerCapture?.(e.pointerId);
});
renderer.domElement.addEventListener("pointerup", () => (isDown = false));
renderer.domElement.addEventListener("pointercancel", () => (isDown = false));
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!isDown) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  velY = dx * 0.0045;
  velX = dy * 0.0032;

  rotY += velY;
  rotX += velX;
  rotX = clamp(rotX, -0.55, 0.35);
});

/* ---------- BASE STYLES (keine Premium-Locks, nur Feel) ---------- */
const STYLES = {
  classic: {
    color: 0xD7A36A,
    rough: 0.78,
    scaleY: 1.00,
    mode: "sprinkles",
    count: PERF === "low" ? 80 : PERF === "mid" ? 120 : 160,
    size: 0.028,
  },
  chunky: {
    color: 0xC98E55,
    rough: 0.86,
    scaleY: 1.22,
    mode: "chunks",
    count: PERF === "low" ? 16 : PERF === "mid" ? 22 : 30,
    size: 0.070,
  },
  soft: {
    color: 0xE2B07A,
    rough: 0.62,
    scaleY: 0.95,
    mode: "sprinkles",
    count: PERF === "low" ? 110 : PERF === "mid" ? 150 : 200,
    size: 0.022,
  },
};

/* ---------- 3 SEED-VARIANTS pro Style (Candy Premium V3) ----------
   Ziel: “Oh… der ist ja geil.” statt “ich hab was eingestellt”.
   Jede Variant = Pattern + Palette + Layout-Rule.
*/
const VARIANTS = {
  classic: [
    {
      id: "ring",
      label: "Ring",
      palette: ["#ffffff", "#ff4fa3", "#ffd2e6", "#ffe45c", "#8be9ff"],
      layout: "ring", // ring-ish distribution
    },
    {
      id: "sprinkleRain",
      label: "Sprinkle Rain",
      palette: ["#ffffff", "#ff7bbf", "#ff4fa3", "#b56bff", "#4aa3ff"],
      layout: "uniform",
    },
    {
      id: "heartPop",
      label: "Heart Pop",
      palette: ["#ffffff", "#ff4fa3", "#ff7bbf", "#ffe3ef"],
      layout: "cluster", // one “cute” cluster
    }
  ],
  chunky: [
    {
      id: "chocoBoulders",
      label: "Choco Boulders",
      palette: ["#3a241a", "#4a2f22", "#2b1a12", "#6b3f2e"],
      layout: "uniform",
    },
    {
      id: "doubleChunk",
      label: "Double Chunk",
      palette: ["#2b1a12", "#3a241a", "#4a2f22", "#b47a43"],
      layout: "ring",
    },
    {
      id: "centerCrown",
      label: "Center Crown",
      palette: ["#2b1a12", "#3a241a", "#4a2f22"],
      layout: "cluster",
    }
  ],
  soft: [
    {
      id: "confetti",
      label: "Confetti",
      palette: ["#ffffff", "#ff7bbf", "#ff4fa3", "#ffe45c", "#9cffc8"],
      layout: "uniform",
    },
    {
      id: "pastelRing",
      label: "Pastel Ring",
      palette: ["#ffffff", "#ffd2e6", "#ffe3ef", "#8be9ff", "#b56bff"],
      layout: "ring",
    },
    {
      id: "sweetSpot",
      label: "Sweet Spot",
      palette: ["#ffffff", "#ff7bbf", "#ffe3ef", "#ffd2e6"],
      layout: "cluster",
    }
  ],
};

/* ---------- Hidden Mood Bias (Option B) ----------
   Keine UI, kein Extra Screen.
   Du kannst später Mood setzen via:
   localStorage.setItem("ok_mood","ehrlich|kraeftig|suess")
   oder URL: ?mood=ehrlich  (optional, falls du willst)
*/
function getMood() {
  const u = new URL(location.href);
  const q = u.searchParams.get("mood");
  const v = (q || localStorage.getItem("ok_mood") || "").toLowerCase().trim();
  if (v === "ehrlich" || v === "kraeftig" || v === "suess") return v;
  return null;
}

/* weights: Mood beeinflusst Surprise (unsichtbar) */
function pickStyleWeighted(rng) {
  const mood = getMood();
  const w = mood === "kraeftig"
    ? { classic: 0.20, chunky: 0.55, soft: 0.25 }
    : mood === "suess"
      ? { classic: 0.25, chunky: 0.15, soft: 0.60 }
      : mood === "ehrlich"
        ? { classic: 0.60, chunky: 0.20, soft: 0.20 }
        : { classic: 0.38, chunky: 0.27, soft: 0.35 };

  const r = rng();
  let acc = 0;
  for (const k of Object.keys(w)) {
    acc += w[k];
    if (r <= acc) return k;
  }
  return "classic";
}

/* ---------- State ---------- */
let activeStyle = "classic";
let activeSeed = 12345;
let activeVariantId = VARIANTS.classic[0].id;

/* ---------- Crossfade Switch ---------- */
let fadeT = 0;
let fading = false;

function switchStyle(nextStyle, nextSeed = activeSeed, nextVariantId = activeVariantId) {
  if (!STYLES[nextStyle]) return;

  // apply to B (invisible)
  applyPresetTo(cookieB, matB, nextStyle, nextSeed, nextVariantId);
  cookieB.rotation.copy(cookieA.rotation);
  cookieB.scale.copy(cookieA.scale);

  matB.opacity = 0.0;
  matA.opacity = 1.0;
  matA.transparent = true;

  fading = true;
  fadeT = 0;

  activeStyle = nextStyle;
  activeSeed = nextSeed;
  activeVariantId = nextVariantId;
}

function tickFade(dt) {
  if (!fading) return;
  fadeT += dt;
  const dur = 0.24;
  const t = Math.min(fadeT / dur, 1);
  const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  matB.opacity = ease;
  matA.opacity = 1 - ease;

  if (t >= 1) {
    applyPresetTo(cookieA, matA, activeStyle, activeSeed, activeVariantId);
    matA.opacity = 1.0;
    matA.transparent = false;
    matB.opacity = 0.0;
    fading = false;
  }
}

/* ---------- Apply style + variant ---------- */
function applyPresetTo(mesh, mat, styleKey, seed, variantId) {
  const s = STYLES[styleKey];
  mat.color.setHex(s.color);
  mat.roughness = s.rough;
  mat.metalness = 0;

  mesh.scale.set(1, s.scaleY, 1);

  const variant = (VARIANTS[styleKey] || []).find(v => v.id === variantId) || VARIANTS[styleKey][0];
  layoutDeco(mesh, deco, s, variant, seed);
}

/* ---------- Deco layout with palette + pattern ---------- */
function layoutDeco(cookieMesh, decoObj, style, variant, seed) {
  const { inst } = decoObj;
  const count = style.count;
  const size = style.size;
  const mode = style.mode;

  const rng = mulberry32(seed || 12345);

  const dummy = new THREE.Object3D();
  const rMax = 0.92;

  // base top height depends on style thickness
  const yTop = (0.17 * cookieMesh.scale.y) + 0.02;

  // pattern helpers
  const layout = variant.layout;
  const palette = variant.palette || ["#ffffff"];

  // cluster center for “sweetSpot/heartPop/centerCrown”
  const clusterA = rng() * Math.PI * 2;
  const clusterR = 0.35 + rng() * 0.15;
  const clusterCx = Math.cos(clusterA) * clusterR;
  const clusterCz = Math.sin(clusterA) * clusterR;

  for (let i = 0; i < inst.count; i++) {
    if (i >= count) {
      dummy.scale.setScalar(0.0001);
      dummy.position.set(0, -10, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, new THREE.Color("#ffffff"));
      continue;
    }

    let a = rng() * Math.PI * 2;
    let rr = rMax * Math.sqrt(rng());

    if (layout === "ring") {
      // bias to outer ring
      const t = rng();
      rr = rMax * (0.72 + t * 0.28);
    } else if (layout === "cluster") {
      // bias to a cute cluster
      const t = rng();
      rr = (0.12 + t * 0.38);
      a = clusterA + (rng() - 0.5) * 1.25;
    }

    let x = Math.cos(a) * rr;
    let z = Math.sin(a) * rr;

    if (layout === "cluster") {
      // pull toward cluster center
      x = clusterCx + x * 0.55;
      z = clusterCz + z * 0.55;
    }

    dummy.position.set(x, yTop, z);

    const s = mode === "chunks"
      ? size * (0.85 + rng() * 0.65)
      : size * (0.80 + rng() * 0.55);

    dummy.scale.setScalar(s);

    // “gravity-ish” tilt: chunky sits a bit heavier
    const tilt = mode === "chunks" ? 0.38 : 0.22;
    dummy.rotation.set((rng() - 0.5) * tilt, rng() * Math.PI, (rng() - 0.5) * tilt);

    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);

    // palette color
    const col = palette[Math.floor(rng() * palette.length)];
    inst.setColorAt(i, new THREE.Color(col));
  }

  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
}

/* ---------- Surprise: Style + Variant + Seed (Mood-weighted) ---------- */
function randomPreset() {
  const seed = (Math.random() * 1e9) | 0;
  const rng = mulberry32(seed);

  const style = pickStyleWeighted(rng);
  const variants = VARIANTS[style] || VARIANTS.classic;
  const variant = variants[Math.floor(rng() * variants.length)];

  // “wow” impulse
  velY += (Math.random() * 0.8 + 0.4);
  velX += (Math.random() * 0.25 - 0.12);

  switchStyle(style, seed, variant.id);
  return { style, seed, variant: variant.id };
}

/* expose hooks */
window.switchStyle = (style) => switchStyle(style, activeSeed, activeVariantId);
window.randomPreset = () => randomPreset();

/* ---------- Pause/Resume (offscreen + tab hidden) ---------- */
let running = true;
let rafId = 0;

const io = new IntersectionObserver((entries) => {
  const v = entries[0]?.isIntersecting;
  running = !!v;
  if (running) loop();
  else cancelAnimationFrame(rafId);
}, { threshold: 0.15 });

io.observe(stageEl);

document.addEventListener("visibilitychange", () => {
  running = document.visibilityState === "visible";
  if (running) loop();
  else cancelAnimationFrame(rafId);
});

/* ---------- Resize ---------- */
window.addEventListener("resize", () => {
  const w = stageEl.clientWidth;
  const h = stageEl.clientHeight;
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

/* ---------- Main Loop ---------- */
let last = performance.now();

// Default preset: Classic + Variant 1
applyPresetTo(cookieA, matA, "classic", activeSeed, VARIANTS.classic[0].id);

function loop(now = performance.now()) {
  if (!running) return;
  rafId = requestAnimationFrame(loop);

  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  // Inertia damping
  velY *= 0.92;
  velX *= 0.90;

  // slow auto rotation
  const auto = prefersReducedMotion ? 0 : 0.18;

  rotY += (auto + velY) * dt;
  rotX += (velX) * dt;
  rotX = clamp(rotX, -0.55, 0.35);

  cookieA.rotation.y = rotY;
  cookieB.rotation.y = rotY;

  cookieA.rotation.x = rotX + Math.sin(now * 0.0006) * 0.03;
  cookieB.rotation.x = cookieA.rotation.x;

  tickFade(dt);
  renderer.render(scene, camera);
}
loop();

/* ---------- Helpers ---------- */
function makeDeco(perf) {
  const group = new THREE.Group();

  const geom = new THREE.SphereGeometry(0.02, perf === "low" ? 6 : 8, perf === "low" ? 6 : 8);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0,
    vertexColors: true
  });

  const max = perf === "low" ? 240 : 280;
  const inst = new THREE.InstancedMesh(geom, mat, max);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(inst);

  // init colors
  for (let i = 0; i < max; i++) inst.setColorAt(i, new THREE.Color("#ffffff"));
  inst.instanceColor.needsUpdate = true;

  return { group, inst };
}

function makeCookieGeometry(perf) {
  const seg = perf === "low" ? 56 : perf === "mid" ? 72 : 96;
  const rTop = 1.0;
  const rBot = 0.98;
  const h = 0.34;

  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 2, false);

  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rr = Math.sqrt(x*x + z*z);

    const edge = smoothstep(0.85, 1.02, rr);
    const wob = (Math.sin(x*6.0) + Math.cos(z*6.0)) * 0.006 * edge;

    pos.setX(i, x + (x/Math.max(rr,1e-5))*wob);
    pos.setZ(i, z + (z/Math.max(rr,1e-5))*wob);

    const top = y > 0.10 ? 1 : 0;
    if (top) pos.setY(i, y + (Math.sin((x+z)*8.0) * 0.003));
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function makeShadowTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");
  const grd = ctx.createRadialGradient(128, 128, 26, 128, 128, 120);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function smoothstep(a,b,x){
  const t = clamp((x-a)/(b-a),0,1);
  return t*t*(3-2*t);
}
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
    }
