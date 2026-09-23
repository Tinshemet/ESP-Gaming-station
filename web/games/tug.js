/* Tug of War — multiplayer mash. Server tallies pulls; drag the knot to your side. */
CAB.register({ id:"tug", name:"Tug of War", icon:"🪢", kind:"mp", pill:"1v1 · mash",
  desc:"mash the button. drag the rope past your line.",
mount(stage, ctx){
  const wrap=ctx.el("div",{style:"flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:16px"});
  const board=ctx.el("div",{class:"hud"});
  const big=ctx.el("div",{class:"big-msg",style:"font-size:clamp(22px,8vw,44px)"});
  const track=ctx.el("div",{style:"position:relative;width:100%;max-width:420px;height:28px;background:var(--panel);border:1px solid var(--line);border-radius:999px;overflow:hidden"});
  const mid=ctx.el("div",{style:"position:absolute;left:calc(50% - 1px);top:0;bottom:0;width:2px;background:var(--line)"});
  const knot=ctx.el("div",{style:"position:absolute;top:-3px;width:16px;height:34px;border-radius:6px;background:var(--yel);left:calc(50% - 8px);transition:left .07s linear"});
  track.append(mid,knot);
  const sub=ctx.el("div",{class:"hud"});
  const pull=ctx.el("button",{class:"btn big2 grn",style:"width:min(82vw,340px)",text:"PULL!"});
  wrap.append(board,big,track,sub,pull); stage.append(wrap);
  let duel=[0,0],names=["",""],side=0,amP=false,goal=20,active=false;
  function setSide(){ amP=duel.indexOf(ctx.me.id)>=0; side=(duel[0]===ctx.me.id)?0:1; }
  function place(rope){ const pct=Math.max(0,Math.min(100,(rope+goal)/(2*goal)*100)); knot.style.left="calc("+pct+"% - 8px)"; }
  function fire(){ if(active&&amP) ctx.net.send({ev:"pull"}); }
  pull.addEventListener("pointerdown",e=>{ e.preventDefault(); fire(); });
  const key=e=>{ if(e.key===" "||e.key==="Enter"){ e.preventDefault(); fire(); } };
  window.addEventListener("keydown",key);
  ctx.net.on(m=>{
    if(m.ev==="wait"){ active=false; big.textContent="🪢"; big.style.color="var(--dim)"; board.textContent="";
      sub.textContent="waiting for a challenger… ("+(m.have||0)+" here)"; place(0); }
    else if(m.ev==="set"){ duel=m.duel; names=m.names; goal=m.goal; setSide(); active=false; place(0);
      big.textContent="READY…"; big.style.color="var(--yel)";
      board.textContent = amP ? ("you're "+(side===0?"◀ "+names[0]:names[1]+" ▶")) : (names[0]+" ◀ 🪢 ▶ "+names[1]);
      sub.textContent = amP?"get ready to mash":"watching"; }
    else if(m.ev==="go"){ active=true; goal=m.goal; big.textContent="MASH!"; big.style.color="var(--grn)";
      sub.textContent = amP?"tap PULL as fast as you can!":"watching"; }
    else if(m.ev==="rope"){ goal=m.goal; place(m.rope); }
    else if(m.ev==="result"){ active=false; goal=m.goal; place(m.rope); const iWon=m.winnerId===ctx.me.id;
      if(amP && iWon) ctx.reportWin();
      if(amP){ big.textContent=iWon?"YOU WON 🏆":"you got dragged 💪"; big.style.color=iWon?"var(--grn)":"var(--red)"; }
      else { big.textContent=(m.winnerId===duel[0]?names[0]:names[1])+" wins"; big.style.color="var(--cyn)"; }
      sub.textContent="next round shortly…"; }
  });
  big.textContent="🪢"; sub.textContent="connecting…";
  return ()=>{ window.removeEventListener("keydown",key); };
}});
