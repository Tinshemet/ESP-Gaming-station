/* Minesweeper — single player. Tap reveals; long-press (or flag mode) plants a flag. */
CAB.register({ id:"mines", name:"Minesweeper", icon:"💣", kind:"sp", desc:"clear the field, flag the bombs.",
mount(stage, ctx){
  const N=9, MINES=10;
  const NUMCOL={1:"#57d9ff",2:"#7CFFB2",3:"#ff6b6b",4:"#ff6ad5",5:"#ffd166",6:"#57d9ff",7:"#c9d6e2",8:"#6b7f96"};

  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:10px;width:100%"});
  const hud=ctx.el("div",{class:"hud"});
  const boardWrap=ctx.el("div",{style:"position:relative"});
  const gridEl=ctx.el("div",{style:"display:grid;gap:2px;background:var(--line);padding:2px;border-radius:6px;touch-action:manipulation"});
  const msg=ctx.el("div",{style:"position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(11,15,20,.85);border-radius:8px;text-align:center"});
  const msgTxt=ctx.el("div",{class:"big-msg",style:"font-size:clamp(24px,8vw,48px)"});
  const msgSub=ctx.el("div",{class:"hud",style:"font-size:15px"});
  msg.append(msgTxt, msgSub, ctx.el("button",{class:"btn grn",text:"↺ NEW GAME",onclick:()=>reset()}));
  boardWrap.append(gridEl, msg);
  const ctrls=ctx.el("div",{class:"ctrls"});
  const flagBtn=ctx.el("button",{class:"btn",text:"🚩 flag: off"});
  flagBtn.addEventListener("click",()=>setFlagMode(!flagMode));
  const newBtn=ctx.el("button",{class:"btn cyn",text:"↺ new",onclick:()=>reset()});
  ctrls.append(flagBtn, newBtn);
  wrap.append(hud, boardWrap, ctrls); stage.append(wrap);

  let cells, btns, gen, over, revealed, flags, started, clockT, flagMode=false, activeLp=null, lastTouch=0, cellPx=30;

  function idx(x,y){ return y*N+x; }
  function neighbors(i){ const x=i%N, y=(i/N)|0, out=[];
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){ if(!dx&&!dy) continue;
      const nx=x+dx, ny=y+dy; if(nx>=0&&nx<N&&ny>=0&&ny<N) out.push(idx(nx,ny)); } return out; }
  function vibrate(){ try{ if(navigator.vibrate) navigator.vibrate(18); }catch(e){} }
  function setFlagMode(v){ flagMode=v; flagBtn.classList.toggle("red",flagMode); flagBtn.textContent="🚩 flag: "+(flagMode?"ON":"off"); }

  function fit(){
    const avail=Math.min(stage.clientWidth-20, stage.clientHeight-210, 430);
    cellPx=Math.max(26, Math.floor((avail-(N+1)*2)/N));
    gridEl.style.gridTemplateColumns="repeat("+N+","+cellPx+"px)";
    if(btns) btns.forEach(b=>{ b.style.width=cellPx+"px"; b.style.height=cellPx+"px"; b.style.fontSize=Math.floor(cellPx*0.52)+"px"; });
  }
  function generate(safe){
    const banned=new Set([safe].concat(neighbors(safe)));
    const spots=[]; for(let i=0;i<N*N;i++) if(!banned.has(i)) spots.push(i);
    for(let i=spots.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=spots[i]; spots[i]=spots[j]; spots[j]=t; }
    for(let k=0;k<MINES && k<spots.length;k++) cells[spots[k]].mine=true;
    for(let i=0;i<N*N;i++) cells[i].count=neighbors(i).filter(n=>cells[n].mine).length;
    gen=true;
  }
  function render(i){
    const b=btns[i], c=cells[i];
    if(c.flagged && !c.revealed){ b.textContent="🚩"; b.style.background="var(--bg2)"; b.style.color=""; return; }
    if(!c.revealed){ b.textContent=""; b.style.background="var(--bg2)"; b.style.color=""; return; }
    if(c.mine){ b.textContent="💣"; b.style.background=c.boom?"var(--red)":"var(--panel)"; return; }
    b.style.background="var(--panel)";
    if(c.count){ b.textContent=String(c.count); b.style.color=NUMCOL[c.count]||"var(--ink)"; }
    else b.textContent="";
  }
  function updateHud(){
    const t=started?Math.floor((Date.now()-started)/1000):0;
    const best=ctx.load("mines_best");
    hud.innerHTML="💣 <b>"+(MINES-flags)+"</b> · ⏱ "+t+"s"+(best?(" · best "+best+"s"):"");
  }
  function reveal(i){
    if(over) return; const c=cells[i]; if(c.revealed||c.flagged) return;
    if(!gen){ generate(i); started=Date.now(); clockT=setInterval(updateHud,300); }
    if(c.mine){ c.boom=true; return lose(); }
    const st=[i];
    while(st.length){ const j=st.pop(), cc=cells[j]; if(cc.revealed||cc.flagged) continue;
      cc.revealed=true; revealed++; render(j);
      if(cc.count===0) neighbors(j).forEach(n=>{ if(!cells[n].revealed&&!cells[n].flagged) st.push(n); }); }
    updateHud();
    if(revealed===N*N-MINES) winGame();
  }
  function flag(i){
    if(over) return; const c=cells[i]; if(c.revealed) return;
    c.flagged=!c.flagged; flags+=c.flagged?1:-1; render(i); updateHud();
  }
  function lose(){
    over=true; clearInterval(clockT);
    cells.forEach((c,i)=>{ if(c.mine){ c.revealed=true; render(i); }
      else if(c.flagged){ btns[i].textContent="✖"; btns[i].style.color="var(--red)"; } });
    msgTxt.style.color="var(--red)"; msgTxt.textContent="💥 BOOM";
    msgSub.textContent="you hit a mine";
    msg.style.display="flex";
  }
  function winGame(){
    over=true; clearInterval(clockT);
    cells.forEach((c,i)=>{ if(c.mine&&!c.flagged){ c.flagged=true; render(i); } });
    flags=MINES; updateHud();
    const t=Math.floor((Date.now()-started)/1000);
    const prev=+(ctx.load("mines_best")||0);
    const isBest=!prev||t<prev, best=isBest?t:prev; ctx.save("mines_best",best); ctx.submitScore(t, true);
    msgTxt.style.color="var(--grn)"; msgTxt.textContent="✓ CLEARED";
    msgSub.innerHTML=t+"s"+(isBest?" · new best!":" · best "+best+"s");
    msg.style.display="flex";
  }
  function attach(b,i){
    let lp=null, longed=false, moved=false;
    b.addEventListener("touchstart",e=>{ if(over) return; e.preventDefault();
      longed=false; moved=false; clearTimeout(lp);
      lp=setTimeout(()=>{ longed=true; lp=null; flag(i); vibrate(); },400); activeLp=lp; },{passive:false});
    b.addEventListener("touchmove",()=>{ moved=true; clearTimeout(lp); },{passive:true});
    b.addEventListener("touchend",e=>{ e.preventDefault(); clearTimeout(lp); lastTouch=Date.now();
      if(over||longed||moved) return; if(flagMode) flag(i); else reveal(i); },{passive:false});
    b.addEventListener("click",()=>{ if(Date.now()-lastTouch<600) return; if(over) return;
      if(flagMode) flag(i); else reveal(i); });
    b.addEventListener("contextmenu",e=>{ e.preventDefault(); if(!over) flag(i); });
  }
  function reset(){
    clearInterval(clockT); clearTimeout(activeLp);
    cells=[]; for(let i=0;i<N*N;i++) cells.push({mine:false,count:0,revealed:false,flagged:false,boom:false});
    gen=false; over=false; revealed=0; flags=0; started=null; clockT=null;
    gridEl.innerHTML=""; btns=[];
    for(let i=0;i<N*N;i++){
      const b=ctx.el("button",{class:"btn",style:"min-width:0;padding:0;border-radius:4px;background:var(--bg2)"});
      attach(b,i); gridEl.append(b); btns.push(b);
    }
    msg.style.display="none"; fit();
    for(let i=0;i<N*N;i++) render(i);
    updateHud();
  }

  const key=e=>{
    if(e.key==="f"||e.key==="F") setFlagMode(!flagMode);
    else if(over && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); reset(); }
  };
  window.addEventListener("keydown",key);

  reset();
  const onR=()=>fit(); window.addEventListener("resize",onR);
  return ()=>{ clearInterval(clockT); clearTimeout(activeLp); window.removeEventListener("keydown",key); window.removeEventListener("resize",onR); };
}});
