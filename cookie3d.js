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
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
renderer.setSize(stageEl.clientWidth, stageEl.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
stageEl.appendChild(renderer.domElement);

/* ---------- Scene / Camera ---------- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, stageEl.clientWidth / stageEl.clientHeight, 0.1, 50);
camera.position.set(0, 0.22, 3.25);

/* ---------- Candy-Premium Lights (soft, cheap) ---------- */
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(2.6, 3.0, 2.4);
scene.add(key);

const fill = new THREE.DirectionalLight(0xfff0f7, 0.70);
fill.position.set(-2.8, 1.6, 2.2);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.45);
rim.position.set(0, 2.0, -3.2);
scene.add(rim);

scene.add(new THREE.AmbientLight(0xffffff, 0.32));

/* ---------- Fake Ground + Shadow Blob (no shadowmaps) ---------- */
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.25, PERF === "low" ? 48 : 64),
  new THREE.MeshStandardMaterial({ color: 0xfff7fb, roughness: 0.95, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.66;
scene.add(ground);

const shadowTex = makeShadowTexture();
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.5, 2.5),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.34, depthWrite: false })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -0.659;
scene.add(shadow);

/* ---------- Cookie geometry (more cookie-like than a flat cylinder) ---------- */
const cookieGeo = makeCookieGeometry(PERF);

/* two meshes for crossfade (A visible, B fades in) */
const matA = new THREE.MeshStandardMaterial({ color: 0xD7A36A, roughness: 0.78, metalness: 0 });
const matB = matA.clone();
matB.transparent = true;
matB.opacity = 0;

const cookieA = new THREE.Mesh(cookieGeo, matA);
const cookieB = new THREE.Mesh(cookieGeo, matB);
cookieA.position.y = 0.0;
cookieB.position.y = 0.0;
scene.add(cookieA, cookieB);

/* ---------- “Crumbs” (cheap points) to add cookie realism without heavy maps) ---------- */
const crumbs = makeCrumbs(PERF);
scene.add(crumbs);

/* ---------- Deco (Instanced) ---------- */
const deco = makeDeco(PERF);
scene.add(deco.group);

/* ---------- Presets (strict separation) ---------- */
const PRESETS = {
  classic: {
    name: "Classic",
    color: 0xD7A36A,
    rough: 0.78,
    scaleY: 1.00,
    glaze: 0.00, // keep 0 for classic
    decoMode: "sprinkles",
    decoCount: PERF === "low" ? 70 : PERF === "mid" ? 110 : 150,
    decoSize: 0.028,
    crumb: 0.07,
  },
  chunky: {
    name: "Chunky",
    color: 0xC98E55,
    rough: 0.86,
    scaleY: 1.22,
    glaze: 0.00, // no candy sheen here
    decoMode: "chunks",
    decoCount: PERF === "low" ? 12 : PERF === "mid" ? 16 : 22,
    decoSize: 0.075,
    crumb: 0.09,
  },
  soft: {
    name: "Soft",
    color: 0xE2B07A,
    rough: 0.62,
    scaleY: 0.95,
    glaze: 0.10, // tiny sheen, candy premium vibe (still subtle)
    decoMode: "sprinkles",
    decoCount: PERF === "low" ? 95 : PERF === "mid" ? 140 : 190,
    decoSize: 0.022,
    crumb: 0.05,
  },
};

let activeStyle = "classic";
let activeSeed = 1337;

/* ---------- Apply preset instantly on load ---------- */
applyPresetInstant(PRESETS.classic, activeSeed);

/* ---------- Drag control (2D + “gravity” feel: diagonal tilt) ---------- */
let isDown = false;
let lastX = 0, lastY = 0;
let rotY = 0;
let tiltX = 0;
let velY = 0, velX = 0;

renderer.domElement.style.touchAction = "none";

renderer.domElement.addEventListener("pointerdown", (e) => {
  isDown = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener("pointerup", () => (isDown = false));
window.addEventListener("pointermove", (e) => {
  if (!isDown) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  velY = dx * 0.004;
  velX = dy * 0.0026;
  rotY += velY;
  tiltX += velX;
  tiltX = clamp(tiltX, -0.45, 0.35);
});

/* ---------- Crossfade switch ---------- */
let fadeT = 0;
let fading = false;

function switchStyle(nextStyle){
  if (!PRESETS[nextStyle] || nextStyle === activeStyle) return;

  // keep same seed when user manually chooses style
  const p = PRESETS[nextStyle];

  // set B to target preset
  applyPresetTo(cookieB, matB, p, activeSeed);
  matB.opacity = 0;
  matA.transparent = true;
  matA.opacity = 1;

  cookieB.rotation.copy(cookieA.rotation);
  cookieB.scale.copy(cookieA.scale);

  fading = true;
  fadeT = 0;
  activeStyle = nextStyle;
}

function tickFade(dt){
  if (!fading) return;
  fadeT += dt;
  const dur = 0.22;
  const t = Math.min(fadeT / dur, 1);
  const ease = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;

  matB.opacity = ease;
  matA.opacity = 1 - ease;

  if (t >= 1){
    // commit final state to A (stable)
    applyPresetTo(cookieA, matA, PRESETS[activeStyle], activeSeed);
    matA.opacity = 1;
    matA.transparent = false;
    matB.opacity = 0;
    fading = false;
  }
}

/* ---------- Surprise: random style + new seed + micro motion kick ---------- */
function randomPreset(){
  const styles = ["classic","chunky","soft"];
  // weighted: chunky a bit more prominent (hero/hall logic)
  const r = Math.random();
  const nextStyle = (r < 0.42) ? "chunky" : (r < 0.74) ? "soft" : "classic";

  activeSeed = (Math.random()*1e9) | 0;

  // add a “wow” kick: diagonal impulse
  velY += (Math.random() * 0.9 + 0.35) * (Math.random() < 0.5 ? -1 : 1);
  velX += (Math.random() * 0.45 + 0.18) * (Math.random() < 0.5 ? -1 : 1);

  switchStyle(nextStyle);
}

/* expose hooks to index.html */
window.switchStyle = switchStyle;
window.randomPreset = randomPreset;
window.getActiveStyle = () => activeStyle;

/* ---------- Loop: pause offscreen / tab hidden ---------- */
let running = true;
let rafId = 0;

const io = new IntersectionObserver((entries)=>{
  const v = entries[0]?.isIntersecting;
  running = !!v;
  if (running) loop();
  else cancelAnimationFrame(rafId);
},{ threshold: 0.15 });
io.observe(stageEl);

document.addEventListener("visibilitychange", ()=>{
  running = document.visibilityState === "visible";
  if (running) loop();
  else cancelAnimationFrame(rafId);
});

window.addEventListener("resize", ()=>{
  const w = stageEl.clientWidth;
  const h = stageEl.clientHeight;
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

/* ---------- Main loop ---------- */
let last = performance.now();
function loop(now = performance.now()){
  if(!running) return;
  rafId = requestAnimationFrame(loop);

  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  // auto-rotate (slow)
  const auto = prefersReducedMotion ? 0 : 0.20;

  // inertia decay
  velY *= 0.92;
  velX *= 0.90;

  rotY += (auto + velY) * dt;
  tiltX += (velX) * dt;
  tiltX = clamp(tiltX, -0.45, 0.35);

  // apply to both meshes so fade stays aligned
  cookieA.rotation.y = rotY;
  cookieB.rotation.y = rotY;

  // “gravity” tilt + tiny breathing
  const breathe = Math.sin(now * 0.00055) * 0.045;
  cookieA.rotation.x = breathe + tiltX;
  cookieB.rotation.x = cookieA.rotation.x;

  tickFade(dt);

  renderer.render(scene, camera);
}

/* start */
loop();

/* ---------- Helpers ---------- */
function makeCookieGeometry(perf){
  const seg = perf === "low" ? 56 : perf === "mid" ? 72 : 96;

  // cookie profile: slightly domed top + softer edge
  // Use LatheGeometry: quick, looks more cookie-like than cylinder
  const pts = [];
  const r = 1.02;
  pts.push(new THREE.Vector2(0.0, -0.18));
  pts.push(new THREE.Vector2(r*0.90, -0.18));
  pts.push(new THREE.Vector2(r*0.98, -0.12));
  pts.push(new THREE.Vector2(r*1.00,  0.00));
  pts.push(new THREE.Vector2(r*0.92,  0.12));
  pts.push(new THREE.Vector2(r*0.65,  0.18));
  pts.push(new THREE.Vector2(0.0,  0.20));

  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateY(Math.PI / seg);
  return g;
}

function makeShadowTexture(){
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");
  const grd = ctx.createRadialGradient(128,128,22, 128,128,120);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,c.width,c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeDeco(perf){
  const group = new THREE.Group();

  const max = perf === "low" ? 220 : perf === "mid" ? 260 : 320;

  const geom = new THREE.SphereGeometry(0.02, perf === "low" ? 8 : 10, perf === "low" ? 8 : 10);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0 });

  const inst = new THREE.InstancedMesh(geom, mat, max);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(inst);

  return { group, inst, mode:"sprinkles", count:110, size:0.02 };
}

function layoutDeco(mesh, decoObj, seed){
  const { inst, count, size, mode } = decoObj;
  const rng = mulberry32(seed);

  const dummy = new THREE.Object3D();
  const r = 0.92;

  for(let i=0;i<inst.count;i++){
    if(i >= count){
      dummy.position.set(0,-10,0);
      dummy.scale.setScalar(0.0001);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      continue;
    }

    const a = rng() * Math.PI * 2;
    const rr = r * Math.sqrt(rng());
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;

    const yTop = 0.18 * mesh.scale.y + 0.02;

    dummy.position.set(x, yTop, z);

    const s = (mode === "chunks")
      ? size * (0.85 + rng()*0.65)
      : size * (0.80 + rng()*0.55);
    dummy.scale.setScalar(s);

    // subtle randomness
    dummy.rotation.set(rng()*0.25, rng()*Math.PI, rng()*0.25);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
}

function makeCrumbs(perf){
  const count = perf === "low" ? 220 : perf === "mid" ? 320 : 420;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const a = new Float32Array(count);

  for(let i=0;i<count;i++){
    pos[i*3+0] = (Math.random()*2-1) * 0.95;
    pos[i*3+1] = 0.18 + Math.random()*0.06;
    pos[i*3+2] = (Math.random()*2-1) * 0.95;
    a[i] = Math.random();
  }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("a", new THREE.BufferAttribute(a, 1));

  const m = new THREE.PointsMaterial({
    color: 0xB07A45,
    size: perf === "low" ? 0.010 : 0.009,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });

  const pts = new THREE.Points(g, m);
  return pts;
}

function applyPresetInstant(preset, seed){
  applyPresetTo(cookieA, matA, preset, seed);
  matA.opacity = 1;
  matA.transparent = false;
  matB.opacity = 0;
}

function applyPresetTo(mesh, mat, preset, seed){
  mat.color.setHex(preset.color);
  mat.roughness = preset.rough;
  mat.metalness = 0;

  // candy premium “soft” has tiny sheen: use clearcoat cheaply
  if (preset.glaze > 0){
    mat.clearcoat = preset.glaze;
    mat.clearcoatRoughness = 0.35;
  } else {
    mat.clearcoat = 0;
    mat.clearcoatRoughness = 0;
  }

  mesh.scale.set(1, preset.scaleY, 1);

  // deco params + deterministic layout
  deco.mode = preset.decoMode;
  deco.count = preset.decoCount;
  deco.size = preset.decoSize;
  layoutDeco(mesh, deco, seed ^ 0x9e3779b9);
}

function mulberry32(a){
  return function(){
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
