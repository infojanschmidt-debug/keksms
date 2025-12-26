/* cookie3d.js — ONLYKEKS "3D" Cookie Hero (Canvas Fake-3D, premium, config-driven)
   API: window.Cookie3D.init(canvas, { recipe?, presets?, onClick? })
*/
(() => {
  const Cookie3D = {};
  let raf = null;

  // ---------- SSOT CONFIG (EDIT HERE) ----------
  const BASES = {
    classic: {
      label: "Classic",
      // dough palette (center -> mid -> edge)
      dough: ["rgba(255,232,198,.98)", "rgba(216,170,118,.98)", "rgba(132,86,44,.98)"],
      speckle: 0.10
    },
    double: {
      label: "Double Choco",
      dough: ["rgba(140,90,60,.98)", "rgba(92,56,34,.98)", "rgba(42,24,14,.98)"],
      speckle: 0.14
    },
    vanilla: {
      label: "Vanilla",
      dough: ["rgba(255,248,230,.98)", "rgba(232,214,178,.98)", "rgba(156,120,70,.98)"],
      speckle: 0.08
    }
  };

  const TOPPINGS = {
    chips: {
      choco: { count: 28, colorA: "rgba(60,38,26,.95)", colorB: "rgba(25,14,10,.95)" },
      white: { count: 22, colorA: "rgba(255,255,255,.85)", colorB: "rgba(200,190,175,.90)" },
      mix:   { count: 30, mix: true }
    },
    crunch: {
      none:  { count: 0 },
      nuts:  { count: 10, colorA: "rgba(210,160,105,.85)", colorB: "rgba(140,95,55,.9)" },
      biscuit:{ count: 8, colorA: "rgba(235,200,150,.85)", colorB: "rgba(165,120,70,.9)" }
    },
    drizzle: {
      none:  { strength: 0 },
      dark:  { strength: 0.55, color: "rgba(40,22,14,.55)" },
      white: { strength: 0.45, color: "rgba(255,255,255,.55)" }
    }
  };

  // 10 Presets (Überrasch mich) — minimal & klar
  const PRESETS_DEFAULT = [
    { name:"Posti Classic", base:"classic", chips:"mix",  crunch:"nuts",    drizzle:"none",  finish:"matte" },
    { name:"Double Crush", base:"double",  chips:"choco",crunch:"biscuit", drizzle:"dark",  finish:"glossy" },
    { name:"Vanilla Clean",base:"vanilla", chips:"white",crunch:"none",    drizzle:"white", finish:"matte" },
    { name:"Classic Dark Drip", base:"classic", chips:"choco", crunch:"none", drizzle:"dark", finish:"glossy" },
    { name:"Choco + Nuts", base:"double", chips:"mix", crunch:"nuts", drizzle:"none", finish:"matte" },
    { name:"White Galaxy", base:"vanilla", chips:"mix", crunch:"biscuit", drizzle:"white", finish:"glossy" },
    { name:"Minimal Classic", base:"classic", chips:"choco", crunch:"none", drizzle:"none", finish:"matte" },
    { name:"Crunchy Vanilla", base:"vanilla", chips:"white", crunch:"nuts", drizzle:"none", finish:"matte" },
    { name:"Full Drizzle", base:"classic", chips:"mix", crunch:"biscuit", drizzle:"dark", finish:"glossy" },
    { name:"Deep Double", base:"double", chips:"choco", crunch:"nuts", drizzle:"none", finish:"glossy" },
  ];

  const DEFAULT_RECIPE = { base:"classic", chips:"mix", crunch:"nuts", drizzle:"none", finish:"matte" };

  // ---------- Public ----------
  Cookie3D.init = function init(canvas, opts = {}) {
    if (!canvas) throw new Error("Cookie3D.init(canvas): canvas missing");
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("2D context not available");

    const cfg = {
      spin: opts.spin ?? 0.22,          // rad/sec
      wobble: opts.wobble ?? 0.035,
      vignette: opts.vignette ?? 0.65,
      grain: opts.grain ?? 0.04,
      clickable: opts.clickable ?? true,
      recipe: normalizeRecipe(opts.recipe || DEFAULT_RECIPE),
      presets: Array.isArray(opts.presets) && opts.presets.length ? opts.presets : PRESETS_DEFAULT,
      onClick: typeof opts.onClick === "function" ? opts.onClick : null
    };

    const state = {
      t0: performance.now(),
      w: 0,
      h: 0,
      dpr: 1,
      seed: mulberry32(((Date.now() ^ 0xC00C1E) >>> 0)),
      chips: [],
      crunch: []
    };

    function rebuildToppings() {
      const r = cfg.recipe;

      // Chips
      const chipMode = TOPPINGS.chips[r.chips] || TOPPINGS.chips.mix;
      const chipCount = chipMode.count ?? 28;
      state.chips = makePieces(state.seed, chipCount, 0.78, "chip");

      // Crunch
      const crunchMode = TOPPINGS.crunch[r.crunch] || TOPPINGS.crunch.none;
      const crunchCount = crunchMode.count ?? 0;
      state.crunch = makePieces(state.seed, crunchCount, 0.70, "crunch");
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      state.dpr = dpr;
      state.w = Math.max(1, Math.floor(rect.width * dpr));
      state.h = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = state.w;
      canvas.height = state.h;
      rebuildToppings();
    }

    function draw(now) {
      const t = (now - state.t0) / 1000;
      const w = state.w, h = state.h;
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,w,h);

      const cx = w * 0.5, cy = h * 0.52;
      const s = Math.min(w, h) * 0.38;

      drawVignette(ctx, w, h, cfg.vignette);

      const spin = t * cfg.spin;
      const wob = Math.sin(t * 1.2) * cfg.wobble;
      const tiltX = 0.18 + wob;
      const tiltY = 0.12 - wob * 0.6;

      const lx = Math.cos(spin * 0.9) * 0.55 + 0.2;
      const ly = Math.sin(spin * 0.9) * 0.35 - 0.25;

      // BODY (base-specific)
      drawCookieBody(ctx, cx, cy, s, tiltX, tiltY, lx, ly, t, cfg.recipe);

      // TOPPINGS
      drawChips(ctx, cx, cy, s, tiltX, tiltY, lx, ly, spin, state.chips, cfg.recipe);
      drawCrunch(ctx, cx, cy, s, tiltX, tiltY, lx, ly, spin, state.crunch, cfg.recipe);

      // DRIZZLE
      drawDrizzle(ctx, cx, cy, s, tiltX, tiltY, spin, cfg.recipe);

      // RIM + finish
      drawRim(ctx, cx, cy, s, tiltX, tiltY, cfg.recipe);

      if (cfg.grain > 0) drawGrain(ctx, w, h, cfg.grain);

      raf = requestAnimationFrame(draw);
    }

    // click = surprise preset
    function pickRandomPreset() {
      const p = cfg.presets[(Math.random() * cfg.presets.length) | 0];
      cfg.recipe = normalizeRecipe(p);
      rebuildToppings();
      return p;
    }

    if (cfg.clickable) {
      canvas.style.cursor = "pointer";
      canvas.addEventListener("click", () => {
        const chosen = pickRandomPreset();
        if (cfg.onClick) cfg.onClick(chosen, cfg.recipe);
      }, { passive: true });
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    raf = requestAnimationFrame(draw);

    // expose small controls
    return {
      setRecipe(next) {
        cfg.recipe = normalizeRecipe(next);
        rebuildToppings();
      },
      surprise() { return pickRandomPreset(); },
      destroy() {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
      }
    };
  };

  // ---------- helpers ----------
  function normalizeRecipe(r) {
    const base = BASES[r.base] ? r.base : "classic";
    const chips = TOPPINGS.chips[r.chips] ? r.chips : "mix";
    const crunch = TOPPINGS.crunch[r.crunch] ? r.crunch : "none";
    const drizzle = TOPPINGS.drizzle[r.drizzle] ? r.drizzle : "none";
    const finish = (r.finish === "glossy") ? "glossy" : "matte";
    return { base, chips, crunch, drizzle, finish };
  }

  function makePieces(rng, count, radiusMax, type) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(rng()) * radiusMax;
      const a = rng() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      const size = (type === "crunch")
        ? lerp(0.030, 0.060, rng())
        : lerp(0.018, 0.045, rng());
      const depth = lerp(0.2, 1.0, rng());
      const tone = rng();
      arr.push({ x, y, size, depth, tone });
    }
    return arr;
  }

  function drawVignette(ctx, w, h, strength) {
    const g = ctx.createRadialGradient(w*0.5, h*0.48, Math.min(w,h)*0.15, w*0.5, h*0.5, Math.min(w,h)*0.7);
    g.addColorStop(0, "rgba(255,255,255,0.02)");
    g.addColorStop(1, `rgba(0,0,0,${0.55*strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);
  }

  function drawCookieBody(ctx, cx, cy, s, tiltX, tiltY, lx, ly, t, recipe) {
    const base = BASES[recipe.base] || BASES.classic;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + tiltX*0.25, 1 - tiltY*0.18);

    const r = s;

    // shadow under cookie
    ctx.save();
    ctx.scale(1, 0.92);
    ctx.beginPath();
    ctx.ellipse(0, r*0.28, r*0.95, r*0.70, 0, 0, Math.PI*2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.filter = "blur(18px)";
    ctx.fill();
    ctx.restore();
    ctx.filter = "none";

    // dough gradient (base-specific)
    const g = ctx.createRadialGradient(-r*0.25 + lx*r*0.18, -r*0.22 + ly*r*0.18, r*0.18, 0, 0, r);
    g.addColorStop(0.00, base.dough[0]);
    g.addColorStop(0.45, base.dough[1]);
    g.addColorStop(1.00, base.dough[2]);

    // cookie disk
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r*0.92, 0, 0, Math.PI*2);
    ctx.fillStyle = g;
    ctx.fill();

    // micro texture overlay
    const g2 = ctx.createRadialGradient(r*0.15, r*0.22, r*0.12, 0, 0, r*1.05);
    g2.addColorStop(0, "rgba(255,255,255,0.06)");
    g2.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // speckles (handmade feel)
    const speck = base.speckle || 0.1;
    const n = Math.floor(220 * speck);
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i=0;i<n;i++){
      const a = Math.random()*Math.PI*2;
      const rr = Math.sqrt(Math.random()) * r * 0.95;
      const x = Math.cos(a)*rr;
      const y = Math.sin(a)*rr*0.92;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.25)";
      ctx.fillRect(x,y,1,1);
    }
    ctx.restore();

    // highlight sweep (finish)
    ctx.save();
    ctx.rotate(Math.sin(t*0.35)*0.08);
    const sweep = ctx.createLinearGradient(-r, -r, r, r);
    const hi = (recipe.finish === "glossy") ? 0.16 : 0.10;
    sweep.addColorStop(0, "rgba(255,255,255,0.00)");
    sweep.addColorStop(0.55, `rgba(255,255,255,${hi})`);
    sweep.addColorStop(1, "rgba(255,255,255,0.00)");
    ctx.fillStyle = sweep;
    ctx.globalCompositeOperation = "screen";
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    ctx.restore();
  }

  function chipColors(recipe, tone) {
    const mode = TOPPINGS.chips[recipe.chips] || TOPPINGS.chips.mix;
    if (mode.mix) {
      // alternate choco/white
      return (tone > 0.5)
        ? TOPPINGS.chips.choco
        : TOPPINGS.chips.white;
    }
    return mode;
  }

  function drawChips(ctx, cx, cy, s, tiltX, tiltY, lx, ly, spin, chips, recipe) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + tiltX*0.25, 1 - tiltY*0.18);

    for (const c of chips) {
      const a = spin + c.depth * 0.25;
      const rx = c.x * Math.cos(a) - c.y * Math.sin(a);
      const ry = c.x * Math.sin(a) + c.y * Math.cos(a);
      const px = rx * s;
      const py = ry * s * 0.92;
      const size = c.size * s * lerp(0.85, 1.15, c.depth);

      const ndotl = clamp01(0.55 + (rx*lx + ry*ly) * 0.55);
      const alpha = lerp(0.65, 0.92, ndotl);

      const col = chipColors(recipe, c.tone);

      // shadow
      ctx.save();
      ctx.translate(px + 2.5, py + 3.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, size*1.05, size*0.75, a*0.4, 0, Math.PI*2);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.filter = "blur(3px)";
      ctx.fill();
      ctx.restore();
      ctx.filter = "none";

      // chip
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a * 0.7);
      const grad = ctx.createRadialGradient(-size*0.35, -size*0.25, size*0.2, 0, 0, size*1.2);
      grad.addColorStop(0, col.colorA ? col.colorA.replace(/[\d.]+\)$/,'') + `${alpha})` : `rgba(70,45,30,${alpha})`);
      grad.addColorStop(1, col.colorB ? col.colorB.replace(/[\d.]+\)$/,'') + `${alpha})` : `rgba(30,18,12,${alpha})`);
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.ellipse(0, 0, size, size*0.72, 0, 0, Math.PI*2);
      ctx.fill();

      // highlight
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(255,255,255,${0.10 + 0.10*ndotl})`;
      ctx.beginPath();
      ctx.ellipse(-size*0.25, -size*0.18, size*0.35, size*0.22, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      ctx.restore();
    }
    ctx.restore();
  }

  function drawCrunch(ctx, cx, cy, s, tiltX, tiltY, lx, ly, spin, pieces, recipe) {
    const mode = TOPPINGS.crunch[recipe.crunch] || TOPPINGS.crunch.none;
    if (!mode.count) return;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + tiltX*0.25, 1 - tiltY*0.18);

    for (const c of pieces) {
      const a = -spin*0.6 + c.depth * 0.18;
      const rx = c.x * Math.cos(a) - c.y * Math.sin(a);
      const ry = c.x * Math.sin(a) + c.y * Math.cos(a);
      const px = rx * s;
      const py = ry * s * 0.92;
      const size = c.size * s;

      const ndotl = clamp01(0.55 + (rx*lx + ry*ly) * 0.55);
      const alpha = lerp(0.55, 0.90, ndotl);

      // chunk shadow
      ctx.save();
      ctx.translate(px + 2.0, py + 2.8);
      ctx.beginPath();
      ctx.roundRect(-size*0.6, -size*0.4, size*1.2, size*0.8, 6);
      ctx.fillStyle = "rgba(0,0,0,0.20)";
      ctx.filter = "blur(2px)";
      ctx.fill();
      ctx.restore();
      ctx.filter = "none";

      // chunk body
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a*0.5);
      const g = ctx.createLinearGradient(-size, -size, size, size);
      g.addColorStop(0, mode.colorA.replace(/[\d.]+\)$/,'') + `${alpha})`);
      g.addColorStop(1, mode.colorB.replace(/[\d.]+\)$/,'') + `${alpha})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(-size*0.6, -size*0.38, size*1.2, size*0.76, 6);
      ctx.fill();

      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(255,255,255,${0.10 + 0.10*ndotl})`;
      ctx.fillRect(-size*0.45, -size*0.25, size*0.5, size*0.18);
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    }

    ctx.restore();
  }

  function drawDrizzle(ctx, cx, cy, s, tiltX, tiltY, spin, recipe) {
    const d = TOPPINGS.drizzle[recipe.drizzle] || TOPPINGS.drizzle.none;
    if (!d.strength) return;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + tiltX*0.25, 1 - tiltY*0.18);
    ctx.rotate(spin*0.15);

    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = d.color;
    ctx.lineWidth = Math.max(2, s*0.03);
    ctx.lineCap = "round";
    ctx.globalAlpha = d.strength;

    // 3 calm drizzle lines (premium, not messy)
    for (let i=0;i<3;i++){
      const y = (i-1)*s*0.22;
      ctx.beginPath();
      ctx.moveTo(-s*0.75, y - s*0.10);
      ctx.bezierCurveTo(-s*0.25, y + s*0.18, s*0.25, y - s*0.18, s*0.75, y + s*0.10);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  function drawRim(ctx, cx, cy, s, tiltX, tiltY, recipe) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + tiltX*0.25, 1 - tiltY*0.18);
    const r = s;

    ctx.beginPath();
    ctx.ellipse(0, 0, r, r*0.92, 0, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = Math.max(1.2, r*0.02);
    ctx.stroke();

    if (recipe.finish === "glossy") {
      ctx.beginPath();
      ctx.ellipse(0, 0, r*0.98, r*0.90, 0, -2.6, -1.2);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = Math.max(1.0, r*0.016);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawGrain(ctx, w, h, amount) {
    const n = Math.floor((w*h) * 0.00002);
    ctx.save();
    ctx.globalAlpha = amount;
    for (let i=0;i<n;i++){
      const x = (Math.random()*w)|0;
      const y = (Math.random()*h)|0;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
      ctx.fillRect(x,y,1,1);
    }
    ctx.restore();
  }

  function clamp01(x){ return Math.max(0, Math.min(1, x)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Export
  window.Cookie3D = Cookie3D;
})();
