/* Speed Math Duel — N players over the relay. seat0 hosts; first correct answer wins the round. */
CAB.register({ id:"speedmath", name:"Speed Math", icon:"➗", kind:"mp", pill:"party · fast",
  desc:"first to tap the right answer scores. brains + thumbs.",
mount(stage, ctx){
  let players=[], mySeat=-1, amHost=false, phase="wait", locked=false, scores=[];
  let hScores={}, correctIdx=-1, roundWon=false, timers=[];
  const T=(fn,ms)=>{ const id=setTimeout(fn,ms); timers.push(id); return id; };
  const clearT=()=>{ timers.forEach(clearTimeout); timers=[]; };

  const wrap=ctx.el("div",{style:"flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:14px;width:100%"});
  const info=ctx.el("div",{class:"hud",style:"font-size:14px"});
  const qEl=ctx.el("div",{class:"big-msg",style:"font-size:clamp(30px,10vw,56px)"});
  const opts=ctx.el("div",{style:"display:grid;grid-template-columns:1fr 1fr;gap:10px;width:min(90vw,360px)"});
  const board=ctx.el("div",{class:"hud",style:"font-size:13px;white-space:pre-line"});
  wrap.append(info,qEl,opts,board); stage.append(wrap);

  const scoreArr=()=>players.map(p=>({id:p.id,name:p.name,score:hScores[p.id]||0})).sort((a,b)=>b.score-a.score);
  const boardText=arr=>arr.slice(0,6).map((s,i)=>(i===0?"👑 ":"   ")+s.name+" — "+s.score).join("\n");

  function genProblem(){ const ops=["+","−","×"]; const op=ops[(Math.random()*3)|0]; let a,b,ans;
    if(op==="+"){ a=(Math.random()*50|0)+10; b=(Math.random()*50|0)+10; ans=a+b; }
    else if(op==="−"){ a=(Math.random()*60|0)+20; b=(Math.random()*a|0); ans=a-b; }
    else { a=(Math.random()*11|0)+2; b=(Math.random()*11|0)+2; ans=a*b; }
    const set=new Set([ans]); while(set.size<4){ const d=ans+((Math.random()*11|0)-5); if(d>=0&&d!==ans) set.add(d); }
    const arr=[...set]; for(let i=arr.length-1;i>0;i--){ const j=Math.random()*(i+1)|0; const t=arr[i];arr[i]=arr[j];arr[j]=t; }
    return { text:a+" "+op+" "+b, o:arr, ci:arr.indexOf(ans) }; }

  function showQ(text,o){ phase="q"; locked=false; qEl.textContent=text+" = ?"; opts.innerHTML="";
    o.forEach((v,i)=>opts.append(ctx.el("button",{class:"btn big2",text:v,onclick:()=>answer(i)}))); }
  function answer(i){ if(phase!=="q"||locked) return; locked=true;
    if(amHost) hostRecord(ctx.me.id,i); else ctx.net.send({ev:"ans",a:i}); }
  function showWin(ci,winnerId,winnerName,arr){ phase="reveal"; scores=arr;
    [...opts.children].forEach((b,i)=>{ b.disabled=true; if(i===ci){ b.style.background="rgba(124,255,178,.18)"; b.style.color="var(--grn)"; } });
    info.textContent = winnerId===ctx.me.id?"⚡ you got it first!":(winnerId?winnerName+" was faster":"nobody got it");
    if(winnerId===ctx.me.id) ctx.reportWin();
    board.textContent=boardText(arr); }

  function hostStart(){ if(!amHost)return; hScores={}; players.forEach(p=>hScores[p.id]=0); hostNext(); }
  function hostNext(){ if(!amHost)return; const P=genProblem(); correctIdx=P.ci; roundWon=false;
    ctx.net.send({ev:"q",text:P.text,o:P.o}); info.textContent="first correct wins!"; showQ(P.text,P.o);
    T(()=>{ if(!roundWon){ hostWin(0,"nobody"); } },10000); }
  function hostRecord(id,a){ if(!amHost||phase!=="q"||roundWon)return; if(a===correctIdx){ roundWon=true; hScores[id]=(hScores[id]||0)+1;
    const w=players.find(p=>p.id===id); hostWin(id, w?w.name:"?"); } }
  function hostWin(id,name){ if(!amHost)return; clearT();
    ctx.net.send({ev:"win",ci:correctIdx,winnerId:id,winnerName:name,scores:scoreArr()});
    showWin(correctIdx,id,name,scoreArr()); T(hostNext,3000); }

  ctx.net.on(m=>{
    if(m.ev==="seats"){ players=m.players||[]; mySeat=players.findIndex(p=>p.id===ctx.me.id); amHost=(mySeat===0);
      if(amHost && players.length>=2 && phase==="wait") hostStart();
      else if(players.length<2){ phase="wait"; info.textContent="waiting for players…"; qEl.textContent="➗"; opts.innerHTML=""; board.textContent=""; }
      return; }
    if(m.ev==="q"){ info.textContent="first correct wins!"; showQ(m.text,m.o); }
    else if(m.ev==="ans"){ if(amHost) hostRecord(m.from,m.a); }
    else if(m.ev==="win"){ showWin(m.ci,m.winnerId,m.winnerName,m.scores||[]); }
  });
  info.textContent="connecting…"; qEl.textContent="➗";
  return ()=>{ clearT(); };
}});
