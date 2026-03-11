import { useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, ReferenceLine, CartesianGrid, AreaChart, Area } from "recharts";

// ── constants ──────────────────────────────────────────────────────────────
const START = 8 * 60;
const END = 16 * 60;
const PREP = 15;
const SIM_HISTORY = 200; // runs to generate historical P50/P80

const SURGEON_COLORS = { A: "#e07b39", B: "#4a9eff", C: "#a78bfa" };

// Procedure profiles: [mu, sigma] for log-normal — tuned so results feel realistic
// mu/sigma of the underlying normal (before exp). These give:
// Appendectomy  → median ~58min, P80 ~80min
// Cholecystectomy → median ~72min, P80 ~100min
// Hernia repair → median ~50min, P80 ~68min
const DEFAULT_PROC_PARAMS = {
  Appendectomy:    { mu: 4.06, sigma: 0.28 },
  Cholecystectomy: { mu: 4.28, sigma: 0.32 },
  "Hernia repair": { mu: 3.91, sigma: 0.26 },
};

// Surgeon skill factor (multiplier on drawn time)
const SURGEON_SKILL = { A: 0.92, B: 1.10, C: 1.00 };

const DEFAULT_PLAN = [
  { chir: "A", proc: "Appendectomy" },
  { chir: "B", proc: "Cholecystectomy" },
  { chir: "C", proc: "Appendectomy" },
  { chir: "A", proc: "Hernia repair" },
  { chir: "B", proc: "Appendectomy" },
  { chir: "C", proc: "Cholecystectomy" },
];

// ── math helpers ───────────────────────────────────────────────────────────
function randLognorm(mu, sigma) {
  const u1 = Math.random(), u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
  return Math.exp(mu + sigma * z);
}

// ── log-normal PDF for chart ───────────────────────────────────────────────
function lognormPDF(x, mu, sigma) {
  if (x <= 0) return 0;
  const lx = Math.log(x);
  return (1 / (x * sigma * Math.sqrt(2 * Math.PI))) *
    Math.exp(-((lx - mu) ** 2) / (2 * sigma ** 2));
}

function buildPDFCurve(mu, sigma, points = 80) {
  const median = Math.exp(mu);
  const xMin = Math.max(5, Math.round(median * 0.3));
  const xMax = Math.round(median * 2.8);
  const step = (xMax - xMin) / points;
  const data = [];
  let maxY = 0;
  for (let i = 0; i <= points; i++) {
    const x = xMin + i * step;
    const y = lognormPDF(x, mu, sigma);
    if (y > maxY) maxY = y;
    data.push({ x: Math.round(x), y });
  }
  // normalize to 0-100 for readability
  return { curve: data.map(d => ({ ...d, y: maxY > 0 ? (d.y / maxY) * 100 : 0 })), median, xMin, xMax };
}

function generateHistory(procParams, n = SIM_HISTORY) {
  // For each procedure × surgeon, draw n samples → compute P50, P80
  const matrix = {};
  for (const [proc, { mu, sigma }] of Object.entries(procParams)) {
    matrix[proc] = {};
    for (const [surg, skill] of Object.entries(SURGEON_SKILL)) {
      const samples = Array.from({ length: n }, () =>
        Math.round(randLognorm(mu, sigma) * skill)
      ).sort((a, b) => a - b);
      const p50 = samples[Math.floor(n * 0.5)];
      const p80 = samples[Math.floor(n * 0.8)];
      matrix[proc][surg] = { p50, p80 };
    }
  }
  return matrix;
}

function plannedFromMatrix(matrix, proc, surg) {
  // Plan = P50 rounded to nearest 5
  const p50 = matrix[proc]?.[surg]?.p50 ?? 60;
  return Math.round(p50 / 5) * 5;
}

function simulate(plan, procParams, matrix) {
  let t = START;
  return plan.map((op, idx) => {
    const { mu, sigma } = procParams[op.proc] ?? { mu: 4.06, sigma: 0.28 };
    const skill = SURGEON_SKILL[op.chir] ?? 1;
    const actual = Math.max(15, Math.round(randLognorm(mu, sigma) * skill));
    const planned = plannedFromMatrix(matrix, op.proc, op.chir);
    const startReal = Math.max(t, START);
    const endReal = startReal + actual;
    const delay = actual - planned;
    const row = {
      id: idx + 1,
      chir: op.chir,
      proc: op.proc,
      startPlan: t,
      endPlan: t + planned,
      startReal,
      endReal,
      planned,
      actual,
      delay,
    };
    t = endReal + PREP;
    return row;
  });
}

// ── formatting ─────────────────────────────────────────────────────────────
function minToTime(m) {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// ── sub-components ─────────────────────────────────────────────────────────
const DAY_W = END - START + 60;

function GanttRow({ row, width }) {
  const color = SURGEON_COLORS[row.chir];
  const pL = ((row.startPlan - START) / DAY_W) * width;
  const pW = Math.max((row.planned / DAY_W) * width, 3);
  const rL = ((row.startReal - START) / DAY_W) * width;
  const rW = Math.max((row.actual / DAY_W) * width, 3);
  return (
    <div style={{ position: "relative", height: 34, marginBottom: 5 }}>
      <div title={`Plan: ${minToTime(row.startPlan)}–${minToTime(row.endPlan)} (${row.planned}min)`}
        style={{ position: "absolute", left: pL, width: pW, height: 13, top: 1,
          border: `2px solid ${color}`, borderRadius: 3, opacity: 0.5 }} />
      <div title={`Rzecz.: ${minToTime(row.startReal)}–${minToTime(row.endReal)} (${row.actual}min)`}
        style={{ position: "absolute", left: rL, width: rW, height: 13, top: 18,
          background: color, borderRadius: 3, opacity: 0.88,
          ...(row.delay > 10 ? { outline: "2px solid #ff4d4d", outlineOffset: 1 } : {}) }} />
    </div>
  );
}

function TimeAxis({ width }) {
  return (
    <div style={{ position: "relative", height: 18, marginBottom: 2 }}>
      {Array.from({ length: 10 }, (_, i) => (8 + i) * 60).map(m => (
        <span key={m} style={{
          position: "absolute",
          left: ((m - START) / DAY_W) * width,
          transform: "translateX(-50%)",
          fontSize: 10, color: "#555", fontFamily: "monospace",
        }}>{minToTime(m)}</span>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "#888" }}>{label}</span>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: color ?? "#ccc" }}>{value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: color ?? "#e07b39", cursor: "pointer" }} />
    </div>
  );
}

// ── main app ───────────────────────────────────────────────────────────────
export default function ORSimV2() {
  const [procParams, setProcParams] = useState(DEFAULT_PROC_PARAMS);
  const [runs, setRuns] = useState(0);
  const [activeTab, setActiveTab] = useState("gantt"); // gantt | matrix | bias

  // regenerate history whenever procParams changes
  const matrix = useMemo(() => generateHistory(procParams), [procParams, runs]);

  const [results, setResults] = useState(() => {
    const m = generateHistory(DEFAULT_PROC_PARAMS);
    return simulate(DEFAULT_PLAN, DEFAULT_PROC_PARAMS, m);
  });

  const runSim = useCallback(() => {
    setRuns(r => r + 1);
    setResults(simulate(DEFAULT_PLAN, procParams, matrix));
  }, [procParams, matrix]);

  // ── derived stats ──────────────────────────────────────────────────────
  const totalDelay = results.reduce((a, r) => a + Math.max(0, r.delay), 0);
  const sumDelay = results.reduce((a, r) => a + r.delay, 0);
  const lastEnd = results.at(-1)?.endReal ?? END;
  const overtime = lastEnd > END;
  const efficiency = ((results.reduce((a,r)=>a+r.actual,0) + PREP*(results.length-1)) / (END-START)) * 100;

  // bias per surgeon
  const surgeonBias = Object.keys(SURGEON_COLORS).map(s => {
    const ops = results.filter(r => r.chir === s);
    const avg = ops.length ? ops.reduce((a,r)=>a+r.delay,0)/ops.length : 0;
    return { surg: s, bias: Math.round(avg * 10) / 10, fill: SURGEON_COLORS[s] };
  });

  // bias per procedure
  const procBias = Object.keys(DEFAULT_PROC_PARAMS).map(p => {
    const ops = results.filter(r => r.proc === p);
    const avg = ops.length ? ops.reduce((a,r)=>a+r.delay,0)/ops.length : 0;
    return { proc: p.replace(" repair",""), bias: Math.round(avg*10)/10 };
  });

  // matrix display data
  const matrixRows = Object.entries(matrix).flatMap(([proc, surgs]) =>
    Object.entries(surgs).map(([surg, { p50, p80 }]) => ({
      proc, surg, p50, p80,
      planned: plannedFromMatrix(matrix, proc, surg),
      slack: plannedFromMatrix(matrix, proc, surg) - p50,
    }))
  );

  // scatter: planned vs actual
  const scatterData = results.map(r => ({
    planned: r.planned, actual: r.actual,
    fill: SURGEON_COLORS[r.chir], name: `Op${r.id} ${r.chir}/${r.proc}`,
  }));

  const setParam = (proc, key, val) => {
    setProcParams(prev => ({ ...prev, [proc]: { ...prev[proc], [key]: val } }));
  };

  const PROC_COLORS = { Appendectomy: "#e07b39", Cholecystectomy: "#4a9eff", "Hernia repair": "#a78bfa" };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", color:"#ddd",
      fontFamily:"'Syne', sans-serif", padding:"28px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        input[type=range]{height:4px; border-radius:2px}
        .card{background:#111118; border:1px solid #1e1e2a; border-radius:10px; padding:18px 20px}
        .tab{padding:7px 16px; border-radius:6px; cursor:pointer; font-size:12px;
          font-weight:600; letter-spacing:0.05em; transition:all 0.15s; border:none;
          font-family:'Syne',sans-serif}
        .tab-active{background:#e07b39; color:#fff}
        .tab-inactive{background:transparent; color:#555; border:1px solid #252530}
        .tab-inactive:hover{color:#999; border-color:#444}
        th{font-size:10px; letter-spacing:0.08em; text-transform:uppercase;
          color:#444; font-weight:500; padding:4px 8px; text-align:left}
        td{padding:5px 8px; font-size:12px; border-bottom:1px solid #161620}
        .kpi-val{font-family:'JetBrains Mono',monospace; font-size:28px; font-weight:500; line-height:1}
        .kpi-lbl{font-size:10px; color:#555; letter-spacing:0.1em; text-transform:uppercase; margin-top:5px}
        ::-webkit-scrollbar{width:5px; height:5px}
        ::-webkit-scrollbar-track{background:#111}
        ::-webkit-scrollbar-thumb{background:#2a2a38; border-radius:3px}
      `}</style>

      {/* ── header ── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#333", textTransform:"uppercase",
            fontFamily:"'JetBrains Mono',monospace", marginBottom:6 }}>
            OR · Symulator Sali — v2
          </div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:"#f0ede8", letterSpacing:"-0.02em" }}>
            Błąd planowania & rozkład log-normalny
          </h1>
          <div style={{ fontSize:11, color:"#444", marginTop:4, fontFamily:"'JetBrains Mono',monospace" }}>
            Plan = P50 z {SIM_HISTORY} symulowanych historycznych operacji · run #{runs}
          </div>
        </div>
        <button onClick={runSim} style={{
          background:"linear-gradient(135deg,#e07b39,#c45e1a)",
          color:"#fff", border:"none", borderRadius:8,
          padding:"10px 24px", fontSize:13, fontWeight:700, cursor:"pointer",
          fontFamily:"'Syne',sans-serif", letterSpacing:"0.04em",
          transition:"transform 0.1s, opacity 0.15s",
        }}
          onMouseEnter={e=>e.target.style.opacity=0.85}
          onMouseLeave={e=>e.target.style.opacity=1}
        >▶ Uruchom</button>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
        {[
          { val: `${sumDelay > 0 ? "+" : ""}${sumDelay}'`, label:"Suma opóźnień", color: sumDelay>0?"#ff6b6b":sumDelay<0?"#6bcb77":"#888" },
          { val: `${totalDelay}'`,  label:"Skumulowane przekrocz.", color:"#ff9f43" },
          { val: `${efficiency.toFixed(1)}%`, label:"Efektywność sali", color: efficiency>=85?"#6bcb77":efficiency>=70?"#e0c039":"#ff6b6b" },
          { val: minToTime(lastEnd), label:"Koniec ostatniej op.", color: overtime?"#ff6b6b":"#6bcb77" },
          { val: `${results.filter(r=>r.delay>0).length}/${results.length}`, label:"Op. z przekroczeniem", color:"#a78bfa" },
        ].map(({ val, label, color }) => (
          <div key={label} className="card">
            <div className="kpi-val" style={{ color }}>{val}</div>
            <div className="kpi-lbl">{label}</div>
          </div>
        ))}
      </div>

      {/* ── tabs ── */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {[["gantt","Gantt"], ["bias","Błąd planowania"], ["matrix","Macierz P50/P80"], ["params","Parametry rozkładów"]].map(([k,lbl]) => (
          <button key={k} className={`tab ${activeTab===k?"tab-active":"tab-inactive"}`}
            onClick={()=>setActiveTab(k)}>{lbl}</button>
        ))}
      </div>

      {/* ── GANTT tab ── */}
      {activeTab === "gantt" && (
        <div className="card">
          <div style={{ display:"flex", gap:20, marginBottom:12, flexWrap:"wrap" }}>
            <div style={{ fontSize:10, color:"#444", display:"flex", gap:16 }}>
              {["A","B","C"].map(s => (
                <span key={s} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <span style={{ background:SURGEON_COLORS[s], width:10, height:10, borderRadius:2, display:"inline-block"}} />
                  <span style={{ color:"#777" }}>Chirurg {s}</span>
                </span>
              ))}
              <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ border:"2px solid #888", width:12, height:8, borderRadius:2, display:"inline-block"}} />
                <span style={{ color:"#777" }}>Plan</span>
              </span>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ background:"#888", width:12, height:8, borderRadius:2, display:"inline-block"}} />
                <span style={{ color:"#777" }}>Rzeczywiste</span>
              </span>
            </div>
          </div>
          <div style={{ overflowX:"auto" }}>
            <div style={{ minWidth:620 }}>
              <div style={{ display:"grid", gridTemplateColumns:"110px 1fr" }}>
                <div />
                <TimeAxis width={580} />
              </div>
              {results.map(row => (
                <div key={row.id} style={{ display:"grid", gridTemplateColumns:"110px 1fr", alignItems:"center" }}>
                  <div style={{ fontSize:10, color:"#666", fontFamily:"'JetBrains Mono',monospace", paddingRight:8 }}>
                    Op {row.id} · <span style={{ color:SURGEON_COLORS[row.chir] }}>{row.chir}</span>
                    <br /><span style={{ color:"#444", fontSize:9 }}>{row.proc}</span>
                  </div>
                  <GanttRow row={row} width={580} />
                </div>
              ))}
            </div>
          </div>
          {/* small table */}
          <table style={{ width:"100%", borderCollapse:"collapse", marginTop:16 }}>
            <thead><tr>
              {["Op","Chirurg","Procedura","Plan","Rzecz.","Δ (min)","Start","Koniec"].map(h=><th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace" }}>{r.id}</td>
                  <td><span style={{ color:SURGEON_COLORS[r.chir], fontWeight:600 }}>{r.chir}</span></td>
                  <td style={{ color:"#666", fontSize:11 }}>{r.proc}</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#777" }}>{r.planned}'</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace" }}>{r.actual}'</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", color: r.delay>0?"#ff6b6b":r.delay<0?"#6bcb77":"#888", fontWeight:600 }}>
                    {r.delay>0?"+":""}{r.delay}'
                  </td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#666" }}>{minToTime(r.startReal)}</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color: r.endReal>END?"#ff6b6b":"#666" }}>{minToTime(r.endReal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <XAxis dataKey="surg" tick={{ fontSize:11, fill:"#666", fontFamily:"JetBrains Mono" }} />
                <YAxis tick={{ fontSize:10, fill:"#555" }} />
                <ReferenceLine y={0} stroke="#333" strokeWidth={1.5} />
                <Tooltip contentStyle={{ background:"#1a1a28", border:"1px solid #2a2a3a", borderRadius:6, fontSize:12 }}
                  labelStyle={{ color:"#ccc" }} formatter={(v)=>[`${v>0?"+":""}${v} min`, "Avg Δ"]} />
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
                <XAxis dataKey="proc" tick={{ fontSize:11, fill:"#666", fontFamily:"JetBrains Mono" }} />
                <YAxis tick={{ fontSize:10, fill:"#555" }} />
                <ReferenceLine y={0} stroke="#333" strokeWidth={1.5} />
                <Tooltip contentStyle={{ background:"#1a1a28", border:"1px solid #2a2a3a", borderRadius:6, fontSize:12 }}
                  formatter={(v)=>[`${v>0?"+":""}${v} min`, "Avg Δ"]} />
                <Bar dataKey="bias" radius={[4,4,0,0]} fill="#4a9eff" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ gridColumn:"1/-1" }}>
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase", marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>
              Plan vs Rzeczywistość — scatter (każda operacja)
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ScatterChart margin={{ top:4,right:4,bottom:0,left:-10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a28" />
                <XAxis dataKey="planned" name="Plan" type="number" tick={{ fontSize:10, fill:"#555" }} label={{ value:"Plan (min)", position:"insideBottom", offset:-2, fill:"#444", fontSize:10 }} />
                <YAxis dataKey="actual" name="Rzecz." type="number" tick={{ fontSize:10, fill:"#555" }} label={{ value:"Rzecz. (min)", angle:-90, position:"insideLeft", fill:"#444", fontSize:10 }} />
                <ReferenceLine segment={[{x:30,y:30},{x:120,y:120}]} stroke="#333" strokeDasharray="4 2" label={{ value:"Idealny plan", fill:"#333", fontSize:9 }} />
                <Tooltip cursor={{ strokeDasharray:"3 3" }}
                  contentStyle={{ background:"#1a1a28", border:"1px solid #2a2a3a", borderRadius:6, fontSize:11 }}
                  formatter={(v,n,p)=>[`${p.payload.actual} min`, p.payload.name]} />
                <Scatter data={scatterData} fill="#e07b39">
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
          <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase", marginBottom:4, fontFamily:"'JetBrains Mono',monospace" }}>
            Macierz Chirurg × Procedura — P50 / P80 / Plan
          </div>
          <div style={{ fontSize:11, color:"#444", marginBottom:14 }}>
            Generowane z {SIM_HISTORY} symulowanych operacji per komórkę · Plan = P50 zaokrąglone do 5 min
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              {["Chirurg","Procedura","P50 hist.","P80 hist.","Plan (P50)","Zapas (Plan−P50)"].map(h=><th key={h}>{h}</th>)}
            </tr></thead>
            <tbody>
              {matrixRows.map((r,i) => (
                <tr key={i}>
                  <td><span style={{ color:SURGEON_COLORS[r.surg], fontWeight:600 }}>{r.surg}</span></td>
                  <td style={{ color:"#888", fontSize:11 }}>{r.proc}</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", color: PROC_COLORS[r.proc] }}>{r.p50}'</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#777" }}>{r.p80}'</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600 }}>{r.planned}'</td>
                  <td style={{ fontFamily:"'JetBrains Mono',monospace",
                    color: r.slack>0?"#6bcb77":r.slack<0?"#ff6b6b":"#888" }}>
                    {r.slack>0?"+":""}{r.slack}'
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PARAMS tab ── */}
      {activeTab === "params" && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {Object.entries(procParams).map(([proc, { mu, sigma }]) => {
            const color = PROC_COLORS[proc];
            const previewMedian = Math.round(Math.exp(mu));
            const previewP80 = Math.round(Math.exp(mu + 0.842 * sigma));
            const { curve, median, xMin, xMax } = buildPDFCurve(mu, sigma);
            const medianPoint = curve.reduce((best, d) => Math.abs(d.x - median) < Math.abs(best.x - median) ? d : best, curve[0]);

            // custom dot for median on chart
            const CustomDot = (props) => {
              const { cx, cy, payload } = props;
              if (Math.abs(payload.x - Math.round(median)) > (xMax - xMin) / curve.length * 1.5) return null;
              return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#0a0a0f" strokeWidth={2} />;
            };

            return (
              <div key={proc} className="card" style={{ borderTop:`2px solid ${color}` }}>
                <div style={{ fontSize:13, fontWeight:600, color, marginBottom:4 }}>{proc}</div>
                <div style={{ fontSize:10, color:"#444", fontFamily:"'JetBrains Mono',monospace", marginBottom:14 }}>
                  mediana ≈ {previewMedian} min · P80 ≈ {previewP80} min
                </div>
                <Slider label="μ (log-scale mean)" value={mu} min={3.5} max={5.0} step={0.01}
                  onChange={v => setParam(proc, "mu", v)} color={color} />
                <Slider label="σ (log-scale std)" value={sigma} min={0.10} max={0.60} step={0.01}
                  onChange={v => setParam(proc, "sigma", v)} color={color} />

                {/* PDF curve chart */}
                <div style={{ marginTop:14, marginBottom:4 }}>
                  <div style={{ fontSize:10, color:"#333", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6, fontFamily:"'JetBrains Mono',monospace" }}>
                    Rozkład czasu operacji
                  </div>
                  <ResponsiveContainer width="100%" height={110}>
                    <AreaChart data={curve} margin={{ top:6, right:4, bottom:0, left:-28 }}>
                      <defs>
                        <linearGradient id={`grad-${proc.replace(/\s/g,"")}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={color} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a26" vertical={false} />
                      <XAxis dataKey="x" tick={{ fontSize:9, fill:"#555", fontFamily:"JetBrains Mono" }}
                        tickFormatter={v => `${v}'`} interval="preserveStartEnd" />
                      <YAxis hide />
                      {/* median reference line */}
                      <ReferenceLine x={Math.round(median)} stroke={color} strokeWidth={1.5}
                        strokeDasharray="4 2"
                        label={{ value:`μ=${Math.round(median)}'`, position:"top", fill:color, fontSize:9, fontFamily:"JetBrains Mono" }} />
                      {/* P80 reference line */}
                      <ReferenceLine x={previewP80} stroke="#555" strokeWidth={1}
                        strokeDasharray="2 3"
                        label={{ value:`P80=${previewP80}'`, position:"top", fill:"#555", fontSize:9, fontFamily:"JetBrains Mono" }} />
                      <Tooltip
                        contentStyle={{ background:"#1a1a28", border:`1px solid ${color}40`, borderRadius:6, fontSize:10 }}
                        formatter={(v, n, p) => [`${p.payload.x} min`, "czas"]}
                        labelFormatter={() => ""}
                      />
                      <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2}
                        fill={`url(#grad-${proc.replace(/\s/g,"")})`}
                        dot={false} activeDot={{ r:3, fill:color }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ marginTop:10, background:"#0d0d14", borderRadius:6, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, color:"#333", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>
                    Macierz P50 per chirurg
                  </div>
                  {["A","B","C"].map(s => {
                    const cell = matrix[proc]?.[s];
                    return (
                      <div key={s} style={{ display:"flex", justifyContent:"space-between", marginBottom:3, fontSize:11 }}>
                        <span style={{ color:SURGEON_COLORS[s], fontWeight:600 }}>Chirurg {s}</span>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", color:"#888" }}>
                          P50 {cell?.p50}' · P80 {cell?.p80}'
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{ gridColumn:"1/-1" }}>
            <div style={{ background:"#0d0d14", border:"1px solid #1e1e2a", borderRadius:8, padding:"12px 16px", fontSize:11, color:"#555" }}>
              <strong style={{ color:"#666" }}>Jak działają parametry:</strong>
              {" "}Czas operacji losowany z rozkładu log-normalnego X ~ LN(μ, σ²), przemnożony przez
              współczynnik chirurga (A: 0.92 · B: 1.10 · C: 1.00).
              Plan = P50 zaokrąglony do 5 min z {SIM_HISTORY} symulowanych operacji historycznych.
              Zwiększenie σ → większy ogon rozkładu → więcej niespodziewanych przekroczeń.
              Pomarańczowa linia przerywana = mediana (μ), szara = P80.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
