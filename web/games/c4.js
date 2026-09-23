/* Connect 4 — multiplayer, turn-based (server-authoritative, lag-proof). */
CAB.register({ id:"c4", name:"Connect 4", icon:"🔴", kind:"mp", pill:"1v1 · turns",
  desc:"four in a row wins. drop into a column.",
mount(stage, ctx){
  const COLS=7, ROWS=6;
  const wrap=ctx.el("div",{style:"flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:12px"});
  const info=ctx.el("div",{class:"hud",style:"font-size:15px"});
  const grid=ctx.el("div",{style:"display:grid;grid-template-columns:repeat(7,1fr);gap:4px;background:#123a63;padding:6px;border-radius:12px;width:min(96vw,392px)"});
  const sub=ctx.el("div",{class:"hud"});
  wrap.append(info,grid,sub); stage.append(wrap);
  let duel=[0,0], names=["",""], myDisc=0, myTurn=false, over=true;
  const cells=[];
  for(let i=0;i<COLS*ROWS;i++){ const c=ctx.el("div",{style:"aspect-ratio:1;border-radius:50%;background:#0b0f14;box-shadow:inset 0 0 0 2px #0a2540"});
    c.addEventListener("click",()=>{ if(!over && myTurn) ctx.net.send({ev:"drop",col:i%COLS}); }); cells.push(c); grid.append(c); }
  const color=v=>v==="1"?"#ff5d5d":v==="2"?"#ffd166":"#0b0f14";
  function render(b){ for(let i=0;i<42;i++) cells[i].style.background=color(b[i]||"0"); }
  ctx.net.on(m=>{
    if(m.ev==="wait"){ over=true; myTurn=false; info.style.color="var(--ink)"; info.textContent="Connect 4";
      sub.textContent="waiting for a challenger… ("+(m.have||0)+" here)"; render("0".repeat(42)); return; }
    duel=m.duel||duel; names=m.names||names; myDisc = duel[0]===ctx.me.id?1 : duel[1]===ctx.me.id?2 : 0;
    render(m.board||"0".repeat(42));
    if(m.ev==="draw"){ over=true; myTurn=false; info.style.color="var(--yel)"; info.textContent="draw — board full"; sub.textContent="new game shortly…"; return; }
    if(m.winnerId){ over=true; myTurn=false; const iWon=m.winnerId===ctx.me.id;
      if(iWon && myDisc) ctx.reportWin();
      info.style.color=iWon?"var(--grn)":"var(--red)";
      info.textContent = myDisc ? (iWon?"🏆 YOU WIN":"you lose") : ((m.winnerId===duel[0]?names[0]:names[1])+" wins");
      sub.textContent="new game shortly…"; return; }
    over=false; myTurn = !!myDisc && m.turn===ctx.me.id;
    const you = myDisc===1?"🔴":myDisc===2?"🟡":"👀"; info.style.color="var(--ink)";
    info.textContent = myDisc ? ("you are "+you) : ("spectating: "+names[0]+" 🔴 vs 🟡 "+names[1]);
    sub.textContent = myDisc ? (myTurn?"your turn — tap a column":"opponent's turn…") : "";
  });
  info.textContent="Connect 4"; sub.textContent="connecting…";
  return ()=>{};
}});
