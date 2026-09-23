/* Snake — single player. Swipe or use the d-pad. */
CAB.register({ id:"snake", name:"Snake", icon:"🐍", kind:"sp", desc:"classic. don't bite yourself.",
mount(stage, ctx){
  const COLS=17, ROWS=17;
  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:8px;width:100%"});
  const diffbar=ctx.el("div",{class:"ctrls",style:"padding:2px;gap:6px"});
  const hud=ctx.el("div",{class:"hud"});
  const cv=document.createElement("canvas");
  const dpad=ctx.el("div",{class:"ctrls",style:"display:grid;grid-template-columns:repeat(3,64px);gap:6px;justify-content:center"});
  wrap.append(diffbar, hud, cv, dpad); stage.append(wrap);

  // difficulty: higher start ms = slower. Hard ~= the original speed.
  const DIFF={easy:{s:210,f:135,d:3}, normal:{s:150,f:95,d:4}, hard:{s:110,f:55,d:5}};
  let diff=ctx.load("snake_diff")||"normal"; if(!DIFF[diff]) diff="normal";
  function renderDiff(){ diffbar.innerHTML="";
    [["easy","🐢 Easy"],["normal","Normal"],["hard","🔥 Hard"]].forEach(([k,lbl])=>{
      diffbar.append(ctx.el("button",{class:"btn"+(diff===k?" grn":""),style:"min-width:0;padding:8px 13px;font-size:13px",text:lbl,
        onclick:()=>{ diff=k; ctx.save("snake_diff",k); renderDiff(); reset(); }})); }); }

  let cell=18;
  function fit(){
    const w=Math.min(stage.clientWidth-24, stage.clientHeight-200, 380);
    cell=Math.max(10, Math.floor(w/COLS));
    cv.width=COLS*cell; cv.height=ROWS*cell;
    cv.style.width=cv.width+"px"; cv.style.height=cv.height+"px";
  }
  const g=cv.getContext("2d");
  let snake, dir, nextDir, food, score, dead, timer, speed, floor, dec;

  function reset(){
    const D=DIFF[diff]; speed=D.s; floor=D.f; dec=D.d;
    snake=[{x:8,y:8},{x:7,y:8},{x:6,y:8}]; dir={x:1,y:0}; nextDir=dir;
    score=0; dead=false; placeFood(); draw();
    clearInterval(timer); timer=setInterval(step, speed);
  }
  function placeFood(){
    do{ food={x:(Math.random()*COLS)|0, y:(Math.random()*ROWS)|0}; }
    while(snake.some(s=>s.x===food.x&&s.y===food.y));
  }
  function step(){
    if(dead) return;
    dir=nextDir;
    const h={x:snake[0].x+dir.x, y:snake[0].y+dir.y};
    if(h.x<0||h.y<0||h.x>=COLS||h.y>=ROWS||snake.some(s=>s.x===h.x&&s.y===h.y)){ return die(); }
    snake.unshift(h);
    if(h.x===food.x&&h.y===food.y){ score++; placeFood(); if(speed>floor){ speed=Math.max(floor,speed-dec); clearInterval(timer); timer=setInterval(step,speed);} }
    else snake.pop();
    draw();
  }
  function die(){ dead=true; clearInterval(timer); draw();
    const best=Math.max(score, +(ctx.load("snake_best")||0)); ctx.save("snake_best",best); ctx.submitScore(score);
    hud.innerHTML="💀 dead — score <b>"+score+"</b> · best "+best+" — <u>tap to retry</u>";
  }
  function draw(){
    g.fillStyle="#0e141c"; g.fillRect(0,0,cv.width,cv.height);
    g.fillStyle="#ff6ad5"; g.fillRect(food.x*cell+2,food.y*cell+2,cell-4,cell-4);
    snake.forEach((s,i)=>{ g.fillStyle=i===0?"#7CFFB2":"#3fae7e"; g.fillRect(s.x*cell+1,s.y*cell+1,cell-2,cell-2); });
    if(!dead) hud.innerHTML="score <b>"+score+"</b>";
  }
  function turn(x,y){ if(x===-dir.x&&y===-dir.y) return; nextDir={x,y}; }

  // swipe
  let sx,sy;
  cv.addEventListener("touchstart",e=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; },{passive:true});
  cv.addEventListener("touchend",e=>{ if(dead){reset();return;} const t=e.changedTouches[0];
    const dx=t.clientX-sx, dy=t.clientY-sy; if(Math.abs(dx)<12&&Math.abs(dy)<12) return;
    if(Math.abs(dx)>Math.abs(dy)) turn(dx>0?1:-1,0); else turn(0,dy>0?1:-1); },{passive:true});
  cv.addEventListener("click",()=>{ if(dead) reset(); });
  // keyboard (admin on laptop)
  const key=e=>{ const k=e.key; if(k==="ArrowUp")turn(0,-1);else if(k==="ArrowDown")turn(0,1);
    else if(k==="ArrowLeft")turn(-1,0);else if(k==="ArrowRight")turn(1,0); else if(dead&&k===" ")reset(); };
  window.addEventListener("keydown",key);
  // dpad (3x3 with arrows; center ↺ = restart)
  const cells=[["",0,0],["▲",0,-1],["",0,0],["◀",-1,0],["↺",0,0],["▶",1,0],["",0,0],["▼",0,1],["",0,0]];
  cells.forEach(([lbl,x,y])=>{ if(!lbl){ dpad.append(ctx.el("span")); return; }
    dpad.append(ctx.el("button",{class:"btn",style:"min-width:0;padding:14px 0",text:lbl,
      onclick:()=>{ if(lbl==="↺"||dead){reset();return;} turn(x,y); }})); });

  renderDiff(); fit(); reset();
  const onR=()=>{ fit(); draw(); }; window.addEventListener("resize",onR);
  return ()=>{ clearInterval(timer); window.removeEventListener("keydown",key); window.removeEventListener("resize",onR); };
}});
