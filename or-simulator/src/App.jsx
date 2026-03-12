import { useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ReferenceLine, CartesianGrid, AreaChart, Area } from "recharts";

const START = 8 * 60, END = 16 * 60, PREP = 15, SIM_HISTORY = 200;
const SURGEON_COLORS = { A: "#e07b39", B: "#4a9eff", C: "#a78bfa" };
const PROC_COLORS = { Appendectomy: "#e07b39", Cholecystectomy: "#4a9eff", "Hernia repair": "#a78bfa" };

const DEFAULT_PROC_PARAMS = {
  Appendectomy:    { mu: 4.06, sigma: 0.28 },
  Cholecystectomy: { mu: 4.28, sigma: 0.32 },
  "Hernia repair": { mu: 3.91, sigma: 0.26 },
};
const SURGEON_SKILL = { A: 0.92, B: 1.10, C: 1.00 };
const DEFAULT_PLAN = [
  { chir: "A", proc: "Appendectomy" },
  { chir: "B", proc: "Cholecystectomy" },
  { chir: "C", proc: "Appendectomy" },
  { chir: "A", proc: "Hernia repair" },
  { chir: "B", proc: "Appendectomy" },
  { chir: "C", proc: "Cholecystectomy" },
];

// ── math ──────────────────────────────────────────────────────────────────
function randLognorm(mu, sigma) {
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return Math.exp(mu + sigma * z);
}
function lognormMean(mu, sigma) { return Math.exp(mu + sigma ** 2 / 2); }
function lognormP80(mu, sigma)  { return Math.exp(mu + 0.842 * sigma); }
function lognormP50(mu, sigma)  { return Math.exp(mu); }

function lognormPDF(x, mu, sigma) {
  if (x <= 0) return 0;
  return (1 / (x * sigma * Math.sqrt(2 * Math.PI))) *
    Math.exp(-((Math.log(x) - mu) ** 2) / (2 * sigma ** 2));
}
function buildPDFCurve(mu, sigma, points = 80) {
  const median = Math.exp(mu);
  const xMin = Math.max(5, Math.round(median * 0.3));
  const xMax = Math.round(median * 3.0);
  const step = (xMax - xMin) / points;
  let maxY = 0;
  const raw = Array.from({ length: points + 1 }, (_, i) => {
    const x = xMin + i * step;
    const y = lognormPDF(x, mu, sigma);
    if (y > maxY) maxY = y;
    return { x: Math.round(x), y };
  });
  return { curve: raw.map(d => ({ ...d, y: maxY > 0 ? (d.y / maxY) * 100 : 0 })), xMin, xMax };
}

function generateHistory(procParams, n = SIM_HISTORY) {
  const matrix = {};
  for (const [proc, { mu, sigma }] of Object.entries(procParams)) {
    matrix[proc] = {};
    for (const [surg, skill] of Object.entries(SURGEON_SKILL)) {
      const samples = Array.from({ length: n }, () =>
        Math.round(randLognorm(mu, sigma) * skill)
      ).sort((a, b) => a - b);
      matrix[proc][surg] = {
        p50: samples[Math.floor(n * 0.5)],
        p80: samples[Math.floor(n * 0.8)],
        mean: Math.round(samples.reduce((a, b) => a + b, 0) / n),
      };
    }
  }
  return matrix;
}

// planMode: "mean" | "p50" | "p80" | "custom"
function getPlanned(matrix, proc, surg, planMode, customOffsets) {
  const cell = matrix[proc]?.[surg];
  if (!cell) return 60;
  let base;
  if (planMode === "mean") base = cell.mean;
  else if (planMode === "p80") base = cell.p80;
  else base = cell.p50; // p50 or custom
  const offset = customOffsets?.[proc] ?? 0;
  return Math.max(10, Math.round((base + offset) / 5) * 5);
}

function simulate(plan, procParams, matrix, planMode, customOffsets) {
  let tReal = START;
  let tPlan = START;
  return plan.map((op, idx) => {
    const { mu, sigma } = procParams[op.proc] ?? { mu: 4.06, sigma: 0.28 };
    const skill = SURGEON_SKILL[op.chir] ?? 1;
    const actual = Math.max(15, Math.round(randLognorm(mu, sigma) * skill));
    const planned    = getPlanned(matrix, op.proc, op.chir, planMode, customOffsets);
    const plannedMean = getPlanned(matrix, op.proc, op.chir, "mean", {});
    const plannedP50  = getPlanned(matrix, op.proc, op.chir, "p50", {});
    const startReal = Math.max(tReal, START);
    const endReal = startReal + actual;
    const startPlan = tPlan;
    const endPlan = startPlan + planned;
    const row = {
      id: idx + 1, chir: op.chir, proc: op.proc,
      startPlan, endPlan,
      startMean: tPlan, endMean: tPlan + plannedMean,
      startP50:  tPlan, endP50:  tPlan + plannedP50,
      startReal, endReal,
      planned, plannedMean, plannedP50,
      actual, delay: actual - planned,
    };
    tReal = endReal + PREP;
    tPlan = endPlan + PREP;
    return row;
  });
}

function minToTime(m) {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  return `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
}

// ── Gantt — 2 bars: active plan + actual ──────────────────────────────────
const DAY_W = END - START + 60;
function px(min, width) { return ((min - START) / DAY_W) * width; }

function GanttRow3({ row, width, planColor }) {
  const color = SURGEON_COLORS[row.chir];
  const pL = px(row.startPlan, width), pW = Math.max((row.planned / DAY_W) * width, 3);
  const rL = px(row.startReal, width), rW = Math.max((row.actual / DAY_W) * width, 3);
  return (
    <div style={{ position:"relative", height:32, marginBottom:4 }}>
      <div title={`Plan (${row.planned} min): ${minToTime(row.startPlan)}–${minToTime(row.endPlan)}`} style={{
        position:"absolute", left:pL, width:pW, height:13, top:1,
        border:`2px solid ${planColor}`, borderRadius:3, opacity:0.8,
      }} />
      <div title={`Rzeczywiste: ${minToTime(row.startReal)}–${minToTime(row.endReal)} (${row.actual} min)`} style={{
        position:"absolute", left:rL, width:rW, height:13, top:17,
        background:color, borderRadius:3, opacity:0.9,
        ...(row.delay > 10 ? { outline:"2px solid #ff4d4d", outlineOffset:1 } : {}),
      }} />
    </div>
  );
}

function TimeAxis({ width }) {
  return (
    <div style={{ position:"relative", height:18, marginBottom:2 }}>
      {Array.from({ length: 10 }, (_, i) => (8 + i) * 60).map(m => (
        <span key={m} style={{
          position:"absolute", left:px(m, width), transform:"translateX(-50%)",
          fontSize:10, color:"#555", fontFamily:"monospace",
        }}>{minToTime(m)}</span>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, color }) {
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
        <span style={{ fontSize:11, color:"#888" }}>{label}</span>
        <span style={{ fontSize:11, fontFamily:"monospace", color: color ?? "#ccc" }}>{value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width:"100%", accentColor: color ?? "#e07b39", cursor:"pointer" }} />
    </div>
  );
}

function ModeBtn({ mode, active, onClick, label, desc, color }) {
  return (
    <button onClick={() => onClick(mode)} style={{
      flex:1, padding:"10px 8px", borderRadius:8, cursor:"pointer",
      border: active ? `2px solid ${color}` : "2px solid #252530",
      background: active ? `${color}18` : "#0d0d14",
      color: active ? color : "#555",
      fontFamily:"'Syne',sans-serif", fontWeight:600, fontSize:12,
      transition:"all 0.15s", textAlign:"center",
    }}>
      <div>{label}</div>
      <div style={{ fontSize:10, fontWeight:400, marginTop:2, color: active ? `${color}bb` : "#444" }}>{desc}</div>
    </button>
  );
}

// ── main ──────────────────────────────────────────────────────────────────
export default function ORSimV3() {
  const [procParams, setProcParams] = useState(DEFAULT_PROC_PARAMS);
  const [planMode, setPlanMode] = useState("mean"); // mean | p50 | p80 | custom
  const [customOffsets, setCustomOffsets] = useState({ Appendectomy:0, Cholecystectomy:0, "Hernia repair":0 });
  const [runs, setRuns] = useState(0);
  const [activeTab, setActiveTab] = useState("gantt");

  const matrix = useMemo(() => generateHistory(procParams), [procParams, runs]);

  const [results, setResults] = useState(() => {
    const m = generateHistory(DEFAULT_PROC_PARAMS);
    return simulate(DEFAULT_PLAN, DEFAULT_PROC_PARAMS, m, "mean", {});
  });

  const runSim = useCallback(() => {
    setRuns(r => r + 1);
    setResults(simulate(DEFAULT_PLAN, procParams, matrix, planMode, customOffsets));
  }, [procParams, matrix, planMode, customOffsets]);

  // auto re-simulate when mode changes — generate fresh matrix to avoid stale useMemo
  const handleModeChange = (mode) => {
    setPlanMode(mode);
    const freshMatrix = generateHistory(procParams);
    setResults(simulate(DEFAULT_PLAN, procParams, freshMatrix, mode, customOffsets));
  };

  const setParam = (proc, key, val) =>
    setProcParams(prev => ({ ...prev, [proc]: { ...prev[proc], [key]: val } }));
  const setOffset = (proc, val) =>
    setCustomOffsets(prev => ({ ...prev, [proc]: val }));

  // ── KPIs ──
  const sumDelay   = results.reduce((a, r) => a + r.delay, 0);
  const totalDelay = results.reduce((a, r) => a + Math.max(0, r.delay), 0);
  const lastEnd    = results.at(-1)?.endReal ?? END;
  const overtime   = lastEnd > END;
  const efficiency    = ((results.reduce((a,r)=>a+r.actual,0) + PREP*(results.length-1)) / (END-START)) * 100;
  const utilization   = (results.reduce((a,r)=>a+r.actual,0) / (END-START)) * 100;

  const surgeonBias = Object.keys(SURGEON_COLORS).map(s => {
    const ops = results.filter(r => r.chir === s);
    const avg = ops.length ? ops.reduce((a,r)=>a+r.delay,0)/ops.length : 0;
    return { surg: s, bias: Math.round(avg*10)/10, fill: SURGEON_COLORS[s] };
  });
  const procBias = Object.keys(DEFAULT_PROC_PARAMS).map(p => {
    const ops = results.filter(r => r.proc === p);
    const avg = ops.length ? ops.reduce((a,r)=>a+r.delay,0)/ops.length : 0;
    return { proc: p.replace(" repair",""), bias: Math.round(avg*10)/10 };
  });
  const matrixRows = Object.entries(matrix).flatMap(([proc, surgs]) =>
    Object.entries(surgs).map(([surg, { p50, p80, mean }]) => ({
      proc, surg, p50, p80, mean,
      planned: getPlanned(matrix, proc, surg, planMode, customOffsets),
    }))
  );
  const scatterData = results.map(r => ({
    planned: r.planned, actual: r.actual,
    fill: SURGEON_COLORS[r.chir], name: `Op${r.id} ${r.chir}`,
  }));

  const MODE_CONFIG = {
    mean: { color:"#ff6b6b", label:"Średnia",  desc:"zawyżona przez długie operacje" },
    p50:  { color:"#e07b39", label:"P50 (mediana)", desc:"50% operacji przekroczy plan" },
    p80:  { color:"#6bcb77", label:"P80",      desc:"tylko 20% przekroczy plan" },
    custom:{ color:"#a78bfa", label:"Własny",  desc:"ręczna korekta per procedura" },
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", color:"#ddd",
      fontFamily:"'Syne',sans-serif", padding:"28px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        input[type=range]{height:4px;border-radius:2px}
        .card{background:#111118;border:1px solid #1e1e2a;border-radius:10px;padding:18px 20px}
        .tab{padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;
          letter-spacing:0.04em;transition:all 0.15s;border:none;font-family:'Syne',sans-serif}
        .tab-active{background:#e07b39;color:#fff}
        .tab-inactive{background:transparent;color:#555;border:1px solid #252530}
        .tab-inactive:hover{color:#999;border-color:#444}
        th{font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#444;
          font-weight:500;padding:4px 8px;text-align:left}
        td{padding:5px 8px;font-size:12px;border-bottom:1px solid #161620}
        .kpi-val{font-family:'JetBrains Mono',monospace;font-size:26px;font-weight:500;line-height:1}
        .kpi-lbl{font-size:10px;color:#555;letter-spacing:0.1em;text-transform:uppercase;margin-top:5px}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#111}
        ::-webkit-scrollbar-thumb{background:#2a2a38;border-radius:3px}
      `}</style>

      {/* header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#333", textTransform:"uppercase",
            fontFamily:"'JetBrains Mono',monospace", marginBottom:6 }}>OR · Symulator Sali — v3</div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:"#f0ede8", letterSpacing:"-0.02em" }}>
            Błąd planowania & rozkład log-normalny
          </h1>
          <div style={{ fontSize:11, color:"#444", marginTop:4, fontFamily:"'JetBrains Mono',monospace" }}>
            Tryb planu: <span style={{ color: MODE_CONFIG[planMode].color }}>{MODE_CONFIG[planMode].label}</span>
            {" "}· run #{runs}
          </div>
        </div>
        <button onClick={runSim} style={{
          background:"linear-gradient(135deg,#e07b39,#c45e1a)", color:"#fff",
          border:"none", borderRadius:8, padding:"10px 24px", fontSize:13,
          fontWeight:700, cursor:"pointer", fontFamily:"'Syne',sans-serif",
        }}>▶ Uruchom</button>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10, marginBottom:16 }}>
        {[
          { val:`${sumDelay>0?"+":""}${sumDelay}'`, label:"Suma opóźnień", color:sumDelay>0?"#ff6b6b":sumDelay<0?"#6bcb77":"#888", tip:null },
          { val:`${totalDelay}'`, label:"Skumul. przekrocz.", color:"#ff9f43", tip:null },
          { val:`${efficiency.toFixed(1)}%`, label:"Efektywność sali", color:efficiency>=85?"#6bcb77":efficiency>=70?"#e0c039":"#ff6b6b", tip:"op. + przygotowania / czas dostępny" },
          { val:`${utilization.toFixed(1)}%`, label:"Utilization (op.)", color:utilization>=75?"#6bcb77":utilization>=60?"#e0c039":"#ff6b6b", tip:"tylko czas operacji / czas dostępny" },
          { val:minToTime(lastEnd), label:"Koniec ostatniej op.", color:overtime?"#ff6b6b":"#6bcb77", tip:null },
          { val:`${results.filter(r=>r.delay>0).length}/${results.length}`, label:"Op. z przekrocz.", color:"#a78bfa", tip:null },
        ].map(({ val, label, color, tip }) => (
          <div key={label} className="card" title={tip ?? ""}>
            <div className="kpi-val" style={{ color }}>{val}</div>
            <div className="kpi-lbl">{label}</div>
            {tip && <div style={{ fontSize:9, color:"#444", marginTop:4, fontFamily:"'JetBrains Mono',monospace" }}>{tip}</div>}
          </div>
        ))}
      </div>

      {/* tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {[
          ["gantt","Gantt"],
          ["planning","Parametry planowania"],
          ["bias","Błąd planowania"],
          ["matrix","Macierz P50/P80"],
          ["params","Rozkłady"],
        ].map(([k,lbl]) => (
          <button key={k} className={`tab ${activeTab===k?"tab-active":"tab-inactive"}`}
            onClick={()=>setActiveTab(k)}>{lbl}</button>
        ))}
      </div>

      {/* ── GANTT tab ── */}
      {activeTab === "gantt" && (
        <div className="card">
          {/* legend */}
          <div style={{ display:"flex", gap:20, marginBottom:14, flexWrap:"wrap", fontSize:11 }}>
            <span style={{ display:"flex", alignItems:"center", gap:6, color:"#666" }}>
              <span style={{ border:`2px solid ${MODE_CONFIG[planMode].color}`, width:18, height:10, borderRadius:2, display:"inline-block" }} />
              Plan — <strong style={{ color: MODE_CONFIG[planMode].color }}>{MODE_CONFIG[planMode].label}</strong>
            </span>
            <span style={{ display:"flex", alignItems:"center", gap:6, color:"#666" }}>
              <span style={{ background:"#aaa", width:18, height:10, borderRadius:2, display:"inline-block" }} />
              Rzeczywistość
            </span>
            {["A","B","C"].map(s => (
              <span key={s} style={{ display:"flex", alignItems:"center", gap:5, color:"#666" }}>
                <span style={{ background:SURGEON_COLORS[s], width:10, height:10, borderRadius:2, display:"inline-block" }} />
                Chirurg {s}
              </span>
            ))}
          </div>
          <div style={{ overflowX:"auto" }}>
            <div style={{ minWidth:640 }}>
              <div style={{ display:"grid", gridTemplateColumns:"120px 1fr" }}>
                <div /><TimeAxis width={580} />
              </div>
              {results.map(row => (
                <div key={row.id} style={{ display:"grid", gridTemplateColumns:"120px 1fr", alignItems:"center" }}>
                  <div style={{ fontSize:10, color:"#666", fontFamily:"'JetBrains Mono',monospace", paddingRight:8 }}>
                    Op {row.id} · <span style={{ color:SURGEON_COLORS[row.chir] }}>{row.chir}</span>
                    <br /><span style={{ color:"#444", fontSize:9 }}>{row.proc}</span>
                  </div>
                  <GanttRow3 row={row} width={580} planColor={MODE_CONFIG[planMode].color} />
                </div>
              ))}
            </div>
          </div>
          {/* table */}
          <table style={{ width:"100%", borderCollapse:"collapse", marginTop:16 }}>
            <thead><tr>
              {["Op","Chir","Procedura","Plan","Start (plan)","Koniec (plan)","Rzecz.","Δ","Start","Koniec"].map(h=><th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace" }}>{r.id}</td>
                  <td><span style={{ color:SURGEON_COLORS[r.chir], fontWeight:600 }}>{r.chir}</span></td>
                  <td style={{ color:"#666", fontSize:11 }}>{r.proc}</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", color: MODE_CONFIG[planMode].color, fontWeight:600 }}>{r.planned}'</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color: MODE_CONFIG[planMode].color, opacity:0.7 }}>{minToTime(r.startPlan)}</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color: MODE_CONFIG[planMode].color, opacity:0.7 }}>{minToTime(r.endPlan)}</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace" }}>{r.actual}'</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
                    color:r.delay>0?"#ff6b6b":r.delay<0?"#6bcb77":"#888" }}>
                    {r.delay>0?"+":""}{r.delay}'
                  </td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#666" }}>{minToTime(r.startReal)}</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11,
                    color:r.endReal>END?"#ff6b6b":"#666" }}>{minToTime(r.endReal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PLANNING PARAMS tab ── */}
      {activeTab === "planning" && (
        <div style={{ display:"grid", gap:14 }}>
          {/* mode switcher */}
          <div className="card">
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
              marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>
              Tryb wyznaczania planu operacji
            </div>
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              {Object.entries(MODE_CONFIG).map(([mode, cfg]) => (
                <ModeBtn key={mode} mode={mode} active={planMode===mode}
                  onClick={handleModeChange} label={cfg.label} desc={cfg.desc} color={cfg.color} />
              ))}
            </div>
            <div style={{ background:"#0d0d14", borderRadius:8, padding:"12px 16px", fontSize:11, color:"#555", lineHeight:1.7 }}>
              <strong style={{ color:"#777" }}>Dlaczego planowanie ze średniej jest błędem?</strong><br/>
              Rozkład log-normalny ma długi ogon po prawej — kilka bardzo długich operacji
              zawyża średnią znacznie powyżej mediany. Jeśli planujemy ze średniej,
              <span style={{ color:"#ff6b6b" }}> połowa operacji systematycznie przekracza plan</span> — nie z winy chirurga,
              ale z powodu złego narzędzia statystycznego.
              P50 (mediana) jest odporna na wartości odstające. P80 daje bufor bezpieczeństwa.
            </div>
          </div>

          {/* per-procedure sliders + comparison */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {Object.entries(DEFAULT_PROC_PARAMS).map(([proc, { mu, sigma }]) => {
              const color = PROC_COLORS[proc];
              const cell = matrix[proc]?.C ?? {};
              const mean = cell.mean ?? Math.round(lognormMean(mu, sigma));
              const p50  = cell.p50  ?? Math.round(lognormP50(mu, sigma));
              const p80  = cell.p80  ?? Math.round(lognormP80(mu, sigma));
              const offset = customOffsets[proc] ?? 0;
              const { curve } = buildPDFCurve(mu, sigma);

              // mark mean and p50 on chart
              const meanVal = Math.round(lognormMean(mu, sigma));
              const medVal  = Math.round(lognormP50(mu, sigma));
              const p80Val  = Math.round(lognormP80(mu, sigma));

              return (
                <div key={proc} className="card" style={{ borderTop:`2px solid ${color}` }}>
                  <div style={{ fontSize:13, fontWeight:600, color, marginBottom:12 }}>{proc}</div>

                  {/* comparison badges */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:14 }}>
                    {[
                      { label:"Średnia", val:`${mean}'`, color:"#ff6b6b", note:"zawyżona" },
                      { label:"P50 (mediana)", val:`${p50}'`, color:"#e07b39", note:"typowy" },
                      { label:"P80", val:`${p80}'`, color:"#6bcb77", note:"bezpieczny" },
                    ].map(b => (
                      <div key={b.label} style={{ background:"#0d0d14", borderRadius:6, padding:"8px 10px",
                        border:`1px solid ${planMode === (b.label==="Średnia"?"mean":b.label==="P80"?"p80":"p50") ? b.color+"66" : "#1e1e2a"}` }}>
                        <div style={{ fontSize:16, fontWeight:600, color:b.color, fontFamily:"'JetBrains Mono',monospace" }}>{b.val}</div>
                        <div style={{ fontSize:9, color:"#555", marginTop:2 }}>{b.label}</div>
                        <div style={{ fontSize:9, color:b.color+"99" }}>{b.note}</div>
                      </div>
                    ))}
                  </div>

                  {/* PDF z liniami dla średniej i P50 */}
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={curve} margin={{ top:8, right:4, bottom:0, left:-28 }}>
                      <defs>
                        <linearGradient id={`pg-${proc.replace(/\s/g,"")}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a26" vertical={false} />
                      <XAxis dataKey="x" tick={{ fontSize:9, fill:"#555" }} tickFormatter={v=>`${v}'`} interval="preserveStartEnd" />
                      <YAxis hide />
                      <ReferenceLine x={meanVal} stroke="#ff6b6b" strokeWidth={2} strokeDasharray="3 2"
                        label={{ value:`ś=${meanVal}'`, position:"top", fill:"#ff6b6b", fontSize:8 }} />
                      <ReferenceLine x={medVal} stroke="#e07b39" strokeWidth={2} strokeDasharray="5 2"
                        label={{ value:`P50=${medVal}'`, position:"top", fill:"#e07b39", fontSize:8 }} />
                      <ReferenceLine x={p80Val} stroke="#6bcb77" strokeWidth={1} strokeDasharray="2 3"
                        label={{ value:`P80=${p80Val}'`, position:"top", fill:"#6bcb77", fontSize:8 }} />
                      <Tooltip contentStyle={{ background:"#1a1a28", border:`1px solid ${color}40`, borderRadius:6, fontSize:10 }}
                        formatter={(v,n,p)=>[`${p.payload.x} min`,""]} labelFormatter={()=>""} />
                      <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2}
                        fill={`url(#pg-${proc.replace(/\s/g,"")})`} dot={false} activeDot={{ r:3, fill:color }} />
                    </AreaChart>
                  </ResponsiveContainer>

                  {/* custom offset slider — only shown in custom mode */}
                  {planMode === "custom" && (
                    <div style={{ marginTop:12, padding:"10px 12px", background:"#0d0d14", borderRadius:6 }}>
                      <Slider label={`Korekta planu (offset)`} value={offset} min={-20} max={30} step={5}
                        onChange={v => { setOffset(proc, v); setResults(simulate(DEFAULT_PLAN, procParams, matrix, "custom", {...customOffsets, [proc]:v})); }}
                        color={color} />
                      <div style={{ fontSize:10, color:"#555", marginTop:2 }}>
                        Baza P50 ({p50}') + {offset} = <span style={{ color, fontWeight:600 }}>{p50 + offset}'</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* diff table */}
          <div className="card">
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
              marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>
              Porównanie planów — różnica średnia vs P50 per chirurg × procedura
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>
                {["Chirurg","Procedura","Średnia","P50","P80","Różnica śr.−P50","Aktywny plan"].map(h=><th key={h}>{h}</th>)}
              </tr></thead>
              <tbody>
                {matrixRows.map((r,i) => {
                  const diff = r.mean - r.p50;
                  return (
                    <tr key={i}>
                      <td><span style={{ color:SURGEON_COLORS[r.surg], fontWeight:600 }}>{r.surg}</span></td>
                      <td style={{ color:"#888", fontSize:11 }}>{r.proc}</td>
                      <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#ff6b6b" }}>{r.mean}'</td>
                      <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#e07b39" }}>{r.p50}'</td>
                      <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#6bcb77" }}>{r.p80}'</td>
                      <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#ff9f43", fontWeight:600 }}>
                        +{diff}'
                      </td>
                      <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700,
                        color: MODE_CONFIG[planMode].color }}>{r.planned}'</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── BIAS tab ── */}
      {activeTab === "bias" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div className="card">
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase", marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>
              Średni błąd planowania per chirurg (min)
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={surgeonBias} margin={{ top:4,right:4,bottom:0,left:-10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a28" />
                <XAxis dataKey="surg" tick={{ fontSize:11, fill:"#666" }} />
                <YAxis tick={{ fontSize:10, fill:"#555" }} />
                <ReferenceLine y={0} stroke="#333" strokeWidth={1.5} />
                <Tooltip contentStyle={{ background:"#1a1a28", border:"1px solid #2a2a3a", borderRadius:6, fontSize:12 }}
                  formatter={v=>[`${v>0?"+":""}${v} min`,"Avg Δ"]} />
                <Bar dataKey="bias" radius={[4,4,0,0]}>
                  {surgeonBias.map((e,i)=><Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase", marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>
              Średni błąd planowania per procedura (min)
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={procBias} margin={{ top:4,right:4,bottom:0,left:-10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a28" />
                <XAxis dataKey="proc" tick={{ fontSize:11, fill:"#666" }} />
                <YAxis tick={{ fontSize:10, fill:"#555" }} />
                <ReferenceLine y={0} stroke="#333" strokeWidth={1.5} />
                <Tooltip contentStyle={{ background:"#1a1a28", border:"1px solid #2a2a3a", borderRadius:6, fontSize:12 }}
                  formatter={v=>[`${v>0?"+":""}${v} min`,"Avg Δ"]} />
                <Bar dataKey="bias" radius={[4,4,0,0]} fill="#4a9eff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card" style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase", marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>
              Plan vs Rzeczywistość — scatter
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top:4,right:4,bottom:0,left:-10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a28" />
                <XAxis dataKey="planned" name="Plan" type="number" tick={{ fontSize:10, fill:"#555" }} label={{ value:"Plan (min)", position:"insideBottom", offset:-2, fill:"#444", fontSize:10 }} />
                <YAxis dataKey="actual" name="Rzecz." type="number" tick={{ fontSize:10, fill:"#555" }} label={{ value:"Rzecz. (min)", angle:-90, position:"insideLeft", fill:"#444", fontSize:10 }} />
                <ReferenceLine segment={[{x:30,y:30},{x:130,y:130}]} stroke="#333" strokeDasharray="4 2" label={{ value:"Idealny plan", fill:"#333", fontSize:9 }} />
                <Tooltip cursor={{ strokeDasharray:"3 3" }}
                  contentStyle={{ background:"#1a1a28", border:"1px solid #2a2a3a", borderRadius:6, fontSize:11 }}
                  formatter={(v,n,p)=>[`${p.payload.actual} min`, p.payload.name]} />
                <Scatter data={scatterData}>
                  {scatterData.map((e,i)=><Cell key={i} fill={e.fill} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── MATRIX tab ── */}
      {activeTab === "matrix" && (
        <div className="card">
          <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase", marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>
            Macierz Chirurg × Procedura
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              {["Chirurg","Procedura","Średnia","P50","P80","Aktywny plan"].map(h=><th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {matrixRows.map((r,i) => (
                <tr key={i}>
                  <td><span style={{ color:SURGEON_COLORS[r.surg], fontWeight:600 }}>{r.surg}</span></td>
                  <td style={{ color:"#888", fontSize:11 }}>{r.proc}</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#ff6b6b" }}>{r.mean}'</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#e07b39" }}>{r.p50}'</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#6bcb77" }}>{r.p80}'</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700,
                    color:MODE_CONFIG[planMode].color }}>{r.planned}'</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PARAMS (rozkłady) tab ── */}
      {activeTab === "params" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {Object.entries(procParams).map(([proc, { mu, sigma }]) => {
            const color = PROC_COLORS[proc];
            const previewMedian = Math.round(Math.exp(mu));
            const previewP80 = Math.round(Math.exp(mu + 0.842 * sigma));
            const { curve } = buildPDFCurve(mu, sigma);
            const meanVal = Math.round(lognormMean(mu, sigma));
            return (
              <div key={proc} className="card" style={{ borderTop:`2px solid ${color}` }}>
                <div style={{ fontSize:13, fontWeight:600, color, marginBottom:4 }}>{proc}</div>
                <div style={{ fontSize:10, color:"#444", fontFamily:"'JetBrains Mono',monospace", marginBottom:14 }}>
                  mediana ≈ {previewMedian}' · średnia ≈ {meanVal}' · P80 ≈ {previewP80}'
                </div>
                <Slider label="μ (log-scale mean)" value={mu} min={3.5} max={5.0} step={0.01}
                  onChange={v => setParam(proc, "mu", v)} color={color} />
                <Slider label="σ (log-scale std)" value={sigma} min={0.10} max={0.60} step={0.01}
                  onChange={v => setParam(proc, "sigma", v)} color={color} />
                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:10, color:"#333", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6, fontFamily:"'JetBrains Mono',monospace" }}>
                    Rozkład — czerwona = średnia, pomarańcz. = mediana
                  </div>
                  <ResponsiveContainer width="100%" height={110}>
                    <AreaChart data={curve} margin={{ top:8, right:4, bottom:0, left:-28 }}>
                      <defs>
                        <linearGradient id={`grad-${proc.replace(/\s/g,"")}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a26" vertical={false} />
                      <XAxis dataKey="x" tick={{ fontSize:9, fill:"#555" }} tickFormatter={v=>`${v}'`} interval="preserveStartEnd" />
                      <YAxis hide />
                      <ReferenceLine x={meanVal} stroke="#ff6b6b" strokeWidth={2} strokeDasharray="3 2"
                        label={{ value:`śr=${meanVal}'`, position:"top", fill:"#ff6b6b", fontSize:8 }} />
                      <ReferenceLine x={previewMedian} stroke="#e07b39" strokeWidth={2} strokeDasharray="5 2"
                        label={{ value:`P50=${previewMedian}'`, position:"top", fill:"#e07b39", fontSize:8 }} />
                      <ReferenceLine x={previewP80} stroke="#6bcb77" strokeWidth={1} strokeDasharray="2 3"
                        label={{ value:`P80=${previewP80}'`, position:"top", fill:"#6bcb77", fontSize:8 }} />
                      <Tooltip contentStyle={{ background:"#1a1a28", border:`1px solid ${color}40`, borderRadius:6, fontSize:10 }}
                        formatter={(v,n,p)=>[`${p.payload.x} min`,""]} labelFormatter={()=>""} />
                      <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2}
                        fill={`url(#grad-${proc.replace(/\s/g,"")})`} dot={false} activeDot={{ r:3, fill:color }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ marginTop:10, background:"#0d0d14", borderRadius:6, padding:"10px 12px" }}>
                  {["A","B","C"].map(s => {
                    const cell = matrix[proc]?.[s];
                    return (
                      <div key={s} style={{ display:"flex", justifyContent:"space-between", marginBottom:3, fontSize:11 }}>
                        <span style={{ color:SURGEON_COLORS[s], fontWeight:600 }}>Chirurg {s}</span>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", color:"#888" }}>
                          śr {cell?.mean}' · P50 {cell?.p50}' · P80 {cell?.p80}'
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
