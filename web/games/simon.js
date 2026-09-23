/* Simon — single player. Watch the sequence, then repeat it. Each round adds one. */
CAB.register({ id:"simon", name:"Simon", icon:"🎵", kind:"sp", desc:"watch, then repeat. one longer each round.",
mount(stage, ctx){
  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:12px;width:100%"});
  const hud=ctx.el("div",{class:"hud"});
  const board=ctx.el("div",{style:"display:grid;grid-template-columns:1fr 1fr;gap:10px;position:relative"});
  const startBtn=ctx.el("button",{class:"btn grn big2",style:"width:min(320px,80vw)",text:"▶ START"});
  wrap.append(hud, board, startBtn); stage.append(wrap);

  // pads: 0 TL green, 1 TR red, 2 BL cyan, 3 BR yellow
  const PADS=[
    {base:"#1b6b47", lit:"#7CFFB2", freq:329.63},
    {base:"#6b2b2b", lit:"#ff6b6b", freq:261.63},
    {base:"#1f5a6b", lit:"#57d9ff", freq:392.00},
    {base:"#6b5a20", lit:"#ffd166", freq:220.00},
  ];
  const pads=PADS.map((p,i)=>{
    const d=ctx.el("div",{class:"simon-pad",style:
      "border-radius:14px;border:1px solid var(--line);transition:background .06s, box-shadow .06s;"+
      "background:"+p.base+";touch-action:manipulation"});
    d.dataset.i=i; return d;
  });
  board.append(...pads);

  let seq=[], input=0, round=0, best=+(ctx.load("simon_best")||0);
  let phase="idle";   // idle | show | play | over
  let timers=[], actx=null, raf=0;

  function later(fn,ms){ const t=setTimeout(fn,ms); timers.push(t); return t; }
  function clearTimers(){ timers.forEach(clearTimeout); timers=[]; }

  function fit(){
    const side=Math.max(160, Math.min(stage.clientWidth-24, stage.clientHeight-190, 420));
    const pad=Math.floor((side-10)/2);
    pads.forEach(d=>{ d.style.width=pad+"px"; d.style.height=pad+"px"; });
  }

  // ---- audio (lazy, on first user gesture) ----
  function ac(){
    if(!actx){ try{ actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ actx=null; } }
    if(actx && actx.state==="suspended"){ try{ actx.resume(); }catch(e){} }
    return actx;
  }
  function beep(freq,dur){
    const c=ac(); if(!c) return;
    try{
      const o=c.createOscillator(), gn=c.createGain();
      o.type="sine"; o.frequency.value=freq;
      o.connect(gn); gn.connect(c.destination);
      const t=c.currentTime;
      gn.gain.setValueAtTime(0.0001,t);
      gn.gain.exponentialRampToValueAtTime(0.22,t+0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      o.start(t); o.stop(t+dur+0.03);
    }catch(e){}
  }
  function buzz(){
    const c=ac(); if(!c) return;
    try{ const o=c.createOscillator(), gn=c.createGain();
      o.type="sawtooth"; o.frequency.value=110; o.connect(gn); gn.connect(c.destination);
      const t=c.currentTime; gn.gain.setValueAtTime(0.25,t); gn.gain.exponentialRampToValueAtTime(0.0001,t+0.5);
      o.start(t); o.stop(t+0.55);
    }catch(e){}
  }

  function light(i,ms){
    const p=PADS[i], d=pads[i];
    d.style.background=p.lit; d.style.boxShadow="0 0 22px "+p.lit;
    beep(p.freq, ms/1000*0.9);
    later(()=>{ d.style.background=p.base; d.style.boxShadow="none"; }, ms);
  }

  function setHud(){
    if(phase==="over"){ hud.innerHTML="💀 wrong — reached round <b>"+round+"</b> · best "+best+" — <u>tap START</u>"; return; }
    if(phase==="idle"){ hud.innerHTML="best <b>"+best+"</b> — press START"; return; }
    hud.innerHTML=(phase==="show"?"👀 watch…":"🎯 your turn")+" · round <b>"+round+"</b> · best "+best;
  }

  function showSequence(){
    phase="show"; input=0; setHud();
    const speed=Math.max(260, 620-round*22);        // gets a touch faster
    seq.forEach((idx,n)=>{ later(()=>light(idx, Math.floor(speed*0.62)), 400+n*speed); });
    later(()=>{ phase="play"; setHud(); }, 400+seq.length*speed);
  }
  function nextRound(){
    round++; seq.push(Math.floor(Math.random()*4)); showSequence();
  }
  function start(){
    clearTimers(); ac(); seq=[]; round=0; phase="idle"; nextRound();
    startBtn.textContent="▶ RESTART";
  }
  function gameOver(){
    phase="over"; best=Math.max(round,best); ctx.save("simon_best",best); ctx.submitScore(round);
    buzz(); pads.forEach((d,i)=>light(i,180)); setHud();
  }

  function press(i){
    if(phase!=="play") return;
    light(i,220);
    if(seq[input]===i){
      input++;
      if(input>=seq.length){ phase="show"; later(nextRound, 620); }
    } else { gameOver(); }
  }

  // ---- input ----
  pads.forEach((d,i)=>{
    d.addEventListener("touchstart",e=>{ e.preventDefault(); press(i); },{passive:false});
    d.addEventListener("mousedown",e=>{ e.preventDefault(); press(i); });
  });
  startBtn.addEventListener("click",e=>{ e.preventDefault(); start(); });
  startBtn.addEventListener("touchstart",e=>{ e.preventDefault(); start(); },{passive:false});
  // desktop keys: 1-4 and arrows (Up=0 Right=1 Left=2 Down=3)
  const keymap={"1":0,"2":1,"3":2,"4":3,"ArrowUp":0,"ArrowRight":1,"ArrowLeft":2,"ArrowDown":3};
  const key=e=>{
    if(e.key===" "||e.key==="Enter"){ e.preventDefault(); start(); return; }
    if(e.key in keymap){ e.preventDefault(); press(keymap[e.key]); }
  };
  window.addEventListener("keydown",key);
  const onR=()=>{ fit(); }; window.addEventListener("resize",onR);

  fit(); setHud();
  return ()=>{
    clearTimers(); cancelAnimationFrame(raf);
    window.removeEventListener("keydown",key); window.removeEventListener("resize",onR);
    if(actx){ try{ actx.close(); }catch(e){} actx=null; }
  };
}});
