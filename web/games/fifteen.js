/* 15-Puzzle — single player. Tap a tile next to the gap to slide it (or arrow keys). */
CAB.register({ id:"fifteen", name:"15-Puzzle", icon:"🧩", kind:"sp", desc:"slide the tiles back into order.",
mount(stage, ctx){
  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:8px;width:100%"});
  const diffbar=ctx.el("div",{class:"ctrls",style:"padding:2px;gap:6px"});
  const hud=ctx.el("div",{class:"hud"});
  const board=ctx.el("div",{style:"position:relative;display:flex"});
  const cv=document.createElement("canvas");
  const msg=ctx.el("div",{style:"position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(11,15,20,.84);text-align:center"});
  const msgTitle=ctx.el("div",{class:"big-msg",style:"color:var(--grn)",text:"SOLVED"});
  const msgScore=ctx.el("div",{class:"hud",style:"font-size:15px"});
  msg.append(msgTitle, msgScore, ctx.el("button",{class:"btn grn",text:"↺ NEW GAME",onclick:()=>reset()}));
  board.append(cv, msg);
  const ctrls=ctx.el("div",{class:"ctrls"});
  ctrls.append(ctx.el("button",{class:"btn cyn",text:"↺ Shuffle",style:"min-width:0;padding:12px 18px;font-size:14px",onclick:()=>reset()}));
  wrap.append(diffbar, hud, board, ctrls); stage.append(wrap);

  const SIZES={"3":"3×3","4":"4×4","5":"5×5"};
  let sizeKey=ctx.load("fifteen_size")||"4"; if(!SIZES[sizeKey]) sizeKey="4";
  let N=+sizeKey;
  function renderDiff(){ diffbar.innerHTML="";
    Object.keys(SIZES).forEach(k=>{
      diffbar.append(ctx.el("button",{class:"btn"+(sizeKey===k?" grn":""),style:"min-width:0;padding:8px 13px;font-size:13px",text:SIZES[k],
        onclick:()=>{ sizeKey=k; N=+k; ctx.save("fifteen_size",k); renderDiff(); reset(); }})); }); }

  const g=cv.getContext("2d");
  let cell=80, tiles, blank, moves, startTs, solved, timer;

  function fit(){
    const w=Math.min(stage.clientWidth-24, stage.clientHeight-220, 420);
    const px=Math.max(120, w);
    cell=Math.floor(px/N);
    cv.width=cell*N; cv.height=cell*N;
    cv.style.width=cv.width+"px"; cv.style.height=cv.height+"px";
  }

  function solvedState(){ const a=[]; for(let i=1;i<N*N;i++) a.push(i); a.push(0); return a; }
  function isSolved(){ for(let i=0;i<N*N-1;i++) if(tiles[i]!==i+1) return false; return tiles[N*N-1]===0; }
  function neighbors(idx){ const r=(idx/N)|0, c=idx%N, out=[];
    if(r>0) out.push(idx-N); if(r<N-1) out.push(idx+N);
    if(c>0) out.push(idx-1); if(c<N-1) out.push(idx+1); return out; }

  function shuffle(){
    tiles=solvedState(); blank=N*N-1;
    let prev=-1, steps=N*N*40;
    for(let i=0;i<steps;i++){
      const nb=neighbors(blank).filter(x=>x!==prev);
      const pick=nb[(Math.random()*nb.length)|0];
      tiles[blank]=tiles[pick]; tiles[pick]=0; prev=blank; blank=pick;
    }
    if(isSolved()) return shuffle();
  }

  function reset(){
    fit(); shuffle(); moves=0; startTs=null; solved=false;
    msg.style.display="none";
    clearInterval(timer); timer=setInterval(refreshHud, 500);
    draw(); refreshHud();
  }

  function slide(idx){
    if(solved) return;
    if(neighbors(blank).indexOf(idx)<0) return;
    tiles[blank]=tiles[idx]; tiles[idx]=0; blank=idx;
    if(startTs===null) startTs=Date.now();
    moves++;
    draw();
    if(isSolved()) win();
    else refreshHud();
  }

  function elapsed(){ return startTs===null?0:Math.floor((Date.now()-startTs)/1000); }
  function fmt(s){ const m=(s/60)|0; return m+":"+String(s%60).padStart(2,"0"); }

  function win(){
    solved=true; clearInterval(timer);
    const key="fifteen_best_"+N, prev=+(ctx.load(key)||0);
    const best=(prev===0||moves<prev)?moves:prev; ctx.save(key,best); ctx.submitScore(moves, true, N+"x"+N);
    const rec=(prev===0||moves<prev)?" · 🏆 new best!":"";
    msgScore.innerHTML="solved in <b>"+moves+"</b> moves · "+fmt(elapsed())+" · best "+best+rec;
    msg.style.display="flex";
    ctx.toast("solved in "+moves+" moves");
  }

  function refreshHud(){
    if(solved) return;
    const key="fifteen_best_"+N, best=+(ctx.load(key)||0);
    hud.innerHTML="moves <b>"+moves+"</b> · "+fmt(elapsed())+(best?" · best "+best:"");
  }

  function draw(){
    g.fillStyle="#0b0f14"; g.fillRect(0,0,cv.width,cv.height);
    g.font="bold "+Math.floor(cell*0.34)+"px ui-monospace,Menlo,Consolas,monospace";
    g.textAlign="center"; g.textBaseline="middle";
    for(let i=0;i<N*N;i++){
      const v=tiles[i]; if(!v) continue;
      const x=(i%N)*cell, y=((i/N)|0)*cell;
      const good=(v===i+1);
      g.fillStyle=good?"rgba(124,255,178,.14)":"rgba(87,217,255,.10)";
      g.fillRect(x+2,y+2,cell-4,cell-4);
      g.strokeStyle=good?"#7CFFB2":"#1d2836"; g.lineWidth=2;
      g.strokeRect(x+2.5,y+2.5,cell-5,cell-5);
      g.fillStyle=good?"#7CFFB2":"#c9d6e2";
      g.fillText(v, x+cell/2, y+cell/2+1);
    }
  }

  function pos(e){ const r=cv.getBoundingClientRect();
    return { x:(e.clientX-r.left)*(cv.width/r.width), y:(e.clientY-r.top)*(cv.height/r.height) }; }
  cv.addEventListener("click",e=>{ if(solved) return;
    const p=pos(e), c=(p.x/cell)|0, r=(p.y/cell)|0;
    if(c<0||c>=N||r<0||r>=N) return; slide(r*N+c); });

  const key=e=>{ if(solved){ if(e.key===" "||e.key==="Enter") reset(); return; }
    const br=(blank/N)|0, bc=blank%N; let idx=-1;
    if(e.key==="ArrowUp"&&br<N-1) idx=blank+N;
    else if(e.key==="ArrowDown"&&br>0) idx=blank-N;
    else if(e.key==="ArrowLeft"&&bc<N-1) idx=blank+1;
    else if(e.key==="ArrowRight"&&bc>0) idx=blank-1;
    if(idx>=0){ e.preventDefault(); slide(idx); } };
  window.addEventListener("keydown",key);

  renderDiff(); reset();
  const onR=()=>{ fit(); draw(); }; window.addEventListener("resize",onR);
  return ()=>{ clearInterval(timer); window.removeEventListener("keydown",key); window.removeEventListener("resize",onR); };
}});
