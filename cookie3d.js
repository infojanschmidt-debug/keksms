/* cookie3d.js — ONLYKEKS Hero Cookie (Canvas "3D" MVP, no deps)
   API: window.Cookie3D.init(canvas, { recipe?, onClick? })
*/
(() => {
  const Cookie3D = {};

  const BASES = {
    classic: { dough:["rgba(255,232,198,.98)","rgba(216,170,118,.98)","rgba(132,86,44,.98)"], speckle:0.10 },
    double:  { dough:["rgba(140,90,60,.98)","rgba(92,56,34,.98)","rgba(42,24,14,.98)"], speckle:0.14 },
    vanilla: { dough:["rgba(255,248,230,.98)","rgba(232,214,178,.98)","rgba(156,120,70,.98)"], speckle:0.08 }
  };

  const PRESETS = [
    { name:"Posti Classic", base:"classic", chips:"mix",  finish:"matte"  },
    { name:"Deep Double",   base:"double",  chips:"choco",finish:"glossy" },
    { name:"Vanilla Clean", base:"vanilla", chips:"white",finish:"matte"  },
  ];

  const DEFAULT = { base:"classic", chips:"mix", finish:"matte" };

  Cookie3D.init = function(canvas, opts = {}) {
    if (!canvas) throw new Error("Cookie3D.init: canvas missing");
    const ctx = canvas.getContext("2d", { alpha:true });
    if (!ctx) throw new Error("Cookie3D.init: 2D ctx missing");

    const cfg = {
      spin: opts.spin ?? 0.22,
      wobble: opts.wobble ?? 0.035,
      recipe: normalize(opts.recipe || DEFAULT),
      onClick: typeof opts.onClick === "function" ? opts.onClick : null
    };

    const st = {
      t0: performance.now(),
      seed: mulberry32(((Date.now() ^ 0xC00C1E)>>>0)),
      chips: []
    };

    function buildChips(){
      st.chips = [];
      const count = cfg.recipe.chips === "white" ? 22 : cfg.recipe.chips === "choco" ? 28 : 30;
      for(let i=0;i<count;i++){
        const r = Math.sqrt(st.seed()) * 0.78;
        const a = st.seed() * Math.PI*2;
        st.chips.push({
          x: Math.cos(a)*r, y: Math.sin(a)*r,
          size: lerp(0.018,0.045,st.seed()),
          depth: lerp(0.2,1.0,st.seed()),
          tone: st.seed()
        });
      }
    }

    function resize(){
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio||1);
      canvas.width = Math.floor(rect.width*dpr);
      canvas.height = Math.floor(rect.height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0); // draw in CSS pixels
      buildChips();
    }

    function draw(now){
      const t = (now - st.t0)/1000;
      const rect = canvas.getBoundingClientRect();
      const W = rect.width, H = rect.height;

      ctx.clearRect(0,0,W,H);

      const vg = ctx.createRadialGradient(W*0.5,H*0.5,Math.min(W,H)*0.15, W*0.5,H*0.5,Math.min(W,H)*0.72);
      vg.addColorStop(0,"rgba(255,255,255,0.02)");
      vg.addColorStop(1,"rgba(0,0,0,0.55)");
      ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);

      const cx=W*0.5, cy=H*0.52;
      const s=Math.min(W,H)*0.38;

      const spin = t*cfg.spin;
      const wob  = Math.sin(t*1.2)*cfg.wobble;
      const tiltX = 0.18 + wob;
      const tiltY = 0.12 - wob*0.6;

      const lx = Math.cos(spin*0.9)*0.55 + 0.2;
      const ly = Math.sin(spin*0.9)*0.35 - 0.25;

      drawBody(ctx,cx,cy,s,tiltX,tiltY,lx,ly,t,cfg.recipe);
      drawChips(ctx,cx,cy,s,tiltX,tiltY,lx,ly,spin,st.chips,cfg.recipe);
      drawRim(ctx,cx,cy,s,tiltX,tiltY,cfg.recipe);

      requestAnimationFrame(draw);
    }

    function surprise(){
      const p = PRESETS[(Math.random()*PRESETS.length)|0];
      cfg.recipe = normalize(p);
      buildChips();
      if(cfg.onClick) cfg.onClick(p, cfg.recipe);
      return p;
    }

    canvas.style.cursor = "pointer";
    canvas.addEventListener("click", surprise, { passive:true });

    resize();
    window.addEventListener("resize", resize, { passive:true });
    requestAnimationFrame(draw);

    return { setRecipe(r){ cfg.recipe=normalize(r); buildChips(); }, surprise };
  };

  function normalize(r){
    const base = BASES[r.base] ? r.base : "classic";
    const chips = (r.chips==="choco"||r.chips==="white"||r.chips==="mix") ? r.chips : "mix";
    const finish = (r.finish==="glossy") ? "glossy" : "matte";
    return { base, chips, finish };
  }

  function drawBody(ctx,cx,cy,s,tiltX,tiltY,lx,ly,t,recipe){
    const base = BASES[recipe.base] || BASES.classic;
    ctx.save();
    ctx.translate(cx,cy);
    ctx.scale(1+tiltX*0.25, 1-tiltY*0.18);

    const r=s;

    ctx.save();
    ctx.scale(1,0.92);
    ctx.beginPath();
    ctx.ellipse(0, r*0.28, r*0.95, r*0.70, 0, 0, Math.PI*2);
    ctx.fillStyle="rgba(0,0,0,0.35)";
    ctx.filter="blur(18px)";
    ctx.fill();
    ctx.restore();
    ctx.filter="none";

    const g = ctx.createRadialGradient(-r*0.25+lx*r*0.18, -r*0.22+ly*r*0.18, r*0.18, 0,0,r);
    g.addColorStop(0, base.dough[0]);
    g.addColorStop(0.45, base.dough[1]);
    g.addColorStop(1, base.dough[2]);

    ctx.beginPath();
    ctx.ellipse(0,0,r,r*0.92,0,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();

    const n = Math.floor(220*(base.speckle||0.1));
    ctx.save();
    ctx.globalAlpha=0.12;
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2;
      const rr=Math.sqrt(Math.random())*r*0.95;
      const x=Math.cos(a)*rr, y=Math.sin(a)*rr*0.92;
      ctx.fillStyle = Math.random()>0.5 ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.25)";
      ctx.fillRect(x,y,1,1);
    }
    ctx.restore();

    ctx.save();
    const hi = recipe.finish==="glossy" ? 0.16 : 0.10;
    const sweep = ctx.createLinearGradient(-r,-r,r,r);
    sweep.addColorStop(0,"rgba(255,255,255,0)");
    sweep.addColorStop(0.55,`rgba(255,255,255,${hi})`);
    sweep.addColorStop(1,"rgba(255,255,255,0)");
    ctx.globalCompositeOperation="screen";
    ctx.fillStyle=sweep; ctx.fill();
    ctx.globalCompositeOperation="source-over";
    ctx.restore();

    ctx.restore();
  }

  function drawChips(ctx,cx,cy,s,tiltX,tiltY,lx,ly,spin,chips,recipe){
    ctx.save();
    ctx.translate(cx,cy);
    ctx.scale(1+tiltX*0.25, 1-tiltY*0.18);

    for(const c of chips){
      const a = spin + c.depth*0.25;
      const rx = c.x*Math.cos(a) - c.y*Math.sin(a);
      const ry = c.x*Math.sin(a) + c.y*Math.cos(a);
      const px = rx*s, py = ry*s*0.92;
      const size = c.size*s*lerp(0.85,1.15,c.depth);

      const ndotl = clamp01(0.55 + (rx*lx + ry*ly)*0.55);
      const alpha = lerp(0.65,0.92,ndotl);

      const mode = recipe.chips==="white" ? "white" : recipe.chips==="choco" ? "choco" : (c.tone>0.5?"choco":"white");
      const colA = mode==="white" ? `rgba(255,255,255,${alpha})` : `rgba(60,38,26,${alpha})`;
      const colB = mode==="white" ? `rgba(200,190,175,${alpha})` : `rgba(25,14,10,${alpha})`;

      ctx.save();
      ctx.translate(px+2.5, py+3.5);
      ctx.beginPath();
      ctx.ellipse(0,0,size*1.05,size*0.75,a*0.4,0,Math.PI*2);
      ctx.fillStyle="rgba(0,0,0,0.22)";
      ctx.filter="blur(3px)";
      ctx.fill();
      ctx.restore();
      ctx.filter="none";

      ctx.save();
      ctx.translate(px,py);
      ctx.rotate(a*0.7);
      const grad = ctx.createRadialGradient(-size*0.35,-size*0.25,size*0.2, 0,0,size*1.2);
      grad.addColorStop(0,colA); grad.addColorStop(1,colB);
      ctx.fillStyle=grad;
      ctx.beginPath();
      ctx.ellipse(0,0,size,size*0.72,0,0,Math.PI*2);
      ctx.fill();

      ctx.globalCompositeOperation="screen";
      ctx.fillStyle=`rgba(255,255,255,${0.10+0.10*ndotl})`;
      ctx.beginPath();
      ctx.ellipse(-size*0.25,-size*0.18,size*0.35,size*0.22,0,0,Math.PI*2);
      ctx.fill();
      ctx.globalCompositeOperation="source-over";
      ctx.restore();
    }

    ctx.restore();
  }

  function drawRim(ctx,cx,cy,s,tiltX,tiltY,recipe){
    ctx.save();
    ctx.translate(cx,cy);
    ctx.scale(1+tiltX*0.25, 1-tiltY*0.18);
    const r=s;

    ctx.beginPath();
    ctx.ellipse(0,0,r,r*0.92,0,0,Math.PI*2);
    ctx.strokeStyle="rgba(255,255,255,0.12)";
    ctx.lineWidth=Math.max(1.2, r*0.02);
    ctx.stroke();

    if(recipe.finish==="glossy"){
      ctx.beginPath();
      ctx.ellipse(0,0,r*0.98,r*0.90,0,-2.6,-1.2);
      ctx.strokeStyle="rgba(255,255,255,0.22)";
      ctx.lineWidth=Math.max(1.0, r*0.016);
      ctx.stroke();
    }
    ctx.restore();
  }

  function clamp01(x){ return Math.max(0, Math.min(1,x)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t>>>15), t | 1);
      t ^= t + Math.imul(t ^ (t>>>7), t | 61);
      return ((t ^ (t>>>14))>>>0) / 4294967296;
    };
  }

  window.Cookie3D = Cookie3D;
})();
