// ---------- Inputs ----------
const INPUTS = [
  {group:"Mass",
   items:[
    {id:"bike",   label:"Bike Mass",                 unit:"kg",  def:90},
    {id:"rider",  label:"Rider Mass",                unit:"kg",  def:95},
    {id:"fw",     label:"Front Weight (fraction, 0–1)", unit:"",  def:0.54},
    {id:"unspct", label:"Total Unsprung Percentage", unit:"%",   def:15}]},
  {group:"Suspension",
   items:[
    {id:"kf",     label:"Front Fork Spring Rate (per fork)", unit:"N/mm", def:8.5},
    {id:"gap",    label:"Shock Mount Gap",           unit:"mm",  def:60},
    {id:"mr",     label:"MR (motion ratio)",         unit:"",    def:0.7268412399},
    {id:"rfreq",  label:"Rear Ride Frequency",       unit:"Hz",  def:2.2},
    {id:"sa",     label:"Spring Angle",              unit:"deg", def:10},
    {id:"swa",    label:"Swingarm Angle",            unit:"deg", def:10},
    {id:"hdist",  label:"Horizontal Distance from Rear Wheel", unit:"mm", def:534.5}]},
  {group:"Geometry & Drivetrain",
   items:[
    {id:"rwr",    label:"Rear Wheel Radius",         unit:"mm",  def:302},
    {id:"fr",     label:"Front Wheel Radius (diagram only)", unit:"mm", def:290},
    {id:"wb",     label:"Wheelbase (WB)",            unit:"mm",  def:1275},
    {id:"spr",    label:"Sprocket Radius",           unit:"inch",def:1},
    {id:"ratio",  label:"Gear Ratio (e.g. 4:1)",     unit:"",    def:"4:1", text:true},
    {id:"mpx",    label:"Motor Placement (x)",       unit:"mm",  def:645},
    {id:"mpy",    label:"Motor Placement (y)",       unit:"mm",  def:413.086}]}
];

// ---------- Build the input form ----------
const inputsEl = document.getElementById("inputs");
INPUTS.forEach(g=>{
  const h=document.createElement("h3"); h.textContent=g.group; inputsEl.appendChild(h);
  g.items.forEach(it=>{
    const row=document.createElement("div"); row.className="row";
    row.innerHTML=`<label for="${it.id}">${it.label}</label>
      <input id="${it.id}" type="text" inputmode="${it.text?'text':'decimal'}" autocomplete="off" value="${it.def}">
      <span class="unit">${it.unit}</span>`;
    inputsEl.appendChild(row);
  });
});

// ---------- Calculation ----------
const rad = d => d*Math.PI/180;

function parseRatio(s){
  s=String(s).trim();
  if(s.includes(":")){const [a,b]=s.split(":").map(Number); return a/b;}
  return Number(s);
}

function compute(v){
  const r={};
  const total=v.bike+v.rider;
  r.rearW = 1 - v.fw;
  r.unsprung = total*v.unspct/100;
  r.unsprungF = r.unsprung/2;
  r.unsprungR = r.unsprung - r.unsprungF;

  r.smw   = v.rwr + v.gap/2;
  r.wtp   = r.smw / v.mr;
  r.dfo   = r.wtp - v.hdist;
  r.swl   = r.wtp / Math.cos(rad(v.swa));

  r.fcm   = total*v.fw - r.unsprungF;
  r.fwheel= 2*v.kf;                                   // two fork legs, N/mm
  r.ffreq = (1/(2*Math.PI))*Math.sqrt(r.fwheel*1000/r.fcm);

  r.rcm   = total*r.rearW - r.unsprungR;
  // Sheet: (Rear Freq*2*pi)^2 * Rear Corner Mass / (MR^2 * cos(Spring Angle))^2 / 9.81 / 100
  r.idealKg = Math.pow(v.rfreq*2*Math.PI,2)*r.rcm/Math.pow(v.mr*v.mr*Math.cos(rad(v.sa)),2)/9.81/100;
  r.idealN  = r.idealKg*9.81;                         // Sheet: Ideal Rear Shock * 9.81
  r.rwheel  = r.idealN*v.mr*v.mr*Math.cos(rad(v.sa)); // Sheet: spring rate * MR^2 * cos(Spring Angle)
  r.sprMM   = v.spr*25.4;

  r.cogx = v.wb/2;
  r.cogy = v.wb*0.34;

  r.rwcx = v.wb;           r.rwcy = v.rwr;
  r.px   = v.wb - r.wtp;   r.py   = v.rwr + r.wtp*Math.tan(rad(v.swa));
  r.osx  = v.mpx;          r.osy  = v.mpy;
  r.csx  = r.osx;          r.csy  = r.osy + r.sprMM;
  r.cwx  = v.wb;           r.cwy  = v.rwr + v.ratio*r.sprMM;

  r.slopeS = (r.rwcy - r.py)/(r.rwcx - r.px);
  r.intS   = r.rwcy - r.slopeS*r.rwcx;
  r.slopeC = (r.cwy - r.csy)/(r.cwx - r.csx);
  r.intC   = r.csy - r.slopeC*r.csx;

  r.ix = (r.intS - r.intC)/(r.slopeC - r.slopeS);     // swingarm line ∩ top chain line
  r.iy = r.slopeS*r.ix + r.intS;
  r.fcx = 0;                                          // front wheel contact line x = 0
  r.fcy = r.iy*v.wb/(v.wb - r.ix);                    // line from rear contact patch through intersection, at x = 0
  r.antiSquat = (r.fcy - v.rwr)/r.cogy*100;      // Sheet: (Intersection - Rear Wheel Radius) / COG y * 100
  return r;
}

const OUTPUTS = [
  {group:"Mass distribution", items:[
    ["Rear Weight (fraction)","",r=>r.rearW],
    ["Total Unsprung Mass","kg",r=>r.unsprung],
    ["Unsprung Front","kg",r=>r.unsprungF],
    ["Unsprung Rear","kg",r=>r.unsprungR],
    ["Front Corner Mass","kg",r=>r.fcm],
    ["Rear Corner Mass","kg",r=>r.rcm]]},
  {group:"Ride frequency & springs", items:[
    ["Front Wheel Rate (2 forks)","N/mm",r=>r.fwheel],
    ["Front Ride Frequency","Hz",r=>r.ffreq],
    ["Ideal Rear Shock","kg/mm",r=>r.idealKg],
    ["Ideal Rear Shock (in Newtons)","N/mm",r=>r.idealN],
    ["Rear Wheel Rate","N/mm",r=>r.rwheel]]},
  {group:"Swingarm & shock", items:[
    ["Shock Mount to Wheel","mm",r=>r.smw],
    ["Wheel to Pivot","mm",r=>r.wtp],
    ["Distance from Output","mm",r=>r.dfo],
    ["Swingarm Length","mm",r=>r.swl],
    ["Sprocket Radius conversion","mm",r=>r.sprMM]]},
  {group:"Coordinates", items:[
    ["COG (x)","mm",r=>r.cogx],
    ["COG (y)","mm",r=>r.cogy],
    ["Rear Wheel Center (x)","mm",r=>r.rwcx],
    ["Rear Wheel Center (y)","mm",r=>r.rwcy],
    ["Swingarm Pivot (x)","mm",r=>r.px],
    ["Swingarm Pivot (y)","mm",r=>r.py],
    ["Output Shaft (x)","mm",r=>r.osx],
    ["Output Shaft (y)","mm",r=>r.osy],
    ["Chain Shaft (x)","mm",r=>r.csx],
    ["Chain Shaft (y)","mm",r=>r.csy],
    ["Chain (wheel) x","mm",r=>r.cwx],
    ["Chain (wheel) y","mm",r=>r.cwy]]},
  {group:"Anti-squat", items:[
    ["Swingarm Pivot to Rear Wheel Center (Slope)","",r=>r.slopeS],
    ["Swingarm Pivot to Rear Slope (Intercept)","mm",r=>r.intS],
    ["Top Chain Slope","",r=>r.slopeC],
    ["Top Chain Intercept","mm",r=>r.intC],
    ["Swingarm / Chain Intersection (x)","mm",r=>r.ix],
    ["Swingarm / Chain Intersection (y)","mm",r=>r.iy],
    ["Intersection to Rear Wheel Contact (x)","mm",r=>r.fcx],
    ["Intersection to Rear Wheel Contact (y)","mm",r=>r.fcy],
    ["Front Wheel Contact (line x =)","mm",r=>r.fcx],
    ["Anti Squat","%",r=>r.antiSquat]]}
];


// ---------- Formula text shown by the ƒ icons ----------
const FORMULAS = {
 "Rear Weight (fraction)":"1 − Front Weight",
 "Total Unsprung Mass":"(Bike Mass + Rider Mass) × Total Unsprung Percentage / 100",
 "Unsprung Front":"Total Unsprung Mass / 2",
 "Unsprung Rear":"Total Unsprung Mass − Unsprung Front",
 "Front Corner Mass":"(Bike Mass + Rider Mass) × Front Weight − Unsprung Front",
 "Rear Corner Mass":"(Bike Mass + Rider Mass) × Rear Weight − Unsprung Rear",
 "Front Wheel Rate (2 forks)":"2 × Front Fork Spring Rate",
 "Front Ride Frequency":"0.5 / π × √( Front Wheel Rate [N/m] / Front Corner Mass )",
 "Ideal Rear Shock":"(Rear Ride Frequency × 2π)² × Rear Corner Mass / (MR² × cos(Spring Angle))² / 9.81 / 100",
 "Ideal Rear Shock (in Newtons)":"Ideal Rear Shock × 9.81",
 "Rear Wheel Rate":"Ideal Rear Shock [N/mm] × MR² × cos(Spring Angle)",
 "Shock Mount to Wheel":"Rear Wheel Radius + Shock Mount Gap / 2",
 "Wheel to Pivot":"Shock Mount to Wheel / MR",
 "Distance from Output":"Wheel to Pivot − Horizontal Distance from Rear Wheel",
 "Swingarm Length":"Wheel to Pivot / cos(Swingarm Angle)",
 "Sprocket Radius conversion":"Sprocket Radius [inch] × 25.4",
 "COG (x)":"Wheelbase / 2",
 "COG (y)":"Wheelbase × 0.34",
 "Rear Wheel Center (x)":"Wheelbase",
 "Rear Wheel Center (y)":"Rear Wheel Radius",
 "Swingarm Pivot (x)":"Rear Wheel Center (x) − Wheel to Pivot",
 "Swingarm Pivot (y)":"Rear Wheel Radius + Wheel to Pivot × tan(Swingarm Angle)",
 "Output Shaft (x)":"Motor Placement (x)",
 "Output Shaft (y)":"Motor Placement (y)",
 "Chain Shaft (x)":"Output Shaft (x)",
 "Chain Shaft (y)":"Output Shaft (y) + Sprocket Radius [mm]",
 "Chain (wheel) x":"Rear Wheel Center (x)",
 "Chain (wheel) y":"Rear Wheel Radius + Gear Ratio × Sprocket Radius [mm]",
 "Swingarm Pivot to Rear Wheel Center (Slope)":"(Rear Wheel Center (y) − Swingarm Pivot (y)) / (Rear Wheel Center (x) − Swingarm Pivot (x))",
 "Swingarm Pivot to Rear Slope (Intercept)":"Rear Wheel Center (y) − Slope × Rear Wheel Center (x)",
 "Top Chain Slope":"(Chain (wheel) y − Chain Shaft (y)) / (Chain (wheel) x − Chain Shaft (x))",
 "Top Chain Intercept":"Chain Shaft (y) − Top Chain Slope × Chain Shaft (x)",
 "Swingarm / Chain Intersection (x)":"(Swingarm Intercept − Chain Intercept) / (Chain Slope − Swingarm Slope)",
 "Swingarm / Chain Intersection (y)":"Swingarm Slope × Intersection (x) + Swingarm Intercept",
 "Intersection to Rear Wheel Contact (x)":"0  (front wheel contact line, x = 0)",
 "Intersection to Rear Wheel Contact (y)":"Intersection (y) × Wheelbase / (Wheelbase − Intersection (x))  — height at x = 0 of the line from the rear contact patch through the intersection",
 "Front Wheel Contact (line x =)":"0",
 "Anti Squat":"(Intersection to Rear Wheel Contact (y) − Rear Wheel Radius) / COG (y) × 100"
};
const openFx = new Set();
const fxBtn = l => `<button class="fxbtn" type="button" data-fx="${esc(l)}" aria-expanded="${openFx.has(l)}" aria-label="Show formula for ${esc(l)}" title="Show formula">ƒ</button>`;

// ---------- UI ----------
const resultsEl = document.getElementById("results");
const versionsEl = document.getElementById("versions");
const vmsg = document.getElementById("vmsg");
const fmt = n => Number.isFinite(n) ? (Math.abs(n)<1e-9?0:n).toLocaleString(undefined,{maximumFractionDigits:4}) : "—";
const esc = t => String(t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ALL = INPUTS.flatMap(g=>g.items);

function parseRaw(raw){
  const v={}, bad=[];
  ALL.forEach(it=>{
    const x = raw[it.id] ?? it.def;
    const val = it.id==="ratio" ? parseRatio(x) : parseFloat(x);
    if(Number.isFinite(val)) v[it.id]=val; else bad.push(it.label);
  });
  return {v,bad};
}
const readRaw = () => Object.fromEntries(ALL.map(it=>[it.id, document.getElementById(it.id).value]));

// ---- Saved versions ----
const KEY="moto-calc-versions";
let versions=[], memOnly=false, compare=new Set(), ran=false, mode="table";
try{ versions=JSON.parse(localStorage.getItem(KEY)||"[]"); }catch(e){ memOnly=true; }
versions.forEach(x=>{ if(!x.id) x.id=Date.now()+Math.random(); });
function persist(){ try{ localStorage.setItem(KEY,JSON.stringify(versions)); }catch(e){ memOnly=true; } }

function renderVersions(){
  versionsEl.innerHTML = versions.length ? versions.map((x,i)=>
    `<div class="ver">
       <input type="checkbox" id="cmp${i}" data-i="${i}" ${compare.has(x.id)?"checked":""}>
       <label for="cmp${i}"><span>${esc(x.name)}</span> <span class="unit">Compare</span></label>
       <button class="alt" data-load="${i}" type="button">Load</button>
       <button class="alt" data-del="${i}" type="button">Delete</button>
     </div>`).join("") : '<p class="hint">No saved versions yet.</p>';
  if(memOnly) versionsEl.insertAdjacentHTML("beforeend",'<p class="error">Browser storage is unavailable; versions will be lost when you close this page. Use Export to keep them.</p>');
}
document.getElementById("vsave").addEventListener("click",()=>{
  const nameEl=document.getElementById("vname");
  versions.push({id:Date.now()+Math.random(), name:nameEl.value.trim()||`Version ${versions.length+1}`, raw:readRaw()});
  persist(); nameEl.value=""; vmsg.textContent=""; renderVersions();
});
versionsEl.addEventListener("click",e=>{
  const b=e.target.closest("button"); if(!b) return;
  if(b.dataset.load!==undefined){
    const x=versions[+b.dataset.load];
    ALL.forEach(it=>{ const el=document.getElementById(it.id); el.value=x.raw[it.id] ?? it.def; el.classList.remove("bad"); });
    run();
  } else if(b.dataset.del!==undefined){
    const x=versions[+b.dataset.del];
    compare.delete(x.id); versions.splice(+b.dataset.del,1);
    persist(); renderVersions(); if(ran) run();
  }
});
versionsEl.addEventListener("change",e=>{
  if(e.target.type!=="checkbox") return;
  const x=versions[+e.target.dataset.i];
  e.target.checked ? compare.add(x.id) : compare.delete(x.id);
  if(ran) run();
});

// ---- Export / Import ----
document.getElementById("vexp").addEventListener("click",()=>{
  if(!versions.length){ vmsg.textContent="Nothing to export yet — save a version first."; return; }
  const data={app:"moto-calc",versions:versions.map(({name,raw})=>({name,raw}))};
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  a.download="motorcycle-calculator-versions.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  vmsg.textContent=`Exported ${versions.length} version(s).`;
});
const fileEl=document.getElementById("vfile");
document.getElementById("vimp").addEventListener("click",()=>fileEl.click());
fileEl.addEventListener("change",()=>{
  const f=fileEl.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const d=JSON.parse(rd.result);
      const list=Array.isArray(d)?d:d.versions;
      if(!Array.isArray(list)) throw new Error("bad format");
      let added=0, skipped=0;
      list.forEach(x=>{
        if(!x||typeof x.name!=="string"||typeof x.raw!=="object"||!x.raw){ skipped++; return; }
        const raw=Object.fromEntries(ALL.filter(it=>x.raw[it.id]!==undefined).map(it=>[it.id,String(x.raw[it.id])]));
        const dup=versions.some(o=>o.name===x.name && ALL.every(it=>(o.raw[it.id]??String(it.def))===(raw[it.id]??String(it.def))));
        if(dup){ skipped++; return; }
        versions.push({id:Date.now()+Math.random(), name:x.name, raw}); added++;
      });
      persist(); renderVersions();
      vmsg.textContent=`Imported ${added} version(s)`+(skipped?`, skipped ${skipped} (duplicate or invalid).`:".");
    }catch(err){ vmsg.textContent="Couldn't read that file — is it a versions file exported from this calculator?"; }
    fileEl.value="";
  };
  rd.readAsText(f);
});

// ---- Diagram ----
// ---- SVG drawing helpers (y axis points up; ytop = top of the viewBox) ----
function helpers(ytop,fs){
  const lh=fs*1.25, Y=y=>+(ytop-y).toFixed(2);
  const Ln=(x1,y1,x2,y2,cls="ln",extra="")=>`<line class="${cls}" x1="${x1}" y1="${Y(y1)}" x2="${x2}" y2="${Y(y2)}" ${extra}/>`;
  const Ci=(x,y,r,cls="ln")=>`<circle class="${cls}" cx="${x}" cy="${Y(y)}" r="${r}"/>`;
  const Tx=(x,y,t,anchor="middle",cls="")=>`<text class="${cls}" x="${x}" y="${Y(y)}" text-anchor="${anchor}" font-size="${fs}" stroke-width="${fs*0.22}">${t}</text>`;
  const lines=(x,y,arr,anchor)=>arr.map((t,k)=>Tx(x,y-k*lh,t,anchor,k===0?"b":"")).join("");
  return {Y,Ln,Ci,Tx,lines,lh};
}
function geom(v){
  const rake=rad(25), len=2.3*v.fr;
  return {H:{x:len*Math.sin(rake), y:v.fr+len*Math.cos(rake)}, S:{x:v.wb-200, y:v.rwr+470}, rake};
}
function diagram(cols){
  const ok=c=>c.r && [c.r.ix,c.r.iy,c.r.fcy,c.r.cogy,c.r.px,c.r.py].every(Number.isFinite);
  if(!ok(cols[0])) return '<p class="error">Diagram unavailable: the swingarm and chain lines don\'t intersect for these inputs.</p>';
  cols=cols.filter(ok);
  const ex=cols.map(c=>{const g=geom(c.v);return{
    minx:Math.min(-c.v.fr,c.r.ix,0), maxx:Math.max(c.v.wb+c.v.rwr,c.r.ix),
    maxy:Math.max(g.H.y+100,g.S.y+30,c.r.fcy,c.r.iy,c.r.cogy)};});
  const minx=Math.min(...ex.map(e=>e.minx)), maxx=Math.max(...ex.map(e=>e.maxx)), maxy=Math.max(...ex.map(e=>e.maxy));
  const xmin=minx-480, W=maxx+120-xmin, fs=W/52, lh=fs*1.25;
  const yA=maxy+110+2*lh, ymin=-440, ytop=yA+fs+40, Ht=ytop-ymin;
  const {Y,Ln,Ci,Tx,lines}=helpers(ytop,fs);
  const f=fmt;

  const skeleton=(c,cls)=>{
    const {v,r}=c, g=geom(v), H=g.H, S=g.S, d={x:Math.sin(g.rake),y:Math.cos(g.rake)};
    const stem={x:H.x+80*d.x,y:H.y+80*d.y};
    return Ci(0,v.fr,v.fr,cls)+Ci(v.wb,v.rwr,v.rwr,cls)+
      Ln(0,v.fr,stem.x,stem.y,cls)+Ln(stem.x,stem.y,stem.x+130,stem.y-10,cls)+
      Ln(H.x,H.y,S.x,S.y,cls)+Ln(S.x,S.y,r.px,r.py,cls)+Ln(H.x,H.y,r.px,r.py,cls)+
      Ln(S.x-220,S.y+25,S.x+160,S.y+25,cls+(cls==="ln"?" thick":""))+
      Ln(r.px,r.py,v.wb,v.rwr,cls+(cls==="ln"?" thick":""))+
      Ci(r.osx,r.osy,r.sprMM,cls)+Ci(v.wb,v.rwr,v.ratio*r.sprMM,cls)+
      Ln(r.csx,r.csy,r.cwx,r.cwy,cls);
  };
  const {v,r}=cols[0], total=v.bike+v.rider;
  const mid={x:(r.px+v.wb)/2, y:(r.py+v.rwr)/2};
  const a=rad(v.swa), AR=Math.min(200,r.swl*0.45);
  const arc=`<path class="acc" d="M ${r.px+AR} ${Y(r.py)} A ${AR} ${AR} 0 0 ${a>=0?1:0} ${r.px+AR*Math.cos(a)} ${Y(r.py-AR*Math.sin(a))}" fill="none"/>`;
  const up=(px,py,lx,arr,anchor)=>{               // label above, leader from point up to text
    const bottom=yA-(arr.length-1)*lh-fs*0.5;
    return Ln(px,py,lx+(anchor==="end"?-6:anchor==="start"?6:0),bottom,"ld")+lines(lx,yA,arr,anchor);
  };
  const down=(px,py,lx,ly,arr,anchor)=>Ln(px,py,lx+(anchor==="end"?-6:anchor==="start"?6:0),ly+fs*1.1,"ld")+lines(lx,ly,arr,anchor);

  let out=`<svg class="moto" viewBox="${xmin} 0 ${W} ${Ht}" role="img" aria-label="Motorcycle geometry diagram">
  <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="${fs*0.7}" markerHeight="${fs*0.7}" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--accent)" stroke="none"/></marker></defs>
  ${Ln(xmin,0,xmin+W,0,"ln")}`;
  cols.slice(1).forEach(c=>{ out+=skeleton(c,"gh")+Ci(c.r.cogx,c.r.cogy,16,"gh"); });
  out+=skeleton(cols[0],"ln");
  out+=Ln(0,v.fr,-v.fr,v.fr,"acc")+Tx(-v.fr*0.5,v.fr+fs*0.3,`R ${f(v.fr)} mm`,"middle","ta")+
       Ln(v.wb,v.rwr,v.wb+v.rwr,v.rwr,"acc")+Tx(v.wb+v.rwr*0.55,v.rwr+fs*0.3,`R ${f(v.rwr)} mm`,"middle","ta");
  // construction lines
  out+=Ln(r.px,r.py,r.ix,r.iy,"ext")+Ln(r.csx,r.csy,r.ix,r.iy,"ext")+
       Ln(v.wb,0,0,r.fcy,"acc")+Ln(0,0,0,r.fcy,"ld")+
       Ln(r.px,r.py,r.px+AR*1.7,r.py,"ext")+arc;
  out+=Tx(r.px+AR+16,r.py-AR*Math.sin(a)*0.5-fs*0.35,`${f(v.swa)}°`,"start","ta b");
  out+=Tx(mid.x,mid.y-1.7*fs,`${f(r.swl)} mm`,"middle","");
  // points
  out+=Ci(r.ix,r.iy,12,"pt")+Ci(0,r.fcy,12,"pt")+Ci(r.px,r.py,12,"pt")+Ci(r.osx,r.osy,10,"pt")+
       Ci(r.cogx,r.cogy,16,"pt")+Ci(r.cogx,r.cogy,32,"acc");
  // callouts
  out+=up(r.cogx,r.cogy,r.cogx+10,["Center of gravity",`(${f(r.cogx)}, ${f(r.cogy)}) mm`,`Total mass ${f(total)} kg`],"start");
  out+=up(r.ix,r.iy,r.ix+10,["Swingarm / chain intersection",`(${f(r.ix)}, ${f(r.iy)}) mm`],"end");
  out+=Ln(0,r.fcy,-60,r.fcy,"ld")+lines(-70,r.fcy+lh*0.4,["Anti-squat line at x = 0",`y = ${f(r.fcy)} mm`,`Anti squat ${f(r.antiSquat)} %`],"end");
  out+=down(r.px,r.py,r.px+30,185,["Swingarm pivot",`(${f(r.px)}, ${f(r.py)}) mm`],"start");
  out+=down(r.osx,r.osy,r.osx-30,185,["Output shaft",`(${f(r.osx)}, ${f(r.osy)}) mm`,"= motor placement"],"end");
  // loads + wheelbase
  const fl=total*v.fw, rl=total*r.rearW;
  [[0,fl,r.unsprungF,"Front"],[v.wb,rl,r.unsprungR,"Rear"]].forEach(([x,m,u,n])=>{
    out+=Ln(x,-110,x,-8,"acc",'marker-end="url(#ah)"')+lines(x,-110-fs*1.1,[`${n} ${f(m)} kg`,`unsprung ${f(u)} kg`],"middle");
  });
  out+=Ln(0,-330,v.wb,-330,"acc",'marker-start="url(#ah)" marker-end="url(#ah)"')+
       Tx(v.wb/2,-330-fs*1.3,`Wheelbase ${f(v.wb)} mm`,"middle","b");
  out+="</svg>";
  out+='<p class="hint">Origin (x = 0) is the front wheel contact patch; y is height above the ground. The frame, fork and bars are schematic — only the labelled points and dimensions come from your inputs.'+
       (cols.length>1?' Dashed grey outlines show the compared version(s).':'')+'</p>';
  return out;
}


// ---- Rear wheel & swingarm close-up ----
function rearDetail(c){
  const {v,r}=c, f=fmt;
  if(![r.px,r.py,r.csy,r.cwy,r.slopeS,r.slopeC,r.intS,r.intC].every(Number.isFinite)) return "";
  const xmin=Math.min(r.osx,r.px)-160, xmax=v.wb+v.rwr+430, W=xmax-xmin, fs=W/58, lh=fs*1.25;
  const maxy=Math.max(2*v.rwr,r.csy,r.cwy,r.py);
  const yA=maxy+110+3*lh, ymin=-360, ytop=yA+fs+40, Ht=ytop-ymin;
  const {Y,Ln,Ci,Tx,lines}=helpers(ytop,fs);
  const a=rad(v.swa), AR=Math.min(200,r.swl*0.45), mid={x:(r.px+v.wb)/2,y:(r.py+v.rwr)/2};
  const dr=v.ratio*r.sprMM, xr=v.wb+v.rwr+90;
  const up=(px,py,lx,arr)=>Ln(px,py,lx+6,yA-(arr.length-1)*lh-fs*0.5,"ld")+lines(lx,yA,arr,"start");
  const both='marker-start="url(#ah2)" marker-end="url(#ah2)"';
  let o=`<svg class="moto" viewBox="${xmin} 0 ${W} ${Ht}" role="img" aria-label="Rear wheel and swingarm close-up">
  <defs><marker id="ah2" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="${fs*0.7}" markerHeight="${fs*0.7}" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--accent)" stroke="none"/></marker></defs>
  ${Ln(xmin,0,xmax,0,"ln")}`;
  // wheel, sprockets, chain, swingarm
  o+=Ci(v.wb,v.rwr,v.rwr,"ln")+Ci(v.wb,v.rwr,dr,"ln")+Ci(r.osx,r.osy,r.sprMM,"ln")+
     Ln(r.csx,r.csy,r.cwx,r.cwy,"ln")+Ln(r.px,r.py,v.wb,v.rwr,"ln thick");
  // angle arc
  o+=Ln(r.px,r.py,r.px+AR*1.7,r.py,"ext")+
     `<path class="acc" d="M ${r.px+AR} ${Y(r.py)} A ${AR} ${AR} 0 0 ${a>=0?1:0} ${r.px+AR*Math.cos(a)} ${Y(r.py-AR*Math.sin(a))}" fill="none"/>`+
     Tx(r.px+AR+16,r.py-AR*Math.sin(a)*0.5-fs*0.35,`${f(v.swa)}°`,"start","ta b")+
     Tx(mid.x,mid.y-1.7*fs,`L = ${f(r.swl)} mm`,"middle","");
  // points
  o+=Ci(v.wb,v.rwr,10,"pt")+Ci(r.px,r.py,12,"pt")+Ci(r.osx,r.osy,8,"pt")+Ci(r.csx,r.csy,8,"pt")+Ci(r.cwx,r.cwy,8,"pt");
  // dimensions: wheel-to-pivot (below), rear wheel radius (right)
  o+=Ln(r.px,r.py,r.px,-90,"ld")+Ln(v.wb,v.rwr,v.wb,-90,"ld")+Ln(r.px,-90,v.wb,-90,"acc",both)+
     Tx((r.px+v.wb)/2,-90-1.3*fs,`Wheel to pivot ${f(r.wtp)} mm`,"middle","b");
  o+=Ln(xr,0,xr,v.rwr,"acc",both)+Ln(v.wb,v.rwr,xr,v.rwr,"ld")+
     lines(xr+28,v.rwr/2+lh*0.5,["Rear wheel radius",`${f(v.rwr)} mm`],"start");
  // line equations
  o+=lines(xmin+20,-250,[`Top chain: slope ${f(r.slopeC)}, intercept ${f(r.intC)} mm`,`Swingarm: slope ${f(r.slopeS)}, intercept ${f(r.intS)} mm`],"start");
  // callouts
  o+=up(r.osx,r.osy,xmin+10,["Drive sprocket / output shaft",`Motor placement (${f(r.osx)}, ${f(r.osy)}) mm`,`Chain shaft (${f(r.csx)}, ${f(r.csy)}) mm`,`Sprocket radius ${f(v.spr)} in = ${f(r.sprMM)} mm`]);
  o+=up(r.px,r.py,xmin+0.37*W,["Swingarm pivot",`(${f(r.px)}, ${f(r.py)}) mm`,`Swingarm angle ${f(v.swa)}°`]);
  o+=up(r.cwx,r.cwy,xmin+0.66*W,[`Driven sprocket (gear ratio ${f(v.ratio)}:1)`,`Chain wheel (${f(r.cwx)}, ${f(r.cwy)}) mm`,`Radius ${f(v.ratio)} × ${f(r.sprMM)} = ${f(dr)} mm`,`Rear wheel center (${f(r.rwcx)}, ${f(r.rwcy)}) mm`]);
  return '<h3 style="margin-top:18px">Rear wheel &amp; swingarm close-up</h3>'+o+"</svg>";
}

// ---- Calculate / render ----
function setMode(m){
  mode=m;
  document.getElementById("mTable").classList.toggle("on",m==="table");
  document.getElementById("mDiag").classList.toggle("on",m==="diagram");
  if(ran) run();
}
document.getElementById("mTable").addEventListener("click",()=>setMode("table"));
document.getElementById("mDiag").addEventListener("click",()=>setMode("diagram"));

function run(){
  const raw=readRaw();
  const {v,bad}=parseRaw(raw);
  ALL.forEach(it=>document.getElementById(it.id).classList.toggle("bad",bad.includes(it.label)));
  if(bad.length){
    resultsEl.innerHTML=`<p class="error">Fix these inputs: ${bad.join(", ")}.</p>`;
    return;
  }
  ran=true;
  const cols=[{name:"Current", v, r:compute(v)}];
  versions.filter(x=>compare.has(x.id)).forEach(x=>{
    const p=parseRaw(x.raw);
    cols.push({name:x.name, v:p.v, r:p.bad.length?null:compute(p.v)});
  });

  if(mode==="diagram"){ const d=diagram(cols); resultsEl.innerHTML=d+(d.startsWith("<svg")?rearDetail(cols[0]):""); return; }

  if(cols.length===1){
    resultsEl.innerHTML=OUTPUTS.map(g=>
      `<h3>${g.group}</h3>`+g.items.map(([label,unit,fn])=>
        `<div class="res"><span>${label}</span><span class="v">${fmt(fn(cols[0].r))}</span><span class="unit">${unit}</span>${fxBtn(label)}</div><div class="fx"${openFx.has(label)?"":" hidden"}>${esc(FORMULAS[label]||"")}</div>`
      ).join("")
    ).join("");
    return;
  }
  const span=cols.length+2;
  resultsEl.innerHTML='<div class="tw"><table><thead><tr><th>Result</th><th></th>'+
    cols.map(c=>`<th>${esc(c.name)}</th>`).join("")+'</tr></thead><tbody>'+
    OUTPUTS.map(g=>`<tr><th colspan="${span}" style="color:var(--muted);padding-top:12px">${g.group}</th></tr>`+
      g.items.map(([label,unit,fn])=>{
        const vals=cols.map(c=>c.r?fmt(fn(c.r)):"—");
        const diff=vals.some(x=>x!==vals[0]);
        return `<tr class="${diff?"diff":""}"><td>${label}</td><td class="u">${unit} ${fxBtn(label)}</td>`+
          vals.map(x=>`<td class="n">${x}</td>`).join("")+"</tr>"+
          `<tr class="fxrow"${openFx.has(label)?"":" hidden"}><td class="fx" colspan="${span}">${esc(FORMULAS[label]||"")}</td></tr>`;
      }).join("")
    ).join("")+'</tbody></table></div><p class="hint">Shaded rows differ from your current inputs.</p>';
}

resultsEl.addEventListener("click",e=>{
  const b=e.target.closest(".fxbtn"); if(!b) return;
  const box=b.closest(".res, tr").nextElementSibling; if(!box) return;
  const open=box.hidden; box.hidden=!open;
  b.setAttribute("aria-expanded",open);
  open ? openFx.add(b.dataset.fx) : openFx.delete(b.dataset.fx);
});
document.getElementById("calc").addEventListener("click",run);
inputsEl.addEventListener("keydown",e=>{ if(e.key==="Enter") run(); });
renderVersions();

// ---------- Draggable column splitter ----------
(function(){
  const main=document.querySelector("main"), sp=document.getElementById("splitter");
  const left=main.children[0], right=main.children[2], SKEY="moto-calc-split";
  function setFrac(f,save){
    f=Math.min(0.8,Math.max(0.2,f));
    main.style.setProperty("--left",f+"fr"); main.style.setProperty("--right",(1-f)+"fr");
    sp.setAttribute("aria-valuenow",Math.round(f*100)); sp.dataset.f=f;
    if(save){ try{localStorage.setItem(SKEY,f);}catch(e){} }
  }
  let saved=0.5; try{ saved=parseFloat(localStorage.getItem(SKEY))||0.5; }catch(e){}
  setFrac(saved,false);
  const frac=x=>{ const a=left.getBoundingClientRect().left, b=right.getBoundingClientRect().right; return (x-a)/(b-a); };
  sp.addEventListener("pointerdown",e=>{ sp.setPointerCapture(e.pointerId); sp.classList.add("drag"); document.body.classList.add("dragging"); });
  sp.addEventListener("pointermove",e=>{ if(sp.hasPointerCapture(e.pointerId)) setFrac(frac(e.clientX),false); });
  const end=e=>{ sp.classList.remove("drag"); document.body.classList.remove("dragging"); setFrac(+sp.dataset.f,true); };
  sp.addEventListener("pointerup",end); sp.addEventListener("pointercancel",end);
  sp.addEventListener("dblclick",()=>setFrac(0.5,true));
  sp.addEventListener("keydown",e=>{
    const f=+sp.dataset.f;
    if(e.key==="ArrowLeft"){ setFrac(f-0.02,true); e.preventDefault(); }
    if(e.key==="ArrowRight"){ setFrac(f+0.02,true); e.preventDefault(); }
    if(e.key==="Home"){ setFrac(0.5,true); e.preventDefault(); }
  });
})();

