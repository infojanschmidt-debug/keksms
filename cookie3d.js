import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function initCookie3D(containerEl, options = {}) {
  if (!containerEl) throw new Error("initCookie3D: containerEl fehlt.");

  const preset = options.preset ?? { base: "classic", topping: "chips", drizzle: "none" };
  const allowDoubleTapReset = !!options.allowDoubleTapReset;

  const mobile = isMobile();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070A12, 6, 14);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0.0, 1.05, 3.15);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });

  const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2.0);
  renderer.setPixelRatio(dpr);
  renderer.setSize(10, 10, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  containerEl.innerHTML = "";
  containerEl.appendChild(renderer.domElement);

  // Lights (slightly softer, more premium)
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x120c18, 0.85));

  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(3.2, 4.2, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xffd5e6, 0.55);
  rim.position.set(-3.2, 2.2, -2.4);
  scene.add(rim);

  // Ground (shadow catcher)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.ShadowMaterial({ opacity: 0.22 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.82;
  ground.receiveShadow = true;
  scene.add(ground);

  // Cookie group
  const group = new THREE.Group();
  scene.add(group);

  const cookie = makeCookieMesh();
  cookie.castShadow = true;
  cookie.receiveShadow = true;
  group.add(cookie);

  const toppingGroup = new THREE.Group();
  const drizzleGroup = new THREE.Group();
  group.add(toppingGroup);
  group.add(drizzleGroup);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.15;
  controls.maxDistance = 4.6;
  controls.maxPolarAngle = Math.PI * 0.58;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.target.set(0, 0.08, 0);
  controls.update();

  if (allowDoubleTapReset) {
    let lastTap = 0;
    renderer.domElement.addEventListener("touchend", () => {
      const now = Date.now();
      if (now - lastTap < 260) controls.reset();
      lastTap = now;
    }, { passive: true });
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(containerEl);
  resize();

  let state = { base: preset.base, topping: preset.topping, drizzle: preset.drizzle };
  applyConfig(state);

  let running = true;
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clock = new THREE.Clock();

  function tick() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.033);
    controls.update();
    if (!prefersReduced) group.rotation.y += dt * 0.14;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  return {
    setConfig(next) {
      state = { ...state, ...next };
      applyConfig(state);
    },
    destroy() {
      running = false;
      ro.disconnect();
      controls.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
      renderer.dispose();
      containerEl.innerHTML = "";
    }
  };

  function resize() {
    const w = Math.max(1, containerEl.clientWidth);
    const h = Math.max(1, containerEl.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function makeCookieMesh() {
    const pts = [
      new THREE.Vector2(0.00, -0.18),
      new THREE.Vector2(0.85, -0.18),
      new THREE.Vector2(0.92, -0.06),
      new THREE.Vector2(0.90,  0.05),
      new THREE.Vector2(0.80,  0.12),
      new THREE.Vector2(0.62,  0.16),
      new THREE.Vector2(0.25,  0.17),
      new THREE.Vector2(0.00,  0.16)
    ];

    const geo = new THREE.LatheGeometry(pts, 64);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xd8b07a,
      roughness: 0.92,
      metalness: 0.02
    });

    // subtle bump
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
      const r = Math.sqrt(x*x + z*z);
      if (r > 0.25 && y > -0.16) pos.setY(i, y + (hash(i) - 0.5) * 0.02);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.0;
    return mesh;
  }

  function applyConfig(cfg) {
    const baseColors = {
      classic: 0xd8b07a,
      choco:   0x6b3f2a,
      oat:     0xcaa978
    };
    cookie.material.color.setHex(baseColors[cfg.base] ?? baseColors.classic);

    clearGroup(toppingGroup);
    clearGroup(drizzleGroup);

    if (cfg.topping === "chips") addChips(toppingGroup);
    if (cfg.topping === "sprinkles") addSprinkles(toppingGroup);
    if (cfg.topping === "nuts") addNuts(toppingGroup);

    if (cfg.drizzle !== "none") addDrizzle(drizzleGroup, cfg.drizzle);
  }

  function addChips(g) {
    const geo = new THREE.SphereGeometry(0.06, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.85, metalness: 0.02 });
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(randomPointOnTop(i));
      m.rotation.set(hash(i)*2, hash(i+11)*2, hash(i+23)*2);
      m.scale.setScalar(0.7 + hash(i+7)*0.7);
      m.castShadow = true;
      g.add(m);
    }
  }

  function addSprinkles(g) {
    const count = mobile ? 120 : 220;
    const geo = new THREE.CapsuleGeometry(0.02, 0.06, 4, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.02 });

    const inst = new THREE.InstancedMesh(geo, mat, count);
    inst.castShadow = true;

    const dummy = new THREE.Object3D();
    const colors = [0xff5c7a, 0x39d98a, 0x5473ff, 0xffd166, 0xffffff, 0x9b5cff];

    for (let i = 0; i < count; i++) {
      dummy.position.copy(randomPointOnTop(i * 13));
      dummy.rotation.set(hash(i)*Math.PI, hash(i+3)*Math.PI, hash(i+6)*Math.PI);
      dummy.scale.setScalar(0.8 + hash(i+9)*0.7);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(i, new THREE.Color(colors[i % colors.length]));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

    g.add(inst);
  }

  function addNuts(g) {
    const geo = new THREE.DodecahedronGeometry(0.07, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xb07b45, roughness: 0.95, metalness: 0.02 });
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(randomPointOnTop(i * 17));
      m.rotation.set(hash(i)*2, hash(i+31)*2, hash(i+63)*2);
      m.scale.setScalar(0.7 + hash(i+7)*0.9);
      m.castShadow = true;
      g.add(m);
    }
  }

  function addDrizzle(g, type) {
    const color = (type === "white") ? 0xf2f2f2 : 0x2b1a12;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.02 });

    for (let k = 0; k < 6; k++) {
      const curve = makeDrizzleCurve(k);
      const geo = new THREE.TubeGeometry(curve, 80, 0.03, 10, false);
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      g.add(m);
    }
  }

  function makeDrizzleCurve(seed) {
    const pts = [];
    const baseY = 0.17;
    const amp = 0.55;
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const a = (t * Math.PI * 2) + seed * 0.55;
      const r = 0.25 + hash(seed*99 + i)*0.55;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = baseY + Math.sin(t * Math.PI * 2) * 0.02 + (hash(seed*77 + i) - 0.5) * 0.01;
      pts.push(new THREE.Vector3(x * amp, y, z * amp));
    }
    return new THREE.CatmullRomCurve3(pts);
  }

  function randomPointOnTop(seed) {
    const u = hash(seed * 17.13);
    const v = hash(seed * 41.77);
    const r = Math.sqrt(u) * 0.72;
    const a = v * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = 0.16 + (hash(seed * 9.19) - 0.5) * 0.02;
    return new THREE.Vector3(x, y, z);
  }

  function clearGroup(g) {
    while (g.children.length) {
      const c = g.children.pop();
      c.geometry?.dispose?.();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose?.());
        else c.material.dispose?.();
      }
    }
  }

  function hash(n) {
    const x = Math.sin(n * 999.123) * 43758.5453;
    return x - Math.floor(x);
  }

  function isMobile() {
    const ua = navigator.userAgent || "";
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || window.matchMedia("(max-width: 768px)").matches;
  }
}
