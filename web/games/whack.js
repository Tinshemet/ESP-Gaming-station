/* Whack-a-mole — 30-second round. Tap the moles, dodge the bombs. */
CAB.register({ id:"whack", name:"Whack-a-mole", icon:"🔨", kind:"sp", desc:"30s. tap moles, not bombs.",
mount(stage, ctx){
  const ROUND=30;
  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;position:relative"});
  const hud=ctx.el("div",{class:"hud"});
  const grid=ctx.el("div",{style:"display:grid;grid-template-columns:repeat(3,1fr);gap:10px"});
  wrap.append(hud, grid); stage.append(wrap);

  let best=+(ctx.load("whack_best")||0);
  const holes=[];
  for(let i=0;i<9;i++){
    const inner=ctx.el("div",{style:"font-size:min(11vw,52px);line-height:1;user-select:none;transition:transform .06s"});
    const cellStyle="position:relative;display:flex;align-items:center;justify-content:center;"+
      "background:radial-gradient(circle at 50% 120%, #1a2634, #0e141c);border:1px solid var(--line);"+
      "border-radius:14px;overflow:hidden;aspect-ratio:1;cursor:pointer";
    const cell=ctx.el("div",{style:cellStyle, onpointerdown:e=>{ e.preventDefault(); whack(i); }}, inner);
    holes.push({cell, inner, active:false, bomb:false, whacked:false, until:0, clear:0});
    grid.append(cell);
  }

  function sizeGrid(){
    const s=Math.min(stage.clientWidth-24, stage.clientHeight-150, 440);
    grid.style.width=Math.max(220,s)+"px";
  }

  let running=false, score=0, timeLeft=ROUND, tick=0, count=0;

  function faceOf(h){
    if(h.whacked) return h.bomb?"💥":"✅";
    if(!h.active) return "";
    return h.bomb?"💣":"🐹";
  }
  function render(i){
    const h=holes[i], f=faceOf(h);
    h.inner.textContent=f;
    h.inner.style.transform=(h.active&&!h.whacked)?"translateY(0) scale(1)":"translateY(30%) scale(.6)";
    h.inner.style.opacity=f?"1":"0";
  }
  function renderAll(){ for(let i=0;i<9;i++) render(i); }

  function whack(i){
    if(!running) return;
    const h=holes[i];
    if(!h.active || h.whacked) return;
    h.whacked=true; h.active=false; h.clear=Date.now()+250;
    if(h.bomb){ score=Math.max(0,score-2); flash("#ff6b6b"); }
    else { score++; flash("#7CFFB2"); }
    render(i); updateHud();
  }
  let flashT=0;
  function flash(c){
    grid.style.boxShadow="0 0 0 2px "+c;
    clearTimeout(flashT); flashT=setTimeout(()=>{ grid.style.boxShadow="none"; },120);
  }

  function updateHud(){
    hud.innerHTML = running
      ? "⏱ <b>"+timeLeft+"</b>s · score <b>"+score+"</b> · best "+best
      : "score <b>"+score+"</b> · best <b>"+best+"</b>";
  }

  function loop(){
    if(!running) return;
    const now=Date.now();
    for(let i=0;i<9;i++){ const h=holes[i];
      if(h.active && now>h.until){ h.active=false; render(i); }        // missed — just retreats
      else if(!h.active && h.whacked && now>h.clear){ h.whacked=false; render(i); }
    }
    const prog=1-(timeLeft/ROUND);                                     // 0 -> 1
    const activeCount=holes.filter(h=>h.active).length;
    const maxA=2+Math.floor(prog*2);                                   // 2..4 at once
    const spawnP=0.14+prog*0.20;
    if(activeCount<maxA && Math.random()<spawnP){
      const empt=[]; for(let i=0;i<9;i++){ const h=holes[i]; if(!h.active && !h.whacked) empt.push(i); }
      if(empt.length){ const i=empt[(Math.random()*empt.length)|0], h=holes[i];
        h.active=true; h.whacked=false; h.bomb=Math.random()<0.16;
        const life=(760 - prog*280) + Math.random()*350; h.until=now+life; render(i); }
    }
  }

  function start(){
    hideOverlay();
    running=true; score=0; timeLeft=ROUND;
    for(const h of holes){ h.active=false; h.whacked=false; } renderAll();
    updateHud();
    clearInterval(tick); clearInterval(count);
    tick=setInterval(loop,90);
    count=setInterval(()=>{ timeLeft--; if(timeLeft<=0){ endGame(); } updateHud(); },1000);
  }
  function endGame(){
    running=false; clearInterval(tick); clearInterval(count);
    for(const h of holes){ h.active=false; h.whacked=false; } renderAll();
    best=Math.max(best,score); ctx.save("whack_best",best); ctx.submitScore(score); updateHud();
    showOverlay("💀 TIME!","score "+score+" · best "+best,"tap to play again");
  }

  // ---- overlay ----
  const ov=ctx.el("div",{style:"position:absolute;inset:0;display:flex;flex-direction:column;"+
    "align-items:center;justify-content:center;gap:12px;text-align:center;padding:20px;"+
    "background:rgba(11,15,20,.86);border-radius:14px;cursor:pointer",
    onpointerdown:e=>{ e.preventDefault(); start(); }});
  const ovTitle=ctx.el("div",{class:"big-msg",style:"font-size:clamp(26px,8vw,52px)"});
  const ovSub=ctx.el("div",{class:"hud",style:"font-size:15px"});
  const ovHint=ctx.el("div",{style:"color:var(--grn);font-size:14px"});
  ov.append(ovTitle, ovSub, ovHint); wrap.append(ov);
  function showOverlay(t,s,h){ ovTitle.textContent=t; ovSub.textContent=s; ovHint.textContent=h; ov.style.display="flex"; }
  function hideOverlay(){ ov.style.display="none"; }

  // ---- keyboard (1-9 grid, space/enter to start) ----
  const key=e=>{
    if(ov.style.display!=="none"){ if(e.key===" "||e.key==="Enter"){ e.preventDefault(); start(); } return; }
    const n=parseInt(e.key,10);
    if(n>=1&&n<=9){ e.preventDefault(); whack(n-1); }
  };
  window.addEventListener("keydown",key);

  sizeGrid(); renderAll();
  showOverlay("🔨 WHACK-A-MOLE","30-second round · 🐹 = +1 · 💣 = -2","tap to start");
  const onR=()=>{ sizeGrid(); }; window.addEventListener("resize",onR);
  return ()=>{ clearInterval(tick); clearInterval(count); clearTimeout(flashT);
    window.removeEventListener("keydown",key); window.removeEventListener("resize",onR); };
}});
