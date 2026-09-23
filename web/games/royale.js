/* Reaction Royale — N-player buzzer. Whole table joins; wait for GREEN, first tap wins. */
CAB.register({ id:"royale", name:"Reaction Royale", icon:"🚨", kind:"mp", pill:"party · buzzer",
  desc:"everyone plays. wait for green. flinch = out.",
mount(stage, ctx){
  const scr=ctx.el("div",{style:"flex:1;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;transition:background .08s;padding:16px"});
  const big=ctx.el("div",{class:"big-msg"});
  const sub=ctx.el("div",{class:"hud",style:"font-size:15px;margin-top:12px"});
  scr.append(big,sub); stage.append(scr);
  let phase="wait", jumped=false;
  const bg=c=>scr.style.background=c;
  ctx.net.on(m=>{
    if(m.ev==="wait"){ phase="wait"; bg("#0e141c"); big.textContent="🚨"; big.style.color="var(--dim)"; sub.textContent="waiting for players… ("+(m.have||0)+" in)"; }
    else if(m.ev==="set"){ phase="set"; jumped=false; bg("#241016"); big.textContent="READY…"; big.style.color="var(--red)"; sub.textContent=(m.have||0)+" players · wait for GREEN — do NOT tap"; }
    else if(m.ev==="go"){ phase="go"; bg("#0c3"); big.textContent="TAP!"; big.style.color="#052"; sub.textContent="GO GO GO"; }
    else if(m.ev==="jumped"){ jumped=true; bg("#301018"); big.textContent="too early 💀"; big.style.color="var(--red)"; sub.textContent="you flinched — sit out this round"; }
    else if(m.ev==="result"){ phase="result"; const iWon=m.winnerId===ctx.me.id; if(iWon) ctx.reportWin();
      bg(iWon?"#0a3":"#0e141c"); big.style.color=iWon?"#cffce0":"var(--cyn)";
      big.textContent=iWon?"YOU WON 🏆":((m.winnerName||"someone")+" won"); sub.textContent="next round shortly…"; }
  });
  function fire(){ if(!jumped && (phase==="go" || phase==="set")) ctx.net.send({ev:"tap"}); }
  scr.addEventListener("touchstart",e=>{ e.preventDefault(); fire(); },{passive:false});
  scr.addEventListener("mousedown",fire);
  const key=e=>{ if(e.key===" "||e.key==="Enter") fire(); };
  window.addEventListener("keydown",key);
  big.textContent="🚨"; sub.textContent="connecting…";
  return ()=>{ window.removeEventListener("keydown",key); };
}});
