/* Tetris — single player. Buttons or arrow keys. Drag to move, tap to rotate, swipe down = hard drop. */
CAB.register({ id:"tetris", name:"Tetris", icon:"🟦", kind:"sp", desc:"stack blocks, clear lines, don't top out.",
mount(stage, ctx){
  const COLS=10, ROWS=18;
  const COLORS={ I:"#57d9ff", O:"#ffd166", T:"#ff6ad5", S:"#7CFFB2", Z:"#ff6b6b", J:"#6a9bff", L:"#ff9f5a" };
  const SHAPES={
    I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O:[[1,1],[1,1]],
    T:[[0,1,0],[1,1,1],[0,0,0]],
    S:[[0,1,1],[1,1,0],[0,0,0]],
    Z:[[1,1,0],[0,1,1],[0,0,0]],
    J:[[1,0,0],[1,1,1],[0,0,0]],
    L:[[0,0,1],[1,1,1],[0,0,0]]
  };

  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:8px;width:100%"});
  const hud=ctx.el("div",{class:"hud"});
  const board=ctx.el("div",{style:"position:relative;display:flex"});
  const cv=document.createElement("canvas");
  const msg=ctx.el("div",{style:"position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(11,15,20,.82);text-align:center"});
  const msgScore=ctx.el("div",{class:"hud",style:"font-size:15px"});
  msg.append(ctx.el("div",{class:"big-msg",style:"color:var(--red)",text:"TOP OUT"}), msgScore,
    ctx.el("button",{class:"btn grn",text:"↺ NEW GAME",onclick:()=>reset()}));
  board.append(cv, msg);
  const ctrls=ctx.el("div",{class:"ctrls"});
  wrap.append(hud, board, ctrls); stage.append(wrap);

  const g=cv.getContext("2d");
  let cell=20;
  function fit(){
    const availW=stage.clientWidth-24, availH=stage.clientHeight-200;
    cell=Math.max(12, Math.floor(Math.min(availW/COLS, availH/ROWS)));
    cv.width=COLS*cell; cv.height=ROWS*cell;
    cv.style.width=cv.width+"px"; cv.style.height=cv.height+"px";
  }

  let grid, piece, bag, score, lines, level, over, timer, speed;

  function firstFilled(s){ for(let y=0;y<s.length;y++) if(s[y].some(v=>v)) return y; return 0; }
  function rotateCW(m){ const n=m.length,r=[]; for(let y=0;y<n;y++){ r[y]=[]; for(let x=0;x<n;x++) r[y][x]=m[n-1-x][y]; } return r; }
  function nextType(){
    if(!bag.length){ bag=["I","O","T","S","Z","J","L"];
      for(let i=bag.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=bag[i]; bag[i]=bag[j]; bag[j]=t; } }
    return bag.pop();
  }
  function collide(s,px,py){
    for(let ry=0;ry<s.length;ry++) for(let rx=0;rx<s[ry].length;rx++){
      if(!s[ry][rx]) continue;
      const bx=px+rx, by=py+ry;
      if(bx<0||bx>=COLS||by>=ROWS) return true;
      if(by>=0 && grid[by][bx]) return true;
    }
    return false;
  }
  function spawn(){
    const t=nextType(), s=SHAPES[t].map(r=>r.slice());
    const x=((COLS-s[0].length)/2)|0, y=-firstFilled(s);
    piece={s, c:COLORS[t], x, y};
    if(collide(s,x,y)) gameOver();
  }
  function move(dx,dy){ if(!collide(piece.s,piece.x+dx,piece.y+dy)){ piece.x+=dx; piece.y+=dy; return true; } return false; }
  function rotate(){ if(over) return; const r=rotateCW(piece.s);
    for(const k of [0,-1,1,-2,2]){ if(!collide(r,piece.x+k,piece.y)){ piece.s=r; piece.x+=k; draw(); return; } } }
  function lock(){
    piece.s.forEach((row,ry)=>row.forEach((v,rx)=>{ if(v){ const by=piece.y+ry, bx=piece.x+rx;
      if(by>=0&&by<ROWS&&bx>=0&&bx<COLS) grid[by][bx]=piece.c; } }));
    let cleared=0;
    for(let y=ROWS-1;y>=0;y--){ if(grid[y].every(c=>c)){ grid.splice(y,1); grid.unshift(new Array(COLS).fill(null)); cleared++; y++; } }
    if(cleared){ score+=[0,100,300,500,800][cleared]*(level+1); lines+=cleared;
      const nl=Math.floor(lines/10); if(nl>level){ level=nl; setSpeed(); } }
    spawn();
  }
  function setSpeed(){ speed=Math.max(90, 700-level*55); if(!over){ clearInterval(timer); timer=setInterval(tick, speed); } }
  function tick(){ if(over) return; if(!move(0,1)) lock(); draw(); }
  function softDrop(){ if(over) return; if(move(0,1)) score++; else lock(); draw(); }
  function hardDrop(){ if(over) return; let d=0; while(move(0,1)) d++; score+=d*2; lock(); draw(); }

  function ghostY(){ let y=piece.y; while(!collide(piece.s,piece.x,y+1)) y++; return y; }
  function drawBlock(bx,by,color,ghost){
    if(by<0) return; const x=bx*cell, y=by*cell;
    if(ghost){ g.globalAlpha=.35; g.strokeStyle=color; g.lineWidth=2; g.strokeRect(x+2,y+2,cell-4,cell-4); g.globalAlpha=1; }
    else { g.fillStyle=color; g.fillRect(x+1,y+1,cell-2,cell-2);
      g.fillStyle="rgba(255,255,255,.16)"; g.fillRect(x+1,y+1,cell-2,Math.max(2,cell*0.18)); }
  }
  function draw(){
    g.fillStyle="#0b0f14"; g.fillRect(0,0,cv.width,cv.height);
    g.strokeStyle="rgba(29,40,54,.7)"; g.lineWidth=1;
    for(let x=1;x<COLS;x++){ g.beginPath(); g.moveTo(x*cell,0); g.lineTo(x*cell,cv.height); g.stroke(); }
    for(let y=1;y<ROWS;y++){ g.beginPath(); g.moveTo(0,y*cell); g.lineTo(cv.width,y*cell); g.stroke(); }
    for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++) if(grid[y][x]) drawBlock(x,y,grid[y][x]);
    if(!over && piece){
      const gy=ghostY();
      piece.s.forEach((row,ry)=>row.forEach((v,rx)=>{ if(v) drawBlock(piece.x+rx,gy+ry,piece.c,true); }));
      piece.s.forEach((row,ry)=>row.forEach((v,rx)=>{ if(v) drawBlock(piece.x+rx,piece.y+ry,piece.c); }));
    }
    const best=Math.max(score, +(ctx.load("tetris_best")||0));
    hud.innerHTML="score <b>"+score+"</b> · lvl "+level+" · lines "+lines+" · best "+best;
  }
  function gameOver(){
    over=true; clearInterval(timer);
    const best=Math.max(score, +(ctx.load("tetris_best")||0)); ctx.save("tetris_best",best); ctx.submitScore(score);
    msgScore.innerHTML="score <b>"+score+"</b> · best "+best;
    msg.style.display="flex";
  }
  function reset(){
    grid=[]; for(let y=0;y<ROWS;y++) grid.push(new Array(COLS).fill(null));
    bag=[]; score=0; lines=0; level=0; over=false; msg.style.display="none";
    spawn(); setSpeed(); draw();
  }

  // on-screen buttons
  function mkBtn(label,cls,fn){ return ctx.el("button",{class:"btn"+(cls?" "+cls:""),
    style:"min-width:52px;padding:14px 14px",text:label,onclick:fn}); }
  ctrls.append(
    mkBtn("◀","",()=>{ if(!over){ move(-1,0); draw(); } }),
    mkBtn("↻","grn",rotate),
    mkBtn("▶","",()=>{ if(!over){ move(1,0); draw(); } }),
    mkBtn("▼","",softDrop),
    mkBtn("⇊","cyn",hardDrop)
  );

  // keyboard
  const key=e=>{
    if(over){ if(e.key===" "||e.key==="Enter") reset(); return; }
    if(e.key==="ArrowLeft"){ move(-1,0); draw(); }
    else if(e.key==="ArrowRight"){ move(1,0); draw(); }
    else if(e.key==="ArrowUp"){ rotate(); }
    else if(e.key==="ArrowDown"){ e.preventDefault(); softDrop(); }
    else if(e.key===" "){ e.preventDefault(); hardDrop(); }
  };
  window.addEventListener("keydown",key);

  // touch: horizontal drag = move, tap = rotate, swipe down = hard drop
  let tsx=0,tsy=0,tst=0,tmoved=false,tLast=0;
  cv.addEventListener("touchstart",e=>{ const t=e.touches[0]; tsx=t.clientX; tsy=t.clientY; tst=Date.now(); tmoved=false; },{passive:true});
  cv.addEventListener("touchmove",e=>{ if(over) return; const t=e.touches[0]; const dx=t.clientX-tsx;
    if(Math.abs(dx)>=cell){ const dir=dx>0?1:-1, n=Math.floor(Math.abs(dx)/cell);
      for(let i=0;i<n;i++) move(dir,0); tsx+=dir*n*cell; tmoved=true; draw(); e.preventDefault(); } },{passive:false});
  cv.addEventListener("touchend",e=>{ tLast=Date.now(); if(over){ reset(); return; }
    const t=e.changedTouches[0], dy=t.clientY-tsy;
    if(!tmoved){ if(dy>cell*2) hardDrop(); else rotate(); } },{passive:true});
  cv.addEventListener("click",()=>{ if(Date.now()-tLast<600) return; if(over) reset(); else rotate(); });

  fit(); reset();
  const onR=()=>{ fit(); draw(); }; window.addEventListener("resize",onR);
  return ()=>{ clearInterval(timer); window.removeEventListener("keydown",key); window.removeEventListener("resize",onR); };
}});
