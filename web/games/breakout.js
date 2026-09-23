/* Breakout — single player. Drag / arrow keys move the paddle. Clear the wall. */
CAB.register({ id:"breakout", name:"Breakout", icon:"🧱", kind:"sp", desc:"drag the paddle. clear the wall.",
mount(stage, ctx){
  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:8px;width:100%"});
  const hud=ctx.el("div",{class:"hud"});
  const cv=document.createElement("canvas");
  wrap.append(hud, cv); stage.append(wrap);
  const g=cv.getContext("2d");

  // coordinate unit = canvas WIDTH. world width = 1, world height = A (aspect), so pixel = unit*W.
  const COLS=7, ROWS=5, MARGIN=0.03, TOPGAP=0.12, BRICK_H=0.05, BGAP=0.008;
  const PW=0.20, PH=0.024, BALLR=0.018;
  const ROWCOL=["#ff6b6b","#ffd166","#7CFFB2","#57d9ff","#ff6ad5"];
  const ROWPTS=[5,4,3,2,1];
  let A=1.6, W=300, H=480;
  let px, bx, by, vx, vy, speed, bricks, left, lives, score, best, level, phase, raf=0, last=0;
  let keyDir=0;

  best=+(ctx.load("breakout_best")||0);

  function fit(){
    const availW=stage.clientWidth-16, availH=stage.clientHeight-90;
    let w=Math.min(availW,440);
    let h=Math.min(availH, w*1.55);
    if(h/w<1.15){ h=w*1.15; }                       // keep it tallish for phone play
    if(h>availH){ h=availH; w=Math.min(w,h/1.15); }
    W=Math.max(200,Math.floor(w)); H=Math.max(260,Math.floor(h)); A=H/W;
    cv.width=W; cv.height=H; cv.style.width=W+"px"; cv.style.height=H+"px";
  }
  function paddleY(){ return A-0.05; }
  function brickRect(c,r){
    const areaW=1-2*MARGIN, bw=(areaW-(COLS-1)*BGAP)/COLS;
    const x=MARGIN+c*(bw+BGAP), y=TOPGAP+r*(BRICK_H+BGAP);
    return {x, y, w:bw, h:BRICK_H};
  }
  function buildBricks(){ bricks=[]; left=0;
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){ bricks.push({c,r,alive:true}); left++; }
  }
  function launch(){
    bx=px; by=paddleY()-BALLR-0.005;
    const ang=(-Math.PI/2)+(Math.random()*0.6-0.3);
    vx=Math.cos(ang); vy=Math.sin(ang);
  }
  function reset(){
    score=0; lives=3; level=1; speed=0.72; px=0.5; phase="play"; buildBricks(); launch(); draw();
  }
  function nextLevel(){ level++; speed=Math.min(speed+0.08,1.25); px=0.5; buildBricks(); launch(); phase="play"; }
  function lifeLost(){
    lives--;
    if(lives<=0){ phase="dead"; best=Math.max(score,best); ctx.save("breakout_best",best); ctx.submitScore(score);
      hud.innerHTML="💀 game over — score <b>"+score+"</b> · best "+best+" — <u>tap to retry</u>"; }
    else { phase="serve"; bx=px; by=paddleY()-BALLR-0.005; vx=0; vy=0; }
  }
  function serve(){ if(phase==="serve"){ phase="play"; launch(); } }

  function step(dt){
    if(phase!=="play" && phase!=="serve") return;
    // paddle by keyboard (works while playing or waiting to serve)
    if(keyDir){ px+=keyDir*1.4*dt; }
    px=Math.max(PW/2, Math.min(1-PW/2, px));
    if(phase==="serve"){ bx=px; by=paddleY()-BALLR-0.005; return; } // ball rides the paddle
    // move ball
    bx+=vx*speed*dt; by+=vy*speed*dt;
    // walls
    if(bx<BALLR){ bx=BALLR; vx=Math.abs(vx); }
    if(bx>1-BALLR){ bx=1-BALLR; vx=-Math.abs(vx); }
    if(by<BALLR){ by=BALLR; vy=Math.abs(vy); }
    // paddle collision
    const py=paddleY();
    if(vy>0 && by+BALLR>=py-PH/2 && by-BALLR<=py+PH/2 && bx>=px-PW/2-BALLR && bx<=px+PW/2+BALLR && by<py){
      const hit=(bx-px)/(PW/2);                     // -1..1
      const ang=(-Math.PI/2)+hit*(Math.PI/3);       // steer up, +/-60deg
      vx=Math.cos(ang); vy=Math.sin(ang);
      by=py-PH/2-BALLR-0.001;
    }
    // floor
    if(by-BALLR>A){ return lifeLost(); }
    // bricks
    for(const b of bricks){ if(!b.alive) continue;
      const rc=brickRect(b.c,b.r);
      if(bx+BALLR<rc.x || bx-BALLR>rc.x+rc.w || by+BALLR<rc.y || by-BALLR>rc.y+rc.h) continue;
      b.alive=false; left--; score+=ROWPTS[b.r];
      // reflect on the shallower-penetration axis
      const overL=(bx+BALLR)-rc.x, overR=(rc.x+rc.w)-(bx-BALLR);
      const overT=(by+BALLR)-rc.y, overB=(rc.y+rc.h)-(by-BALLR);
      const minX=Math.min(overL,overR), minY=Math.min(overT,overB);
      if(minX<minY){ vx=-vx; } else { vy=-vy; }
      speed=Math.min(speed+0.006,1.35);              // slight ramp per brick
      if(left<=0){ phase="won"; best=Math.max(score,best); ctx.save("breakout_best",best); ctx.submitScore(score);
        hud.innerHTML="🏆 cleared! — score <b>"+score+"</b> · best "+best+" — <u>tap for next wall</u>"; }
      break;
    }
  }
  function draw(){
    g.fillStyle="#0b0f14"; g.fillRect(0,0,W,H);
    // bricks
    for(const b of bricks){ if(!b.alive) continue;
      const rc=brickRect(b.c,b.r);
      g.fillStyle=ROWCOL[b.r%ROWCOL.length];
      g.fillRect(rc.x*W+1, rc.y*W+1, rc.w*W-2, rc.h*W-2);
    }
    // paddle
    const py=paddleY();
    g.fillStyle="#c9d6e2"; g.fillRect((px-PW/2)*W, (py-PH/2)*W, PW*W, PH*W);
    // ball
    g.fillStyle="#ffd166"; g.beginPath(); g.arc(bx*W, by*W, BALLR*W, 0, 7); g.fill();
    // messages
    if(phase==="serve"){ g.fillStyle="#57d9ff"; g.textAlign="center"; g.font="bold "+Math.floor(W*0.05)+"px ui-monospace,monospace";
      g.fillText("TAP TO SERVE", W/2, H*0.55); }
    if(phase!=="dead"&&phase!=="won"){ hud.innerHTML="score <b>"+score+"</b> · lives "+"●".repeat(Math.max(0,lives))+" · best "+best+" · L"+level; }
  }
  function loop(ts){
    if(!last) last=ts; let dt=(ts-last)/1000; last=ts;
    if(dt>0.045) dt=0.045;
    step(dt); draw();
    raf=requestAnimationFrame(loop);
  }

  // ---- input ----
  function setPaddleFromClient(clientX){
    const rc=cv.getBoundingClientRect(); if(!rc.width) return;
    const u=(clientX-rc.left)/rc.width;
    px=Math.max(PW/2, Math.min(1-PW/2, u));
  }
  function onDown(){ if(phase==="dead"||phase==="won"){ if(phase==="won") nextLevel(); else reset(); return true; } if(phase==="serve"){ serve(); } return false; }
  cv.addEventListener("touchstart",e=>{ e.preventDefault(); if(onDown()) return; setPaddleFromClient(e.touches[0].clientX); },{passive:false});
  cv.addEventListener("touchmove",e=>{ e.preventDefault(); if(phase==="play"||phase==="serve") setPaddleFromClient(e.touches[0].clientX); },{passive:false});
  let mdown=false;
  cv.addEventListener("mousedown",e=>{ mdown=true; if(onDown()) return; setPaddleFromClient(e.clientX); });
  cv.addEventListener("mousemove",e=>{ if(mdown && (phase==="play"||phase==="serve")) setPaddleFromClient(e.clientX); });
  const up=()=>{ mdown=false; }; window.addEventListener("mouseup",up);
  const key=e=>{ const k=e.key;
    if(k==="ArrowLeft"){ keyDir=-1; }
    else if(k==="ArrowRight"){ keyDir=1; }
    else if(k===" "||k==="Enter"){ e.preventDefault(); if(!onDown()) serve(); } };
  const keyU=e=>{ if((e.key==="ArrowLeft"&&keyDir<0)||(e.key==="ArrowRight"&&keyDir>0)) keyDir=0; };
  window.addEventListener("keydown",key); window.addEventListener("keyup",keyU);
  const onR=()=>{ fit(); draw(); }; window.addEventListener("resize",onR);

  fit(); reset(); raf=requestAnimationFrame(loop);
  return ()=>{ cancelAnimationFrame(raf);
    window.removeEventListener("keydown",key); window.removeEventListener("keyup",keyU);
    window.removeEventListener("mouseup",up); window.removeEventListener("resize",onR); };
}});
