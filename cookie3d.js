import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * initCookie3D(containerEl, options)
 * - containerEl: DOM Element (div), bekommt renderer canvas rein
 * - options.preset: { base, topping, drizzle }
 * - options.allowDoubleTapReset: boolean
 */
export function initCookie3D(containerEl, options = {}) {
  if (!containerEl) throw new Error("initCookie3D: containerEl fehlt.");

  const preset = options.preset ?? { base: "classic", topping: "chips", drizzle: "none" };
  const allowDoubleTapReset = !!options.allowDoubleTapReset;

  // Basic scene
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0.0, 1.1, 3.2);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });

  // Mobile-friendly pixel ratio cap (hitze & akku)
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2.0);
  renderer.setPixelRatio(dpr);
  renderer.setSize(10, 10, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Insert canvas
  containerEl.innerHTML = "";
  containerEl.appendChild(renderer.domElement);

  // Lights
  const hemi = new THREE.HemisphereLight(0xbcd2ff, 0x1b1020, 0.85);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 4, 2);
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
  rim.position.set(-3, 2, -2);
  scene.add(rim);

  // Ground (shadow catcher)
  const groundGeo = new THREE.PlaneGeometry(12, 12);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.22 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.8;
  ground.receiveShadow = true;
  scene.add(ground);

  // Cookie group
  const group = new THREE.Group();
  scene.add(group);

  // Create cookie mesh (lathe-ish profile)
  const cookie = makeCookieMesh();
  cookie.castShadow = true;
  cookie.receiveShadow = true;
  group.add(cookie);

  // Toppings holders
  const toppingGroup = new THREE.Group();
  group.add(toppingGroup);

  const drizzleGroup = new THREE.Group();
  group.add(drizzleGroup);

  // Controls (touch friendly)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 2.2;
  controls.maxDistance = 4.6;
  controls.maxPolarAngle = Math.PI * 0.58;
  controls.minPolarAngle = Math.PI * 0.28;
  controls.target.set(0, 0.1, 0);
  controls.update();

  // Double tap reset (mobile)
  if (allowDoubleTapReset) {
    let lastTap = 0;
    renderer.domElement.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTap < 260) {
        controls.reset();
      }
      lastTap = now;
    }, { passive: true });
  }

  // Resize observer
  const ro = new ResizeObserver(() => resize());
  ro.observe(containerEl);

  // Apply preset
  let state = { base: preset.base, topping: preset.topping, drizzle: preset.drizzle };
  applyConfig(state);

  // Animate
  let running = true;
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clock = new THREE.Clock();
  function tick() {
    if (!running) return;

    const dt = Math.min(clock.getDelta(), 0.033);

    controls.update();

    if (!prefersReduced) {
      group.rotation.y += dt * 0.15;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  // Public API
  return {
    setConfig(next) {
      state = { ...state, ...next };
      applyConfig(state);
    },
    destroy() {
      running = false;
      ro.disconnect();
      controls.dispose();

      // Dispose scene
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
