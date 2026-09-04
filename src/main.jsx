import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity, BarChart3, CircleHelp, Gauge, Layers3, Play, RotateCcw,
  Settings2, SlidersHorizontal, Sparkles, Target, Wind, Zap, Rocket as RocketIcon
} from "lucide-react";
import "./index.css";

const MODELS = [
  { id:"basic", name:"A-01", type:"STANDARD", desc:"Baseline configuration", mass:100, fuel:40, thrust:2500, burn:8, cd:.50, diameter:.50, stability:87 },
  { id:"aero", name:"A-02", type:"AERODYNAMIC", desc:"Low-drag nose profile", mass:105, fuel:42, thrust:2600, burn:8, cd:.30, diameter:.45, stability:82 },
  { id:"stable", name:"A-03", type:"STABILITY", desc:"High-stability fin set", mass:110, fuel:40, thrust:2550, burn:8, cd:.45, diameter:.50, stability:96 },
  { id:"light", name:"A-04", type:"LIGHTWEIGHT", desc:"Reduced structural mass", mass:85, fuel:32, thrust:2400, burn:7, cd:.42, diameter:.45, stability:83 }
];

const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const rnd = (seed)=>{ seed.v=(seed.v*1664525+1013904223)>>>0; return seed.v/4294967296; };
const gaussian = seed => {
  const a=Math.max(rnd(seed),1e-6), b=Math.max(rnd(seed),1e-6);
  return Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*b);
};

function runSimulation(model, cfg) {
  const seed={v:91731}, samples=[], representative=[];
  for(let run=0; run<cfg.runs; run++){
    let mass=model.mass, fuel=model.fuel, h=0, v=0, x=0, t=0, maxV=0, maxA=0;
    const wind=Math.max(0,cfg.wind + gaussian(seed)*Math.max(.5,cfg.wind*.22));
    const thrust=model.thrust*(1+gaussian(seed)*cfg.error/100);
    const angle=cfg.angle*Math.PI/180, dt=.08;
    while(t<180 && (h>=0 || t<.16)){
      const thrustNow=fuel>0 ? thrust : 0;
      const drag=.5*cfg.air*model.cd*Math.PI*(model.diameter/2)**2*v*v;
      const gravity=9.81;
      const ax=(thrustNow*Math.cos(angle)-drag*Math.sign(v)-mass*gravity*Math.cos(Math.PI/2-angle))/Math.max(mass,1);
      const vertical=(thrustNow*Math.sin(angle)-drag*Math.max(Math.sin(angle),.2)-mass*gravity)/Math.max(mass,1);
      const fuelRate=model.fuel/model.burn;
      if(fuel>0) fuel=Math.max(0,fuel-fuelRate*dt);
      mass=Math.max(model.mass-model.fuel, model.mass-fuel);
      v=Math.max(0,v+vertical*dt);
      h=Math.max(0,h+v*dt);
      x+=(wind*.018 + ax*Math.cos(angle)*.015)*dt*12;
      maxV=Math.max(maxV,v); maxA=Math.max(maxA,Math.abs(vertical));
      if(run===0 && representative.length<900) representative.push({t,h,v});
      t+=dt;
      if(fuel<=0 && v<.2 && t>model.burn+12) break;
      if(h>100000) break;
    }
    samples.push({h,v:maxV,a:maxA,x:Math.abs(x),fuel:model.fuel-fuel});
  }
  const mean=k=>samples.reduce((s,o)=>s+o[k],0)/samples.length;
  const heights=samples.map(o=>o.h), avgH=mean("h");
  const sd=Math.sqrt(heights.reduce((s,n)=>s+(n-avgH)**2,0)/heights.length);
  return {avgH,maxH:Math.max(...heights),minH:Math.min(...heights),sd,maxV:mean("v"),maxA:mean("a"),drift:mean("x"),fuel:mean("fuel"),eff:avgH/Math.max(mean("fuel"),1),trace:representative};
}

function Rocket({running}) {
  return <div className="relative flex h-[440px] items-center justify-center overflow-hidden rounded-[28px] border border-white/[.07] bg-[#080c12]">
    <div className="absolute inset-0 noise opacity-70" />
    <div className="absolute inset-x-0 top-1/2 h-px bg-white/[.045]" />
    <div className="absolute left-1/2 top-0 h-full w-px bg-white/[.045]" />
    <div className="absolute right-6 top-6 flex items-center gap-2 text-[10px] font-semibold tracking-[.22em] text-slate-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>LIVE MODEL</div>
    <div className={`rocket-body relative flex flex-col items-center ${running?"-translate-y-2 transition-transform duration-1000":""}`}>
      <div className="h-20 w-20 bg-gradient-to-br from-slate-100 via-slate-400 to-slate-700" style={{clipPath:"polygon(50% 0,100% 100%,0 100%)"}}/>
      <div className="relative h-48 w-[58px] rounded-b-[24px] bg-gradient-to-r from-slate-200 via-slate-500 to-slate-800">
        <div className="absolute left-1/2 top-10 h-12 w-3 -translate-x-1/2 rounded-full bg-cyan-300/70 shadow-[0_0_20px_rgba(85,230,189,.5)]"/>
        <div className="absolute -left-10 bottom-2 h-20 w-10 bg-gradient-to-r from-slate-700 to-slate-500" style={{clipPath:"polygon(100% 0,100% 100%,0 100%)"}}/>
        <div className="absolute -right-10 bottom-2 h-20 w-10 bg-gradient-to-l from-slate-700 to-slate-500" style={{clipPath:"polygon(0 0,100% 100%,0 100%)"}}/>
      </div>
      <div className="relative h-24 w-16">
        <div className="flame absolute left-1/2 top-0 h-24 w-10 -translate-x-1/2 rounded-b-full bg-gradient-to-b from-white via-cyan-300 to-transparent blur-[5px]"/>
        <div className="flame absolute left-1/2 top-0 h-20 w-4 -translate-x-1/2 rounded-b-full bg-gradient-to-b from-white to-orange-400 blur-[1px]"/>
      </div>
    </div>
    <div className="scanline pointer-events-none absolute inset-x-0 top-0 h-1/2"/>
    <div className="absolute bottom-5 left-5 text-[10px] tracking-[.18em] text-slate-600">NORTH / 90° AZIMUTH</div>
  </div>
}

function Chart({trace}) {
  const pts=useMemo(()=>{
    if(!trace?.length) return "";
    const maxH=Math.max(1,...trace.map(p=>p.h)), maxT=Math.max(1,...trace.map(p=>p.t));
    return trace.filter((_,i)=>i%3===0).map(p=>`${(p.t/maxT)*100},${100-(p.h/maxH)*88-6}`).join(" ");
  },[trace]);
  return <div className="relative h-[250px] overflow-hidden rounded-2xl border border-white/[.07] bg-[#080c12]">
    <div className="absolute inset-0" style={{backgroundImage:"linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px)",backgroundSize:"44px 44px"}}/>
    {trace?.length ? <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full p-5">
      <polyline points={pts} fill="none" stroke="#55e6bd" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>
      <polyline points={`0,94 ${pts}`} fill="none" stroke="#55e6bd" strokeOpacity=".08" strokeWidth="12" vectorEffect="non-scaling-stroke"/>
    </svg> : <div className="flex h-full items-center justify-center text-sm text-slate-600">RUN SIMULATION TO GENERATE FLIGHT DATA</div>}
    <span className="absolute bottom-3 left-4 text-[9px] tracking-[.18em] text-slate-600">TIME</span>
    <span className="absolute left-3 top-3 text-[9px] tracking-[.18em] text-slate-600">ALTITUDE</span>
  </div>
}

function Stat({label,value,unit}) {
  return <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-4">
    <div className="text-[9px] font-bold uppercase tracking-[.2em] text-slate-600">{label}</div>
    <div className="mt-2 text-xl font-semibold tracking-tight text-slate-100">{value}<span className="ml-1 text-[11px] font-medium text-slate-500">{unit}</span></div>
  </div>
}

export default function App(){
  const [modelId,setModelId]=useState("basic");
  const [wind,setWind]=useState(6);
  const [angle,setAngle]=useState(90);
  const [error,setError]=useState(3);
  const [air,setAir]=useState(1.225);
  const [runs,setRuns]=useState(1000);
  const [result,setResult]=useState(null);
  const [running,setRunning]=useState(false);
  const model=MODELS.find(m=>m.id===modelId);

  const launch=()=>{
    setRunning(true);
    setTimeout(()=>{ setResult(runSimulation(model,{wind,angle,error,air,runs})); setRunning(false); },180);
  };

  return <div className="min-h-screen bg-[#07090d]">
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[.07] bg-[#080b10]/90 px-5 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-black"><RocketIcon size={18}/></div>
        <div><div className="text-sm font-black tracking-[.16em]">ROCKETLAB</div><div className="text-[9px] tracking-[.18em] text-slate-600">FLIGHT SIMULATION SYSTEM</div></div>
      </div>
      <div className="hidden items-center gap-5 md:flex">
        <span className="flex items-center gap-2 text-[10px] font-semibold tracking-[.16em] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400"/>SYSTEM ONLINE</span>
        <span className="text-[10px] tracking-[.14em] text-slate-600">v2.0.0</span>
      </div>
    </header>

    <div className="mx-auto grid max-w-[1500px] gap-5 p-4 md:p-6 xl:grid-cols-[220px_minmax(0,1fr)_310px]">
      <aside className="hidden xl:block">
        <div className="sticky top-24">
          <div className="mb-5 px-3 text-[9px] font-bold tracking-[.24em] text-slate-600">WORKSPACE</div>
          <nav className="space-y-1">
            {[["SIMULATION",Gauge],["DESIGN",Layers3],["ANALYSIS",BarChart3],["OPTIMIZATION",Sparkles]].map(([label,Icon],i)=>
              <button key={label} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[11px] font-semibold tracking-[.1em] ${i===0?"bg-white/[.06] text-emerald-300":"text-slate-500 hover:bg-white/[.03] hover:text-slate-300"}`}><Icon size={15}/>{label}</button>
            )}
          </nav>
          <div className="my-7 h-px bg-white/[.06]"/>
          <div className="px-3 text-[9px] font-bold tracking-[.24em] text-slate-600">PROJECT</div>
          <div className="mt-3 rounded-xl border border-white/[.06] bg-white/[.025] p-3">
            <div className="text-[10px] text-slate-500">CURRENT MODEL</div>
            <div className="mt-1 text-sm font-semibold">{model.name}</div>
            <div className="mt-2 text-[9px] text-slate-600">{model.type}</div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 space-y-5">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <div className="mb-1 text-[10px] font-bold tracking-[.22em] text-emerald-400">MISSION CONTROL / SIMULATION</div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Launch Environment</h1>
          </div>
          <div className="flex items-center gap-2 text-[10px] tracking-[.12em] text-slate-600"><Activity size={13}/> MONTE CARLO ENGINE READY</div>
        </div>

        <Rocket running={running}/>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <section className="glass rounded-[26px] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div><div className="text-[9px] font-bold tracking-[.22em] text-slate-600">FLIGHT TELEMETRY</div><h2 className="mt-1 text-base font-semibold">Altitude Profile</h2></div>
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[.06] px-2 py-1 text-[9px] font-bold tracking-[.12em] text-emerald-300">LIVE TRACE</div>
            </div>
            <Chart trace={result?.trace}/>
          </section>

          <section className="glass rounded-[26px] p-5">
            <div className="mb-5 flex items-center justify-between"><div><div className="text-[9px] font-bold tracking-[.22em] text-slate-600">MISSION RESULT</div><h2 className="mt-1 text-base font-semibold">Performance</h2></div><Target size={17} className="text-slate-600"/></div>
            {result ? <div className="grid grid-cols-2 gap-3">
              <Stat label="AVG ALTITUDE" value={result.avgH.toLocaleString(undefined,{maximumFractionDigits:0})} unit="m"/>
              <Stat label="MAX VELOCITY" value={result.maxV.toFixed(1)} unit="m/s"/>
              <Stat label="ALTITUDE SD" value={result.sd.toFixed(1)} unit="m"/>
              <Stat label="DRIFT" value={result.drift.toFixed(1)} unit="m"/>
            </div> : <div className="grid h-[178px] place-items-center rounded-2xl border border-dashed border-white/[.07] text-center"><div><Gauge className="mx-auto mb-3 text-slate-700" size={27}/><p className="text-[10px] tracking-[.12em] text-slate-600">NO FLIGHT DATA</p></div></div>}
          </section>
        </div>
      </main>

      <aside className="space-y-5">
        <section className="glass rounded-[26px] p-5">
          <div className="mb-5 flex items-center gap-2"><SlidersHorizontal size={16} className="text-emerald-400"/><div><div className="text-[9px] font-bold tracking-[.22em] text-slate-600">CONFIGURATION</div><h2 className="mt-1 text-base font-semibold">Rocket Model</h2></div></div>
          <div className="grid grid-cols-2 gap-2">
            {MODELS.map(m=><button key={m.id} onClick={()=>setModelId(m.id)} className={`rounded-xl border p-3 text-left transition ${modelId===m.id?"border-emerald-400/35 bg-emerald-400/[.07]":"border-white/[.07] bg-white/[.02] hover:bg-white/[.05]"}`}>
              <div className={`text-[10px] font-bold ${modelId===m.id?"text-emerald-300":"text-slate-400"}`}>{m.name}</div><div className="mt-1 text-[8px] tracking-[.12em] text-slate-600">{m.type}</div>
            </button>)}
          </div>
          <div className="mt-5 space-y-5">
            <Control label="LAUNCH ANGLE" value={`${angle}°`} min={45} max={90} step={1} val={angle} set={setAngle}/>
            <Control label="WIND SPEED" value={`${wind.toFixed(1)} m/s`} min={0} max={15} step={.5} val={wind} set={setWind}/>
            <Control label="THRUST ERROR" value={`±${error}%`} min={0} max={10} step={.5} val={error} set={setError}/>
            <Control label="AIR DENSITY" value={`${air.toFixed(3)} kg/m³`} min={.8} max={1.4} step={.005} val={air} set={setAir}/>
          </div>
        </section>

        <section className="glass rounded-[26px] p-5">
          <div className="mb-4 flex items-center justify-between"><div><div className="text-[9px] font-bold tracking-[.22em] text-slate-600">MONTE CARLO</div><h2 className="mt-1 text-base font-semibold">Repeat Runs</h2></div><Zap size={16} className="text-amber-300"/></div>
          <select value={runs} onChange={e=>setRuns(Number(e.target.value))} className="w-full rounded-xl border border-white/[.08] bg-black/20 px-3 py-2.5 text-sm text-slate-200 outline-none">
            <option value={100}>100 runs</option><option value={500}>500 runs</option><option value={1000}>1,000 runs</option><option value={5000}>5,000 runs</option>
          </select>
          <button onClick={launch} disabled={running} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3.5 text-[11px] font-black tracking-[.14em] text-[#06100c] transition hover:bg-emerald-300 disabled:opacity-50">
            {running?<><Activity size={15}/> SIMULATING...</>:<><Play size={15} fill="currentColor"/> RUN SIMULATION</>}
          </button>
          <button onClick={()=>setResult(null)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[.07] px-4 py-2.5 text-[10px] font-semibold tracking-[.12em] text-slate-500 hover:text-slate-300"><RotateCcw size={13}/> RESET RESULT</button>
        </section>

        <section className="rounded-[26px] border border-white/[.06] bg-white/[.018] p-5">
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.15em] text-slate-500"><Wind size={14}/> RANDOMIZED VARIABLES</div>
          <div className="mt-3 space-y-2 text-[10px] text-slate-600">
            <div className="flex justify-between"><span>Wind direction</span><span className="text-slate-400">RANDOM</span></div>
            <div className="flex justify-between"><span>Gust variation</span><span className="text-slate-400">±25%</span></div>
            <div className="flex justify-between"><span>Engine output</span><span className="text-slate-400">±{error}%</span></div>
          </div>
        </section>
      </aside>
    </div>
    <footer className="mx-auto max-w-[1500px] px-5 pb-8 pt-2 text-[9px] tracking-[.16em] text-slate-700 md:px-8">ROCKETLAB / AEROSPACE × COMPUTER ENGINEERING / SIMULATION PROTOTYPE</footer>
  </div>
}

function Control({label,value,min,max,step,val,set}){
  return <label className="block">
    <div className="mb-2 flex justify-between text-[9px] font-bold tracking-[.16em]"><span className="text-slate-500">{label}</span><span className="text-emerald-300">{value}</span></div>
    <input className="range" type="range" min={min} max={max} step={step} value={val} onChange={e=>set(Number(e.target.value))}/>
  </label>
}

createRoot(document.getElementById("root")).render(<App />);
