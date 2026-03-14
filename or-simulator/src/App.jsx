import { useState, useMemo, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ReferenceLine, CartesianGrid, AreaChart, Area } from "recharts";

const START = 8 * 60, END = 16 * 60, PREP = 15, SIM_HISTORY = 200;
const SURGEON_COLORS = { A: "#e07b39", B: "#4a9eff", C: "#a78bfa" };
const PROC_COLORS = { Appendectomy: "#e07b39", Cholecystectomy: "#4a9eff", "Hernia Repair": "#a78bfa", "Major Surgery": "#ff2244" };
const SURGEONS = ["A", "B", "C"];
const PROCS = ["Appendectomy", "Cholecystectomy", "Hernia Repair", "Major Surgery"];

const DEFAULT_PROC_PARAMS = {
  Appendectomy:    { mu: 4.06, sigma: 0.28 },
  Cholecystectomy: { mu: 4.28, sigma: 0.32 },
  "Hernia Repair": { mu: 3.91, sigma: 0.26 },
  "Major Surgery": { mu: 5.00, sigma: 0.40 },
};
const SURGEON_SKILL = { A: 0.92, B: 1.10, C: 1.00 };

// ── i18n ──────────────────────────────────────────────────────────────────
const T = {
  pl: {
    subtitle: "OR · Symulator Sali — v5",
    title: "Symulacja Sali Operacyjnej",
    planMode: "Tryb planu",
    run: "run",
    help: "? Instrukcja",
    runBtn: "▶ Uruchom symulację",
    daysLabel: "Liczba dni",
    overtimeLabel: "Limit nadgodzin",
    kpi: {
      sumDelay: "Suma opóźnień",
      totalDelay: "Przekroczenia (suma)",
      efficiency: "Efektywność sali",
      efficiencyTip: "op. + przygotowania / czas dostępny",
      utilization: "Wykorzystanie sali",
      utilizationTip: "tylko czas operacji / czas dostępny",
      lastEnd: "Koniec ostatniej op.",
      overruns: "Op. z przekroczeniem",
      carryOver: "Carry-over (Day+1)",
      carryOverTip: "operacje przeniesione na następny dzień",
      startDelaySum: "Suma opoźn. startu",
      startDelaySumTip: "łączne opóźnienie pierwszej operacji przez wszystkie dni",
      sorTotal: "Przypadki ED (SOR)",
      sorTotalTip: "łączna liczba nieplanowanych przypadków z SOR / ED",
    },
    tabs: {
      schedule: "1. Plan dnia",
      planning: "2. Parametry planowania",
      params:   "3. Rozkłady czasów realizacji",
      gantt:    "4. Gantt (wyniki)",
      monte:    "5. Analiza Monte Carlo",
    },
    schedule: {
      title: "Zbuduj plan operacyjny",
      opsCount: "Liczba operacji / dzień",
      randomize: "🎲 Losuj plan",
      pool: "Przeciągnij procedurę →",
      slotSurgeon: "Chir.",
      remove: "✕",
      emptySlot: "Upuść tutaj",
      runBtn: "▶ Uruchom symulację →",
      hint: "Przeciągnij kafelek z lewej na slot. Przypisz chirurga.",
      disruptions: "Zakłócenia",
      enableDelay: "Opóźnienie startu pierwszej operacji",
      enableSor: "Nieplanowany przypadek z SOR",
    },
    gantt: {
      planLabel: "Plan —",
      actual: "Rzeczywistość",
      surgeon: "Chirurg",
      carryOver: "⚠ Carry-over",
      day: "Dzień",
      tableHeaders: ["Op","#Plan","Chir","Procedura","Plan","Start","Koniec (plan)","Rzecz.","Δ","Start real","Koniec real","Carry-over"],
    },
    planning: {
      modeTitle: "Tryb wyznaczania planu operacji",
      modes: {
        mean:   { label: "Średnia",       desc: "zawyżona przez długie operacje" },
        p50:    { label: "P50 (mediana)", desc: "50% operacji przekroczy plan" },
        p80:    { label: "P80",           desc: "tylko 20% przekroczy plan" },
        custom: { label: "Własny",        desc: "ręczna korekta per procedura" },
      },
      explainTitle: "Dlaczego planowanie ze średniej jest błędem?",
      explainBody: "Rozkład log-normalny ma długi ogon po prawej — kilka bardzo długich operacji zawyża średnią znacznie powyżej mediany. Jeśli planujemy ze średniej,",
      explainHighlight: " połowa operacji systematycznie przekracza plan",
      explainSuffix: " — nie z winy chirurga, ale z powodu złego narzędzia statystycznego. P50 (mediana) jest odporna na wartości odstające. P80 daje bufor bezpieczeństwa.",
      badges: { mean: "zawyżona", p50: "typowy", p80: "bezpieczny" },
      offsetLabel: "Korekta planu (offset)",
      offsetBase: "Baza P50",
      diffTitle: "Porównanie planów — różnica średnia vs P50 per chirurg × procedura",
      diffHeaders: ["Chirurg","Procedura","Średnia","P50","P80","Różnica śr.−P50","Aktywny plan"],
    },
    bias: {
      bySurgeon: "Średni błąd planowania per chirurg (min)",
      byProc: "Średni błąd planowania per procedura (min)",
      scatter: "Plan vs Rzeczywistość — scatter",
      idealPlan: "Idealny plan",
      avgDelta: "Śr. Δ",
    },
    matrix: {
      title: "Macierz Chirurg × Procedura",
      headers: ["Chirurg","Procedura","Średnia","P50","P80","Aktywny plan"],
    },
    params: {
      distLabel: "Rozkład — czerwona = średnia, pomarańcz. = P50",
      surgeon: "Chirurg",
      disruptTitle: "Parametry zakłóceń",
      delayTitle: "Opóźnienie startu",
      delayOnTime: "Prawdopodobieństwo startu na czas",
      delayMean: "Średnie opóźnienie gdy wystąpi (min)",
      sorTitle: "Przypadek z SOR",
      sorLambda: "Średnia liczba przypadków / dzień (λ)",
      sorDuration: "Średni czas operacji pilnej (min)",
      sorPriority: "Priorytet SOR",
      sorPriorityOptions: ["Wyprzedza planowe", "Na koniec dnia"],
      disruptOff: "Zakłócenia wyłączone — włącz w zakładce 1",
    },
    monte: {
      title: "Analiza Monte Carlo — porównanie strategii planowania",
      iterLabel: "Liczba iteracji",
      runBtn: "▶ Uruchom analizę",
      running: "Liczenie...",
      iterations: "iteracji",
      overtimeRate: "% dni z nadgodzinami",
      carryOverRate: "% dni z carry-over",
      avgDelay: "Średnie opóźnienie (min)",
      p80Delay: "P80 opóźnienia (min)",
      avgEnd: "Średni koniec dnia",
      modes: { mean: "Średnia", p50: "P50", p80: "P80", custom: "Własny" },
      histTitle: "Rozkład godziny końca dnia",
      summaryTitle: "Podsumowanie — 4 strategie planowania",
      headers: ["Strategia", "% nadgodzin", "% carry-over", "Śr. opóźnienie", "P80 opóźnienia", "Śr. koniec"],
      hint: "Zamrożony plan · różne realizacje losowe",
    },
    helpModal: {
      label: "Instrukcja obsługi",
      title: "Symulator Sali Operacyjnej",
      close: "Kliknij gdziekolwiek poza oknem aby zamknąć",
      steps: [
        { title: "1. Plan dnia", body: "Ustaw liczbę operacji / dzień (3–10) i liczbę dni (1–5) suwakami w nagłówku. Przeciągnij procedury z lewej na sloty lub kliknij '🎲 Losuj plan'. Przypisz chirurga każdej operacji. Na dole możesz włączyć zakłócenia: opóźnienie startu pierwszej operacji i/lub nieplanowany przypadek z SOR." },
        { title: "2. Parametry planowania", body: "Wybierz tryb wyznaczania planu: Średnia — błędne podejście, zawyżona przez długie operacje. P50 (mediana) — typowy czas, połowa operacji przekroczy plan. P80 — bezpieczniejszy, tylko 20% przekroczy plan. Własny — ręczna korekta per procedura." },
        { title: "3. Rozkłady czasów realizacji", body: "Suwaki μ (mu) i σ (sigma) zmieniają kształt rozkładu log-normalnego per procedura. Czerwona linia = średnia (zawyżona), pomarańczowa = P50 (typowy), zielona = P80 (bezpieczny). Gdy zakłócenia są włączone — na dole pojawia się sekcja parametrów zakłóceń." },
        { title: "4. Gantt (wyniki)", body: "Kliknij ▶ Uruchom w nagłówku lub w zakładce planu. Każde uruchomienie losuje nową realizację — plan pozostaje stały. Kolorowa ramka = plan, pełny pasek = rzeczywistość, czerwony = carry-over, przerywany = SOR. Opóźnienie startu widoczne jako ⏱ w nagłówku dnia." },
        { title: "5. Błąd planowania", body: "Wykresy pokazują średni błąd planowania per chirurg i per procedura. Scatter plot — punkty powyżej przekątnej = operacja dłuższa niż plan." },
        { title: "6. KPI", body: "Suma opóźnień, przekroczenia, efektywność i wykorzystanie sali liczone agregacyjnie przez wszystkie dni. Carry-over (Day+1) — łączna liczba operacji przesuniętych na następny dzień. Ustawienia są automatycznie zapamiętywane — odświeżenie strony nie kasuje planu." },
      ],
    },
  },
  en: {
    subtitle: "OR · Operating Room Simulator — v5",
    title: "Operating Room Simulator",
    planMode: "Plan mode",
    run: "run",
    help: "? Help",
    runBtn: "▶ Run simulation",
    daysLabel: "Number of days",
    overtimeLabel: "Overtime limit",
    kpi: {
      sumDelay: "Total delay",
      totalDelay: "Overruns (sum)",
      efficiency: "Room efficiency",
      efficiencyTip: "ops + prep time / available time",
      utilization: "Room utilization",
      utilizationTip: "ops time only / available time",
      lastEnd: "Last op. end",
      overruns: "Ops with overrun",
      carryOver: "Carry-over (Day+1)",
      carryOverTip: "operations moved to next day",
      startDelaySum: "Start delay (sum)",
      startDelaySumTip: "total first case start delay across all days",
      sorTotal: "ED (SOR) cases",
      sorTotalTip: "total unplanned emergency cases across all days",
    },
    tabs: {
      schedule: "1. Schedule",
      planning: "2. Planning params",
      params:   "3. Distribution of realization times",
      gantt:    "4. Gantt (results)",
      monte:    "5. Monte Carlo Analysis",
    },
    schedule: {
      title: "Build the operating schedule",
      opsCount: "Ops per day",
      randomize: "🎲 Randomize",
      pool: "Drag a procedure →",
      slotSurgeon: "Surg.",
      remove: "✕",
      emptySlot: "Drop here",
      runBtn: "▶ Run simulation →",
      hint: "Drag a tile from the left onto a slot. Assign a surgeon.",
      disruptions: "Disruptions",
      enableDelay: "First case start delay",
      enableSor: "Unplanned emergency (SOR)",
    },
    gantt: {
      planLabel: "Plan —",
      actual: "Actual",
      surgeon: "Surgeon",
      carryOver: "⚠ Carry-over",
      day: "Day",
      tableHeaders: ["Op","#Plan","Surg","Procedure","Plan","Start","End (plan)","Actual","Δ","Start real","End real","Carry-over"],
    },
    planning: {
      modeTitle: "Planning mode",
      modes: {
        mean:   { label: "Mean",          desc: "inflated by long outlier ops" },
        p50:    { label: "P50 (median)",  desc: "50% of ops will exceed plan" },
        p80:    { label: "P80",           desc: "only 20% will exceed plan" },
        custom: { label: "Custom",        desc: "manual offset per procedure" },
      },
      explainTitle: "Why planning from the mean is a mistake?",
      explainBody: "The log-normal distribution has a long right tail — a few very long operations inflate the mean well above the median. Planning from the mean means",
      explainHighlight: " half of operations systematically exceed the plan",
      explainSuffix: " — not due to surgeon error, but due to the wrong statistical tool. P50 (median) is robust to outliers. P80 provides a safety buffer.",
      badges: { mean: "inflated", p50: "typical", p80: "safe" },
      offsetLabel: "Plan offset (minutes)",
      offsetBase: "P50 base",
      diffTitle: "Plan comparison — mean vs P50 per surgeon × procedure",
      diffHeaders: ["Surgeon","Procedure","Mean","P50","P80","Diff mean−P50","Active plan"],
    },
    bias: {
      bySurgeon: "Average planning error per surgeon (min)",
      byProc: "Average planning error per procedure (min)",
      scatter: "Plan vs Actual — scatter",
      idealPlan: "Perfect plan",
      avgDelta: "Avg Δ",
    },
    matrix: {
      title: "Surgeon × Procedure matrix",
      headers: ["Surgeon","Procedure","Mean","P50","P80","Active plan"],
    },
    params: {
      distLabel: "Distribution — red = mean, orange = P50",
      surgeon: "Surgeon",
      disruptTitle: "Disruption parameters",
      delayTitle: "Start delay",
      delayOnTime: "Probability of on-time start",
      delayMean: "Mean delay when it occurs (min)",
      sorTitle: "Emergency case (SOR)",
      sorLambda: "Mean cases per day (λ)",
      sorDuration: "Mean emergency op duration (min)",
      sorPriority: "SOR priority",
      sorPriorityOptions: ["Preempts scheduled ops", "Added at end of day"],
      disruptOff: "Disruptions disabled — enable in tab 1",
    },
    monte: {
      title: "Monte Carlo Analysis — planning strategy comparison",
      iterLabel: "Number of iterations",
      runBtn: "▶ Run analysis",
      running: "Computing...",
      iterations: "iterations",
      overtimeRate: "% days with overtime",
      carryOverRate: "% days with carry-over",
      avgDelay: "Avg delay (min)",
      p80Delay: "P80 delay (min)",
      avgEnd: "Avg end of day",
      modes: { mean: "Mean", p50: "P50", p80: "P80", custom: "Custom" },
      histTitle: "Distribution of end-of-day time",
      summaryTitle: "Summary — 4 planning strategies",
      headers: ["Strategy", "% overtime", "% carry-over", "Avg delay", "P80 delay", "Avg end"],
      hint: "Frozen plan · random realizations",
    },
    helpModal: {
      label: "User guide",
      title: "Operating Room Simulator",
      close: "Click anywhere outside to close",
      steps: [
        { title: "1. Schedule", body: "Set ops per day (3–10) and number of days (1–5) using the header sliders. Drag procedure tiles onto slots or click '🎲 Randomize'. Assign a surgeon to each slot. At the bottom you can enable disruptions: first case start delay and/or unplanned emergency (SOR)." },
        { title: "2. Planning parameters", body: "Choose planning mode: Mean — incorrect approach, inflated by long ops. P50 (median) — typical time, half of ops will exceed plan. P80 — safer, only 20% will exceed. Custom — manual offset per procedure." },
        { title: "3. Distribution of realization times", body: "μ (mu) and σ (sigma) sliders change the log-normal distribution shape per procedure. Red = mean (inflated), orange = P50 (typical), green = P80 (safe). When disruptions are enabled, a parameter section appears below." },
        { title: "4. Gantt (results)", body: "Click ▶ Run in the header or schedule tab. Each run draws a new realization — the plan stays fixed. Colored outline = plan, solid bar = actual, red = carry-over, dashed = SOR emergency. Start delay shown as ⏱ in the day header." },
        { title: "5. Planning bias", body: "Charts show average planning error per surgeon and procedure. Scatter plot — points above the diagonal = operation longer than planned." },
        { title: "6. KPIs", body: "Total delay, overruns, efficiency and utilization are aggregated across all days. Carry-over (Day+1) — total ops moved to the next day. All settings are automatically saved — refreshing the page will not reset your plan." },
      ],
    },
  },
};

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

function getPlanned(matrix, proc, surg, planMode, customOffsets) {
  const cell = matrix[proc]?.[surg];
  if (!cell) return 60;
  let base;
  if (planMode === "mean") base = cell.mean;
  else if (planMode === "p80") base = cell.p80;
  else base = cell.p50;
  const offset = customOffsets?.[proc] ?? 0;
  return Math.max(10, Math.round((base + offset) / 5) * 5);
}

// ── Disruption helpers ────────────────────────────────────────────────────
function samplePoisson(lambda) {
  // Knuth algorithm
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function sampleStartDelay(onTimeProbability, meanDelay) {
  if (Math.random() < onTimeProbability) return 0;
  // exponential distribution: -meanDelay * ln(U)
  return Math.round(-meanDelay * Math.log(Math.max(Math.random(), 1e-10)));
}

// ── Multi-day simulation ──────────────────────────────────────────────────
function simulateMultiDay(plan, procParams, matrix, planMode, customOffsets, numDays, overtimeLimit, disruptions = {}) {
  const { enableDelay=false, delayOnTime=0.7, delayMean=20,
          enableSor=false, sorLambda=1, sorDuration=60, sorPriority="end" } = disruptions;
  const HARD_END = END + overtimeLimit;
  let carryQueue = [];
  let globalPlanId = 0;

  const days = [];

  for (let d = 0; d < numDays; d++) {
    // fresh plan ops get new continuous IDs each day
    const freshOps = plan.map((op) => ({ ...op, planId: ++globalPlanId, isCarryOver: false }));
    const todayPlan = [
      ...carryQueue.map(op => ({ ...op, isCarryOver: true })),
      ...freshOps,
    ];
    carryQueue = [];

    // ── start delay disruption ──
    const startDelay = enableDelay ? sampleStartDelay(delayOnTime, delayMean) : 0;

    // ── SOR cases for this day ──
    const sorCases = [];
    if (enableSor) {
      const nSor = samplePoisson(sorLambda);
      for (let s = 0; s < nSor; s++) {
        const arrivalMin = START + Math.floor(Math.random() * (END - START));
        const duration = Math.max(20, Math.round(-sorDuration * Math.log(Math.max(Math.random(), 1e-10))));
        sorCases.push({ arrivalMin, duration });
      }
      sorCases.sort((a, b) => a.arrivalMin - b.arrivalMin);
    }

    let tReal = START + startDelay;
    let tPlan = START;
    const rows = [];
    let overflowed = false;
    let sorQueue = [...sorCases]; // SOR cases not yet inserted

    for (let i = 0; i < todayPlan.length; i++) {
      const op = todayPlan[i];

      // ── insert SOR preempt cases that arrive before this op starts ──
      if (sorPriority === "preempt") {
        while (sorQueue.length > 0 && sorQueue[0].arrivalMin <= tReal) {
          const sor = sorQueue.shift();
          if (!overflowed && tReal + sor.duration <= HARD_END) {
            rows.push({
              id: rows.length + 1, planId: "SOR", dayIdx: d,
              chir: "SOR", proc: "Emergency (SOR)", isCarryOver: false, isSor: true,
              startPlan: tReal, endPlan: tReal + sor.duration,
              startReal: tReal, endReal: tReal + sor.duration,
              planned: sor.duration, actual: sor.duration, delay: 0,
            });
            tReal = tReal + sor.duration + PREP;
            tPlan = tReal;
          }
        }
      }

      const { mu, sigma } = procParams[op.proc] ?? { mu: 4.06, sigma: 0.28 };
      const skill = SURGEON_SKILL[op.chir] ?? 1;
      const actual = Math.max(15, Math.round(randLognorm(mu, sigma) * skill));
      const planned = getPlanned(matrix, op.proc, op.chir, planMode, customOffsets);

      const startReal = Math.max(tReal, START);
      const endReal = startReal + actual;
      const startPlan = tPlan;
      const endPlan = startPlan + planned;

      // carry-over if: already overflowed, OR planned end exceeds limit, OR actual end exceeds limit
      if (overflowed || endPlan > HARD_END || endReal > HARD_END) {
        overflowed = true;
        carryQueue.push({ proc: op.proc, chir: op.chir, planId: op.planId });
        continue;
      }

      rows.push({
        id: rows.length + 1,
        planId: op.planId,
        dayIdx: d,
        chir: op.chir,
        proc: op.proc,
        isCarryOver: op.isCarryOver,
        isSor: false,
        startDelay: i === 0 ? startDelay : 0,
        startPlan, endPlan,
        startReal, endReal,
        planned, actual,
        delay: actual - planned,
      });

      tReal = endReal + PREP;
      tPlan = endPlan + PREP;
    }

    // ── append SOR cases at end of day if priority = "end" ──
    if (sorPriority === "end") {
      for (const sor of sorQueue.length > 0 ? sorCases : []) {
        if (!overflowed && tReal + sor.duration <= HARD_END) {
          rows.push({
            id: rows.length + 1, planId: "SOR", dayIdx: d,
            chir: "SOR", proc: "Emergency (SOR)", isCarryOver: false, isSor: true,
            startPlan: tReal, endPlan: tReal + sor.duration,
            startReal: tReal, endReal: tReal + sor.duration,
            planned: sor.duration, actual: sor.duration, delay: 0,
          });
          tReal = tReal + sor.duration + PREP;
        }
      }
    }

    days.push({
      dayIdx: d,
      rows,
      carryOverCount: carryQueue.length,
      lastEnd: rows.at(-1)?.endReal ?? START,
      startDelay,
      sorCount: sorCases.length,
    });
  }

  return days;
}

function minToTime(m) {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  return `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
}

// ── Gantt ──────────────────────────────────────────────────────────────────
const DAY_W = END - START + 60;
function px(min, width) { return ((min - START) / DAY_W) * width; }

function GanttRow({ row, width, planColor }) {
  const isSor = row.isSor;
  const color = isSor ? "#ff2244" : row.isCarryOver ? "#ff2244" : SURGEON_COLORS[row.chir];
  const pL = px(row.startPlan, width), pW = Math.max((row.planned / DAY_W) * width, 3);
  const rL = px(row.startReal, width), rW = Math.max((row.actual / DAY_W) * width, 3);
  return (
    <div style={{ position:"relative", height:32, marginBottom:4 }}>
      {!isSor && (
        <div title={`Plan #${row.planId ?? "—"} · Plan (${row.planned} min): ${minToTime(row.startPlan)}–${minToTime(row.endPlan)}`} style={{
          position:"absolute", left:pL, width:pW, height:13, top:1,
          border:`2px solid ${row.isCarryOver ? "#ff2244" : planColor}`,
          borderRadius:3, opacity:0.8,
        }} />
      )}
      <div title={`${isSor ? "🚨 SOR Emergency" : `Plan #${row.planId ?? "—"}`} · ${minToTime(row.startReal)}–${minToTime(row.endReal)} (${row.actual} min)${row.isCarryOver ? " · CARRY-OVER" : ""}${row.startDelay > 0 ? ` · Start delay: ${row.startDelay}'` : ""}`} style={{
        position:"absolute", left:rL, width:rW, height: isSor ? 28 : 13, top: isSor ? 2 : 17,
        background: isSor ? "#ff224488" : color,
        border: isSor ? "2px dashed #ff2244" : "none",
        borderRadius:3, opacity: row.isCarryOver ? 1 : 0.9,
        ...(row.delay > 10 && !isSor ? { outline:"2px solid #ff4d4d", outlineOffset:1 } : {}),
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

// ── Schedule Builder ──────────────────────────────────────────────────────
function buildRandomPlan(n) {
  return Array.from({ length: n }, () => ({
    proc: PROCS[Math.floor(Math.random() * PROCS.length)],
    chir: SURGEONS[Math.floor(Math.random() * SURGEONS.length)],
  }));
}
function buildEmptySlots(n) {
  return Array.from({ length: n }, () => ({ proc: null, chir: "A" }));
}

function MiniGantt({ slots, matrix, planMode, customOffsets, planColor, numDays }) {
  const filledSlots = slots.filter(s => s.proc !== null);
  if (filledSlots.length === 0) return null;
  const W = 460;
  // build bars per day — same plan repeats each day, LP is continuous
  const days = Array.from({ length: numDays }, (_, d) => {
    let t = START;
    const bars = filledSlots.map((s, i) => {
      const dur = getPlanned(matrix, s.proc, s.chir, planMode, customOffsets);
      const start = t; const end = t + dur;
      t = end + PREP;
      const lp = d * filledSlots.length + i + 1; // continuous LP
      return { ...s, start, end, dur, lp };
    });
    const lastEnd = bars[bars.length - 1].end;
    return { d, bars, lastEnd, overtime: lastEnd > END };
  });

  return (
    <div style={{ marginTop:20, background:"#0a0a0f", borderRadius:8, padding:"14px 16px", border:"1px solid #1e1e2a" }}>
      <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
        fontFamily:"'JetBrains Mono',monospace", marginBottom:12 }}>
        Plan preview · {planMode.toUpperCase()} · {numDays} {numDays === 1 ? "day" : "days"}
      </div>
      {days.map(({ d, bars, lastEnd, overtime }) => (
        <div key={d} style={{ marginBottom:14 }}>
          {/* day header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <span style={{ fontSize:10, color:"#e07b39", fontWeight:700, fontFamily:"'Syne',sans-serif" }}>Day {d + 1}</span>
            <span style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", color: overtime ? "#ff6b6b" : "#6bcb77" }}>
              {minToTime(lastEnd)}{overtime ? " ⚠" : " ✓"}
            </span>
          </div>
          {/* time axis */}
          <div style={{ position:"relative", height:14, marginBottom:2 }}>
            {Array.from({ length: 9 }, (_, i) => (8 + i) * 60).map(m => (
              <span key={m} style={{ position:"absolute", left:((m-START)/DAY_W)*W,
                transform:"translateX(-50%)", fontSize:8, color:"#333", fontFamily:"monospace" }}>
                {minToTime(m)}
              </span>
            ))}
          </div>
          {/* bars row */}
          <div style={{ position:"relative", height:22 }}>
            <div style={{ position:"absolute", left:((END-START)/DAY_W)*W, top:0, bottom:0, width:1, background:"#ff6b6b33" }} />
            {bars.map((bar) => {
              const color = PROC_COLORS[bar.proc] ?? "#888";
              const bL = ((bar.start-START)/DAY_W)*W;
              const bW = Math.max((bar.dur/DAY_W)*W, 4);
              const isOver = bar.end > END;
              return (
                <div key={bar.lp}
                  title={`#${bar.lp} · ${bar.proc} · Surg ${bar.chir} · ${minToTime(bar.start)}–${minToTime(bar.end)} (${bar.dur}')`}
                  style={{ position:"absolute", top:0, height:20, left:bL, width:bW,
                    background:`${color}33`, border:`1.5px solid ${color}`, borderRadius:4,
                    ...(isOver ? { outline:"1.5px solid #ff4d4d", outlineOffset:1 } : {}),
                  }}>
                  <span style={{ position:"absolute", left:3, top:"50%", transform:"translateY(-50%)",
                    fontSize:8, fontFamily:"'JetBrains Mono',monospace", whiteSpace:"nowrap",
                    color: SURGEON_COLORS[bar.chir], fontWeight:600 }}>#{bar.lp} {bar.dur}'</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleBuilder({ slots, setSlots, opsCount, setOpsCount, onRun, t, matrix, planMode, customOffsets, planColor, numDays }) {
  const [dragProc, setDragProc] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [dragSlotIdx, setDragSlotIdx] = useState(null);

  const handleDrop = (idx) => {
    if (!dragProc) return;
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, proc: dragProc } : s));
    setDragProc(null); setDragOverIdx(null);
  };
  const handleSlotDrop = (idx) => {
    if (dragSlotIdx === null || dragSlotIdx === idx) return;
    setSlots(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragSlotIdx, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    setDragSlotIdx(null); setDragOverIdx(null);
  };

  const readyCount = slots.filter(s => s.proc !== null).length;
  const allReady = readyCount === slots.length;

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:16 }}>
        {/* left: pool */}
        <div>
          <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase", marginBottom:10, fontFamily:"'JetBrains Mono',monospace" }}>{t.pool}</div>
          {PROCS.map(proc => {
            const color = PROC_COLORS[proc];
            const p50 = matrix[proc]?.C?.p50 ?? Math.round(Math.exp(DEFAULT_PROC_PARAMS[proc]?.mu ?? 4.06));
            return (
              <div key={proc} draggable
                onDragStart={() => setDragProc(proc)}
                onDragEnd={() => { setDragProc(null); setDragOverIdx(null); }}
                style={{ background:`${color}18`, border:`1px solid ${color}55`, borderRadius:8, padding:"9px 12px", marginBottom:8, cursor:"grab", userSelect:"none", display:"flex", justifyContent:"space-between", alignItems:"center", transform: dragProc===proc ? "scale(0.97)" : "scale(1)", transition:"transform 0.1s" }}>
                <span style={{ fontSize:12, fontWeight:600, color }}>{proc}</span>
                <span style={{ fontSize:10, color:`${color}99`, fontFamily:"'JetBrains Mono',monospace" }}>~{p50}'</span>
              </div>
            );
          })}
          <div style={{ marginTop:12, fontSize:10, color:"#333", lineHeight:1.6, fontFamily:"'JetBrains Mono',monospace" }}>{t.hint}</div>
        </div>

        {/* right: slots */}
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
            <span style={{ fontSize:11, color:"#888", whiteSpace:"nowrap" }}>{t.opsCount}:</span>
            <input type="range" min={3} max={10} step={1} value={opsCount}
              onChange={e => {
                const n = parseInt(e.target.value);
                setOpsCount(n);
                setSlots(prev => n > prev.length
                  ? [...prev, ...buildRandomPlan(n - prev.length)]
                  : prev.slice(0, n));
              }}
              style={{ flex:1, accentColor:"#e07b39", cursor:"pointer" }} />
            <span style={{ fontSize:16, fontWeight:700, color:"#e07b39", fontFamily:"'JetBrains Mono',monospace", minWidth:20, textAlign:"center" }}>{opsCount}</span>
          </div>

          <div style={{ display:"grid", gap:5 }}>
            {slots.map((slot, idx) => {
              const color = slot.proc ? PROC_COLORS[slot.proc] : "#333";
              const isOver = dragOverIdx === idx;
              const dur = slot.proc ? getPlanned(matrix, slot.proc, slot.chir, planMode, customOffsets) : null;
              return (
                <div key={idx}
                  onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={() => { if (dragSlotIdx !== null) handleSlotDrop(idx); else handleDrop(idx); }}
                  draggable={slot.proc !== null}
                  onDragStart={() => setDragSlotIdx(idx)}
                  onDragEnd={() => { setDragSlotIdx(null); setDragOverIdx(null); }}
                  style={{ display:"grid", gridTemplateColumns:"24px 1fr 48px 100px 28px", alignItems:"center", gap:7, background: isOver?"#1a1a2a":"#111118", border:`1px solid ${isOver?"#e07b39":(slot.proc?color+"44":"#1e1e2a")}`, borderRadius:7, padding:"7px 10px", transition:"border-color 0.15s, background 0.15s", cursor: slot.proc?"grab":"default" }}>
                  <span style={{ fontSize:11, color:"#444", fontFamily:"'JetBrains Mono',monospace", textAlign:"center" }}>{idx+1}</span>
                  {slot.proc
                    ? <span style={{ fontSize:12, fontWeight:600, color }}>{slot.proc}</span>
                    : <span style={{ fontSize:11, color:"#333", fontStyle:"italic" }}>{t.emptySlot}</span>}
                  <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color: dur?`${color}cc`:"#333", textAlign:"right" }}>{dur?`${dur}'`:"—"}</span>
                  <select value={slot.chir}
                    onChange={e => setSlots(prev => prev.map((s,i) => i===idx?{...s,chir:e.target.value}:s))}
                    style={{ background:"#0d0d14", border:"1px solid #252530", borderRadius:6, color:SURGEON_COLORS[slot.chir], padding:"4px 6px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>
                    {SURGEONS.map(s => <option key={s} value={s}>{t.slotSurgeon} {s}</option>)}
                  </select>
                  <button onClick={() => setSlots(prev => prev.map((s,i) => i===idx?{...s,proc:null}:s))}
                    style={{ background:"transparent", border:"none", color:"#333", cursor:"pointer", fontSize:14, padding:0, lineHeight:1 }}>{t.remove}</button>
                </div>
              );
            })}
          </div>

          <button onClick={onRun} disabled={!allReady} style={{ marginTop:14, width:"100%", padding:"11px", background: allReady?"linear-gradient(135deg,#e07b39,#c45e1a)":"#1a1a24", color: allReady?"#fff":"#444", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor: allReady?"pointer":"not-allowed", fontFamily:"'Syne',sans-serif", transition:"all 0.2s" }}>
            {allReady ? t.runBtn : `${readyCount}/${slots.length} procedur przypisanych`}
          </button>
        </div>
      </div>
      <MiniGantt slots={slots} matrix={matrix} planMode={planMode} customOffsets={customOffsets} planColor={planColor} numDays={numDays} />
    </div>
  );
}

// ── Multi-day Gantt display ───────────────────────────────────────────────
function MultiDayGantt({ days, planColor, t }) {
  const W = 560;
  return (
    <div>
      {days.map(({ dayIdx, rows, lastEnd, startDelay, sorCount }) => {
        const overtime = lastEnd > END;
        const carryOvers = rows.filter(r => r.isCarryOver).length;
        return (
          <div key={dayIdx} style={{ marginBottom:20 }}>
            {/* day header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#e07b39", fontFamily:"'Syne',sans-serif", letterSpacing:"0.05em" }}>
                  {t.day} {dayIdx + 1}
                </span>
                {carryOvers > 0 && (
                  <span style={{ fontSize:10, color:"#ff2244", fontFamily:"'JetBrains Mono',monospace", background:"#ff224422", padding:"2px 7px", borderRadius:4 }}>
                    {t.carryOver}: {carryOvers}
                  </span>
                )}
                {startDelay > 0 && (
                  <span style={{ fontSize:10, color:"#ff9f43", fontFamily:"'JetBrains Mono',monospace", background:"#ff9f4322", padding:"2px 7px", borderRadius:4 }}>
                    ⏱ +{startDelay}'
                  </span>
                )}
                {sorCount > 0 && (
                  <span style={{ fontSize:10, color:"#ff2244", fontFamily:"'JetBrains Mono',monospace", background:"#ff224422", padding:"2px 7px", borderRadius:4 }}>
                    🚨 SOR ×{sorCount}
                  </span>
                )}
              </div>
              <div style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color: overtime?"#ff6b6b":"#6bcb77" }}>
                {minToTime(lastEnd)}{overtime ? " ⚠" : " ✓"}
              </div>
            </div>
            {/* axis + rows */}
            <div style={{ overflowX:"auto" }}>
              <div style={{ minWidth:700 }}>
                <div style={{ display:"grid", gridTemplateColumns:"120px 1fr" }}>
                  <div /><TimeAxis width={W} />
                </div>
                {/* end-of-day line */}
                <div style={{ position:"relative" }}>
                  <div style={{ position:"absolute", left: 120 + px(END, W), top:0, bottom:0, width:1, background:"#ff6b6b44", zIndex:1 }} />
                  {rows.map(row => (
                    <div key={row.id} style={{ display:"grid", gridTemplateColumns:"120px 1fr", alignItems:"center" }}>
                      <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", paddingRight:8,
                        color: row.isSor ? "#ff2244" : row.isCarryOver ? "#ff2244" : "#666" }}>
                        {row.isSor && <span style={{ fontSize:9, color:"#ff2244" }}>🚨 </span>}
                        {row.isCarryOver && !row.isSor && <span style={{ fontSize:9, color:"#ff2244" }}>↩ </span>}
                        {row.startDelay > 0 && <span style={{ fontSize:9, color:"#ff9f43" }}>⏱ </span>}
                        <span style={{ color: row.isSor ? "#ff2244" : "#555" }}>#{row.planId ?? "—"} </span>
                        Op {row.id} · <span style={{ color: row.isSor ? "#ff2244" : row.isCarryOver ? "#ff2244" : SURGEON_COLORS[row.chir] }}>{row.chir}</span>
                        <br /><span style={{ color:"#444", fontSize:9 }}>{row.proc}</span>
                      </div>
                      <GanttRow row={row} width={W} planColor={planColor} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── localStorage hook ─────────────────────────────────────────────────────
function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });
  const setStored = (val) => {
    setValue(prev => {
      const next = typeof val === "function" ? val(prev) : val;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  return [value, setStored];
}

// ── main ──────────────────────────────────────────────────────────────────
export default function ORSimV5() {
  const [procParams, setProcParams]     = useLocalStorage("or_procParams", DEFAULT_PROC_PARAMS);
  const [planMode, setPlanMode]         = useLocalStorage("or_planMode", "mean");
  const [customOffsets, setCustomOffsets] = useLocalStorage("or_offsets", { Appendectomy:0, Cholecystectomy:0, "Hernia Repair":0, "Major Surgery":0 });
  const [lang, setLang]                 = useLocalStorage("or_lang", "pl");
  const [numDays, setNumDays]           = useLocalStorage("or_numDays", 3);
  const [overtimeLimit, setOvertimeLimit] = useLocalStorage("or_overtime", 240);
  const [opsCount, setOpsCount]         = useLocalStorage("or_opsCount", 6);
  const [slots, setSlots]               = useLocalStorage("or_slots", buildRandomPlan(6));

  // disruption state
  const [enableDelay, setEnableDelay]   = useLocalStorage("or_enableDelay", false);
  const [delayOnTime, setDelayOnTime]   = useLocalStorage("or_delayOnTime", 0.7);
  const [delayMean, setDelayMean]       = useLocalStorage("or_delayMean", 20);
  const [enableSor, setEnableSor]       = useLocalStorage("or_enableSor", false);
  const [sorLambda, setSorLambda]       = useLocalStorage("or_sorLambda", 1);
  const [sorDuration, setSorDuration]   = useLocalStorage("or_sorDuration", 60);
  const [sorPriority, setSorPriority]   = useLocalStorage("or_sorPriority", "end");

  const [runs, setRuns] = useState(0);
  const [activeTab, setActiveTab] = useState("schedule");
  const [showHelp, setShowHelp] = useState(false);

  const t = T[lang];
  const matrix = useMemo(() => generateHistory(procParams), [procParams]);

  const initDays = useMemo(() => {
    const m = generateHistory(DEFAULT_PROC_PARAMS);
    return simulateMultiDay(buildRandomPlan(6), DEFAULT_PROC_PARAMS, m, "mean", {}, 3, 60);
  }, []);
  const [days, setDays] = useState(initDays);

  const disruptions = { enableDelay, delayOnTime, delayMean, enableSor, sorLambda, sorDuration, sorPriority };

  const runSim = useCallback(() => {
    const validPlan = slots.filter(s => s.proc !== null);
    if (validPlan.length === 0) return;
    setRuns(r => r + 1);
    setDays(simulateMultiDay(validPlan, procParams, matrix, planMode, customOffsets, numDays, overtimeLimit, disruptions));
    setActiveTab("gantt");
  }, [slots, procParams, matrix, planMode, customOffsets, numDays, overtimeLimit, enableDelay, delayOnTime, delayMean, enableSor, sorLambda, sorDuration, sorPriority]);

  const handleModeChange = (mode) => {
    setPlanMode(mode);
    const validPlan = slots.filter(s => s.proc !== null);
    setDays(simulateMultiDay(validPlan, procParams, matrix, mode, customOffsets, numDays, overtimeLimit, disruptions));
  };

  const [mcIterations, setMcIterations] = useLocalStorage("or_mcIter", 500);
  const [mcResults, setMcResults] = useState(null);
  const [mcRunning, setMcRunning] = useState(false);

  const runMonteCarlo = useCallback(() => {
    const validPlan = slots.filter(s => s.proc !== null);
    if (validPlan.length === 0) return;
    setMcRunning(true);
    setMcResults(null);

    // run async to allow UI to update
    setTimeout(() => {
      const modes = ["mean", "p50", "p80", "custom"];

      const results = {};
      for (const mode of modes) {
        const endTimes = [], delays = [], overtimeDays = [], carryDays = [];
        const overtimeMins = [], carryOvers = [], efficiencies = [], utilizations = [], opsMins = [];
        for (let i = 0; i < mcIterations; i++) {
          const sim = simulateMultiDay(validPlan, procParams, matrix, mode, customOffsets, numDays, overtimeLimit, disruptions);
          const allR = sim.flatMap(d => d.rows);
          const lastE = sim.at(-1)?.lastEnd ?? END;
          const totalD = allR.reduce((a, r) => a + Math.max(0, r.delay), 0);
          const hasOT = sim.some(d => d.lastEnd > END);
          const hasCO = sim.some(d => d.carryOverCount > 0);
          const totalCO = sim.slice(0, -1).reduce((a, d) => a + d.carryOverCount, 0);
          const totalOTMin = sim.reduce((a, d) => a + Math.max(0, d.lastEnd - END), 0);
          const eff = allR.length
            ? ((allR.reduce((a,r)=>a+r.actual,0) + PREP*(allR.length-1)) / ((END-START)*numDays)) * 100 : 0;
          const util = allR.length
            ? (allR.reduce((a,r)=>a+r.actual,0) / ((END-START)*numDays)) * 100 : 0;
          const opsMin = allR.length ? Math.round(allR.reduce((a,r)=>a+r.actual,0) / numDays) : 0;
          endTimes.push(lastE);
          delays.push(totalD);
          overtimeDays.push(hasOT ? 1 : 0);
          carryDays.push(hasCO ? 1 : 0);
          overtimeMins.push(totalOTMin);
          carryOvers.push(totalCO);
          efficiencies.push(eff);
          utilizations.push(util);
          opsMins.push(opsMin);
        }
        endTimes.sort((a, b) => a - b);
        delays.sort((a, b) => a - b);
        results[mode] = {
          overtimeRate: Math.round(overtimeDays.reduce((a,b)=>a+b,0) / mcIterations * 100),
          carryOverRate: Math.round(carryDays.reduce((a,b)=>a+b,0) / mcIterations * 100),
          avgDelay: Math.round(delays.reduce((a,b)=>a+b,0) / mcIterations),
          p80Delay: delays[Math.floor(mcIterations * 0.8)],
          avgEnd: Math.round(endTimes.reduce((a,b)=>a+b,0) / mcIterations),
          avgOvertimeMin: Math.round(overtimeMins.reduce((a,b)=>a+b,0) / mcIterations),
          avgCarryOver: numDays > 1 ? Math.round(carryOvers.reduce((a,b)=>a+b,0) / mcIterations / (numDays-1) * 10) / 10 : 0,
          worstEnd: Math.max(...endTimes),
          avgEfficiency: Math.round(efficiencies.reduce((a,b)=>a+b,0) / mcIterations * 10) / 10,
          avgUtilization: Math.round(utilizations.reduce((a,b)=>a+b,0) / mcIterations * 10) / 10,
          avgOpsMin: Math.round(opsMins.reduce((a,b)=>a+b,0) / mcIterations),
          endTimes,
        };
      }
      setMcResults(results);
      setMcRunning(false);
    }, 50);
  }, [slots, procParams, matrix, customOffsets, numDays, overtimeLimit, disruptions, mcIterations]);

  const handleRandomize = () => setSlots(buildRandomPlan(opsCount));

  const setParam = (proc, key, val) =>
    setProcParams(prev => ({ ...prev, [proc]: { ...prev[proc], [key]: val } }));
  const setOffset = (proc, val) =>
    setCustomOffsets(prev => ({ ...prev, [proc]: val }));

  // ── KPIs (aggregate across all days) ──
  const allRows = days.flatMap(d => d.rows);
  const sumDelay   = allRows.reduce((a, r) => a + r.delay, 0);
  const totalDelay = allRows.reduce((a, r) => a + Math.max(0, r.delay), 0);
  const lastEnd    = days.at(-1)?.lastEnd ?? END;
  const overtime   = lastEnd > END;
  const efficiency = allRows.length
    ? ((allRows.reduce((a,r)=>a+r.actual,0) + PREP*(allRows.length-1)) / ((END-START)*numDays)) * 100 : 0;
  const utilization = allRows.length
    ? (allRows.reduce((a,r)=>a+r.actual,0) / ((END-START)*numDays)) * 100 : 0;
  const totalCarryOver = days.reduce((a, d) => a + d.rows.filter(r => r.isCarryOver).length, 0);
  const startDelaySum  = days.reduce((a, d) => a + (d.startDelay ?? 0), 0);
  const sorTotal       = days.reduce((a, d) => a + (d.sorCount ?? 0), 0);

  const surgeonBias = Object.keys(SURGEON_COLORS).map(s => {
    const ops = allRows.filter(r => r.chir === s);
    const avg = ops.length ? ops.reduce((a,r)=>a+r.delay,0)/ops.length : 0;
    return { surg: s, bias: Math.round(avg*10)/10, fill: SURGEON_COLORS[s] };
  });
  const procBias = Object.keys(DEFAULT_PROC_PARAMS).map(p => {
    const ops = allRows.filter(r => r.proc === p);
    const avg = ops.length ? ops.reduce((a,r)=>a+r.delay,0)/ops.length : 0;
    return { proc: p.replace("Hernia Repair","Hernia"), bias: Math.round(avg*10)/10 };
  });
  const matrixRows = Object.entries(matrix).flatMap(([proc, surgs]) =>
    Object.entries(surgs).map(([surg, { p50, p80, mean }]) => ({
      proc, surg, p50, p80, mean,
      planned: getPlanned(matrix, proc, surg, planMode, customOffsets),
    }))
  );
  const scatterData = allRows.map(r => ({
    planned: r.planned, actual: r.actual,
    fill: r.isCarryOver ? "#ff2244" : SURGEON_COLORS[r.chir], name: `Op${r.id} D${r.dayIdx+1} ${r.chir}`,
  }));

  const MODE_CONFIG = {
    mean:   { color:"#ff6b6b", ...t.planning.modes.mean },
    p50:    { color:"#e07b39", ...t.planning.modes.p50 },
    p80:    { color:"#6bcb77", ...t.planning.modes.p80 },
    custom: { color:"#a78bfa", ...t.planning.modes.custom },
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0a0a0f", color:"#ddd", fontFamily:"'Syne',sans-serif", padding:"28px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        input[type=range]{height:4px;border-radius:2px}
        select{outline:none}
        .card{background:#111118;border:1px solid #1e1e2a;border-radius:10px;padding:18px 20px}
        .tab{padding:7px 14px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;letter-spacing:0.04em;transition:all 0.15s;border:none;font-family:'Syne',sans-serif}
        .tab-active{background:#e07b39;color:#fff}
        .tab-inactive{background:transparent;color:#555;border:1px solid #252530}
        .tab-inactive:hover{color:#999;border-color:#444}
        th{font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#444;font-weight:500;padding:4px 8px;text-align:left}
        td{padding:5px 8px;font-size:12px;border-bottom:1px solid #161620}
        .kpi-val{font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:500;line-height:1}
        .kpi-lbl{font-size:10px;color:#555;letter-spacing:0.1em;text-transform:uppercase;margin-top:5px}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#111}
        ::-webkit-scrollbar-thumb{background:#2a2a38;border-radius:3px}
      `}</style>

      {/* header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#333", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", marginBottom:6 }}>{t.subtitle}</div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:"#f0ede8", letterSpacing:"-0.02em" }}>{t.title}</h1>
          <div style={{ fontSize:11, color:"#444", marginTop:4, fontFamily:"'JetBrains Mono',monospace" }}>
            {t.planMode}: <span style={{ color: MODE_CONFIG[planMode].color }}>{MODE_CONFIG[planMode].label}</span>
            {" "}· {numDays}d · {t.run} #{runs}
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {/* days slider */}
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#111118", border:"1px solid #1e1e2a", borderRadius:8, padding:"8px 14px" }}>
            <span style={{ fontSize:11, color:"#666", whiteSpace:"nowrap" }}>{t.daysLabel}:</span>
            <input type="range" min={1} max={5} step={1} value={numDays}
              onChange={e => setNumDays(parseInt(e.target.value))}
              style={{ width:80, accentColor:"#e07b39", cursor:"pointer" }} />
            <span style={{ fontSize:14, fontWeight:700, color:"#e07b39", fontFamily:"'JetBrains Mono',monospace", minWidth:16 }}>{numDays}</span>
          </div>
          {/* overtime slider */}
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#111118", border:"1px solid #1e1e2a", borderRadius:8, padding:"8px 14px" }}>
            <span style={{ fontSize:11, color:"#666", whiteSpace:"nowrap" }}>{t.overtimeLabel}:</span>
            <input type="range" min={0} max={120} step={15} value={overtimeLimit}
              onChange={e => setOvertimeLimit(parseInt(e.target.value))}
              style={{ width:80, accentColor:"#ff6b6b", cursor:"pointer" }} />
            <span style={{ fontSize:14, fontWeight:700, color:"#ff6b6b", fontFamily:"'JetBrains Mono',monospace", minWidth:32 }}>{overtimeLimit}'</span>
          </div>
          {/* lang */}
          <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:"1px solid #252530" }}>
            {["pl","en"].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ padding:"8px 14px", background: lang===l?"#e07b39":"transparent", color: lang===l?"#fff":"#555", border:"none", cursor:"pointer", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12, transition:"all 0.15s" }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => setShowHelp(true)} style={{ background:"transparent", color:"#555", border:"1px solid #252530", borderRadius:8, padding:"10px 16px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>{t.help}</button>
          <button onClick={runSim} style={{ background:"linear-gradient(135deg,#e07b39,#c45e1a)", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>{t.runBtn}</button>
        </div>
      </div>

      {/* ── HELP MODAL ── */}
      {showHelp && (
        <div onClick={() => setShowHelp(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#111118", border:"1px solid #1e1e2a", borderRadius:12, padding:"28px 32px", maxWidth:580, width:"100%", maxHeight:"80vh", overflowY:"auto", position:"relative" }}>
            <button onClick={() => setShowHelp(false)} style={{ position:"absolute", top:16, right:16, background:"transparent", border:"none", color:"#555", fontSize:20, cursor:"pointer", lineHeight:1 }}>✕</button>
            <div style={{ fontSize:10, letterSpacing:"0.15em", color:"#444", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", marginBottom:8 }}>{t.helpModal.label}</div>
            <h2 style={{ margin:"0 0 20px", fontSize:18, color:"#f0ede8" }}>{t.helpModal.title}</h2>
            {t.helpModal.steps.map(({ title, body }, i) => (
              <div key={i} style={{ marginBottom:18 }}>
                <div style={{ display:"flex", gap:10, alignItems:"baseline", marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"#e0d8cc" }}>{title}</span>
                </div>
                <div style={{ fontSize:12, color:"#666", lineHeight:1.7 }}>{body}</div>
              </div>
            ))}
            <div style={{ borderTop:"1px solid #1e1e2a", paddingTop:14, marginTop:4, fontSize:10, color:"#444", fontFamily:"'JetBrains Mono',monospace", textAlign:"center" }}>{t.helpModal.close}</div>
          </div>
        </div>
      )}

      {/* KPIs — 7 cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(9,1fr)", gap:8, marginBottom:16 }}>
        {[
          { val:`${sumDelay>0?"+":""}${sumDelay}'`, label:t.kpi.sumDelay, color:sumDelay>0?"#ff6b6b":sumDelay<0?"#6bcb77":"#888" },
          { val:`${totalDelay}'`, label:t.kpi.totalDelay, color:"#ff9f43" },
          { val:`${efficiency.toFixed(1)}%`, label:t.kpi.efficiency, color:efficiency>=85?"#6bcb77":efficiency>=70?"#e0c039":"#ff6b6b", tip:t.kpi.efficiencyTip },
          { val:`${utilization.toFixed(1)}%`, label:t.kpi.utilization, color:utilization>=75?"#6bcb77":utilization>=60?"#e0c039":"#ff6b6b", tip:t.kpi.utilizationTip },
          { val:minToTime(lastEnd), label:t.kpi.lastEnd, color:overtime?"#ff6b6b":"#6bcb77" },
          { val:`${allRows.filter(r=>r.delay>0).length}/${allRows.length}`, label:t.kpi.overruns, color:"#a78bfa" },
          { val:`${totalCarryOver}`, label:t.kpi.carryOver, color:totalCarryOver>0?"#ff2244":"#6bcb77", tip:t.kpi.carryOverTip },
          { val:`${startDelaySum}'`, label:t.kpi.startDelaySum, color:startDelaySum>0?"#ff9f43":"#555", tip:t.kpi.startDelaySumTip },
          { val:`${sorTotal}`, label:t.kpi.sorTotal, color:sorTotal>0?"#ff2244":"#555", tip:t.kpi.sorTotalTip },
        ].map(({ val, label, color, tip }) => (
          <div key={label} className="card" title={tip??""}>
            <div className="kpi-val" style={{ color }}>{val}</div>
            <div className="kpi-lbl">{label}</div>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {Object.entries(t.tabs).map(([k,lbl]) => (
          <button key={k} className={`tab ${activeTab===k?"tab-active":"tab-inactive"}`} onClick={()=>setActiveTab(k)}>{lbl}</button>
        ))}
      </div>

      {/* ── SCHEDULE tab ── */}
      {activeTab === "schedule" && (
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace" }}>{t.schedule.title}</div>
            <button onClick={handleRandomize} style={{ background:"#1a1a28", border:"1px solid #252530", color:"#aaa", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>{t.schedule.randomize}</button>
          </div>
          <ScheduleBuilder slots={slots} setSlots={setSlots} opsCount={opsCount} setOpsCount={setOpsCount}
            onRun={runSim} t={t.schedule} matrix={matrix} planMode={planMode}
            customOffsets={customOffsets} planColor={MODE_CONFIG[planMode].color} numDays={numDays} />

          {/* disruption toggles */}
          <div style={{ marginTop:16, borderTop:"1px solid #1e1e2a", paddingTop:16 }}>
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
              fontFamily:"'JetBrains Mono',monospace", marginBottom:12 }}>
              ⚡ {t.schedule.disruptions}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                { key:"delay", enabled:enableDelay, setter:setEnableDelay, label:t.schedule.enableDelay, color:"#ff9f43" },
                { key:"sor",   enabled:enableSor,   setter:setEnableSor,   label:t.schedule.enableSor,   color:"#ff2244" },
              ].map(({ key, enabled, setter, label, color }) => (
                <div key={key} onClick={() => setter(v => !v)} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"10px 14px",
                  background: enabled ? `${color}14` : "#111118",
                  border:`1px solid ${enabled ? color+"66" : "#1e1e2a"}`,
                  borderRadius:8, cursor:"pointer", transition:"all 0.15s",
                }}>
                  <div style={{
                    width:18, height:18, borderRadius:4, flexShrink:0,
                    background: enabled ? color : "transparent",
                    border:`2px solid ${enabled ? color : "#333"}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    {enabled && <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:12, color: enabled ? color : "#555", fontWeight: enabled ? 600 : 400 }}>
                    {label}
                  </span>
                  {enabled && (
                    <span style={{ marginLeft:"auto", fontSize:10, color:`${color}99`,
                      fontFamily:"'JetBrains Mono',monospace" }}>
                      {key === "delay" ? `P=${Math.round(delayOnTime*100)}% · ${delayMean}'` : `λ=${sorLambda} · ${sorDuration}'`}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {(enableDelay || enableSor) && (
              <div style={{ marginTop:8, fontSize:10, color:"#555", fontFamily:"'JetBrains Mono',monospace" }}>
                ↳ {lang === "pl" ? "Ustaw parametry w zakładce 3" : "Configure parameters in tab 3"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PLANNING tab ── */}
      {activeTab === "planning" && (
        <div style={{ display:"grid", gap:14 }}>
          <div className="card">
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase", marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>{t.planning.modeTitle}</div>
            <div style={{ display:"flex", gap:10, marginBottom:16 }}>
              {Object.entries(MODE_CONFIG).map(([mode, cfg]) => (
                <ModeBtn key={mode} mode={mode} active={planMode===mode} onClick={handleModeChange} label={cfg.label} desc={cfg.desc} color={cfg.color} />
              ))}
            </div>
            <div style={{ background:"#0d0d14", borderRadius:8, padding:"12px 16px", fontSize:11, color:"#555", lineHeight:1.7 }}>
              <strong style={{ color:"#777" }}>{t.planning.explainTitle}</strong><br/>
              {t.planning.explainBody}<span style={{ color:"#ff6b6b" }}>{t.planning.explainHighlight}</span>{t.planning.explainSuffix}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {Object.entries(DEFAULT_PROC_PARAMS).map(([proc, { mu, sigma }]) => {
              const color = PROC_COLORS[proc];
              const cell = matrix[proc]?.C ?? {};
              const mean = cell.mean ?? Math.round(lognormMean(mu, sigma));
              const p50  = cell.p50  ?? Math.round(lognormP50(mu, sigma));
              const p80  = cell.p80  ?? Math.round(lognormP80(mu, sigma));
              const offset = customOffsets[proc] ?? 0;
              const { curve } = buildPDFCurve(mu, sigma);
              const meanVal = Math.round(lognormMean(mu, sigma));
              const medVal  = Math.round(lognormP50(mu, sigma));
              const p80Val  = Math.round(lognormP80(mu, sigma));
              return (
                <div key={proc} className="card" style={{ borderTop:`2px solid ${color}` }}>
                  <div style={{ fontSize:13, fontWeight:600, color, marginBottom:12 }}>{proc}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6, marginBottom:14 }}>
                    {[
                      { key:"mean", label:"Mean",   val:`${mean}'`, color:"#ff6b6b", note:t.planning.badges.mean },
                      { key:"p50",  label:"P50",    val:`${p50}'`,  color:"#e07b39", note:t.planning.badges.p50 },
                      { key:"p80",  label:"P80",    val:`${p80}'`,  color:"#6bcb77", note:t.planning.badges.p80 },
                    ].map(b => (
                      <div key={b.key} style={{ background:"#0d0d14", borderRadius:6, padding:"8px 10px", border:`1px solid ${planMode===b.key?b.color+"66":"#1e1e2a"}` }}>
                        <div style={{ fontSize:16, fontWeight:600, color:b.color, fontFamily:"'JetBrains Mono',monospace" }}>{b.val}</div>
                        <div style={{ fontSize:9, color:"#555", marginTop:2 }}>{b.label}</div>
                        <div style={{ fontSize:9, color:b.color+"99" }}>{b.note}</div>
                      </div>
                    ))}
                  </div>
                  <ResponsiveContainer width="100%" height={90}>
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
                      <ReferenceLine x={meanVal} stroke="#ff6b6b" strokeWidth={2} strokeDasharray="3 2" label={{ value:`ś=${meanVal}'`, position:"top", fill:"#ff6b6b", fontSize:8 }} />
                      <ReferenceLine x={medVal}  stroke="#e07b39" strokeWidth={2} strokeDasharray="5 2" label={{ value:`P50=${medVal}'`, position:"top", fill:"#e07b39", fontSize:8 }} />
                      <ReferenceLine x={p80Val}  stroke="#6bcb77" strokeWidth={1} strokeDasharray="2 3" label={{ value:`P80=${p80Val}'`, position:"top", fill:"#6bcb77", fontSize:8 }} />
                      <Tooltip contentStyle={{ background:"#1a1a28", border:`1px solid ${color}40`, borderRadius:6, fontSize:10 }} formatter={(v,n,p)=>[`${p.payload.x} min`,""]} labelFormatter={()=>""} />
                      <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={`url(#pg-${proc.replace(/\s/g,"")})`} dot={false} activeDot={{ r:3, fill:color }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  {planMode === "custom" && (
                    <div style={{ marginTop:12, padding:"10px 12px", background:"#0d0d14", borderRadius:6 }}>
                      <Slider label={t.planning.offsetLabel} value={offset} min={-20} max={30} step={5}
                        onChange={v => { setOffset(proc, v); const vp=slots.filter(s=>s.proc!==null); setDays(simulateMultiDay(vp,procParams,matrix,"custom",{...customOffsets,[proc]:v},numDays,overtimeLimit)); }}
                        color={color} />
                      <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{t.planning.offsetBase} ({p50}') + {offset} = <span style={{ color, fontWeight:600 }}>{p50+offset}'</span></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="card">
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase", marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>{t.planning.diffTitle}</div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>{t.planning.diffHeaders.map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {matrixRows.map((r,i) => (
                  <tr key={i}>
                    <td><span style={{ color:SURGEON_COLORS[r.surg], fontWeight:600 }}>{r.surg}</span></td>
                    <td style={{ color:"#888", fontSize:11 }}>{r.proc}</td>
                    <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#ff6b6b" }}>{r.mean}'</td>
                    <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#e07b39" }}>{r.p50}'</td>
                    <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#6bcb77" }}>{r.p80}'</td>
                    <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#ff9f43", fontWeight:600 }}>+{r.mean-r.p50}'</td>
                    <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:MODE_CONFIG[planMode].color }}>{r.planned}'</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PARAMS tab ── */}
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
                <div style={{ fontSize:10, color:"#444", fontFamily:"'JetBrains Mono',monospace", marginBottom:14 }}>P50 ≈ {previewMedian}' · śr ≈ {meanVal}' · P80 ≈ {previewP80}'</div>
                <Slider label="μ (log-scale mean)" value={mu} min={3.5} max={5.0} step={0.01} onChange={v => setParam(proc,"mu",v)} color={color} />
                <Slider label="σ (log-scale std)"  value={sigma} min={0.10} max={0.60} step={0.01} onChange={v => setParam(proc,"sigma",v)} color={color} />
                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:10, color:"#333", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6, fontFamily:"'JetBrains Mono',monospace" }}>{t.params.distLabel}</div>
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
                      <ReferenceLine x={meanVal}       stroke="#ff6b6b" strokeWidth={2} strokeDasharray="3 2" label={{ value:`śr=${meanVal}'`,      position:"top", fill:"#ff6b6b", fontSize:8 }} />
                      <ReferenceLine x={previewMedian} stroke="#e07b39" strokeWidth={2} strokeDasharray="5 2" label={{ value:`P50=${previewMedian}'`, position:"top", fill:"#e07b39", fontSize:8 }} />
                      <ReferenceLine x={previewP80}    stroke="#6bcb77" strokeWidth={1} strokeDasharray="2 3" label={{ value:`P80=${previewP80}'`,    position:"top", fill:"#6bcb77", fontSize:8 }} />
                      <Tooltip contentStyle={{ background:"#1a1a28", border:`1px solid ${color}40`, borderRadius:6, fontSize:10 }} formatter={(v,n,p)=>[`${p.payload.x} min`,""]} labelFormatter={()=>""} />
                      <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={`url(#grad-${proc.replace(/\s/g,"")})`} dot={false} activeDot={{ r:3, fill:color }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ marginTop:10, background:"#0d0d14", borderRadius:6, padding:"10px 12px" }}>
                  {["A","B","C"].map(s => {
                    const cell = matrix[proc]?.[s];
                    return (
                      <div key={s} style={{ display:"flex", justifyContent:"space-between", marginBottom:3, fontSize:11 }}>
                        <span style={{ color:SURGEON_COLORS[s], fontWeight:600 }}>{t.params.surgeon} {s}</span>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", color:"#888" }}>śr {cell?.mean}' · P50 {cell?.p50}' · P80 {cell?.p80}'</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* disruption params — shown below distributions when active */}
      {activeTab === "params" && (
        <div style={{ marginTop:14 }}>
          {(!enableDelay && !enableSor) ? (
            <div className="card" style={{ textAlign:"center", color:"#333", fontSize:12,
              fontFamily:"'JetBrains Mono',monospace", padding:"14px" }}>
              {t.params.disruptOff}
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns: enableDelay && enableSor ? "1fr 1fr" : "1fr", gap:12 }}>
              {enableDelay && (
                <div className="card" style={{ borderTop:"2px solid #ff9f43" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#ff9f43", marginBottom:14 }}>
                    ⏱ {t.params.delayTitle}
                  </div>
                  <Slider label={t.params.delayOnTime} value={delayOnTime} min={0} max={1} step={0.05}
                    onChange={setDelayOnTime} color="#ff9f43" />
                  <div style={{ fontSize:10, color:"#555", marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>
                    {lang==="pl" ? `Opóźnienie wystąpi w ${Math.round((1-delayOnTime)*100)}% dni` : `Delay occurs in ${Math.round((1-delayOnTime)*100)}% of days`}
                  </div>
                  <Slider label={t.params.delayMean} value={delayMean} min={5} max={60} step={5}
                    onChange={setDelayMean} color="#ff9f43" />
                  <div style={{ marginTop:10, background:"#0d0d14", borderRadius:6, padding:"8px 12px",
                    fontSize:11, color:"#888", fontFamily:"'JetBrains Mono',monospace" }}>
                    {lang==="pl"
                      ? `Typowe opóźnienie: 0–${Math.round(delayMean*2)}'`
                      : `Typical delay range: 0–${Math.round(delayMean*2)}'`}
                  </div>
                </div>
              )}
              {enableSor && (
                <div className="card" style={{ borderTop:"2px solid #ff2244" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#ff2244", marginBottom:14 }}>
                    🚨 {t.params.sorTitle}
                  </div>
                  <Slider label={t.params.sorLambda} value={sorLambda} min={0.5} max={3} step={0.5}
                    onChange={setSorLambda} color="#ff2244" />
                  <div style={{ fontSize:10, color:"#555", marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>
                    {lang==="pl"
                      ? `Oczekiwana liczba przypadków/dzień: ${sorLambda}`
                      : `Expected cases/day: ${sorLambda}`}
                  </div>
                  <Slider label={t.params.sorDuration} value={sorDuration} min={20} max={120} step={10}
                    onChange={setSorDuration} color="#ff2244" />
                  <div style={{ marginTop:10 }}>
                    <div style={{ fontSize:10, color:"#555", marginBottom:6 }}>{t.params.sorPriority}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      {["preempt","end"].map((p, i) => (
                        <button key={p} onClick={() => setSorPriority(p)} style={{
                          flex:1, padding:"7px 10px", borderRadius:6, cursor:"pointer", fontSize:11,
                          border:`1px solid ${sorPriority===p ? "#ff2244" : "#252530"}`,
                          background: sorPriority===p ? "#ff224420" : "#0d0d14",
                          color: sorPriority===p ? "#ff2244" : "#555",
                          fontFamily:"'Syne',sans-serif", fontWeight:600,
                        }}>{t.params.sorPriorityOptions[i]}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── GANTT tab ── */}
      {activeTab === "gantt" && (
        <div className="card">
          <div style={{ display:"flex", gap:20, marginBottom:14, flexWrap:"wrap", fontSize:11 }}>
            <span style={{ display:"flex", alignItems:"center", gap:6, color:"#666" }}>
              <span style={{ border:`2px solid ${MODE_CONFIG[planMode].color}`, width:18, height:10, borderRadius:2, display:"inline-block" }} />
              {t.gantt.planLabel} <strong style={{ color:MODE_CONFIG[planMode].color }}>{MODE_CONFIG[planMode].label}</strong>
            </span>
            <span style={{ display:"flex", alignItems:"center", gap:6, color:"#666" }}>
              <span style={{ background:"#aaa", width:18, height:10, borderRadius:2, display:"inline-block" }} />
              {t.gantt.actual}
            </span>
            <span style={{ display:"flex", alignItems:"center", gap:6, color:"#ff2244" }}>
              <span style={{ background:"#ff2244", width:18, height:10, borderRadius:2, display:"inline-block" }} />
              {t.gantt.carryOver}
            </span>
            {enableSor && (
              <span style={{ display:"flex", alignItems:"center", gap:6, color:"#ff2244" }}>
                <span style={{ background:"#ff224488", border:"2px dashed #ff2244", width:18, height:10, borderRadius:2, display:"inline-block" }} />
                🚨 SOR
              </span>
            )}
            {enableDelay && (
              <span style={{ display:"flex", alignItems:"center", gap:6, color:"#ff9f43" }}>
                ⏱ {lang === "pl" ? "Opóźnienie startu" : "Start delay"}
              </span>
            )}
            {["A","B","C"].map(s => (
              <span key={s} style={{ display:"flex", alignItems:"center", gap:5, color:"#666" }}>
                <span style={{ background:SURGEON_COLORS[s], width:10, height:10, borderRadius:2, display:"inline-block" }} />
                {t.gantt.surgeon} {s}
              </span>
            ))}
          </div>
          <MultiDayGantt days={days} planColor={MODE_CONFIG[planMode].color} t={t.gantt} />

          {/* table — all days */}
          <div style={{ marginTop:20 }}>
            {(() => {
              // collect planIds that appeared as carry-over in any day
              const carryOverIds = new Set(
                days.flatMap(d => d.rows.filter(r => r.isCarryOver).map(r => r.planId))
              );
              return (
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>{t.gantt.tableHeaders.map(h=><th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {days.flatMap(d => d.rows).map((r, i) => {
                      const wasCarriedOver = carryOverIds.has(r.planId);
                      return (
                        <tr key={i} style={{ background: r.isCarryOver ? "#ff224410" : "transparent" }}>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace",
                            color: wasCarriedOver ? "#ff2244" : "#aaa", fontWeight: wasCarriedOver ? 700 : 400 }}>
                            D{r.dayIdx+1}-{r.id}
                          </td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace",
                            color: wasCarriedOver ? "#ff2244" : "#555", fontWeight: wasCarriedOver ? 700 : 400, fontSize:11 }}>
                            #{r.planId ?? "—"}
                          </td>
                          <td><span style={{ color: r.isCarryOver?"#ff2244":SURGEON_COLORS[r.chir], fontWeight:600 }}>{r.chir}</span></td>
                          <td style={{ color:"#666", fontSize:11 }}>{r.proc}{r.isCarryOver?" ↩":""}</td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace", color:MODE_CONFIG[planMode].color, fontWeight:600 }}>{r.planned}'</td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:MODE_CONFIG[planMode].color, opacity:0.7 }}>{minToTime(r.startPlan)}</td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:MODE_CONFIG[planMode].color, opacity:0.7 }}>{minToTime(r.endPlan)}</td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace" }}>{r.actual}'</td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
                            color:r.delay>0?"#ff6b6b":r.delay<0?"#6bcb77":"#888" }}>{r.delay>0?"+":""}{r.delay}'</td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"#666" }}>{minToTime(r.startReal)}</td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11,
                            color:r.endReal>END?"#ff6b6b":"#666" }}>{minToTime(r.endReal)}</td>
                          <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, textAlign:"center" }}>
                            {r.isCarryOver
                              ? <span style={{ color:"#ff2244", fontWeight:700 }}>↩ D{r.dayIdx}</span>
                              : wasCarriedOver
                              ? <span style={{ color:"#ff9f43", fontSize:10 }}>→ D{r.dayIdx+2}</span>
                              : <span style={{ color:"#333" }}>—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── MONTE CARLO tab ── */}
      {activeTab === "monte" && (
        <div style={{ display:"grid", gap:14 }}>
          {/* controls */}
          <div className="card">
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
              marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>
              {t.monte.title}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:260 }}>
                <span style={{ fontSize:11, color:"#888", whiteSpace:"nowrap" }}>{t.monte.iterLabel}:</span>
                <input type="range" min={100} max={1000} step={100} value={mcIterations}
                  onChange={e => setMcIterations(parseInt(e.target.value))}
                  style={{ flex:1, accentColor:"#a78bfa", cursor:"pointer" }} />
                <span style={{ fontSize:14, fontWeight:700, color:"#a78bfa",
                  fontFamily:"'JetBrains Mono',monospace", minWidth:40 }}>{mcIterations}</span>
              </div>
              <button onClick={runMonteCarlo} disabled={mcRunning} style={{
                padding:"10px 28px", background: mcRunning ? "#1a1a24" : "linear-gradient(135deg,#a78bfa,#7c5cdb)",
                color: mcRunning ? "#555" : "#fff", border:"none", borderRadius:8,
                fontSize:13, fontWeight:700, cursor: mcRunning ? "not-allowed" : "pointer",
                fontFamily:"'Syne',sans-serif",
              }}>
                {mcRunning ? t.monte.running : t.monte.runBtn}
              </button>
              <span style={{ fontSize:10, color:"#333", fontFamily:"'JetBrains Mono',monospace" }}>
                {t.monte.hint}
              </span>
            </div>
          </div>

          {mcRunning && (
            <div className="card" style={{ textAlign:"center", padding:"32px", color:"#555",
              fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>
              ⏳ {lang==="pl" ? `Liczę ${mcIterations} iteracji × 4 strategie...` : `Computing ${mcIterations} iterations × 4 strategies...`}
            </div>
          )}

          {mcResults && !mcRunning && (() => {
            const modeKeys = Object.keys(mcResults);
            const COLORS = { mean:"#ff6b6b", p50:"#e07b39", p80:"#6bcb77", custom:"#a78bfa" };

            // build histogram data — bucket end times into 15-min bins
            const bins = {};
            for (let m = START; m <= END + 120; m += 15) bins[m] = { time: minToTime(m) };
            modeKeys.forEach(mode => {
              mcResults[mode].endTimes.forEach(et => {
                const bucket = Math.floor(et / 15) * 15;
                if (!bins[bucket]) bins[bucket] = { time: minToTime(bucket) };
                bins[bucket][mode] = (bins[bucket][mode] ?? 0) + 1;
              });
            });
            const histData = Object.values(bins).filter(b =>
              modeKeys.some(m => b[m] > 0)
            );

            return (
              <>
                {/* summary table */}
                <div className="card">
                  <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
                    marginBottom:12, fontFamily:"'JetBrains Mono',monospace" }}>
                    {t.monte.summaryTitle} · {mcIterations} {t.monte.iterations}
                  </div>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead><tr>
                      {(lang==="pl"
                        ? ["Strategia","% dni na czas","Nadgodz. śr. (min/dzień)","Carry-over śr. (szt/dzień)","Min op. śr./dzień","Efektywność sali","Wykorzystanie sali","Najgorszy dzień"]
                        : ["Strategy","% days on time","Avg overtime (min/day)","Avg carry-over (ops/day)","Avg op. min/day","Room efficiency","Room utilization","Worst day"]
                      ).map(h=><th key={h}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {modeKeys.map(mode => {
                        const r = mcResults[mode];
                        const color = COLORS[mode];
                        const pctOnTime = 100 - r.overtimeRate;
                        return (
                          <tr key={mode}>
                            <td><span style={{ color, fontWeight:700, fontSize:13 }}>{t.monte.modes[mode]}</span></td>
                            <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
                              color: pctOnTime>=80?"#6bcb77":pctOnTime>=50?"#e0c039":"#ff6b6b" }}>
                              {pctOnTime}%
                            </td>
                            <td style={{ fontFamily:"'JetBrains Mono',monospace",
                              color: r.avgOvertimeMin>30?"#ff6b6b":r.avgOvertimeMin>0?"#ff9f43":"#6bcb77" }}>
                              {r.avgOvertimeMin}'
                            </td>
                            <td style={{ fontFamily:"'JetBrains Mono',monospace",
                              color: r.avgCarryOver>1?"#ff2244":r.avgCarryOver>0?"#ff9f43":"#6bcb77" }}>
                              {r.avgCarryOver.toFixed(1)}
                            </td>
                            <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#4a9eff", fontWeight:600 }}>
                              {r.avgOpsMin}'
                            </td>
                            <td style={{ fontFamily:"'JetBrains Mono',monospace",
                              color: r.avgEfficiency>=85?"#6bcb77":r.avgEfficiency>=70?"#e0c039":"#ff6b6b" }}>
                              {r.avgEfficiency}%
                            </td>
                            <td style={{ fontFamily:"'JetBrains Mono',monospace",
                              color: r.avgUtilization>=75?"#6bcb77":r.avgUtilization>=60?"#e0c039":"#ff6b6b" }}>
                              {r.avgUtilization}%
                            </td>
                            <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#ff6b6b" }}>
                              {minToTime(r.worstEnd)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* diagnostic message */}
                {(() => {
                  const modeVals = modeKeys.map(m => mcResults[m].overtimeRate);
                  const minOT = Math.min(...modeVals);
                  const maxOT = Math.max(...modeVals);
                  const diff = maxOT - minOT;
                  const allHigh = modeVals.every(v => v > 70);
                  const allLow  = modeVals.every(v => v < 10);
                  if (allHigh) return (
                    <div style={{ background:"#ff224410", border:"1px solid #ff224433", borderRadius:8,
                      padding:"12px 16px", fontSize:11, color:"#ff9f43",
                      fontFamily:"'JetBrains Mono',monospace" }}>
                      ⚠ {lang==="pl"
                        ? "Plan jest zbyt ciasny — wszystkie strategie regularnie przepełniają salę. Zmniejsz liczbę operacji lub zwiększ limit nadgodzin aby zobaczyć różnicę między strategiami."
                        : "Plan is too tight — all strategies regularly overflow. Reduce the number of operations or increase the overtime limit to see differences between strategies."}
                    </div>
                  );
                  if (allLow && diff < 5) return (
                    <div style={{ background:"#6bcb7710", border:"1px solid #6bcb7733", borderRadius:8,
                      padding:"12px 16px", fontSize:11, color:"#6bcb77",
                      fontFamily:"'JetBrains Mono',monospace" }}>
                      ✓ {lang==="pl"
                        ? "Plan ma duży zapas — wszystkie strategie mieszczą się w dniu. Zwiększ liczbę operacji aby zobaczyć różnicę między strategiami."
                        : "Plan has a large margin — all strategies fit within the day. Increase operations to see differences between strategies."}
                    </div>
                  );
                  if (diff < 5) return (
                    <div style={{ background:"#e0c03910", border:"1px solid #e0c03933", borderRadius:8,
                      padding:"12px 16px", fontSize:11, color:"#e0c039",
                      fontFamily:"'JetBrains Mono',monospace" }}>
                      ℹ {lang==="pl"
                        ? `Różnica między strategiami wynosi tylko ${diff}%. Spróbuj zwiększyć liczbę operacji lub zmienić parametry rozkładu aby uzyskać wyraźniejszy efekt.`
                        : `Difference between strategies is only ${diff}%. Try increasing operations or changing distribution parameters for a clearer effect.`}
                    </div>
                  );
                  return null;
                })()}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
                  {modeKeys.map(mode => {
                    const color = COLORS[mode];
                    const r = mcResults[mode];

                    // build per-mode histogram bins
                    const modeBins = {};
                    for (let m = START; m <= END + 120; m += 15) {
                      modeBins[m] = { time: minToTime(m), count: 0 };
                    }
                    r.endTimes.forEach(et => {
                      const bucket = Math.floor(et / 15) * 15;
                      if (!modeBins[bucket]) modeBins[bucket] = { time: minToTime(bucket), count: 0 };
                      modeBins[bucket].count += 1;
                    });
                    const modeHistData = Object.values(modeBins).filter(b => b.count > 0);
                    const onTime = r.endTimes.filter(e => e <= END).length;
                    const pctOnTime = Math.round(onTime / mcIterations * 100);

                    return (
                      <div key={mode} className="card" style={{ borderTop:`2px solid ${color}` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
                          <span style={{ fontSize:13, fontWeight:700, color }}>{t.monte.modes[mode]}</span>
                          <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace",
                            color: pctOnTime >= 80 ? "#6bcb77" : pctOnTime >= 50 ? "#e0c039" : "#ff6b6b" }}>
                            {pctOnTime}% {lang==="pl" ? "na czas" : "on time"}
                          </span>
                        </div>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={modeHistData} margin={{ top:4, right:4, bottom:16, left:-15 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a28" />
                            <XAxis dataKey="time" tick={{ fontSize:8, fill:"#555" }} interval={2}
                              label={{ value: lang==="pl"?"Koniec":"End", position:"insideBottom", offset:-8, fill:"#444", fontSize:9 }} />
                            <YAxis tick={{ fontSize:8, fill:"#555" }} />
                            <ReferenceLine x={minToTime(END)} stroke="#ff6b6b" strokeDasharray="3 2" strokeWidth={1.5} />
                            <Tooltip contentStyle={{ background:"#1a1a28", border:`1px solid ${color}40`, borderRadius:6, fontSize:10 }}
                              formatter={v => [v, lang==="pl" ? "iteracji" : "iterations"]} />
                            <Bar dataKey="count" fill={color} opacity={0.8} radius={[2,2,0,0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginTop:8 }}>
                          <div style={{ background:"#0d0d14", borderRadius:6, padding:"6px 10px" }}>
                            <div style={{ fontSize:16, fontWeight:600, color:"#4a9eff",
                              fontFamily:"'JetBrains Mono',monospace" }}>{r.avgOpsMin}'</div>
                            <div style={{ fontSize:9, color:"#555", marginTop:2 }}>
                              {lang==="pl" ? "min op./dzień" : "op. min/day"}
                            </div>
                          </div>
                          <div style={{ background:"#0d0d14", borderRadius:6, padding:"6px 10px" }}>
                            <div style={{ fontSize:16, fontWeight:600, color,
                              fontFamily:"'JetBrains Mono',monospace" }}>{minToTime(r.avgEnd)}</div>
                            <div style={{ fontSize:9, color:"#555", marginTop:2 }}>
                              {lang==="pl" ? "śr. koniec" : "avg end"}
                            </div>
                          </div>
                          <div style={{ background:"#0d0d14", borderRadius:6, padding:"6px 10px" }}>
                            <div style={{ fontSize:16, fontWeight:600,
                              color: r.avgOvertimeMin > 0 ? "#ff9f43" : "#6bcb77",
                              fontFamily:"'JetBrains Mono',monospace" }}>{r.avgOvertimeMin}'</div>
                            <div style={{ fontSize:9, color:"#555", marginTop:2 }}>
                              {lang==="pl" ? "śr. nadgodziny" : "avg overtime"}
                            </div>
                          </div>
                          <div style={{ background:"#0d0d14", borderRadius:6, padding:"6px 10px" }}>
                            <div style={{ fontSize:16, fontWeight:600,
                              color: r.avgCarryOver > 0 ? "#ff2244" : "#6bcb77",
                              fontFamily:"'JetBrains Mono',monospace" }}>{r.avgCarryOver.toFixed(1)}</div>
                            <div style={{ fontSize:9, color:"#555", marginTop:2 }}>
                              {lang==="pl" ? "śr. carry-over/dzień" : "avg carry-over/day"}
                            </div>
                          </div>
                          <div style={{ background:"#0d0d14", borderRadius:6, padding:"6px 10px" }}>
                            <div style={{ fontSize:16, fontWeight:600, color:"#ff6b6b",
                              fontFamily:"'JetBrains Mono',monospace" }}>{minToTime(r.worstEnd)}</div>
                            <div style={{ fontSize:9, color:"#555", marginTop:2 }}>
                              {lang==="pl" ? "najgorszy dzień" : "worst day"}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {!mcResults && !mcRunning && (
            <div className="card" style={{ textAlign:"center", padding:"32px", color:"#333",
              fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>
              {lang==="pl"
                ? `Kliknij "▶ Uruchom analizę" aby porównać 4 strategie planowania na ${mcIterations} losowych realizacjach`
                : `Click "▶ Run analysis" to compare 4 planning strategies across ${mcIterations} random realizations`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
