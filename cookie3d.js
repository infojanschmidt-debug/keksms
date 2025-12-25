// cookie3d.js — OnlyKeks Hybrid Candy Premium v3 (PATCHED)
// Fixes:
// - Removed duplicate "surpriseBtn" click handler (prevents double-trigger)
// - Added RAF guard (prevents multiple RAF loops due to IO + visibility events)
// - Added Pointer Capture (stable drag rotation on touch/mouse)

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { RGBELoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/RGBELoader.js";

const stageEl = document.getElementById("k3dStage");
if (!stageEl) throw new Error("k3dStage fehlt");

const msgEl = document.getElementById("msg");
const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

const PERF = (() => {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (mem <= 3 || cores <= 4) return "low";
  if (mem <= 6 || cores <= 6) return "mid";
  return "high";
})();

const DPR_CAP = PERF === "low" ? 1.25 : 1.5;

// ---------- Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
renderer.setSize(stageEl.clientWidth, stageEl.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = false;
renderer.physicallyCorrectLights = true;

stageEl.appendChild(renderer.domElement);

// ---------- Scene / Camera
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  35,
  stageEl.clientWidth / stageEl.clientHeight,
  0.1,
  60
);
camera.position.set(0, 0.22, 3.15);

// ---------- Lights (soft studio)
const key = new THREE.DirectionalLight(0xffffff, 1.05);
key.position.set(2.8, 3.0, 2.2);
scene.add(key);

const fill = new THREE.DirectionalLight(0xffeef6, 0.65);
fill.position.set(-2.8, 1.7, 2.0);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.35);
rim.position.set(0.2, 2.2, -3.2);
scene.add(rim);

scene.add(new THREE.AmbientLight(0xffffff, 0.18));

// ---------- HDR ENV
const HDR_URL = "./assets/hdri/studio_1k.hdr";

(async function applyHDR() {
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const hdrTex = await new RGBELoader()
      .setDataType(THREE.HalfFloatType)
      .loadAsync(HDR_URL);

    const envMap = pmrem.fromEquirectangular(hdrTex).texture;
    scene.environment = envMap;

    hdrTex.dispose();
    pmrem.dispose();
  } catch (e) {
    console.warn("HDR load failed:", e);
  }
})();

// ---------- Stage ground + fake shadow + glow
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.26, 64),
  new THREE.MeshStandardMaterial({
    color: 0xfff7fb,
    roughness: 0.98,
    metalness: 0,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.70;
scene.add(ground);

const shadowTex = makeShadowTexture();
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(2.6, 2.6),
  new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -0.699;
scene.add(shadow);

const glowTex = makeGlowTexture();
const glow = new THREE.Mesh(
  new THREE.CircleGeometry(1.35, 64),
  new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
  })
);
glow.rotation.x = -Math.PI / 2;
glow.position.y = -0.698;
scene.add(glow);

// ---------- Cookie geometry (baked)
const cookieGeo = makeBakedCookieGeometry(PERF);

// Two meshes for crossfade
const matA = new THREE.MeshPhysicalMaterial({
  color: 0xd7a36a,
  roughness: 0.96,
  metalness: 0.0,
  clearcoat: 0.06,
  clearcoatRoughness: 0.66,
  envMapIntensity: 0.18,
});
const matB = matA.clone();
matB.transparent = true;
matB.opacity = 0.0;

const cookieA = new THREE.Mesh(cookieGeo, matA);
const cookieB = new THREE.Mesh(cookieGeo, matB);
scene.add(cookieA, cookieB);

// ---------- Details: crumbs + cracks
const details = makeCookieDetails(PERF);
cookieA.add(details.groupA);
cookieB.add(details.groupB);

// ---------- Deco (instanced)
const deco = makeDeco(PERF);
scene.add(deco.group);

// ---------- TEXT ON COOKIE (curved overlay + emboss maps)
const label = makeCookieLabelOverlay();
cookieA.add(label.meshA);
cookieB.add(label.meshB);

window.setCookieMessage = setCookieMessage;
if (msgEl) {
  const apply = () => setCookieMessage(msgEl.value || "");
  msgEl.addEventListener("input", apply, { passive: true });
  apply();
}

// ---------- Presets
const PRESETS = {
  classic: {
    baseColor: 0xd7a36a,
    rough: 0.97,
    clear: 0.06,
    clearR: 0.66,
    envI: 0.18,
    scaleY: 1.0,
    puff: 0.0,
    decoMode: "sprinkles",
    decoCount: PERF === "low" ? 80 : PERF === "mid" ? 130 : 170,
    decoSize: 0.026,
    crumb: 0.075,
    crack: 0.11,
    glaze: 0.0,
  },
  chunky: {
    baseColor: 0xc98e55,
    rough: 0.99,
    clear: 0.035,
    clearR: 0.78,
    envI: 0.14,
    scaleY: 1.18,
    puff: 0.10,
    decoMode: "chunks",
    decoCount: PERF === "low" ? 12 : PERF === "mid" ? 16 : 22,
    decoSize: 0.075,
    crumb: 0.10,
    crack: 0.18,
    glaze: 0.0,
  },
  soft: {
    baseColor: 0xe2b07a,
    rough: 0.93,
    clear: 0.085,
    clearR: 0.55,
    envI: 0.22,
    scaleY: 0.96,
    puff: 0.0,
    decoMode: "sprinkles",
    decoCount: PERF === "low" ? 95 : PERF === "mid" ? 150 : 210,
    decoSize: 0.022,
    crumb: 0.055,
    crack: 0.06,
    glaze: 0.10,
  },
};

let activeStyle = "classic";
let activeSeed = 1337;

// ---------- Texture System (cached, tiered)
const TEX_BASE = "./assets/textures";
const texLoader = new THREE.TextureLoader();

const TEX_CACHE = new Map(); // key -> { albedo, rough, normal, ao }

function texKey(style, tier){ return `${style}@${tier}`; }
function tierForDevice(){
  if (PERF === "low") return "low";
  if (PERF === "mid") return "mid";
  return "high";
}

function configureColorTexture(t){
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy?.() || 4, PERF==="low" ? 2 : 8);
  t.flipY = false; // NOTE: keep as-is for your current asset pipeline
  return t;
}
function configureDataTexture(t){
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy?.() || 4, PERF==="low" ? 2 : 8);
  t.flipY = false; // NOTE: keep as-is for your current asset pipeline
  return t;
}
function loadOne(url, isColor){
  return new Promise((resolve, reject)=>{
    texLoader.load(url, (tex)=> resolve(isColor ? configureColorTexture(tex) : configureDataTexture(tex)), undefined, reject);
  });
}
async function loadStyleTextures(style){
  const tier = tierForDevice();
  const key = texKey(style, tier);
  if (TEX_CACHE.has(key)) return TEX_CACHE.get(key);

  const base = `${TEX_BASE}/${style}`;
  const wantNormal = (tier !== "low");

  const pack = { albedo:null, rough:null, normal:null, ao:null };

  try{
    pack.albedo = await loadOne(`${base}/albedo.jpg`, true).catch(async ()=> loadOne(`${base}/albedo.png`, true));
    pack.rough  = await loadOne(`${base}/roughness.png`, false).catch(async ()=> loadOne(`${base}/roughness.jpg`, false));

    if (wantNormal){
      pack.normal = await loadOne(`${base}/normal.png`, false).catch(async ()=> loadOne(`${base}/normal.jpg`, false));
    }
    pack.ao = await loadOne(`${base}/ao.png`, false).catch(()=> null);

    TEX_CACHE.set(key, pack);
    return pack;
  }catch(err){
    console.warn("Texture load failed for", style, err);
    TEX_CACHE.set(key, pack);
    return pack;
  }
}

async function applyStyleTexturesToMaterial(style, mat){
  const pack = await loadStyleTextures(style);

  if (pack.albedo){
    mat.map = pack.albedo;
    mat.map.needsUpdate = true;
  }
  if (pack.rough){
    mat.roughnessMap = pack.rough;
    mat.roughnessMap.needsUpdate = true;
  } else {
    mat.roughnessMap = null;
  }
  if (pack.normal){
    mat.normalMap = pack.normal;
    mat.normalMap.needsUpdate = true;
    const n = (style==="chunky") ? 1.15 : (style==="soft") ? 0.75 : 0.95;
    mat.normalScale.set(n, n);
  } else {
    mat.normalMap = null;
  }

  mat.needsUpdate = true;
}

// ---------- Apply initial preset + textures
applyPresetInstant(PRESETS.classic, activeSeed);

// ---------- Controls: drag rotate X/Y + inertia (PATCH: pointer capture)
renderer.domElement.style.touchAction = "none";
let isDown = false;
let lastX = 0;
let lastY = 0;

let rotY = 0;
let rotX = 0.06;

let velY = 0;
let velX = 0;

let surpriseKick = 0;

renderer.domElement.addEventListener("pointerdown", (e) => {
  isDown = true;
  lastX = e.clientX;
  lastY = e.clientY;
  renderer.domElement.setPointerCapture?.(e.pointerId);
});
renderer.domElement.addEventListener("pointerup", (e) => {
  isDown = false;
  renderer.domElement.releasePointerCapture?.(e.pointerId);
});
renderer.domElement.addEventListener("pointercancel", () => {
  isDown = false;
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!isDown) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  velY = dx * 0.0042;
  velX = dy * 0.0034;

  rotY += velY;
  rotX += velX;
  rotX = clamp(rotX, -0.35, 0.35);
});

// ---------- Crossfade switching
let fadeT = 0;
let fading = false;

function switchStyle(next, seed = activeSeed) {
  if (!PRESETS[next] || next === activeStyle) return;

  applyPresetToMesh(cookieB, matB, details.groupB, deco, PRESETS[next], seed, next);

  cookieB.rotation.copy(cookieA.rotation);
  cookieB.scale.copy(cookieA.scale);

  matB.opacity = 0.0;
  matB.transparent = true;
  matA.opacity = 1.0;
  matA.transparent = true;

  fading = true;
  fadeT = 0;

  activeStyle = next;
  activeSeed = seed;
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
    applyPresetToMesh(cookieA, matA, details.groupA, deco, PRESETS[activeStyle], activeSeed, activeStyle);
    matA.opacity = 1.0;
    matA.transparent = false;

    matB.opacity = 0.0;
    fading = false;
  }
}

function randomPreset() {
  const styles = ["classic", "chunky", "soft"];
  const next = styles[Math.floor(Math.random() * styles.length)];
  const seed = (Math.random() * 1e9) | 0;

  surpriseKick = 1;
  playMicrosound();
  switchStyle(next, seed);

  document.querySelectorAll?.(".chip").forEach((b) => {
    b.classList.toggle("active", b.dataset.style === next);
  });
}

window.switchStyle = (s) => switchStyle(s, activeSeed);
window.randomPreset = randomPreset;

// ---------- Pause/resume (PATCH: RAF guard)
let running = true;
let rafId = 0;
let last = performance.now();

function startLoop(){
  if (rafId) return; // guard: already running
  last = performance.now();
  rafId = requestAnimationFrame(loop);
}

function stopLoop(){
  if (!rafId) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
}

// Intersection Observer
const io = new IntersectionObserver(
  (entries) => {
    const v = entries[0]?.isIntersecting;
    running = !!v;
    if (running) startLoop();
    else stopLoop();
  },
  { threshold: 0.15 }
);
io.observe(stageEl);

document.addEventListener("visibilitychange", () => {
  running = document.visibilityState === "visible";
  if (running) startLoop();
  else stopLoop();
});

// ---------- Resize
window.addEventListener("resize", () => {
  const w = stageEl.clientWidth;
  const h = stageEl.clientHeight;
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// ---------- Main loop (PATCH: stop if not running)
function loop(now = performance.now()) {
  if (!running) { stopLoop(); return; }

  rafId = requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 0.033);
  last = now;

  const autoY = prefersReducedMotion ? 0 : 0.15;
  const autoX = prefersReducedMotion ? 0 : 0.03;

  velY *= 0.92;
  velX *= 0.90;

  rotY += (autoY + velY) * dt;
  rotX += (autoX + velX) * dt;
  rotX = clamp(rotX, -0.35, 0.35);

  cookieA.rotation.set(rotX, rotY, 0);
  cookieB.rotation.set(rotX, rotY, 0);

  const breathe = Math.sin(now * 0.00055) * 0.012;
  cookieA.position.y = breathe * 0.5;
  cookieB.position.y = cookieA.position.y;

  if (surpriseKick > 0) {
    surpriseKick = Math.max(0, surpriseKick - dt * 3.6);
    const k = easeOutCubic(surpriseKick);
    camera.position.z = 3.15 - (1 - k) * 0.18;
    glow.material.opacity = 0.14 + (1 - k) * 0.10;
  } else {
    camera.position.z = 3.15;
    glow.material.opacity = 0.14;
  }

  tickFade(dt);
  renderer.render(scene, camera);
}

// kick off initial loop safely
startLoop();

// ------------------ Cookie label overlay + emboss

function makeCookieLabelOverlay() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const texA = new THREE.CanvasTexture(canvas);
  texA.colorSpace = THREE.SRGBColorSpace;
  texA.anisotropy = renderer.capabilities.getMaxAnisotropy?.() || 4;

  const texB = texA.clone();

  const roughA = new THREE.CanvasTexture(canvas);
  roughA.colorSpace = THREE.NoColorSpace;
  const roughB = roughA.clone();

  const normA = new THREE.CanvasTexture(canvas);
  normA.colorSpace = THREE.NoColorSpace;
  const normB = normA.clone();

  const matA = new THREE.MeshPhysicalMaterial({
    map: texA,
    roughnessMap: roughA,
    normalMap: normA,
    transparent: true,
    opacity: 1,
    roughness: 0.22,
    metalness: 0,
    clearcoat: 0.30,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.25,
    normalScale: new THREE.Vector2(0.75, 0.75),
    depthWrite: false,
  });

  const matB = matA.clone();
  matB.map = texB;
  matB.roughnessMap = roughB;
  matB.normalMap = normB;

  // Curved plane
  const geo = new THREE.PlaneGeometry(1.55, 0.70, 42, 8);
  const bend = 0.18;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = -Math.pow(x / 0.78, 2) * bend;
    pos.setZ(i, z);
  }
  geo.computeVertexNormals();

  const meshA = new THREE.Mesh(geo, matA);
  const meshB = new THREE.Mesh(geo, matB);

  const yTop = 0.215;
  meshA.position.set(0, yTop, 0.02);
  meshB.position.set(0, yTop, 0.02);
  meshA.rotation.x = -0.18;
  meshB.rotation.x = -0.18;

  return { canvas, ctx, texA, texB, meshA, meshB };
}

function setCookieMessage(raw) {
  const text = sanitizeCookieText(raw);
  drawCookieLabel(label.ctx, label.canvas, text);
  label.texA.needsUpdate = true;
  label.texB.needsUpdate = true;
  updateEmbossMaps();
}

function sanitizeCookieText(s) {
  s = (s || "").trim();
  if (!s) return "";
  if (s.length > 28) s = s.slice(0, 27) + "…";
  s = s.replace(/\s+/g, " ");
  return s;
}

function drawCookieLabel(ctx, canvas, text) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (!text) return;

  const off = drawCookieLabel._off || (drawCookieLabel._off = document.createElement("canvas"));
  off.width = W; off.height = H;
  const o = off.getContext("2d");
  o.clearRect(0,0,W,H);

  // soft oval backing
  o.save();
  o.translate(W/2, H/2);
  o.scale(1.0, 0.72);
  o.beginPath();
  o.arc(0, 0, 360, 0, Math.PI*2);
  o.closePath();
  const g = o.createRadialGradient(0,0,40,0,0,360);
  g.addColorStop(0, "rgba(255,255,255,0.92)");
  g.addColorStop(0.60,"rgba(255,255,255,0.62)");
  g.addColorStop(1, "rgba(255,255,255,0.00)");
  o.fillStyle = g;
  o.fill();
  o.restore();

  // autosize
  o.textAlign = "center";
  o.textBaseline = "middle";
  let size = 140;
  o.font = `900 ${size}px system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif`;
  while (o.measureText(text).width > 860 && size > 88) {
    size -= 4;
    o.font = `900 ${size}px system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif`;
  }

  // height mask
  o.fillStyle = "rgba(255,255,255,0.95)";
  o.fillText(text, W/2, H/2);

  o.globalAlpha = 0.55;
  o.filter = "blur(2px)";
  o.fillText(text, W/2, H/2);
  o.filter = "none";
  o.globalAlpha = 1.0;

  // final color map
  ctx.save();
  ctx.drawImage(off, 0, 0);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = o.font;

  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  ctx.shadowOffsetX = 0;

  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fillText(text, W/2, H/2);

  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(255,120,191,0.18)";
  ctx.strokeText(text, W/2, H/2);

  ctx.restore();

  drawCookieLabel._heightMask = off;
}

function updateEmbossMaps() {
  if (!drawCookieLabel._heightMask) return;
  const mask = drawCookieLabel._heightMask;

  // Roughness map
  const r = (updateEmbossMaps._r || (updateEmbossMaps._r = document.createElement("canvas")));
  r.width = mask.width; r.height = mask.height;
  const rc = r.getContext("2d");
  rc.clearRect(0,0,r.width,r.height);

  rc.fillStyle = "rgb(150,150,150)";
  rc.fillRect(0,0,r.width,r.height);

  rc.globalAlpha = 1;
  rc.drawImage(mask, 0, 0);

  const img = rc.getImageData(0,0,r.width,r.height);
  const d = img.data;
  for (let i=0;i<d.length;i+=4){
    const m = d[i]; // 0..255
    const v = 150 - (m * 0.45);
    const vv = Math.max(40, Math.min(200, v));
    d[i]=d[i+1]=d[i+2]=vv;
    d[i+3]=255;
  }
  rc.putImageData(img,0,0);

  // Normal map from height
  const n = (updateEmbossMaps._n || (updateEmbossMaps._n = document.createElement("canvas")));
  n.width = mask.width; n.height = mask.height;
  const nc = n.getContext("2d");
  nc.clearRect(0,0,n.width,n.height);

  const mc = mask.getContext("2d");
  const mImg = mc.getImageData(0,0,mask.width,mask.height);
  const md = mImg.data;

  const out = nc.createImageData(mask.width, mask.height);
  const od = out.data;

  const w = mask.width, h = mask.height;
  const getH = (x,y)=>{
    x = Math.max(0, Math.min(w-1, x));
    y = Math.max(0, Math.min(h-1, y));
    return md[(y*w + x)*4] / 255;
  };

  for (let y=0;y<h;y++){
    for (let x=0;x<w;x++){
      const hl = getH(x-1,y);
      const hr = getH(x+1,y);
      const hu = getH(x,y-1);
      const hd = getH(x,y+1);

      let dx = (hr - hl) * 2.2;
      let dy = (hd - hu) * 2.2;

      let nx = (-dx * 0.5) + 0.5;
      let ny = (-dy * 0.5) + 0.5;
      let nz = 1.0;

      const idx = (y*w + x)*4;
      od[idx+0] = Math.round(nx * 255);
      od[idx+1] = Math.round(ny * 255);
      od[idx+2] = Math.round(nz * 255);
      od[idx+3] = 255;
    }
  }

  nc.putImageData(out, 0, 0);

  // Apply to both label meshes
  label.meshA.material.roughnessMap.image = r;
  label.meshA.material.roughnessMap.needsUpdate = true;
  label.meshA.material.normalMap.image = n;
  label.meshA.material.normalMap.needsUpdate = true;

  label.meshB.material.roughnessMap.image = r;
  label.meshB.material.roughnessMap.needsUpdate = true;
  label.meshB.material.normalMap.image = n;
  label.meshB.material.normalMap.needsUpdate = true;
}

// ------------------ Apply preset

function applyPresetInstant(p, seed) {
  applyPresetToMesh(cookieA, matA, details.groupA, deco, p, seed, "classic");
  matA.opacity = 1.0;
  matA.transparent = false;

  matB.opacity = 0.0;
  matB.transparent = true;
}

function applyPresetToMesh(mesh, mat, detailGroup, decoObj, p, seed, styleKey) {
  mat.color.setHex(p.baseColor);
  mat.roughness = p.rough;
  mat.metalness = 0.0;
  mat.clearcoat = p.clear;
  mat.clearcoatRoughness = p.clearR;
  mat.envMapIntensity = p.envI;

  if (p.glaze > 0) {
    mat.envMapIntensity = p.envI + p.glaze * 0.08;
    mat.clearcoat = p.clear + p.glaze * 0.05;
    mat.clearcoatRoughness = Math.max(0.35, p.clearR - p.glaze * 0.12);
  }

  mesh.scale.set(1, p.scaleY, 1);
  const puff = p.puff || 0;
  mesh.scale.x = 1 + puff * 0.06;
  mesh.scale.z = 1 + puff * 0.06;

  layoutDetails(detailGroup, mesh.scale.y, p, seed);

  decoObj.mode = p.decoMode;
  decoObj.count = p.decoCount;
  decoObj.size = p.decoSize;
  layoutDeco(mesh, decoObj, seed);

  // keep label height synced (chunky higher)
  const y = 0.215 * mesh.scale.y;
  label.meshA.position.y = y;
  label.meshB.position.y = y;

  // apply textures async (photoreal)
  applyStyleTexturesToMaterial(styleKey, mat);
}

// ------------------ Details + Deco layout

function makeCookieDetails(perf) {
  const groupA = new THREE.Group();
  const groupB = new THREE.Group();

  const crumbGeom = new THREE.SphereGeometry(0.012, 8, 8);
  const crumbMatA = new THREE.MeshStandardMaterial({ color: 0xf2d6b3, roughness: 1, metalness: 0 });
  const crumbMatB = crumbMatA.clone();

  const crackGeom = new THREE.BoxGeometry(0.06, 0.006, 0.01);
  const crackMatA = new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 1, metalness: 0 });
  const crackMatB = crackMatA.clone();

  const maxCrumbs = perf === "low" ? 140 : perf === "mid" ? 220 : 300;
  const maxCracks = perf === "low" ? 30 : perf === "mid" ? 44 : 60;

  for (let i = 0; i < maxCrumbs; i++) {
    groupA.add(new THREE.Mesh(crumbGeom, crumbMatA));
    groupB.add(new THREE.Mesh(crumbGeom, crumbMatB));
  }
  for (let i = 0; i < maxCracks; i++) {
    groupA.add(new THREE.Mesh(crackGeom, crackMatA));
    groupB.add(new THREE.Mesh(crackGeom, crackMatB));
  }

  return { groupA, groupB, maxCrumbs, maxCracks };
}

function layoutDetails(group, scaleY, p, seed) {
  const rnd = mulberry32(seed ^ 0xA5B357);
  const children = group.children;

  const maxCracks = PERF === "low" ? 30 : PERF === "mid" ? 44 : 60;
  const maxCrumbs = children.length - maxCracks;

  const crumbCount = Math.floor(maxCrumbs * clamp(p.crumb, 0, 1));
  const crackCount = Math.floor(maxCracks * clamp(p.crack, 0, 1));

  for (let i = 0; i < maxCrumbs; i++) {
    const m = children[i];
    if (i >= crumbCount) {
      m.scale.setScalar(0.0001);
      m.position.set(0, -10, 0);
      continue;
    }
    const a = rnd() * Math.PI * 2;
    const rr = 0.88 * Math.sqrt(rnd());
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const yTop = 0.19 * scaleY + 0.02;
    m.position.set(x, yTop, z);
    const s = 0.007 + rnd() * 0.010;
    m.scale.setScalar(s);
  }

  for (let i = 0; i < maxCracks; i++) {
    const m = children[maxCrumbs + i];
    if (i >= crackCount) {
      m.scale.setScalar(0.0001);
      m.position.set(0, -10, 0);
      continue;
    }
    const a = rnd() * Math.PI * 2;
    const rr = 0.65 * Math.sqrt(rnd());
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const yTop = 0.19 * scaleY + 0.018;
    m.position.set(x, yTop, z);
    m.rotation.set(0, rnd() * Math.PI, rnd() * 0.18 - 0.09);
    const len = 0.045 + rnd() * 0.08;
    m.scale.set(len, 1, 1);
  }
}

function makeDeco(perf) {
  const group = new THREE.Group();
  const max = 260;

  const sprGeom = new THREE.SphereGeometry(0.02, 10, 10);
  const sprMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.35,
    metalness: 0,
    clearcoat: 0.12,
    clearcoatRoughness: 0.45,
    envMapIntensity: 0.35,
  });

  const inst = new THREE.InstancedMesh(sprGeom, sprMat, max);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(inst);

  return { group, inst, mode: "sprinkles", count: 120, size: 0.02 };
}

function layoutDeco(cookieMesh, decoObj, seed) {
  const { inst, count, size, mode } = decoObj;
  const dummy = new THREE.Object3D();
  const rnd = mulberry32(seed ^ 0x31F00D);
  const r = 0.92;

  for (let i = 0; i < inst.count; i++) {
    if (i >= count) {
      dummy.scale.setScalar(0.0001);
      dummy.position.set(0, -10, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      continue;
    }

    const ringBias = mode === "sprinkles" ? 0.55 : 0.35;
    const rr = r * Math.sqrt(lerp(rnd(), 1, ringBias));
    const a = rnd() * Math.PI * 2;

    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;

    const yTop = 0.20 * cookieMesh.scale.y + 0.022;
    dummy.position.set(x, yTop, z);

    const s =
      mode === "chunks"
        ? size * (0.8 + rnd() * 0.7)
        : size * (0.75 + rnd() * 0.55);

    dummy.scale.setScalar(s);
    dummy.rotation.set(rnd() * 0.32 - 0.16, rnd() * Math.PI, rnd() * 0.28 - 0.14);

    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }

  inst.instanceMatrix.needsUpdate = true;

  if (mode === "chunks") {
    decoObj.inst.material.color.setHex(0x3a2a1f);
    decoObj.inst.material.roughness = 0.55;
    decoObj.inst.material.clearcoat = 0.12;
    decoObj.inst.material.envMapIntensity = 0.22;
  } else {
    decoObj.inst.material.color.setHex(0xfff7ff);
    decoObj.inst.material.roughness = 0.35;
    decoObj.inst.material.clearcoat = 0.14;
    decoObj.inst.material.envMapIntensity = 0.38;
  }
}

// ------------------ Geometry + textures

function makeBakedCookieGeometry(perf) {
  const seg = perf === "low" ? 52 : perf === "mid" ? 72 : 96;
  const r = 1.0;
  const h = 0.36;
  const g = new THREE.CylinderGeometry(r, r, h, seg, 8, false);
  g.rotateY(Math.PI / seg);

  const pos = g.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);

    const yn = v.y / (h * 0.5);
    const rr = Math.sqrt(v.x * v.x + v.z * v.z);
    const rn = rr / r;

    const dome = (1 - rn) * 0.06;
    const edgeSoft = Math.pow(clamp(rn, 0, 1), 4) * 0.035;

    const wobble =
      Math.sin(v.x * 6.2) * 0.004 +
      Math.cos(v.z * 6.8) * 0.004 +
      Math.sin((v.x + v.z) * 5.1) * 0.003;

    if (yn > 0) {
      v.y += dome + wobble;
      const topPuff = 1 + (1 - rn) * 0.01;
      v.x *= topPuff;
      v.z *= topPuff;
    } else {
      v.y -= dome * 0.55 + wobble * 0.5;
      const botTuck = 1 - edgeSoft * 0.35;
      v.x *= botTuck;
      v.z *= botTuck;
    }

    v.x *= 1 - edgeSoft;
    v.z *= 1 - edgeSoft;

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  g.computeVertexNormals();
  return g;
}

function makeShadowTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");
  const grd = ctx.createRadialGradient(128, 128, 18, 128, 128, 128);
  grd.addColorStop(0, "rgba(0,0,0,0.58)");
  grd.addColorStop(0.45, "rgba(0,0,0,0.22)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const ctx = c.getContext("2d");
  const grd = ctx.createRadialGradient(128, 128, 24, 128, 128, 128);
  grd.addColorStop(0, "rgba(255,79,163,0.32)");
  grd.addColorStop(0.55, "rgba(255,79,163,0.10)");
  grd.addColorStop(1, "rgba(255,79,163,0.0)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------ Microsound

let audioCtx = null;
function playMicrosound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;

    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = "sine";
    o.frequency.value = 660 + Math.random() * 90;
    g.gain.value = 0.00001;

    o.connect(g);
    g.connect(ctx.destination);

    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.00001, t);
    g.gain.exponentialRampToValueAtTime(0.035, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.00001, t + 0.14);

    o.start(t);
    o.stop(t + 0.16);
  } catch (_) {}
}

// ------------------ Utils

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// NOTE: Removed duplicate surprise button click handler on purpose.
// Your HTML already handles the button and calls window.randomPreset?.()
