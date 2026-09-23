/* Asteroids — single player. Rotate + thrust, shoot the rocks. Buttons, arrow keys + space. */
CAB.register({ id:"asteroids", name:"Asteroids", icon:"🚀", kind:"sp", desc:"vector rocks. wrap the screen. don't get hit.",
mount(stage, ctx){
  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;height:100%"});
  const hud=ctx.el("div",{class:"hud"});
  const board=ctx.el("div",{style:"position:relative;display:flex"});
  const cv=document.createElement("canvas");
  const msg=ctx.el("div",{style:"position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(11,15,20,.82);text-align:center"});
  const msgScore=ctx.el("div",{class:"hud",style:"font-size:15px"});
  msg.append(ctx.el("div",{class:"big-msg",style:"color:var(--red)",text:"GAME OVER"}), msgScore,
    ctx.el("button",{class:"btn grn",text:"↺ RETRY",onclick:()=>reset()}));
  board.append(cv, msg);
  const ctrls=ctx.el("div",{class:"ctrls"});
  wrap.append(hud, board, ctrls); stage.append(wrap);

  const g=cv.getContext("2d");
  let W=360, H=480;
  function fit(){
    W=Math.max(200, Math.min(stage.clientWidth-24, 520));
    H=Math.max(240, Math.min(stage.clientHeight-190, 640));
    cv.width=W; cv.height=H;
    cv.style.width=W+"px"; cv.style.height=H+"px";
  }

  const SHIP_R=13, TURN=3.4, ACCEL=220, FRICTION=0.62, BULLET_SPD=440, BULLET_LIFE=0.9, FIRE_CD=0.22;
  let ship, bullets, rocks, score, lives, wave, over, inv, raf=0, last=0;
  const kb={left:false,right:false,thrust:false,fire:false};
  const bt={left:false,right:false,thrust:false,fire:false};
  const L=()=>kb.left||bt.left, R=()=>kb.right||bt.right, T=()=>kb.thrust||bt.thrust, F=()=>kb.fire||bt.fire;
  let fireCd=0;

  function rockShape(){ const n=9+((Math.random()*4)|0), pts=[];
    for(let i=0;i<n;i++) pts.push(0.72+Math.random()*0.5); return pts; }
  function spawnRock(x,y,size){
    const spd=(38+Math.random()*46)*(1+ (3-size)*0.22 + wave*0.05), a=Math.random()*Math.PI*2;
    return { x,y, vx:Math.cos(a)*spd, vy:Math.sin(a)*spd, size, r:size*13, ang:Math.random()*Math.PI*2,
      spin:(Math.random()-0.5)*1.8, shape:rockShape() };
  }
  function newWave(){
    wave++; rocks=[]; const count=3+wave;
    for(let i=0;i<count;i++){
      let x,y; do{ x=Math.random()*W; y=Math.random()*H; }
      while(Math.hypot(x-ship.x,y-ship.y)<Math.min(W,H)*0.32);
      rocks.push(spawnRock(x,y,3));
    }
  }
  function reset(){
    fit();
    ship={x:W/2,y:H/2,ang:-Math.PI/2,vx:0,vy:0};
    bullets=[]; rocks=[]; score=0; lives=3; wave=0; over=false; inv=2.2; fireCd=0;
    kb.left=kb.right=kb.thrust=kb.fire=false; bt.left=bt.right=bt.thrust=bt.fire=false;
    msg.style.display="none";
    newWave();
    if(raf) cancelAnimationFrame(raf); last=performance.now(); raf=requestAnimationFrame(loop);
  }

  function wrap2(o){ if(o.x<0)o.x+=W; else if(o.x>=W)o.x-=W; if(o.y<0)o.y+=H; else if(o.y>=H)o.y-=H; }
  function shoot(){
    bullets.push({ x:ship.x+Math.cos(ship.ang)*SHIP_R, y:ship.y+Math.sin(ship.ang)*SHIP_R,
      vx:Math.cos(ship.ang)*BULLET_SPD+ship.vx, vy:Math.sin(ship.ang)*BULLET_SPD+ship.vy, life:BULLET_LIFE });
  }
  function hitShip(){
    lives--;
    if(lives<=0){ gameOver(); return; }
    ship.x=W/2; ship.y=H/2; ship.vx=ship.vy=0; ship.ang=-Math.PI/2; inv=2.2;
  }
  function gameOver(){
    over=true; if(raf){ cancelAnimationFrame(raf); raf=0; }
    const best=Math.max(score, +(ctx.load("asteroids_best")||0)); ctx.save("asteroids_best",best);
    msgScore.innerHTML="score <b>"+score+"</b> · best "+best+" · wave "+wave;
    msg.style.display="flex";
    ctx.submitScore(score);
  }

  function update(dt){
    if(inv>0) inv-=dt;
    if(L()) ship.ang-=TURN*dt;
    if(R()) ship.ang+=TURN*dt;
    if(T()){ ship.vx+=Math.cos(ship.ang)*ACCEL*dt; ship.vy+=Math.sin(ship.ang)*ACCEL*dt; }
    const damp=Math.pow(FRICTION,dt); ship.vx*=damp; ship.vy*=damp;
    ship.x+=ship.vx*dt; ship.y+=ship.vy*dt; wrap2(ship);

    fireCd-=dt;
    if(F()&&fireCd<=0){ shoot(); fireCd=FIRE_CD; }

    for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i];
      b.x+=b.vx*dt; b.y+=b.vy*dt; wrap2(b); b.life-=dt; if(b.life<=0) bullets.splice(i,1); }

    for(const rk of rocks){ rk.x+=rk.vx*dt; rk.y+=rk.vy*dt; rk.ang+=rk.spin*dt; wrap2(rk); }

    // bullet vs rock
    for(let i=rocks.length-1;i>=0;i--){ const rk=rocks[i];
      for(let j=bullets.length-1;j>=0;j--){ const b=bullets[j];
        if(Math.hypot(b.x-rk.x,b.y-rk.y)<rk.r){
          bullets.splice(j,1); rocks.splice(i,1);
          score+=[0,100,50,20][rk.size]||20;
          if(rk.size>1){ rocks.push(spawnRock(rk.x,rk.y,rk.size-1)); rocks.push(spawnRock(rk.x,rk.y,rk.size-1)); }
          break;
        }
      }
    }
    // rock vs ship
    if(inv<=0){ for(const rk of rocks){ if(Math.hypot(ship.x-rk.x,ship.y-rk.y)<rk.r+SHIP_R*0.7){ hitShip(); break; } } }
    if(!over && !rocks.length) newWave();
  }

  function draw(){
    g.fillStyle="#0b0f14"; g.fillRect(0,0,W,H);
    // rocks
    g.strokeStyle="#6b7f96"; g.lineWidth=1.6;
    for(const rk of rocks){ g.save(); g.translate(rk.x,rk.y); g.rotate(rk.ang);
      g.beginPath(); const n=rk.shape.length;
      for(let i=0;i<n;i++){ const a=(i/n)*Math.PI*2, rr=rk.r*rk.shape[i];
        const px=Math.cos(a)*rr, py=Math.sin(a)*rr; i?g.lineTo(px,py):g.moveTo(px,py); }
      g.closePath(); g.stroke(); g.restore(); }
    // bullets
    g.fillStyle="#7CFFB2";
    for(const b of bullets){ g.beginPath(); g.arc(b.x,b.y,2.4,0,Math.PI*2); g.fill(); }
    // ship (blink while invulnerable)
    if(!over && !(inv>0 && (((inv*10)|0)%2))){
      g.save(); g.translate(ship.x,ship.y); g.rotate(ship.ang);
      g.strokeStyle="#57d9ff"; g.lineWidth=2; g.beginPath();
      g.moveTo(SHIP_R,0); g.lineTo(-SHIP_R*0.8,SHIP_R*0.7); g.lineTo(-SHIP_R*0.4,0);
      g.lineTo(-SHIP_R*0.8,-SHIP_R*0.7); g.closePath(); g.stroke();
      if(T()){ g.strokeStyle="#ff9f5a"; g.beginPath();
        g.moveTo(-SHIP_R*0.4,0); g.lineTo(-SHIP_R*1.1,0); g.stroke(); }
      g.restore();
    }
    const best=Math.max(score, +(ctx.load("asteroids_best")||0));
    hud.innerHTML="score <b>"+score+"</b> · ♥ "+Math.max(0,lives)+" · wave "+wave+" · best "+best;
  }

  function loop(now){
    let dt=(now-last)/1000; last=now; if(dt>0.05) dt=0.05;
    if(!over){ update(dt); draw(); raf=requestAnimationFrame(loop); }
  }

  // on-screen buttons (hold to act)
  function holdBtn(label,cls,flag){
    const b=ctx.el("button",{class:"btn"+(cls?" "+cls:""),style:"min-width:62px;padding:16px 14px;touch-action:none",text:label});
    const on=e=>{ e.preventDefault(); bt[flag]=true; };
    const off=()=>{ bt[flag]=false; };
    b.addEventListener("pointerdown",on);
    b.addEventListener("pointerup",off);
    b.addEventListener("pointerleave",off);
    b.addEventListener("pointercancel",off);
    return b;
  }
  ctrls.append(
    holdBtn("◀","","left"),
    holdBtn("▶","","right"),
    holdBtn("THRUST","cyn","thrust"),
    holdBtn("FIRE","grn","fire")
  );
  const onPointerUp=()=>{ bt.left=bt.right=bt.thrust=bt.fire=false; };
  window.addEventListener("pointerup",onPointerUp);

  const kdown=e=>{
    if(over){ if(e.key===" "||e.key==="Enter"){ e.preventDefault(); reset(); } return; }
    if(e.key==="ArrowLeft") kb.left=true;
    else if(e.key==="ArrowRight") kb.right=true;
    else if(e.key==="ArrowUp"){ e.preventDefault(); kb.thrust=true; }
    else if(e.key===" "){ e.preventDefault(); kb.fire=true; }
  };
  const kup=e=>{
    if(e.key==="ArrowLeft") kb.left=false;
    else if(e.key==="ArrowRight") kb.right=false;
    else if(e.key==="ArrowUp") kb.thrust=false;
    else if(e.key===" ") kb.fire=false;
  };
  window.addEventListener("keydown",kdown);
  window.addEventListener("keyup",kup);
  // tap game-over overlay area to retry (button already handles it; canvas tap as fallback)
  cv.addEventListener("click",()=>{ if(over) reset(); });

  reset();
  const onR=()=>{ const ox=ship?ship.x/W:0.5, oy=ship?ship.y/H:0.5; fit();
    if(ship){ ship.x=ox*W; ship.y=oy*H; } draw(); };
  window.addEventListener("resize",onR);
  return ()=>{ if(raf) cancelAnimationFrame(raf);
    window.removeEventListener("keydown",kdown); window.removeEventListener("keyup",kup);
    window.removeEventListener("pointerup",onPointerUp); window.removeEventListener("resize",onR); };
}});
