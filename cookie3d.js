/* cookie3d.js — OnlyCakes / Keks-Universum
   Engine: Three.js (global THREE + OrbitControls)
   API:
     Cookie3D.mount({ canvas, getState, onReady })
     Cookie3D.update(state)
*/

(() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const CATALOG = {
    base: {
      classic: { name: "Klassisch", color: 0xd7b98e },
      choco:   { name: "Schoko",    color: 0x7a4b2c },
      dark:    { name: "Dark",      color: 0x2a1c16 },
    },
    toppings: {
      chocochips: { name: "Choco Chips", color: 0x2b1b14 },
      sprinkles:  { name: "Sprinkles",   color: 0xff7ad9 },
      nuts:       { name: "Nüsse",       color: 0xb0855b },
      caramel:    { name: "Karamell",    color: 0xd08b2b },
      oreo:       { name: "Oreo Crumb",  color: 0x1b1b1b },
      berry:      { name: "Berry Dust",  color: 0xff4d6d },
    },
    extras: {
      bitcoin: { name: "Bitcoin-Glanz", color: 0xf5b700 },
      giftwrap: { name: "Giftwrap", color: 0x20e3b2 },
      double: { name: "Double", color: 0x7c5cff },
    }
  };

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeCookieTexture(baseHex) {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 512;
    const ctx = c.getContext("2d");

    // Base
    ctx.fillStyle = "#" + baseHex.toString(16).padStart(6, "0");
    ctx.fillRect(0, 0, c.width, c.height);

    // Vignette + baked gradient
    const g = ctx.createRadialGradient(240, 220, 40, 260, 260, 320);
    g.addColorStop(0, "rgba(255,255,255,0.18)");
    g.addColorStop(0.55, "rgba(0,0,0,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);

    // Speckles
    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * c.width;
      const y = Math.random() * c.height;
      const r = Math.random() * 1.8 + 0.2;
      const a = Math.random() * 0.18 + 0.05;
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tiny pores
    for (let i = 0; i < 550; i++) {
      const x = Math.random() * c.width;
      const y = Math.random() * c.height;
      const r = Math.random() * 6 + 2;
      const a = Math.random() * 0.12 + 0.06;
      ctx.strokeStyle = `rgba(0,0,0,${a})`;
      ctx.lineWidth = Math.random() * 1.2 + 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }

  function deformCookieTop(geom, seed) {
    // Subtle “baked” noise on top surface
    const rng = mulberry32(seed);
    const pos = geom.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // Only affect top face-ish vertices (y positive)
      if (v.y > 0) {
        const d = Math.sqrt(v.x * v.x + v.z * v.z);
        const edge = clamp(1 - d / 1.0, 0, 1); // center more, edge less
        const noise = (rng() - 0.5) * 0.08 * edge + (rng() - 0.5) * 0.02;
        v.y += noise;
        // tiny radial wobble
        const wob = (rng() - 0.5) * 0.015 * edge;
        v.x += v.x * wob;
        v.z += v.z * wob;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
  }

  function buildCookieMesh(baseColorHex, doubleCookie, seed) {
    // Cookie dimensions
    const radius = 1.05;
    const height = doubleCookie ? 0.55 : 0.38;

    const geom = new THREE.CylinderGeometry(radius, radius * 1.02, height, 64, 8, false);
    deformCookieTop(geom, seed);

    const tex = makeCookieTexture(baseColorHex);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: baseColorHex,
      roughness: 0.82,
      metalness: 0.02,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Slight tilt for drama
    mesh.rotation.y = 0.3;
    mesh.rotation.x = -0.06;

    return mesh;
  }

  function randomPointOnCookieTop(rng, rMax) {
    const a = rng() * Math.PI * 2;
    const rr = Math.sqrt(rng()) * rMax;
    return { x: Math.cos(a) * rr, z: Math.sin(a) * rr };
  }

  function addToppings(scene, state, cookieTopY, seed) {
    const rng = mulberry32(seed);
    const group = new THREE.Group();
    group.name = "toppingsGroup";

    const tops = Array.isArray(state.toppings) ? state.toppings : [];
    const has = (id) => tops.includes(id);

    // Chips
    if (has("chocochips")) {
      const color = CATALOG.toppings.chocochips.color;
      const chipGeom = new THREE.SphereGeometry(0.06, 10, 10);
      const chipMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.0 });
      const count = 85;
      const inst = new THREE.InstancedMesh(chipGeom, chipMat, count);
      inst.castShadow = true;
      const m = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        const p = randomPointOnCookieTop(rng, 0.92);
        const y = cookieTopY + 0.03 + rng() * 0.02;
        const s = 0.75 + rng() * 0.8;
        const q = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI)
        );
        const pos = new THREE.Vector3(p.x, y, p.z);
        const sc = new THREE.Vector3(s, s, s);
        m.compose(pos, q, sc);
        inst.setMatrixAt(i, m);
      }
      group.add(inst);
    }

    // Sprinkles
    if (has("sprinkles")) {
      const sprGeom = new THREE.CapsuleGeometry(0.015, 0.10, 4, 10);
      const colors = [0xff7ad9, 0x2de2e6, 0x7c5cff, 0xffd166, 0x20e3b2, 0xffffff];
      const count = 120;
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshStandardMaterial({
          color: colors[Math.floor(rng() * colors.length)],
          roughness: 0.55,
          metalness: 0.05,
        });
        const spr = new THREE.Mesh(sprGeom, mat);
        const p = randomPointOnCookieTop(rng, 0.95);
        spr.position.set(p.x, cookieTopY + 0.05 + rng() * 0.02, p.z);
        spr.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
        const s = 0.8 + rng() * 0.7;
        spr.scale.setScalar(s);
        spr.castShadow = true;
        group.add(spr);
      }
    }

    // Nuts (chunks)
    if (has("nuts")) {
      const nutGeom = new THREE.DodecahedronGeometry(0.07, 0);
      const nutMat = new THREE.MeshStandardMaterial({ color: CATALOG.toppings.nuts.color, roughness: 0.85 });
      const count = 45;
      for (let i = 0; i < count; i++) {
        const nut = new THREE.Mesh(nutGeom, nutMat);
        const p = randomPointOnCookieTop(rng, 0.9);
        nut.position.set(p.x, cookieTopY + 0.05 + rng() * 0.03, p.z);
        nut.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
        const s = 0.7 + rng() * 1.2;
        nut.scale.setScalar(s);
        nut.castShadow = true;
        group.add(nut);
      }
    }

    // Oreo Crumb (dusty pebbles)
    if (has("oreo")) {
      const crumbGeom = new THREE.IcosahedronGeometry(0.03, 0);
      const crumbMat = new THREE.MeshStandardMaterial({ color: CATALOG.toppings.oreo.color, roughness: 0.95 });
      const count = 140;
      const inst = new THREE.InstancedMesh(crumbGeom, crumbMat, count);
      inst.castShadow = true;
      const m = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        const p = randomPointOnCookieTop(rng, 0.95);
        const y = cookieTopY + 0.03 + rng() * 0.03;
        const s = 0.6 + rng() * 1.3;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng()*Math.PI, rng()*Math.PI, rng()*Math.PI));
        m.compose(new THREE.Vector3(p.x, y, p.z), q, new THREE.Vector3(s,s,s));
        inst.setMatrixAt(i, m);
      }
      group.add(inst);
    }

    // Berry Dust (pink particles)
    if (has("berry")) {
      const dustGeom = new THREE.SphereGeometry(0.012, 8, 8);
      const dustMat = new THREE.MeshStandardMaterial({ color: CATALOG.toppings.berry.color, roughness: 0.8 });
      const count = 220;
      const inst = new THREE.InstancedMesh(dustGeom, dustMat, count);
      const m = new THREE.Matrix4();
      for (let i = 0; i < count; i++) {
        const p = randomPointOnCookieTop(rng, 0.98);
        const y = cookieTopY + 0.04 + rng() * 0.02;
        const s = 0.5 + rng() * 1.4;
        m.compose(new THREE.Vector3(p.x, y, p.z), new THREE.Quaternion(), new THREE.Vector3(s,s,s));
        inst.setMatrixAt(i, m);
      }
      group.add(inst);
    }

    // Caramel drizzle (curves)
    if (has("caramel")) {
      const mat = new THREE.MeshStandardMaterial({
        color: CATALOG.toppings.caramel.color,
        roughness: 0.35,
        metalness: 0.02,
      });

      for (let s = 0; s < 6; s++) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.95, cookieTopY + 0.07, -0.75 + s*0.28),
          new THREE.Vector3(-0.35, cookieTopY + 0.10, -0.55 + s*0.28),
          new THREE.Vector3( 0.35, cookieTopY + 0.08, -0.35 + s*0.28),
          new THREE.Vector3( 0.95, cookieTopY + 0.09, -0.15 + s*0.28),
        ]);
        const tube = new THREE.TubeGeometry(curve, 48, 0.02, 10, false);
        const mesh = new THREE.Mesh(tube, mat);
        mesh.castShadow = true;
        group.add(mesh);
      }
    }

    // Extras: Bitcoin sheen + coin stamp
    const extras = Array.isArray(state.extras) ? state.extras : [];
    if (extras.includes("bitcoin")) {
      const coinGeom = new THREE.CylinderGeometry(0.23, 0.23, 0.05, 40);
      const coinMat = new THREE.MeshStandardMaterial({
        color: 0xf5b700,
        roughness: 0.35,
        metalness: 0.85,
      });
      const coin = new THREE.Mesh(coinGeom, coinMat);
      coin.position.set(0.55, cookieTopY + 0.12, -0.25);
      coin.rotation.set(Math.PI / 2, 0.2, 0.4);
      coin.castShadow = true;

      // Simple embossed "B"
      const textCanvas = document.createElement("canvas");
      textCanvas.width = 256; textCanvas.height = 256;
      const tctx = textCanvas.getContext("2d");
      tctx.clearRect(0,0,256,256);
      tctx.fillStyle = "rgba(0,0,0,0)";
      tctx.fillRect(0,0,256,256);
      tctx.fillStyle = "rgba(20,10,0,0.55)";
      tctx.font = "bold 150px system-ui, Arial";
      tctx.textAlign = "center";
      tctx.textBaseline = "middle";
      tctx.fillText("₿", 128, 132);
      const decal = new THREE.CanvasTexture(textCanvas);
      const decalMat = new THREE.MeshStandardMaterial({
        map: decal,
        transparent: true,
        roughness: 0.25,
        metalness: 0.25,
      });
      const decalPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.35,0.35), decalMat);
      decalPlane.position.set(0, 0.03, 0);
      decalPlane.rotation.x = -Math.PI/2;
      coin.add(decalPlane);

      group.add(coin);
    }

    scene.add(group);
    return group;
  }

  function removeByName(scene, name) {
    const obj = scene.getObjectByName(name);
    if (obj) {
      obj.traverse((n) => {
        if (n.geometry) n.geometry.dispose?.();
        if (n.material) {
          if (Array.isArray(n.material)) n.material.forEach(m => m.dispose?.());
          else n.material.dispose?.();
        }
      });
      scene.remove(obj);
    }
  }

  function fitRendererToCanvas(renderer, camera, canvas) {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const need = renderer.domElement.width !== w || renderer.domElement.height !== h;
    if (need) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  const Cookie3D = {
    _mounted: false,
    _canvas: null,
    _renderer: null,
    _scene: null,
    _camera: null,
    _controls: null,
    _cookie: null,
    _toppings: null,
    _lastKey: "",

    mount({ canvas, getState, onReady } = {}) {
      if (!canvas) throw new Error("Cookie3D.mount: canvas fehlt");
      this._canvas = canvas;

      const scene = new THREE.Scene();
      scene.background = null;

      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 2.2, 5.2);

      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      // Lights
      const hemi = new THREE.HemisphereLight(0xffffff, 0x1a2440, 0.65);
      scene.add(hemi);

      const key = new THREE.DirectionalLight(0xffffff, 1.05);
      key.position.set(4, 6, 3);
      key.castShadow = true;
      key.shadow.mapSize.set(1024,1024);
      key.shadow.camera.left = -4;
      key.shadow.camera.right = 4;
      key.shadow.camera.top = 4;
      key.shadow.camera.bottom = -4;
      scene.add(key);

      const rim = new THREE.DirectionalLight(0x9ae6ff, 0.45);
      rim.position.set(-6, 3, -4);
      scene.add(rim);

      // Ground (subtle)
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.ShadowMaterial({ opacity: 0.22 })
      );
      ground.rotation.x = -Math.PI/2;
      ground.position.y = -0.55;
      ground.receiveShadow = true;
      scene.add(ground);

      // Controls
      const controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.minDistance = 3.6;
      controls.maxDistance = 8.0;
      controls.minPolarAngle = 0.65;
      controls.maxPolarAngle = 1.25;
      controls.target.set(0, 0.25, 0);

      this._renderer = renderer;
      this._scene = scene;
      this._camera = camera;
      this._controls = controls;
      this._mounted = true;

      const animate = () => {
        if (!this._mounted) return;
        fitRendererToCanvas(renderer, camera, canvas);
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);

      window.addEventListener("resize", () => fitRendererToCanvas(renderer, camera, canvas), { passive: true });

      // initial build
      const st = getState ? getState() : {};
      this.update(st);

      onReady && onReady();
    },

    update(state = {}) {
      if (!this._mounted) return;

      // normalize state
      const baseId = (state.base && CATALOG.base[state.base]) ? state.base : "classic";
      const baseColor = CATALOG.base[baseId].color;

      const toppings = Array.isArray(state.toppings) ? state.toppings.filter(t => CATALOG.toppings[t]) : [];
      const extras = Array.isArray(state.extras) ? state.extras.filter(x => CATALOG.extras[x]) : [];

      const key = `${baseId}|${toppings.join(",")}|${extras.join(",")}`;
      if (key === this._lastKey) return;
      this._lastKey = key;

      const seed = hashString(key);

      removeByName(this._scene, "cookieGroup");
      const group = new THREE.Group();
      group.name = "cookieGroup";

      const doubleCookie = extras.includes("double");
      const cookie = buildCookieMesh(baseColor, doubleCookie, seed);
      cookie.name = "cookieMesh";
      group.add(cookie);

      // Cookie top height approx
      const cookieTopY = (doubleCookie ? 0.55 : 0.38) / 2;

      // Toppings
      removeByName(this._scene, "toppingsGroup");
      addToppings(this._scene, { toppings, extras }, cookieTopY, seed + 1337);

      // Add cookie group
      this._scene.add(group);
      this._cookie = cookie;

      // Slight auto spin for “alive”
      // (OrbitControls still works)
      cookie.rotation.y = 0.25;

      // Bring camera/target to “always visible cookie”
      this._controls.target.set(0, 0.25, 0);
      this._camera.position.set(0, 2.1, 5.1);
      this._camera.lookAt(0, 0.25, 0);
    }
  };

  window.Cookie3D = Cookie3D;
})();
