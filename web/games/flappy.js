/* Flappy — single player. Tap / space / click to flap. Mind the gaps. */
CAB.register({ id:"flappy", name:"Flappy", icon:"🐤", kind:"sp", desc:"tap to flap. mind the gaps.",
mount(stage, ctx){
  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:8px;width:100%"});
  const hud=ctx.el("div",{class:"hud"});
  const cv=document.createElement("canvas");
  const btn=ctx.el("button",{class:"btn grn big2",style:"width:min(320px,80vw)",text:"FLAP"});
  wrap.append(hud, cv, btn); stage.append(wrap);
  const g=cv.getContext("2d");

  // world in fractional units: x = fraction of width, y = fraction of height
  const BX=0.30, R=0.034, PW=0.17, GH=0.155, SPACING=0.62;
  const GRAV=2.0, FLAP=-0.62, SPEED=0.34;
  let by, vy, pipes, score, best, phase, raf=0, last=0;

  best=+(ctx.load("flappy_best")||0);

  function fit(){
    const availW=stage.clientWidth-16, availH=stage.clientHeight-118;
    let w=Math.min(availW,460);
    let h=Math.min(availH, w*1.7);
    w=Math.min(w, Math.floor(h*0.8));
    cv.width=Math.max(160,Math.floor(w)); cv.height=Math.max(220,Math.floor(h));
    cv.style.width=cv.width+"px"; cv.style.height=cv.height+"px";
  }
  function newPipe(x){
    const lo=GH+0.09, hi=1-GH-0.14;               // keep gap on-screen, leave floor room
    return {x:x, gy:lo+Math.random()*(hi-lo), scored:false};
  }
  function reset(){
    by=0.42; vy=0; score=0; phase="ready";
    pipes=[newPipe(1.05), newPipe(1.05+SPACING), newPipe(1.05+SPACING*2)];
    draw();
  }
  function flap(){
    if(phase==="dead"){ reset(); return; }
    if(phase==="ready") phase="play";
    vy=FLAP;
  }
  function circHitsRect(cx,cy,r, x0,y0,x1,y1){
    const nx=Math.max(x0,Math.min(cx,x1)), ny=Math.max(y0,Math.min(cy,y1));
    const dx=cx-nx, dy=cy-ny; return dx*dx+dy*dy < r*r;
  }
  function die(){
    phase="dead";
    best=Math.max(score,best); ctx.save("flappy_best",best); ctx.submitScore(score);
    hud.innerHTML="💀 down — score <b>"+score+"</b> · best "+best+" — <u>tap to retry</u>";
  }
  function update(dt){
    if(phase==="ready"){ by=0.42+Math.sin(last/380)*0.02; return; } // gentle bob while waiting
    if(phase!=="play") return;                                       // dead: freeze the frame
    vy+=GRAV*dt; by+=vy*dt;
    const W=cv.width, H=cv.height, rpx=R*W;
    // top clamp / floor death
    if(by*H-rpx<0){ by=rpx/H; vy=0; }
    if(by*H+rpx>=H){ by=(H-rpx)/H; return die(); }
    // pipes
    for(const p of pipes){
      p.x-=SPEED*dt;
      if(!p.scored && p.x+PW<BX){ p.scored=true; score++; }
    }
    while(pipes.length && pipes[0].x+PW<-0.06) pipes.shift();
    const lastX=pipes.length?pipes[pipes.length-1].x:0;
    if(lastX<1-SPACING) pipes.push(newPipe(lastX+SPACING));
    // collision
    const cx=BX*W, cy=by*H;
    for(const p of pipes){
      const x0=p.x*W, x1=(p.x+PW)*W;
      if(x1<cx-rpx || x0>cx+rpx) continue;
      const gTop=(p.gy-GH)*H, gBot=(p.gy+GH)*H;
      if(circHitsRect(cx,cy,rpx, x0,0,x1,gTop) || circHitsRect(cx,cy,rpx, x0,gBot,x1,H)){ return die(); }
    }
  }
  function draw(){
    const W=cv.width, H=cv.height;
    g.fillStyle="#0e141c"; g.fillRect(0,0,W,H);
    // ground line
    g.strokeStyle="#1d2836"; g.lineWidth=2; g.beginPath(); g.moveTo(0,H-1); g.lineTo(W,H-1); g.stroke();
    // pipes
    for(const p of pipes){
      const x0=p.x*W, w=PW*W, gTop=(p.gy-GH)*H, gBot=(p.gy+GH)*H;
      g.fillStyle="#7CFFB2"; g.fillRect(x0,0,w,gTop);
      g.fillRect(x0,gBot,w,H-gBot);
      g.fillStyle="#3fae7e"; g.fillRect(x0,gTop-8,w,8); g.fillRect(x0,gBot,w,8);
    }
    // bird
    const cx=BX*W, cy=by*H, rpx=R*W;
    g.fillStyle="#ffd166"; g.beginPath(); g.arc(cx,cy,rpx,0,7); g.fill();
    g.fillStyle="#0b0f14"; g.beginPath(); g.arc(cx+rpx*0.35,cy-rpx*0.25,rpx*0.22,0,7); g.fill();
    // score overlay
    g.fillStyle="#c9d6e2"; g.textAlign="center"; g.font="bold "+Math.floor(H*0.11)+"px ui-monospace,monospace";
    g.fillText(score, W/2, H*0.16);
    if(phase==="ready"){ g.fillStyle="#57d9ff"; g.font="bold "+Math.floor(H*0.045)+"px ui-monospace,monospace";
      g.fillText("TAP TO START", W/2, H*0.60); }
    if(phase!=="dead") hud.innerHTML="score <b>"+score+"</b> · best "+best;
  }
  function loop(ts){
    if(!last) last=ts;
    let dt=(ts-last)/1000; last=ts;
    if(dt>0.05) dt=0.05;                            // clamp to avoid tunneling
    update(dt); draw();
    raf=requestAnimationFrame(loop);
  }

  // input
  const tap=e=>{ if(e){ e.preventDefault(); } flap(); };
  cv.addEventListener("touchstart",tap,{passive:false});
  cv.addEventListener("mousedown",tap);
  btn.addEventListener("touchstart",tap,{passive:false});
  btn.addEventListener("click",e=>{ e.preventDefault(); flap(); });
  const key=e=>{ if(e.key===" "||e.key==="ArrowUp"||e.key==="Enter"){ e.preventDefault(); flap(); } };
  window.addEventListener("keydown",key);
  const onR=()=>{ fit(); draw(); }; window.addEventListener("resize",onR);

  fit(); reset(); raf=requestAnimationFrame(loop);
  return ()=>{ cancelAnimationFrame(raf); window.removeEventListener("keydown",key); window.removeEventListener("resize",onR); };
}});
