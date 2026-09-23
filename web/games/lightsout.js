/* Lights Out — single player. Tap a cell to flip it and its 4 neighbors. Turn them all off. */
CAB.register({ id:"lightsout", name:"Lights Out", icon:"💡", kind:"sp", desc:"flip the cross. kill every light.",
mount(stage, ctx){
  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:8px;width:100%"});
  const diffbar=ctx.el("div",{class:"ctrls",style:"padding:2px;gap:6px"});
  const hud=ctx.el("div",{class:"hud"});
  const board=ctx.el("div",{style:"position:relative;display:flex"});
  const cv=document.createElement("canvas");
  const msg=ctx.el("div",{style:"position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(11,15,20,.84);text-align:center"});
  const msgScore=ctx.el("div",{class:"hud",style:"font-size:15px"});
  msg.append(ctx.el("div",{class:"big-msg",style:"color:var(--grn)",text:"✓ CLEARED!"}), msgScore,
    ctx.el("button",{class:"btn grn",text:"↺ NEW GAME",onclick:()=>reset()}));
  board.append(cv, msg);
  const ctrls=ctx.el("div",{class:"ctrls"});
  ctrls.append(ctx.el("button",{class:"btn cyn",text:"↺ New board",style:"min-width:0;padding:12px 18px;font-size:14px",onclick:()=>reset()}));
  wrap.append(diffbar, hud, board, ctrls); stage.append(wrap);

  const SIZES={"4":"4×4","5":"5×5"};
  let sizeKey=ctx.load("lightsout_size")||"5"; if(!SIZES[sizeKey]) sizeKey="5";
  let N=+sizeKey;
  function renderDiff(){ diffbar.innerHTML="";
    Object.keys(SIZES).forEach(k=>{
      diffbar.append(ctx.el("button",{class:"btn"+(sizeKey===k?" grn":""),style:"min-width:0;padding:8px 13px;font-size:13px",text:SIZES[k],
        onclick:()=>{ sizeKey=k; N=+k; ctx.save("lightsout_size",k); renderDiff(); reset(); }})); }); }

  const g=cv.getContext("2d");
  let cell=80, grid, moves, done;

  function fit(){
    const w=Math.min(stage.clientWidth-24, stage.clientHeight-220, 420);
    cell=Math.floor(Math.max(120,w)/N);
    cv.width=cell*N; cv.height=cell*N;
    cv.style.width=cv.width+"px"; cv.style.height=cv.height+"px";
  }

  function toggle(r,c){ if(r<0||c<0||r>=N||c>=N) return; grid[r][c]=!grid[r][c]; }
  function press(r,c){ toggle(r,c); toggle(r-1,c); toggle(r+1,c); toggle(r,c-1); toggle(r,c+1); }

  function generate(){
    grid=[]; for(let r=0;r<N;r++){ grid.push([]); for(let c=0;c<N;c++) grid[r].push(false); }
    // start all-off, apply random taps -> always solvable; loop until not already solved
    let taps=N*N;
    do{
      for(let r=0;r<N;r++) for(let c=0;c<N;c++) grid[r][c]=false;
      for(let i=0;i<taps;i++) press((Math.random()*N)|0, (Math.random()*N)|0);
    } while(allOff());
  }
  function allOff(){ for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(grid[r][c]) return false; return true; }
  function litCount(){ let n=0; for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(grid[r][c]) n++; return n; }

  function reset(){ fit(); generate(); moves=0; done=false; msg.style.display="none"; draw(); refreshHud(); }

  function tap(r,c){
    if(done) return;
    press(r,c); moves++; draw();
    if(allOff()) win(); else refreshHud();
  }

  function win(){
    done=true;
    const key="lightsout_best_"+N, prev=+(ctx.load(key)||0);
    const best=(prev===0||moves<prev)?moves:prev; ctx.save(key,best); ctx.submitScore(moves, true, N+"x"+N);
    const rec=(prev===0||moves<prev)?" · 🏆 new best!":"";
    msgScore.innerHTML="cleared in <b>"+moves+"</b> moves · best "+best+rec;
    msg.style.display="flex";
    ctx.toast("cleared in "+moves+" moves");
  }
  function refreshHud(){ if(done) return;
    const key="lightsout_best_"+N, best=+(ctx.load(key)||0);
    hud.innerHTML="moves <b>"+moves+"</b> · lit "+litCount()+(best?" · best "+best:""); }

  function draw(){
    g.fillStyle="#0b0f14"; g.fillRect(0,0,cv.width,cv.height);
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){
      const x=c*cell, y=r*cell, on=grid[r][c];
      g.fillStyle=on?"rgba(255,209,102,.22)":"rgba(20,28,40,.9)";
      g.fillRect(x+3,y+3,cell-6,cell-6);
      g.strokeStyle=on?"#ffd166":"#1d2836"; g.lineWidth=2;
      g.strokeRect(x+3.5,y+3.5,cell-7,cell-7);
      if(on){ g.fillStyle="#ffd166"; const rad=Math.max(4,cell*0.13);
        g.beginPath(); g.arc(x+cell/2,y+cell/2,rad,0,Math.PI*2); g.fill(); }
    }
  }

  function pos(e){ const rc=cv.getBoundingClientRect();
    return { x:(e.clientX-rc.left)*(cv.width/rc.width), y:(e.clientY-rc.top)*(cv.height/rc.height) }; }
  cv.addEventListener("click",e=>{ if(done) return;
    const p=pos(e), c=(p.x/cell)|0, r=(p.y/cell)|0;
    if(c<0||c>=N||r<0||r>=N) return; tap(r,c); });

  const key=e=>{ if(done&&(e.key===" "||e.key==="Enter")) reset(); };
  window.addEventListener("keydown",key);

  renderDiff(); reset();
  const onR=()=>{ fit(); draw(); }; window.addEventListener("resize",onR);
  return ()=>{ window.removeEventListener("keydown",key); window.removeEventListener("resize",onR); };
}});
