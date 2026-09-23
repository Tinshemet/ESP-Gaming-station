/* Trivia Buzzer — N players over the relay. seat0 = host (owns the bank + scoring). */
CAB.register({ id:"trivia", name:"Trivia Buzzer", icon:"🧠", kind:"mp", pill:"party · quiz",
  desc:"whole table plays. right answer scores. 8 questions.",
mount(stage, ctx){
  const BANK=[
    {q:"What planet is known as the Red Planet?",o:["Venus","Mars","Jupiter","Mercury"],a:1},
    {q:"How many continents are there?",o:["5","6","7","8"],a:2},
    {q:"What's the largest ocean?",o:["Atlantic","Indian","Arctic","Pacific"],a:3},
    {q:"Who painted the Mona Lisa?",o:["Da Vinci","Picasso","Van Gogh","Monet"],a:0},
    {q:"What gas do plants breathe in?",o:["Oxygen","Nitrogen","CO₂","Helium"],a:2},
    {q:"How many strings on a standard guitar?",o:["4","5","6","7"],a:2},
    {q:"What's the tallest animal?",o:["Elephant","Giraffe","Horse","Ostrich"],a:1},
    {q:"Which language has the most native speakers?",o:["English","Hindi","Spanish","Mandarin"],a:3},
    {q:"What year did the first iPhone launch?",o:["2005","2007","2009","2010"],a:1},
    {q:"How many sides does a hexagon have?",o:["5","6","7","8"],a:1},
    {q:"What's the hardest natural substance?",o:["Gold","Iron","Diamond","Quartz"],a:2},
    {q:"Which planet is closest to the Sun?",o:["Mercury","Venus","Earth","Mars"],a:0},
    {q:"What's the chemical symbol for gold?",o:["Go","Gd","Au","Ag"],a:2},
    {q:"How many minutes in a full day?",o:["1000","1440","1600","2400"],a:1},
    {q:"Who wrote Romeo and Juliet?",o:["Dickens","Shakespeare","Twain","Poe"],a:1},
    {q:"What's the smallest prime number?",o:["0","1","2","3"],a:2},
    {q:"Which country invented pizza?",o:["Greece","France","Italy","Spain"],a:2},
    {q:"What organ pumps blood?",o:["Liver","Heart","Lungs","Kidney"],a:1},
    {q:"How many colors in a rainbow?",o:["5","6","7","8"],a:2},
    {q:"What's the fastest land animal?",o:["Lion","Cheetah","Horse","Gazelle"],a:1},
    {q:"Which is NOT a primary color?",o:["Red","Blue","Green","Yellow"],a:2},
    {q:"What's H₂O commonly known as?",o:["Salt","Water","Acid","Air"],a:1},
    {q:"How many players on a soccer team?",o:["9","10","11","12"],a:2},
    {q:"What's the capital of Japan?",o:["Seoul","Beijing","Tokyo","Bangkok"],a:2}
  ];
  let players=[], mySeat=-1, amHost=false, phase="wait", myAnswer=-1, scores=[];
  let hScores={}, round=0, correct=-1, answered={}, timers=[];
  const T=(fn,ms)=>{ const id=setTimeout(fn,ms); timers.push(id); return id; };
  const clearT=()=>{ timers.forEach(clearTimeout); timers=[]; };

  const wrap=ctx.el("div",{style:"flex:1;display:flex;flex-direction:column;align-items:center;gap:12px;padding:14px;width:100%"});
  const info=ctx.el("div",{class:"hud",style:"font-size:14px"});
  const qEl=ctx.el("div",{class:"big-msg",style:"font-size:clamp(17px,4.6vw,24px);min-height:2.4em;display:flex;align-items:center;text-align:center"});
  const opts=ctx.el("div",{style:"display:grid;grid-template-columns:1fr 1fr;gap:8px;width:min(94vw,420px)"});
  const board=ctx.el("div",{class:"hud",style:"font-size:13px;white-space:pre-line"});
  wrap.append(info,qEl,opts,board); stage.append(wrap);

  const scoreArr=()=>players.map(p=>({id:p.id,name:p.name,score:hScores[p.id]||0})).sort((a,b)=>b.score-a.score);
  const boardText=arr=>arr.slice(0,6).map((s,i)=>(i===0?"👑 ":"   ")+s.name+" — "+s.score).join("\n");

  function answer(a){ if(phase!=="q"||myAnswer>=0) return; myAnswer=a; paintOpts(-1);
    if(amHost) hostRecord(ctx.me.id,a); else ctx.net.send({ev:"ans",a:a}); }
  function paintOpts(rev){ [...opts.children].forEach((b,i)=>{
      b.disabled = phase!=="q" || myAnswer>=0;
      let bg="var(--panel)", col="var(--ink)";
      if(rev>=0){ if(i===rev){ bg="rgba(124,255,178,.18)"; col="var(--grn)"; } else if(i===myAnswer){ bg="rgba(255,107,107,.15)"; col="var(--red)"; } }
      else if(i===myAnswer){ bg="var(--bg2)"; col="var(--cyn)"; }
      b.style.background=bg; b.style.color=col; }); }
  function showQ(q,o){ phase="q"; myAnswer=-1; qEl.textContent=q; opts.innerHTML="";
    o.forEach((txt,i)=>opts.append(ctx.el("button",{class:"btn",style:"font-size:14px",text:txt,onclick:()=>answer(i)})));
    paintOpts(-1); }
  function showReveal(cor,arr){ phase="reveal"; correct=cor; scores=arr; paintOpts(cor);
    board.textContent=boardText(arr);
    info.textContent = myAnswer===cor?"✅ correct!":(myAnswer<0?"⏱ no answer":"❌ wrong"); }
  function showDone(arr){ phase="done"; qEl.textContent="🏁 Final scores"; opts.innerHTML=""; board.textContent=boardText(arr);
    info.textContent = arr[0]?("🏆 "+arr[0].name+" wins!"):"";
    if(arr[0] && arr[0].id===ctx.me.id && arr[0].score>0) ctx.reportWin(); }

  // host
  function hostStart(){ if(!amHost)return; round=0; hScores={}; players.forEach(p=>hScores[p.id]=0); hostNext(); }
  function hostNext(){ if(!amHost)return; if(round>=8){ ctx.net.send({ev:"done",scores:scoreArr()}); showDone(scoreArr()); T(hostStart,7000); return; }
    const Q=BANK[(Math.random()*BANK.length)|0]; correct=Q.a; answered={}; round++;
    ctx.net.send({ev:"q",n:round,total:8,q:Q.q,o:Q.o}); info.textContent="Q"+round+"/8"; showQ(Q.q,Q.o);
    T(hostReveal,12000); }
  function hostRecord(id,a){ if(!amHost||phase!=="q")return; if(answered[id]!=null)return; answered[id]=a;
    if(a===correct) hScores[id]=(hScores[id]||0)+1;
    if(Object.keys(answered).length>=players.length) hostReveal(); }
  function hostReveal(){ if(!amHost||phase!=="q")return; clearT();
    ctx.net.send({ev:"reveal",correct:correct,scores:scoreArr()}); showReveal(correct,scoreArr()); T(hostNext,4000); }

  ctx.net.on(m=>{
    if(m.ev==="seats"){ players=m.players||[]; mySeat=players.findIndex(p=>p.id===ctx.me.id); amHost=(mySeat===0);
      if(amHost && players.length>=2 && phase==="wait"){ hostStart(); }
      else if(players.length<2){ phase="wait"; info.textContent="waiting for players…"; qEl.textContent="🧠"; opts.innerHTML=""; board.textContent=""; }
      return; }
    if(m.ev==="q"){ info.textContent="Q"+m.n+"/"+m.total; showQ(m.q,m.o); }
    else if(m.ev==="ans"){ if(amHost) hostRecord(m.from,m.a); }
    else if(m.ev==="reveal"){ showReveal(m.correct,m.scores||[]); }
    else if(m.ev==="done"){ showDone(m.scores||[]); }
  });
  info.textContent="connecting…"; qEl.textContent="🧠";
  return ()=>{ clearT(); };
}});
