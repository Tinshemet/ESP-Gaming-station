/* Offline Dino — there's genuinely no internet, so… the dino. Tap/space to jump. */
CAB.register({ id:"dino", name:"Offline Dino", icon:"🦖", kind:"sp", desc:"no internet. one button. run.",
mount(stage, ctx){
  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:10px;width:100%"});
  const hud=ctx.el("div",{class:"hud"});
  const cv=document.createElement("canvas");
  const ctrls=ctx.el("div",{class:"ctrls"});
  wrap.append(hud, cv, ctrls); stage.append(wrap);

  const g=cv.getContext("2d");
  let W=360, H=200;
  function fit(){
    W=Math.max(240, Math.min(stage.clientWidth-16, 620));
    H=Math.max(160, Math.min(Math.floor(W*0.52), stage.clientHeight-180, 300));
    cv.width=W; cv.height=H;
    cv.style.width=W+"px"; cv.style.height=H+"px";
  }

  // fractional units so it survives resize -----------------------
  const GROUNDF=0.80;                 // ground line as fraction of H
  const DINO_XF=0.13, DINO_WF=0.075, DINO_HF=0.20;  // xf/wf of W, hf of H
  const GRAV=3.6, JUMPV=1.60;         // in H-fractions per s / s^2
  const JHF=0.34;                     // (informational) ~jump apex height

  let dino, obstacles, speed, dist, score, best, dead, elapsed, nextSpawn;
  best=+(ctx.load("dino_best")||0);

  function reset(){
    dino={y:0, vy:0, onGround:true};
    obstacles=[]; speed=0.55; dist=0; score=0; dead=false; elapsed=0; nextSpawn=0.7;
    last=0;
  }
  function jump(){
    if(dead){ reset(); return; }
    if(dino.onGround){ dino.vy=JUMPV; dino.onGround=false; }
  }
  function spawn(){
    const wf=DINO_WF*(0.7+Math.random()*0.7);
    const hf=0.11+Math.random()*0.11;
    obstacles.push({xf:1.06, wf:wf, hf:hf});
  }
  function update(dt){
    elapsed+=dt;
    speed=0.55+Math.min(elapsed/28,0.75);       // 0.55 -> 1.30 screen-widths/s
    dist+=speed*dt;
    score=Math.floor(dist*20);
    if(score>best){ best=score; }
    // dino physics
    dino.y+=dino.vy*dt; dino.vy-=GRAV*dt;
    if(dino.y<=0){ dino.y=0; dino.vy=0; dino.onGround=true; }
    // obstacles
    for(const o of obstacles) o.xf-=speed*dt;
    while(obstacles.length && obstacles[0].xf+obstacles[0].wf<-0.05) obstacles.shift();
    nextSpawn-=dt;
    if(nextSpawn<=0){
      spawn();
      const tighten=1-Math.min(elapsed/60,0.3);
      nextSpawn=(0.85+Math.random()*0.85)*tighten;
    }
    // collision
    const dins=DINO_WF*0.22;                     // forgiveness inset
    const dl=DINO_XF+dins, drt=DINO_XF+DINO_WF-dins;
    for(const o of obstacles){
      if(drt>o.xf && dl<o.xf+o.wf && dino.y < o.hf-0.01){ die(); break; }
    }
  }
  function die(){ if(dead) return; dead=true; best=Math.max(best,score); ctx.save("dino_best",best); ctx.submitScore(score); }

  function rr(x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r);
    g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }

  function draw(){
    const gy=H*GROUNDF;
    g.fillStyle="#0b0f14"; g.fillRect(0,0,W,H);
    // parallax stars
    g.fillStyle="#16202c";
    for(let i=0;i<6;i++){ const x=(i*W/6 - dist*W*0.15) % W; g.fillRect((x+W)%W, 10+((i*37)%(H*0.35)), 2, 2); }
    // ground
    g.strokeStyle="#1d2836"; g.lineWidth=2;
    g.beginPath(); g.moveTo(0,gy); g.lineTo(W,gy); g.stroke();
    // moving ground dashes
    g.fillStyle="#243247";
    const dash=W*0.06, step=W*0.12, off=(dist*W)%step;
    for(let x=-off;x<W;x+=step){ g.fillRect(x,gy+6,dash,3); }
    // obstacles (cacti)
    for(const o of obstacles){
      const x=o.xf*W, w=o.wf*W, h=o.hf*H;
      g.fillStyle="#3fae7e"; rr(x, gy-h, w, h, Math.min(4,w*0.3)); g.fill();
      g.fillStyle="#2c8862"; g.fillRect(x+w*0.35, gy-h*0.6, w*0.3, h*0.6);
    }
    // dino
    const dw=DINO_WF*W, dh=DINO_HF*H, dx=DINO_XF*W;
    const dbot=gy - dino.y*H, dtop=dbot-dh;
    g.fillStyle=dead?"#ff6b6b":"#7CFFB2";
    rr(dx, dtop, dw, dh, Math.min(5,dw*0.25)); g.fill();
    // head bump
    rr(dx+dw*0.45, dtop-dh*0.28, dw*0.55, dh*0.42, 3); g.fill();
    // eye
    g.fillStyle="#0b0f14"; g.fillRect(dx+dw*0.72, dtop-dh*0.12, Math.max(2,dw*0.12), Math.max(2,dw*0.12));
    // legs (only when running on ground)
    if(dino.onGround && !dead){
      g.fillStyle=dead?"#ff6b6b":"#7CFFB2";
      const ph=Math.floor(dist*22)%2;
      g.fillRect(dx+dw*0.15, dbot, dw*0.22, dh*0.16*(ph?1:0.4));
      g.fillRect(dx+dw*0.6,  dbot, dw*0.22, dh*0.16*(ph?0.4:1));
    }
    // HUD text on canvas
    g.fillStyle="#6b7f96"; g.textAlign="right"; g.textBaseline="top";
    g.font="700 "+Math.floor(H*0.09)+"px ui-monospace,monospace";
    g.fillText(("00000"+score).slice(-5), W-8, 8);
    g.fillStyle="#243247"; g.font="600 "+Math.floor(H*0.06)+"px ui-monospace,monospace";
    g.fillText("HI "+("00000"+best).slice(-5), W-8, 8+H*0.11);

    if(dead){
      g.fillStyle="rgba(11,15,20,.72)"; g.fillRect(0,0,W,H);
      g.textAlign="center";
      g.fillStyle="#ff6b6b"; g.textBaseline="middle";
      g.font="700 "+Math.floor(H*0.16)+"px ui-monospace,monospace";
      g.fillText("G A M E  O V E R", W/2, H*0.4);
      g.fillStyle="#c9d6e2"; g.font="600 "+Math.floor(H*0.08)+"px ui-monospace,monospace";
      g.fillText("score "+score+" · best "+best, W/2, H*0.58);
      g.fillStyle="#7CFFB2"; g.font="600 "+Math.floor(H*0.075)+"px ui-monospace,monospace";
      g.fillText("tap to retry", W/2, H*0.72);
    }
    hud.innerHTML = dead
      ? "💀 score <b>"+score+"</b> · best "+best+" — <u>tap / space to retry</u>"
      : "score <b>"+score+"</b> · best "+best+" — ▲ tap to jump";
  }

  // ---- loop ----
  let raf=0, last=0;
  function frame(ts){
    let dt=last?(ts-last)/1000:0; last=ts; if(dt>0.05) dt=0.05;
    if(!dead && dt>0) update(dt);
    draw();
    raf=requestAnimationFrame(frame);
  }

  // ---- input ----
  cv.addEventListener("touchstart",e=>{ e.preventDefault(); jump(); },{passive:false});
  cv.addEventListener("mousedown",jump);
  const key=e=>{ if(e.key===" "||e.key==="ArrowUp"||e.key==="Enter"){ e.preventDefault(); jump(); } };
  window.addEventListener("keydown",key);
  ctrls.append(ctx.el("button",{class:"btn grn big2",text:"▲ JUMP",style:"min-width:180px",
    onpointerdown:e=>{ e.preventDefault(); jump(); }}));

  fit(); reset();
  const onR=()=>{ fit(); draw(); }; window.addEventListener("resize",onR);
  raf=requestAnimationFrame(frame);
  return ()=>{ cancelAnimationFrame(raf); window.removeEventListener("keydown",key); window.removeEventListener("resize",onR); };
}});
