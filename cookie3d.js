/* cookie3d.js (komplett) — ONLYKEKS Hero Cookie (Canvas "3D" Premium MVP, no deps)
   API: window.Cookie3D.init(canvas, { recipe?, presets?, onClick? })

   Features:
   - 3 Bases: classic / double / vanilla
   - 3 Toppings Slots: chips + crunch + drizzle
   - finish: matte/glossy
   - Click on cookie = "Überrasch mich" (random preset)
*/
(() => {
  const Cookie3D = {};
  let raf = null;

  // ---------- SSOT: Cookie Definition ----------
  const BASES = {
    classic: {
      label: "Classic",
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
      choco: { count: 28, a: "rgba(60,38,26,ALPHA)", b: "rgba(25,14,10,ALPHA)" },
      white: { count: 22, a: "rgba(255,255,255,ALPHA)", b: "rgba(200,190,175,ALPHA)" },
      mix:   { count: 30, mix: true }
    },
    crunch: {
      none:   { count: 0 },
      nuts:   { count: 10, a: "rgba(210,160,105,ALPHA)", b: "rgba(140,95,55,ALPHA)" },
      biscuit:{ count: 8,  a: "rgba(235,200,150,ALPHA)", b: "rgba(165,120,70,ALPHA)" }
    },
    drizzle: {
      none:  { strength: 0,  color: "rgba(0,0,0,0)" },
      dark:  { strength: 0.55, color: "rgba(40,22,14,0.55)" },
      white: { strength: 0.45, color: "rgba(255,255,255,0.55)" }
    }
  };

  const PRESETS_DEFAULT = [
    { name:"Posti Classic", base:"classic", chips:"mix",   crunch:"nuts",    drizzle:"none",  finish:"matte"  },
    { name:"Deep Double",   base:"double",  chips:"choco", crunch:"biscuit", drizzle:"dark",  finish:"glossy" },
    { name:"Vanilla Clean", base:"vanilla", chips:"white", crunch:"none",    drizzle:"white", finish:"matte"  },
    { name:"Classic Drip",  base:"classic", chips:"choco", crunch:"none",    drizzle:"dark",  finish:"glossy" },
    { name:"Crunchy Mix",   base:"vanilla", chips:"mix",   crunch:"nuts",    drizzle:"none",  finish:"matte"  },
  ];

  const DEFAULT_RECIPE = { base:"classic", chips:"mix", crunch:"nuts", drizzle:"none", finish:"matte" };

  // ---------- Public ----------
  Cookie3D.init = function init(canvas, opts = {}) {
    if (!canvas) throw new Error("Cookie3D.init(canvas): canvas missing");
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("Cookie3D.init: 2D context not available");

    const cfg = {
      spin: opts.spin ?? 0.22,
      wobble: opts.wobble ?? 0.035,
      vignette: opts.vignette ?? 0.65,
      grain: opts.grain ?? 0.035,
      clickable: opts.clickable ?? true,
      recipe: normalizeRecipe(opts.recipe || DEFAULT_RECIPE),
      presets: Array.isArray(opts.presets) && opts.presets.length ? opts.presets : PRESETS_DEFAULT,
      onClick: (typeof opts.onClick === "function") ? opts.onClick : null
    };

    const state = {
      t0: performance.now(),
      seed: mulberry32(((Date.now() ^ 0xC00C1E) >>> 0)),
      chips: [],
      crunch: [],
      dpr: 1,
      rectW: 0,
      rectH: 0
    };

    function makePieces(count, radiusMax, type){
      const arr = [];
      for (let i = 0; i < count; i++) {
        const r = Math.sqrt(state.seed()) * radiusMax;
        const a = state.seed() * Math.PI * 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        const size = (type === "crunch")
          ? lerp(0.030, 0.060, state.seed())
          : lerp(0.018, 0.045, state.seed());
        const depth = lerp(0.2, 1.0, state.seed());
        const tone = state.seed();
        arr.push({ x, y, size, depth, tone });
      }
      return arr;
    }

    function rebuildToppings(){
      const r = cfg.recipe;

      const chipMode = TOPPINGS.chips[r.chips] || TOPPINGS.chips.mix;
      const chipCount = chipMode.count ?? 28;
      state.chips = makePieces(chipCount, 0.78, "chip");

      const crunchMode = TOPPINGS.crunch[r.crunch] || TOPPINGS.crunch.none;
      const crunchCount = crunchMode.count ?? 0;
      state.crunch = makePieces(crunchCount, 0.70, "crunch");
    }

    function resize(){
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      state.dpr = dpr;
      state.rectW = rect.width;
      state.rectH = rect.height;

      canvas.width  = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);

      // Draw in CSS pixel coordinates
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      rebuildToppings();
    }

    function surprise(){
      const p = cfg.presets[(Math.random() * cfg.presets.length) | 0];
      cfg.recipe = normalizeRecipe(p);
      rebuildToppings();
      if (cfg.onClick) cfg.onClick(p, cfg.recipe);
      return p;
    }

    function draw(now){
      const t = (now - state.t0) / 1000;
      const W = state.rectW;
      const H = state.rectH;
      if (!W || !H) { raf = requestAnimationFrame(draw); return; }

      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx.clearRect(0,0,W,H);

      drawVignette(ctx, W, H, cfg.vignette);

      const cx = W * 0.5, cy = H * 0.52;
      const s  = Math.min(W, H) * 0.38;

      const spin = t * cfg.spin;
      const wob  = Math.sin(t * 1.2) * cfg.wobble;
      const tiltX = 0.18 + wob;
      const tiltY = 0.12 - wob * 0.6;

      const lx = Math.cos(spin * 0.9) * 0.55 + 0.2;
      const ly = Math.sin(spin * 0.9) * 0.35 - 0.25;

      drawCookieBody(ctx, cx, cy, s, tiltX, tiltY, lx, ly, t, cfg.recipe);
      drawChips(ctx, cx, cy, s, tiltX, tiltY, lx, ly, spin, state.chips, cfg.recipe);
      drawCrunch(ctx, cx, cy, s, tiltX, tiltY, lx, ly, spin, state.crunch, cfg.recipe);
      drawDrizzle(ctx, cx, cy, s, tiltX, tiltY, spin, cfg.recipe);
      drawRim(ctx, cx, cy, s, tiltX, tiltY, cfg.recipe);

      if (cfg.grain > 0) drawGrain(ctx, W, H, cfg.grain);

      raf = requestAnimationFrame(draw);
    }

    if (cfg.clickable){
      canvas.style.cursor = "pointer";
      canvas.addEventListener("click", surprise, { passive: true });
    }

    resize();
    window.addEventListener("resize", resize, { passive: true });
    raf = requestAnimationFrame(draw);

    return {
      setRecipe(next){ cfg.recipe = normalizeRecipe(next); rebuildToppings(); },
      surprise,
      destroy(){
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
      }
    };
  };

  // ---------- Drawing helpers ----------
  function drawVignette(ctx, w, h, strength){
    const g = ctx.createRadialGradient(w*0.5, h*0.48, Math.min(w,h)*0.15, w*0.5, h*0.5, Math.min(w,h)*0.7);
    g.addColorStop(0, "rgba(255,255,255,0.02)");
    g.addColorStop(1, `rgba(0,0,0,${0.55*strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);
  }

  function drawCookieBody(ctx, cx, cy, s, tiltX, tiltY, lx, ly, t, recipe){
    const base = BASES[recipe.base] || BASES.classic;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + tiltX*0.25, 1 - tiltY*0.18);

    const r = s;

    // Shadow under cookie (depth)
    ctx.save();
    ctx.scale(1, 0.92);
    ctx.beginPath();
    ctx.ellipse(0, r*0.28, r*0.95, r*0.70, 0, 0, Math.PI*2);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.filter = "blur(18px)";
    ctx.fill();
    ctx.restore();
    ctx.filter = "none";

    // Dough gradient
    const g = ctx.createRadialGradient(-r*0.25 + lx*r*0.18, -r*0.22 + ly*r*0.18, r*0.18, 0, 0, r);
    g.addColorStop(0.00, base.dough[0]);
    g.addColorStop(0.45, base.dough[1]);
    g.addColorStop(1.00, base.dough[2]);

    ctx.beginPath();
    ctx.ellipse(0, 0, r, r*0.92, 0, 0, Math.PI*2);
    ctx.fillStyle = g;
    ctx.fill();

    // Subtle overlay texture
    const g2 = ctx.createRadialGradient(r*0.15, r*0.22, r*0.12, 0, 0, r*1.05);
    g2.addColorStop(0, "rgba(255,255,255,0.06)");
    g2.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Handmade speckles
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

    // Finish highlight sweep
    ctx.save();
    const hi = (recipe.finish === "glossy") ? 0.16 : 0.10;
    const sweep = ctx.createLinearGradient(-r, -r, r, r);
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

  function chipColors(recipe, tone){
    const mode = TOPPINGS.chips[recipe.chips] || TOPPINGS.chips.mix;
    if (mode.mix) return (tone > 0.5) ? TOPPINGS.chips.choco : TOPPINGS.chips.white;
    return mode;
  }

  function drawChips(ctx, cx, cy, s, tiltX, tiltY, lx, ly, spin, chips, recipe){
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
      const colA = col.a.replace("ALPHA", String(alpha));
      const colB = col.b.replace("ALPHA", String(alpha));

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
      grad.addColorStop(0, colA);
      grad.addColorStop(1, colB);
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

  function drawCrunch(ctx, cx, cy, s, tiltX, tiltY, lx, ly, spin, pieces, recipe){
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

      const colA = mode.a.replace("ALPHA", String(alpha));
      const colB = mode.b.replace("ALPHA", String(alpha));

      // chunk shadow
      ctx.save();
      ctx.translate(px + 2.0, py + 2.8);
      ctx.beginPath();
      roundRect(ctx, -size*0.6, -size*0.4, size*1.2, size*0.8, 6);
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
      g.addColorStop(0, colA);
      g.addColorStop(1, colB);
      ctx.fillStyle = g;
      ctx.beginPath();
      roundRect(ctx, -size*0.6, -size*0.38, size*1.2, size*0.76, 6);
      ctx.fill();

      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = `rgba(255,255,255,${0.10 + 0.10*ndotl})`;
      ctx.fillRect(-size*0.45, -size*0.25, size*0.5, size*0.18);
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    }

    ctx.restore();
  }

  function drawDrizzle(ctx, cx, cy, s, tiltX, tiltY, spin, recipe){
    const d = TOPPINGS.drizzle[recipe.drizzle] || TOPPINGS.drizzle.none;
    if (!d.strength) return;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + tiltX*0.25, 1 - tiltY*0.18);
    ctx.rotate(spin * 0.15);

    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = d.color;
    ctx.lineWidth = Math.max(2, s*0.03);
    ctx.lineCap = "round";
    ctx.globalAlpha = d.strength;

    for (let i=0;i<3;i++){
      const y = (i-1) * s * 0.22;
      ctx.beginPath();
      ctx.moveTo(-s*0.75, y - s*0.10);
      ctx.bezierCurveTo(-s*0.25, y + s*0.18, s*0.25, y - s*0.18, s*0.75, y + s*0.10);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  function drawRim(ctx, cx, cy, s, tiltX, tiltY, recipe){
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

  function drawGrain(ctx, w, h, amount){
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

  // ---------- utils ----------
  function normalizeRecipe(r){
    const base = BASES[r.base] ? r.base : "classic";
    const chips = TOPPINGS.chips[r.chips] ? r.chips : "mix";
    const crunch = TOPPINGS.crunch[r.crunch] ? r.crunch : "nuts";
    const drizzle = TOPPINGS.drizzle[r.drizzle] ? r.drizzle : "none";
    const finish = (r.finish === "glossy") ? "glossy" : "matte";
    return { base, chips, crunch, drizzle, finish };
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
  function roundRect(ctx, x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y,   x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x,   y+h, rr);
    ctx.arcTo(x,   y+h, x,   y,   rr);
    ctx.arcTo(x,   y,   x+w, y,   rr);
    ctx.closePath();
  }

  // Export (wichtig!)
  window.Cookie3D = Cookie3D;
})();
