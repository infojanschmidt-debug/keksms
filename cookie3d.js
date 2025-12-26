/* cookie3d.js — MVP "3D"-Cookie (Fake-3D Canvas), no deps
   API: window.Cookie3D.init(canvas)
*/
(() => {
  const Cookie3D = {};
  let raf = null;

  Cookie3D.init = function init(canvas, opts = {}) {
    if (!canvas) throw new Error("Cookie3D.init(canvas): canvas missing");
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("2D context not available");

    // Settings (Premium / ruhig)
    const cfg = {
      chips: opts.chips ?? 26,
      wobble: opts.wobble ?? 0.035,
      spin: opts.spin ?? 0.22,          // rad/sec
      vignette: opts.vignette ?? 0.65,
      grain: opts.grain ?? 0.05,
      ...opts
    };

    // Internal state
    const state = {
      t0: performance.now(),
      w: 0,
      h: 0,
      dpr: 1,
      seed: mulberry32((Date.now() ^ 0xA5A5A5) >>> 0),
      chips: []
    };

    // Build chips once (positions on disk)
    function buildChips() {
      state.chips = [];
      for (let i = 0; i < cfg.chips; i++) {
        // radius distribution bias to middle
        const r = Math.sqrt(state.seed()) * 0.78;
        const a = state.seed() * Math.PI * 2;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        const size = lerp(0.018, 0.045, state.seed());
        const depth = lerp(0.2, 1.0, state.seed()); // used for parallax
        const tone = state.seed();
        state.chips.push({ x, y, size, depth, tone });
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      state.dpr = dpr;
      state.w = Math.max(1, Math.floor(rect.width * dpr));
      state.h = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = state.w;
      canvas.height = state.h;
      buildChips();
    }

    function draw(now) {
      const t = (now - state.t0) / 1000;
      const w = state.w, h = state.h, dpr = state.dpr;
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,w,h);

      // center + scale
      const cx = w * 0.5, cy = h * 0.52;
      const s = Math.min(w, h) * 0.38;

      // subtle background vignette (premium, dark)
      drawVignette(ctx, w, h, cfg.vignette);

      // cookie "3D" parameters
      const spin = t * cfg.spin;                // rotation angle
      const wob = Math.sin(t * 1.2) * cfg.wobble;
      const tiltX = 0.18 + wob;                 // tilt factor
      const tiltY = 0.12 - wob * 0.6;

      // light direction rotates slightly with spin (nice)
      const lx = Math.cos(spin * 0.9) * 0.55 + 0.2;
      const ly = Math.sin(spin * 0.9) * 0.35 - 0.25;

      // cookie body
      drawCookieBody(ctx, cx, cy, s, tiltX, tiltY, lx, ly, t);

      // chips with parallax (gives "3D")
      drawChips(ctx, cx, cy, s, tiltX, tiltY, lx, ly, spin, state.chips);

      // rim highlight
      drawRim(ctx, cx, cy, s, tiltX, tiltY, lx, ly);

      // subtle grain
      if (cfg.grain > 0) drawGrain(ctx, w, h, cfg.grain);

      raf = requestAnimationFrame(draw);
    }

    // kick off
    resize();
    window.addEventListener("resize", resize, { passive: true });
    raf = requestAnimationFrame(draw);

    // return handle (optional)
    return {
      destroy() {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
      }
    };
  };

  // ---------- Drawing helpers ----------

  function drawVignette(ctx, w, h, strength) {
    const g = ctx.createRadialGradient(w*0.5, h*0.48, Math.min(w,h)*0.15, w*0.5, h*0.5, Math.min(w,h)*0.7);
    g.addColorStop(0, "rgba(255,255,255,0.02)");
    g.addColorStop(1, `rgba(0,0,0,${0.55*strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);
  }

  function drawCookieBody(ctx, cx, cy, s, tiltX, tiltY, lx, ly, t) {
    // Ellipse transform for tilt
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + tiltX*0.25, 1 - tiltY*0.18);

    // Base cookie gradient (dough)
    const r = s;
    const g = ctx.createRadialGradient(-r*0.25 + lx*r*0.18, -r*0.22 + ly*r*0.18, r*0.18, 0, 0, r);
    g.addColorStop(0.00, "rgba(255,232,198,0.98)");
    g.addColorStop(0.45, "rgba(216,170,118,0.98)");
    g.addColorStop(1.00, "rgba(132, 86, 44,0.98)");

    // Slight texture via second gradient
    const g2 = ctx.createRadialGradient(r*0.15, r*0.22, r*0.12, 0, 0, r*1.05);
    g2.addColorStop(0, "rgba(255,255,255,0.06)");
    g2.addColorStop(1, "rgba(0,0,0,0.10)");

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

    // Cookie disk
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r*0.92, 0, 0, Math.PI*2);
    ctx.fillStyle = g;
    ctx.fill();

    // Overlay texture
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Soft highlight sweep
    ctx.save();
    ctx.rotate(Math.sin(t*0.35)*0.08);
    const sweep = ctx.createLinearGradient(-r, -r, r, r);
    sweep.addColorStop(0, "rgba(255,255,255,0.00)");
    sweep.addColorStop(0.55, "rgba(255,255,255,0.10)");
    sweep.addColorStop(1, "rgba(255,255,255,0.00)");
    ctx.fillStyle = sweep;
    ctx.globalCompositeOperation = "screen";
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    ctx.restore();
  }

  function drawChips(ctx, cx, cy, s, tiltX, tiltY, lx, ly, spin, chips) {
    ctx.save();
    ctx.translate(cx, cy);
    // tilt
    ctx.scale(1 + tiltX*0.25, 1 - tiltY*0.18);

    for (const c of chips) {
      // Rotate chips around center to create motion
      const a = spin + c.depth * 0.25;
      const rx = c.x * Math.cos(a) - c.y * Math.sin(a);
      const ry = c.x * Math.sin(a) + c.y * Math.cos(a);

      // Parallax + fake height
      const px = rx * s;
      const py = ry * s * 0.92;
      const size = c.size * s * lerp(0.85, 1.15, c.depth);

      // Lighting for chip
      const ndotl = clamp01(0.55 + (rx*lx + ry*ly) * 0.55);
      const base = lerp(0.15, 0.35, c.tone);
      const alpha = lerp(0.65, 0.92, ndotl);

      // Chip shadow (gives depth)
      ctx.save();
      ctx.translate(px + 2.5, py + 3.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, size*1.05, size*0.75, a*0.4, 0, Math.PI*2);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.filter = "blur(3px)";
      ctx.fill();
      ctx.restore();
      ctx.filter = "none";

      // Chip body
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a * 0.7);
      const grad = ctx.createRadialGradient(-size*0.35, -size*0.25, size*0.2, 0, 0, size*1.2);
      grad.addColorStop(0, `rgba(70,45,30,${alpha})`);
      grad.addColorStop(1, `rgba(30,18,12,${alpha})`);
      ctx.fillStyle = grad;

      ctx.beginPath();
      ctx.ellipse(0, 0, size, size*0.72, 0, 0, Math.PI*2);
      ctx.fill();

      // Specular tiny highlight
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

  function drawRim(ctx, cx, cy, s, tiltX, tiltY, lx, ly) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + tiltX*0.25, 1 - tiltY*0.18);
    const r = s;

    // rim stroke
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r*0.92, 0, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = Math.max(1.2, r*0.02);
    ctx.stroke();

    // highlight arc (top-left)
    ctx.beginPath();
    ctx.ellipse(0, 0, r*0.98, r*0.90, 0, -2.6, -1.2);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = Math.max(1.0, r*0.014);
    ctx.stroke();

    ctx.restore();
  }

  function drawGrain(ctx, w, h, amount) {
    // lightweight grain pass
    const n = Math.floor((w*h) * 0.00002); // sparse
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
