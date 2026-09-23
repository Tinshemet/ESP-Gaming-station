/* Idle Clicker — tap the cookie, buy helpers, watch the number go up forever. */
CAB.register({ id:"idle", name:"Idle Clicker", icon:"🍪", kind:"sp", desc:"tap. buy. profit. repeat.",
mount(stage, ctx){
  // ---- economy definition ----
  const BUILDINGS=[
    {id:"tap",  name:"Auto-Tapper", icon:"👆", base:15,      cps:0.2},
    {id:"barista",name:"Barista",   icon:"☕", base:100,     cps:1},
    {id:"farm", name:"Bean Farm",   icon:"🌾", base:1100,    cps:8},
    {id:"mine", name:"Sugar Mine",  icon:"⛏️", base:12000,   cps:47},
    {id:"factory",name:"Factory",   icon:"🏭", base:130000,  cps:260},
    {id:"bank", name:"Cookie Bank", icon:"🏦", base:1400000, cps:1400},
    {id:"lab",  name:"Flavor Lab",  icon:"🧪", base:2e7,     cps:7800},
    {id:"portal",name:"Cookie Portal",icon:"🌀",base:3.3e8,  cps:44000},
  ];

  // ---- state ----
  let cookies=0, total=0, tapLevel=0, multLevel=0;
  const counts={}; BUILDINGS.forEach(b=>counts[b.id]=0);
  (function loadState(){
    try{
      const raw=ctx.load("idle_state"); if(!raw) return;
      const s=JSON.parse(raw);
      if(typeof s.cookies==="number") cookies=s.cookies;
      if(typeof s.total==="number") total=s.total;
      if(typeof s.tapLevel==="number") tapLevel=s.tapLevel;
      if(typeof s.multLevel==="number") multLevel=s.multLevel;
      if(s.counts) BUILDINGS.forEach(b=>{ if(typeof s.counts[b.id]==="number") counts[b.id]=s.counts[b.id]; });
    }catch(e){}
  })();

  function mult(){ return Math.pow(2, multLevel); }
  function clickGain(){ return Math.pow(2, tapLevel) * mult(); }
  function cps(){ let s=0; BUILDINGS.forEach(b=>s+=counts[b.id]*b.cps); return s*mult(); }
  function bCost(b){ return Math.floor(b.base*Math.pow(1.15, counts[b.id])); }
  function tapCost(){ return Math.floor(200*Math.pow(6, tapLevel)); }
  function multCost(){ return Math.floor(9000*Math.pow(10, multLevel)); }

  function fmt(n){
    if(!isFinite(n)) return "∞";
    n=Math.max(0,n);
    if(n<1000) return (n<100 && Math.floor(n)!==n) ? n.toFixed(1) : String(Math.floor(n));
    const u=["","K","M","B","T","Qa","Qi","Sx","Sp","Oc","No","Dc"];
    let i=0; while(n>=1000 && i<u.length-1){ n/=1000; i++; }
    return (n<10?n.toFixed(2):n<100?n.toFixed(1):n.toFixed(0))+u[i];
  }

  // ---- UI ----
  const wrap=ctx.el("div",{style:"display:flex;flex-direction:column;align-items:center;gap:10px;width:100%;max-width:440px;margin:0 auto;padding:8px;height:100%;overflow:auto"});
  const counter=ctx.el("div",{style:"font-size:30px;font-weight:700;color:var(--yel);text-align:center"});
  const rate=ctx.el("div",{class:"hud",style:"margin-top:-4px"});
  const cookieBtn=ctx.el("button",{style:"font-size:84px;line-height:1;background:transparent;border:none;padding:6px;user-select:none;transition:transform .05s;position:relative",text:"🍪"});
  const tapInfo=ctx.el("div",{class:"hud",style:"padding:0"});
  const shop=ctx.el("div",{style:"display:flex;flex-direction:column;gap:6px;width:100%;margin-top:6px"});
  wrap.append(counter, rate, cookieBtn, tapInfo, ctx.el("div",{class:"section-h",text:"SHOP"}), shop);
  stage.append(wrap);

  // floating +n feedback
  const timeouts=new Set();
  function floatGain(g){
    const f=ctx.el("div",{style:"position:absolute;left:50%;top:10%;transform:translateX(-50%);color:var(--grn);font-weight:700;font-size:18px;pointer-events:none;transition:all .6s ease-out;opacity:1",text:"+"+fmt(g)});
    cookieBtn.append(f);
    requestAnimationFrame(()=>{ f.style.top="-30%"; f.style.opacity="0"; });
    const to=setTimeout(()=>{ f.remove(); timeouts.delete(to); },650); timeouts.add(to);
  }

  const refs=[]; // {btn, cost:()=>n}
  function shopItems(){
    const items=[];
    BUILDINGS.forEach(b=>items.push({
      name:b.icon+" "+b.name, cost:()=>bCost(b),
      sub:()=>"+"+fmt(b.cps*mult())+"/s each · owned "+counts[b.id],
      buy:()=>{ const c=bCost(b); if(cookies>=c){ cookies-=c; counts[b.id]++; return true; } return false; }
    }));
    items.push({ name:"✊ Stronger Taps", cost:tapCost,
      sub:()=>"tap power → "+fmt(Math.pow(2,tapLevel+1)*mult()),
      buy:()=>{ const c=tapCost(); if(cookies>=c){ cookies-=c; tapLevel++; return true; } return false; } });
    items.push({ name:"✨ Golden Roast", cost:multCost,
      sub:()=>"x2 ALL production (now x"+fmt(mult())+")",
      buy:()=>{ const c=multCost(); if(cookies>=c){ cookies-=c; multLevel++; return true; } return false; } });
    return items;
  }
  function renderShop(){
    shop.innerHTML=""; refs.length=0;
    shopItems().forEach(it=>{
      const cost=it.cost();
      const btn=ctx.el("button",{class:"btn",
        style:"width:100%;min-width:0;padding:10px 12px;text-align:left;display:flex;justify-content:space-between;align-items:center;gap:8px;border-radius:10px",
        onclick:()=>{ if(it.buy()){ save(); renderShop(); updateStats(); } else ctx.toast("not enough cookies"); }});
      btn.append(
        ctx.el("div",{style:"display:flex;flex-direction:column;gap:2px;min-width:0"},[
          ctx.el("span",{style:"font-weight:700",text:it.name}),
          ctx.el("span",{style:"font-size:11px;color:var(--dim)",text:it.sub()}),
        ]),
        ctx.el("span",{style:"color:var(--yel);font-weight:700;white-space:nowrap",text:"🍪 "+fmt(cost)})
      );
      shop.append(btn); refs.push({btn, cost:it.cost});
    });
    updateStats();
  }
  function updateStats(){
    counter.textContent="🍪 "+fmt(cookies);
    rate.innerHTML="<b>"+fmt(cps())+"</b>/sec · lifetime "+fmt(total);
    tapInfo.textContent="tap = +"+fmt(clickGain());
    refs.forEach(r=>{ const afford=cookies>=r.cost(); r.btn.style.opacity=afford?"1":"0.45"; r.btn.style.borderColor=afford?"var(--grn)":"var(--line)"; });
  }

  cookieBtn.addEventListener("click",()=>{
    const g=clickGain(); cookies+=g; total+=g;
    cookieBtn.style.transform="scale(0.92)";
    const to=setTimeout(()=>{ cookieBtn.style.transform="scale(1)"; timeouts.delete(to); },70); timeouts.add(to);
    floatGain(g); updateStats();
  });

  // ---- persistence ----
  function save(){
    try{ ctx.save("idle_state", JSON.stringify({cookies,total,tapLevel,multLevel,counts})); }catch(e){}
  }

  // ---- loops ----
  let last=Date.now();
  const tick=setInterval(()=>{
    const now=Date.now(), dt=(now-last)/1000; last=now;
    const g=cps()*dt; cookies+=g; total+=g;
    updateStats();
  },100);
  const saveT=setInterval(save, 5000);
  const scoreT=setInterval(()=>ctx.submitScore(Math.floor(total)), 15000);

  renderShop();
  if(total>0) ctx.submitScore(Math.floor(total));

  return ()=>{
    clearInterval(tick); clearInterval(saveT); clearInterval(scoreT);
    timeouts.forEach(t=>clearTimeout(t)); timeouts.clear();
    save(); ctx.submitScore(Math.floor(total));
  };
}});
