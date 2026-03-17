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

const T = {
  pl: {
    subtitle: "OR · Symulator Sali — v5",
    title: "Symulacja Sali Operacyjnej — TEST",
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
      schedule: "1. Plan",
      settings: "2. Ustawienia",
      params:   "3. Rozkłady",
      test:     "4. Wyniki",
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
    },
    planning: {
      modeTitle: "Tryb wyznaczania planu operacji",
      modes: {
        mean:   { label: "Średnia",       desc: "globalny rozkład procedury" },
        p50:    { label: "P50 (mediana)", desc: "globalny — 50% przekroczy plan" },
        p80:    { label: "P80",           desc: "globalny — tylko 20% przekroczy" },
        custom: { label: "Własny",        desc: "ręczna korekta per procedura" },
        robust: { label: "Robust",        desc: "P80 per chirurg × procedura" },
      },
    },
    params: {
      distLabel: "Rozkład — czerwona = średnia, pomarańcz. = P50",
      surgeon: "Chirurg",
      delayOnTime: "Prawdopodobieństwo startu na czas",
      delayMean: "Średnie opóźnienie gdy wystąpi (min)",
      sorLambda: "Średnia liczba przypadków / dzień (λ)",
      sorDuration: "Średni czas operacji pilnej (min)",
      sorPriorityOptions: ["Wyprzedza planowe", "Na koniec dnia"],
    },
    monte: {
      title: "Analiza Monte Carlo — porównanie strategii planowania",
      iterLabel: "Liczba iteracji",
      runBtn: "▶ Uruchom analizę",
      running: "Liczenie...",
      iterations: "iteracji",
      modes: { mean: "Średnia", p50: "P50", p80: "P80", custom: "Własny", robust: "Robust" },
      summaryTitle: "Podsumowanie — 4 strategie planowania",
      headers: ["Strategia", "% nadgodzin", "% carry-over", "Śr. opóźnienie", "P80 opóźnienia", "Śr. koniec"],
      hint: "Zamrożony plan · różne realizacje losowe",
    },
    helpModal: {
      label: "Instrukcja obsługi",
      title: "Symulator Sali Operacyjnej",
      close: "Kliknij gdziekolwiek poza oknem aby zamknąć",
      intro: "Sala operacyjna to jeden z najdroższych zasobów szpitala — godzina kosztuje tysiące złotych, a każda minuta przestoju lub przekroczenia planu generuje realne straty. Większość szpitali planuje operacje korzystając ze średnich czasów — to matematyczny błąd, bo rozkład czasów operacji jest log-normalny: kilka ekstremalnie długich przypadków zawyża średnią, przez co połowa operacji systematycznie przekracza plan. Ten symulator pokazuje jak różne strategie planowania radzą sobie z tą niepewnością. Możesz zbudować własny plan operacyjny, wybrać strategię (od naiwnej średniej po zaawansowane metody odporne na zakłócenia: MIT Robust Scheduling i Rolling Horizon Optimizer), a następnie uruchomić symulację — program losuje rzeczywiste czasy operacji z rozkładu statystycznego i pokazuje co się dzieje: opóźnienia, carry-over (operacje przesunięte na następny dzień), nieplanowane przypadki SOR z izby przyjęć. Analiza Monte Carlo pozwala porównać strategie na setkach losowych realizacji — zamiast jednego szczęśliwego lub pechowego dnia, widzisz pełny rozkład wyników.",
      steps: [
        { title: "1. Plan operacyjny", body: "Ustaw liczbę dni (suwak w nagłówku, max 30) i liczbę operacji / dzień (suwak w zakładce). Przeciągnij procedury z lewej puli na sloty lub kliknij '🎲 Losuj plan'. Każdemu slotowi przypisz chirurga (A / B / C) — chirurdzy różnią się współczynnikiem wydajności. Przycisk 🏥 Demo wczytuje gotowy plan demonstracyjny 7 dni × 5 ops z włączonym SOR. Przycisk 🔧 Optymalizuj sortuje operacje po przewidywalności (CV) i ustawia plan Robust. Zakłócenia (dolna sekcja): ⏱ opóźnienie startu pierwszej operacji dnia — możesz ustawić prawdopodobieństwo startu na czas i średni czas opóźnienia. 🚨 SOR — nieplanowany przypadek z izby przyjęć, losowany z rozkładu Poissona (λ = śr. liczba / dzień). Parametry SOR: czas trwania, priorytet (wyprzedza planowe vs na koniec dnia)." },
        { title: "2. Ustawienia strategii", body: "Tryb planu bazowego — jak wyznaczamy czas planowany per operacja: Średnia (błąd — log-normal ma długi ogon, średnia > mediana), P50 (mediana — typowy czas, 50% operacji przekroczy plan), P80 (bezpieczny — tylko 20% przekroczy plan), Własny (ręczna korekta offset per procedura). MIT Robust Scheduling (Denton et al.) — parametr Γ (Gamma) steruje budżetem buforów: budget = min(Γ × max_deviation, dostępny_czas). Im wyższe Γ, tym więcej czasu rezerwujesz na zmienne operacje — mniejsze ryzyko carry-over, ale mniejsza przepustowość. Wykres pod suwakiem pokazuje bufor per operacja proporcjonalny do jej zmienności (P80−P50). Rolling Horizon Optimizer — okno look-ahead: po zaplanowaniu dnia sprawdza czy zostało wolne miejsce i pożycza najkrótszą operację z kolejnych N dni. Zmiana okna zmienia agresywność optymalizacji." },
        { title: "3. Rozkłady czasów", body: "Każda procedura ma rozkład log-normalny z parametrami μ (mu) i σ (sigma). μ przesuwa całą krzywą (dłuższy / krótszy mediana), σ steruje szerokością ogona (większe σ = więcej ekstremalnych przypadków). Czerwona linia = średnia (zawyżona przez ogon), pomarańczowa = P50 (mediana, typowy czas), zielona = P80 (czas bezpieczny). Pod wykresem tabela P50 / P80 / średnia per chirurg × procedura — chirurg B jest 10% wolniejszy, A 8% szybszy niż baseline C." },
        { title: "4. Wyniki", body: "Główna zakładka — otwiera się automatycznie po kliknięciu ▶ Uruchom symulację. Układ od góry: (1) Panel Monte Carlo — suwak iteracji i przycisk ▶ Uruchom analizę. Po uruchomieniu MC tabela KPI pokazuje wartości uśrednione z setek przebiegów zamiast jednego losowania. (2) Tabela KPI — porównuje 5 strategii (Średnia / P50 / P80 / Robust / Rolling Horizon) na tych samych losowaniach — uczciwe porównanie. Zielona komórka = najlepsza wartość w wierszu. (3) Histogramy rozkładu godziny końca dnia per strategia — im krzywa bardziej przesunięta w lewo, tym lepsza strategia. Pod każdym histogramem kafelki: min op./dzień, śr. koniec, śr. nadgodziny, carry-over/dzień, OTCR%. (4) Przełącznik strategii — zmienia prawą kolumnę Ganttów. (5) Gantty — lewy = plan bazowy, prawy = wybrana strategia. Kolorowa ramka = plan, pełny pasek = rzeczywistość, czerwony = carry-over ↩, przerywany = SOR 🚨, ⏩ zielony = przyspieszone przez RH, ⏱ = opóźnienie startu. (6) Tabela szczegółów operacji — każda operacja z dokładnymi czasami, odchyleniem od planu i statusem carry-over." },
      ],
    },
  },
  en: {
    subtitle: "OR · Operating Room Simulator — v5",
    title: "Operating Room Simulator — TEST",
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
      schedule: "1. Plan",
      settings: "2. Settings",
      params:   "3. Distributions",
      test:     "4. Results",
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
    },
    planning: {
      modeTitle: "Planning mode",
      modes: {
        mean:   { label: "Mean",          desc: "global procedure distribution" },
        p50:    { label: "P50 (median)",  desc: "global — 50% will exceed plan" },
        p80:    { label: "P80",           desc: "global — only 20% will exceed" },
        custom: { label: "Custom",        desc: "manual offset per procedure" },
        robust: { label: "Robust",        desc: "P80 per surgeon × procedure" },
      },
    },
    params: {
      distLabel: "Distribution — red = mean, orange = P50",
      surgeon: "Surgeon",
      delayOnTime: "Probability of on-time start",
      delayMean: "Mean delay when it occurs (min)",
      sorLambda: "Mean cases per day (λ)",
      sorDuration: "Mean emergency op duration (min)",
      sorPriorityOptions: ["Preempts scheduled ops", "Added at end of day"],
    },
    monte: {
      title: "Monte Carlo Analysis — planning strategy comparison",
      iterLabel: "Number of iterations",
      runBtn: "▶ Run analysis",
      running: "Computing...",
      iterations: "iterations",
      modes: { mean: "Mean", p50: "P50", p80: "P80", custom: "Custom", robust: "Robust" },
      summaryTitle: "Summary — 4 planning strategies",
      headers: ["Strategy", "% overtime", "% carry-over", "Avg delay", "P80 delay", "Avg end"],
      hint: "Frozen plan · random realizations",
    },
    helpModal: {
      label: "User guide",
      title: "Operating Room Simulator",
      close: "Click anywhere outside to close",
      intro: "The operating room is one of the most expensive resources in a hospital — an hour costs thousands, and every minute of delay or overrun generates real losses. Most hospitals schedule operations using average durations — a mathematical mistake, because operation times follow a log-normal distribution: a few extremely long cases inflate the mean, causing half of all operations to systematically exceed the plan. This simulator shows how different planning strategies handle that uncertainty. You can build your own operating schedule, choose a strategy (from the naive mean to advanced methods robust to disruptions: MIT Robust Scheduling and Rolling Horizon Optimizer), then run a simulation — the program draws actual operation times from a statistical distribution and shows what happens: delays, carry-overs (operations pushed to the next day), and unplanned emergency cases from the ED. Monte Carlo analysis lets you compare strategies across hundreds of random realizations — instead of one lucky or unlucky day, you see the full distribution of outcomes.",
      steps: [
        { title: "1. Operating schedule", body: "Set the number of days (header slider, up to 30) and ops per day (tab slider). Drag procedure tiles from the left pool onto slots or click '🎲 Randomize'. Assign a surgeon (A / B / C) to each slot — surgeons have different efficiency multipliers. The 🏥 Demo button loads a 7-day × 5-ops demo plan with SOR enabled. 🔧 Optimize sorts ops by predictability (CV) and sets the Robust plan. Disruptions (bottom section): ⏱ first case start delay — set the on-time probability and mean delay. 🚨 SOR — unplanned emergency cases drawn from a Poisson distribution (λ = avg cases/day). SOR parameters: duration, priority (preempts scheduled ops vs added at end of day)." },
        { title: "2. Strategy settings", body: "Base plan mode — how planned duration is set per operation: Mean (incorrect — log-normal has a long right tail, mean > median), P50 (median — typical time, 50% of ops will exceed plan), P80 (safe — only 20% will exceed), Custom (manual offset per procedure). MIT Robust Scheduling (Denton et al.) — Γ (Gamma) controls the buffer budget: budget = min(Γ × max_deviation, available_time). Higher Γ = more buffer for variable ops = lower carry-over risk but lower throughput. The chart below the slider shows buffer per operation proportional to its variability (P80−P50). Rolling Horizon Optimizer — look-ahead window: after scheduling each day it checks remaining capacity and borrows the shortest op from the next N days. Larger window = more aggressive optimization." },
        { title: "3. Duration distributions", body: "Each procedure follows a log-normal distribution with parameters μ (mu) and σ (sigma). μ shifts the whole curve (longer/shorter median), σ controls tail width (higher σ = more extreme cases). Red line = mean (inflated by the tail), orange = P50 (median, typical time), green = P80 (safe time). The table below shows P50 / P80 / mean per surgeon × procedure — surgeon B is 10% slower, A is 8% faster than baseline C." },
        { title: "4. Results", body: "Main tab — opens automatically after clicking ▶ Run simulation. Layout from top: (1) Monte Carlo panel — iterations slider and ▶ Run analysis button. When MC is run, the KPI table shows values averaged across hundreds of runs instead of a single draw. (2) KPI table — compares 5 strategies (Mean / P50 / P80 / Robust / Rolling Horizon) on the same random draws — a fair comparison. Green cell = best value in row. (3) End-of-day distribution histograms per strategy — the more left-shifted, the better. Below each histogram: op. min/day, avg end, avg overtime, carry-over/day, OTCR%. (4) Strategy switcher — changes the right Gantt column. (5) Gantts — left = base plan, right = selected strategy. Colored outline = plan, solid bar = actual, red = carry-over ↩, dashed = SOR 🚨, ⏩ green = accelerated by RH, ⏱ = start delay. (6) Operation detail table — each operation with exact times, plan deviation and carry-over status." },
      ],
    },
  },
};

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

function getGlobalPlanned(procParams, proc, planMode, customOffsets) {
  const { mu, sigma } = procParams[proc] ?? { mu: 4.06, sigma: 0.28 };
  let base;
  if (planMode === "mean") base = Math.round(lognormMean(mu, sigma));
  else if (planMode === "p80")  base = Math.round(lognormP80(mu, sigma));
  else                          base = Math.round(lognormP50(mu, sigma));
  const offset = customOffsets?.[proc] ?? 0;
  return Math.max(10, Math.round((base + offset) / 5) * 5);
}

function buildRobustPlan(plan, matrix, procParams, gamma, overtimeLimit = 0) {
  if (!plan || plan.length === 0) return {};

  const ops = plan.map(op => {
    const cell = matrix[op.proc]?.[op.chir];
    const { sigma, mu } = procParams[op.proc] ?? { sigma: 0.28, mu: 4.06 };
    const p50 = cell?.p50 ?? Math.round(lognormP50(mu, sigma));
    const p80 = cell?.p80 ?? Math.round(lognormP80(mu, sigma));
    const deviation = Math.max(0, p80 - p50);
    return { proc: op.proc, chir: op.chir, p50, deviation, sigma };
  });

  const sumP50 = ops.reduce((a, o) => a + o.p50, 0);
  const prepTotal = PREP * (ops.length - 1);
  const availableBuffer = Math.max(0, (END - START + overtimeLimit) - sumP50 - prepTotal);

  const maxDev = Math.max(...ops.map(o => o.deviation), 1);
  const totalBudget = Math.min(gamma * maxDev, availableBuffer);

  const totalDev = ops.reduce((a, o) => a + o.deviation, 0) || 1;
  const result = {};
  ops.forEach(op => {
    const key = `${op.proc}__${op.chir}`;
    const share = op.deviation / totalDev;
    const buffer = Math.round(share * totalBudget);
    result[key] = Math.max(10, Math.round((op.p50 + buffer) / 5) * 5);
  });
  return result;
}

function getPlanned(matrix, proc, surg, planMode, customOffsets) {
  if (planMode === "robust") {
    const robustPlan = customOffsets?._robustPlan;
    if (robustPlan) {
      const key = `${proc}__${surg}`;
      return robustPlan[key] ?? 60;
    }
    const cell = matrix[proc]?.[surg];
    if (!cell) return 60;
    return Math.max(10, Math.round(cell.p80 / 5) * 5);
  }
  const cell = matrix[proc]?.[surg];
  if (!cell) return 60;
  let base;
  if (planMode === "mean") base = cell.mean;
  else if (planMode === "p80") base = cell.p80;
  else base = cell.p50;
  const offset = customOffsets?.[proc] ?? 0;
  return Math.max(10, Math.round((base + offset) / 5) * 5);
}

// ── Rolling Horizon Optimizer ─────────────────────────────────────────────
// FIX: HARD_END reduced by 75 min to leave room for SOR cases at end of day
function buildRollingHorizonPlan(slots, procParams, overtimeLimit, numDays, planningWindow) {
  const validSlots = slots.filter(s => s.proc !== null);
  if (validSlots.length === 0) return [];

  const HARD_END = END + overtimeLimit - 75; // bufor na SOR

  const score = (op) => {
    const { mu, sigma } = procParams[op.proc] ?? { mu: 4.06, sigma: 0.28 };
    return { ...op, p50: Math.round(lognormP50(mu, sigma)) };
  };

  let schedule = Array.from({ length: numDays }, () =>
    validSlots.map(s => score({ ...s }))
  );

  for (let d = 0; d < schedule.length; d++) {
    let usedTime = 0;
    for (const op of schedule[d]) {
      usedTime += (usedTime > 0 ? PREP : 0) + op.p50;
    }
    let timeLeft = HARD_END - START - usedTime;

    let borrowed = true;
    while (borrowed && timeLeft >= PREP + 55) {
      borrowed = false;
      let bestOp = null, bestDay = -1, bestIdx = -1;

      for (let fd = d + 1; fd <= Math.min(d + planningWindow, schedule.length - 1); fd++) {
        for (let oi = 0; oi < schedule[fd].length; oi++) {
          const op = schedule[fd][oi];
          if (PREP + op.p50 <= timeLeft) {
            if (!bestOp || op.p50 < bestOp.p50) {
              bestOp = op; bestDay = fd; bestIdx = oi;
            }
          }
        }
      }

      if (bestOp) {
        schedule[d].push({ ...bestOp, isAccelerated: true, fromDay: bestDay });
        schedule[bestDay].splice(bestIdx, 1);
        usedTime += PREP + bestOp.p50;
        timeLeft = HARD_END - START - usedTime;
        borrowed = true;
      }
    }
  }

  return schedule
    .filter(day => day.length > 0)
    .map(day => day.map(({ p50, ...op }) => op));
}

function samplePoisson(lambda) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

function sampleStartDelay(onTimeProbability, meanDelay) {
  if (Math.random() < onTimeProbability) return 0;
  return Math.round(-meanDelay * Math.log(Math.max(Math.random(), 1e-10)));
}

function simulateMultiDay(plan, procParams, matrix, planMode, customOffsets, numDays, overtimeLimit, disruptions = {}) {
  const { enableDelay=false, delayOnTime=0.7, delayMean=20,
          enableSor=false, sorLambda=1, sorDuration=60, sorPriority="end" } = disruptions;
  const HARD_END = END + overtimeLimit;
  let carryQueue = [];
  let globalPlanId = 0;

  const calcPlanned = (proc, surg) => {
    if (planMode === "robust") return getPlanned(matrix, proc, surg, "robust", customOffsets);
    return getGlobalPlanned(procParams, proc, planMode, customOffsets);
  };

  const days = [];

  for (let d = 0; d < numDays; d++) {
    const freshOps = plan.map((op) => ({ ...op, planId: ++globalPlanId, isCarryOver: false }));
    const todayPlan = [
      ...carryQueue.map(op => ({ ...op, isCarryOver: true })),
      ...freshOps,
    ];
    carryQueue = [];

    const startDelay = enableDelay ? sampleStartDelay(delayOnTime, delayMean) : 0;

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
    let sorQueue = [...sorCases];

    for (let i = 0; i < todayPlan.length; i++) {
      const op = todayPlan[i];

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
      const planned = calcPlanned(op.proc, op.chir);

      const startReal = Math.max(tReal, START);
      const endReal = startReal + actual;
      const startPlan = tPlan;
      const endPlan = startPlan + planned;

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

function simulateDaysToComplete(plan, procParams, matrix, planMode, customOffsets, overtimeLimit, disruptions = {}, prepackedDayPlans = null) {
  const { enableDelay=false, delayOnTime=0.7, delayMean=20 } = disruptions;
  const HARD_END = END + overtimeLimit;
  const MAX_DAYS = plan.length * 3;

  const calcPlanned = (proc, surg) => {
    if (planMode === "robust") return getPlanned(matrix, proc, surg, "robust", customOffsets);
    return getGlobalPlanned(procParams, proc, planMode, customOffsets);
  };

  if (prepackedDayPlans) {
    let queue = prepackedDayPlans.flat().map((op, i) => ({ ...op, id: i }));
    let day = 0;
    while (queue.length > 0 && day < MAX_DAYS) {
      day++;
      const startDelay = enableDelay ? sampleStartDelay(delayOnTime, delayMean) : 0;
      let tReal = START + startDelay;
      const nextQueue = [];
      for (const op of queue) {
        const { mu, sigma } = procParams[op.proc] ?? { mu: 4.06, sigma: 0.28 };
        const skill = SURGEON_SKILL[op.chir] ?? 1;
        const actual = Math.max(15, Math.round(randLognorm(mu, sigma) * skill));
        const endReal = tReal + actual;
        if (endReal > HARD_END) { nextQueue.push(op); continue; }
        tReal = endReal + PREP;
      }
      queue = nextQueue;
    }
    return day;
  }

  let queue = plan.map((op, i) => ({ ...op, id: i }));
  let day = 0;

  while (queue.length > 0 && day < MAX_DAYS) {
    day++;
    const startDelay = enableDelay ? sampleStartDelay(delayOnTime, delayMean) : 0;
    let tReal = START + startDelay;
    let tPlan = START;
    const nextQueue = [];
    let overflowed = false;

    for (const op of queue) {
      const planned = calcPlanned(op.proc, op.chir);
      const { mu, sigma } = procParams[op.proc] ?? { mu: 4.06, sigma: 0.28 };
      const skill = SURGEON_SKILL[op.chir] ?? 1;
      const actual = Math.max(15, Math.round(randLognorm(mu, sigma) * skill));
      const endReal = tReal + actual;
      const endPlan = tPlan + planned;
      if (overflowed || endPlan > HARD_END || endReal > HARD_END) {
        overflowed = true;
        nextQueue.push(op);
        continue;
      }
      tReal = endReal + PREP;
      tPlan = endPlan + PREP;
    }
    queue = nextQueue;
  }
  return day;
}

function simulateDual(plan, procParams, matrix, planMode, customOffsets, robustLevel, numDays, overtimeLimit, disruptions = {}, robustPlanOverride = null, externalDraws = null) {
  const { enableDelay=false, delayOnTime=0.7, delayMean=20,
          enableSor=false, sorLambda=1, sorDuration=60, sorPriority="end" } = disruptions;
  const HARD_END = END + overtimeLimit;

  const draws = externalDraws ?? Array.from({ length: numDays }, (_, d) => {
    const startDelay = enableDelay ? sampleStartDelay(delayOnTime, delayMean) : 0;
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
    const actuals = plan.map(op => {
      const { mu, sigma } = procParams[op.proc] ?? { mu: 4.06, sigma: 0.28 };
      const skill = SURGEON_SKILL[op.chir] ?? 1;
      return Math.max(15, Math.round(randLognorm(mu, sigma) * skill));
    });
    return { startDelay, sorCases, actuals };
  });

  const runPlan = (planModeFn, planArg) => {
    const usePlan = planArg ?? plan;
    let carryQueue = [];
    let sorCarryQueue = [];
    let globalPlanId = 0;
    const days = [];

    for (let d = 0; d < numDays; d++) {
      const { startDelay, sorCases, actuals } = draws[d];
      const freshOps = usePlan.map((op, i) => ({ ...op, planId: ++globalPlanId, isCarryOver: false, _actualIdx: i }));

      const todaySorCarry = [...sorCarryQueue];
      sorCarryQueue = [];

      const todayPlan = [
        ...carryQueue.map(op => ({ ...op, isCarryOver: true })),
        ...freshOps,
      ];
      carryQueue = [];

      let tReal = START + startDelay;
      let tPlan = START;
      const rows = [];
      let overflowed = false;
      let sorQueue = [...sorCases];
      let freshIdx = 0;

      for (const sor of todaySorCarry) {
        if (tReal + sor.duration <= HARD_END) {
          rows.push({
            id: rows.length+1, planId:"SOR", dayIdx:d, chir:"SOR",
            proc:"Emergency (SOR)", isCarryOver:true, isSor:true,
            startPlan:tReal, endPlan:tReal+sor.duration,
            startReal:tReal, endReal:tReal+sor.duration,
            planned:sor.duration, actual:sor.duration, delay:0,
          });
          tReal += sor.duration + PREP;
          tPlan = tReal;
        } else {
          sorCarryQueue.push(sor);
        }
      }

      for (let i = 0; i < todayPlan.length; i++) {
        const op = todayPlan[i];

        if (sorPriority === "preempt") {
          while (sorQueue.length > 0 && sorQueue[0].arrivalMin <= tReal) {
            const sor = sorQueue.shift();
            if (!overflowed && tReal + sor.duration <= HARD_END) {
              rows.push({
                id: rows.length+1, planId:"SOR", dayIdx:d, chir:"SOR",
                proc:"Emergency (SOR)", isCarryOver:false, isSor:true,
                startPlan:tReal, endPlan:tReal+sor.duration,
                startReal:tReal, endReal:tReal+sor.duration,
                planned:sor.duration, actual:sor.duration, delay:0,
              });
              tReal += sor.duration + PREP;
              tPlan = tReal;
            } else {
              sorCarryQueue.push(sor);
            }
          }
        }

        const planned = planModeFn(op.proc, op.chir);
        const actual = op.isCarryOver
          ? Math.max(15, Math.round(randLognorm(
              procParams[op.proc]?.mu ?? 4.06,
              procParams[op.proc]?.sigma ?? 0.28
            ) * (SURGEON_SKILL[op.chir] ?? 1)))
          : (actuals[op._actualIdx] ?? actuals[freshIdx++ % actuals.length]);

        const startReal = Math.max(tReal, START);
        const endReal = startReal + actual;
        const startPlan = tPlan;
        const endPlan = startPlan + planned;

        if (overflowed || endPlan > HARD_END || endReal > HARD_END) {
          overflowed = true;
          carryQueue.push({ proc: op.proc, chir: op.chir, planId: op.planId, _actualIdx: op._actualIdx });
          continue;
        }

        rows.push({
          id: rows.length+1, planId: op.planId, dayIdx: d,
          chir: op.chir, proc: op.proc,
          isCarryOver: op.isCarryOver, isSor: false,
          startDelay: i === 0 ? startDelay : 0,
          startPlan, endPlan, startReal, endReal,
          planned, actual, delay: actual - planned,
        });

        tReal = endReal + PREP;
        tPlan = endPlan + PREP;
      }

      if (sorPriority === "end") {
        for (const sor of sorCases) {
          if (!overflowed && tReal + sor.duration <= HARD_END) {
            rows.push({
              id: rows.length+1, planId:"SOR", dayIdx:d, chir:"SOR",
              proc:"Emergency (SOR)", isCarryOver:false, isSor:true,
              startPlan:tReal, endPlan:tReal+sor.duration,
              startReal:tReal, endReal:tReal+sor.duration,
              planned:sor.duration, actual:sor.duration, delay:0,
            });
            tReal += sor.duration + PREP;
          } else {
            sorCarryQueue.push(sor);
          }
        }
      }

      days.push({
        dayIdx: d, rows,
        carryOverCount: carryQueue.length,
        sorCarryCount: sorCarryQueue.length,
        lastEnd: rows.at(-1)?.endReal ?? START,
        startDelay, sorCount: sorCases.length,
      });
    }
    return days;
  };

  const baseFn = (proc, surg) => getGlobalPlanned(procParams, proc, planMode, customOffsets);

  const planForRobust = robustPlanOverride ?? plan;
  const robustPlanMap = buildRobustPlan(planForRobust, matrix, procParams, robustLevel, overtimeLimit);
  const robustFn = (proc, surg) => getPlanned(matrix, proc, surg, "robust", {
    ...customOffsets, _robustPlan: robustPlanMap
  });

  return {
    base:   runPlan(baseFn, plan),
    robust: runPlan(robustFn, planForRobust),
    draws,
  };
}

// ── Simulate Optimized Plan (Rolling Horizon) ────────────────────────────
// FIX: removed debug console.log lines
function simulateOptimized(dayPlans, procParams, draws, overtimeLimit, disruptions = {}) {
  const { sorPriority = "end" } = disruptions;
  const HARD_END = END + overtimeLimit;
  const SOR_HARD_END = END + overtimeLimit + 90; // SOR wchodzi zawsze — wydłużamy dzień o max 90 min

  let carryQueue = [];
  let sorCarryQueue = [];
  let globalPlanId = 0;
  const days = [];
  const totalDays = dayPlans.length;
  const MAX_EXTRA_DAYS = 5;

  const actualsPool = draws.flatMap(d => d.actuals);
  let actualIdx = 0;

  const totalDaysWithExtra = totalDays + MAX_EXTRA_DAYS;

  for (let d = 0; d < totalDaysWithExtra; d++) {
    if (d >= totalDays && carryQueue.length === 0 && sorCarryQueue.length === 0) break;

    const draw = draws[Math.min(d, draws.length - 1)];
    const startDelay = d < totalDays ? draw.startDelay : 0;
    const sorCases = d < totalDays ? draw.sorCases : [];

    const todaySorCarry = [...sorCarryQueue];
    sorCarryQueue = [];

    const freshOps = d < totalDays
      ? dayPlans[d].map(op => ({
          ...op, planId: ++globalPlanId, isCarryOver: false, isAccelerated: op.isAccelerated ?? false
        }))
      : [];
    const todayPlan = [
      ...carryQueue.map(op => ({ ...op, isCarryOver: true })),
      ...freshOps,
    ];
    carryQueue = [];

    let tReal = START + startDelay;
    let tPlan = START;
    const rows = [];
    let overflowed = false;

    for (const sor of todaySorCarry) {
      if (tReal + sor.duration <= HARD_END) {
        rows.push({
          id: rows.length+1, planId:"SOR", dayIdx:d, chir:"SOR",
          proc:"Emergency (SOR)", isCarryOver:true, isSor:true,
          startPlan:tReal, endPlan:tReal+sor.duration,
          startReal:tReal, endReal:tReal+sor.duration,
          planned:sor.duration, actual:sor.duration, delay:0,
        });
        tReal += sor.duration + PREP;
        tPlan = tReal;
      } else {
        sorCarryQueue.push(sor);
      }
    }

    for (let i = 0; i < todayPlan.length; i++) {
      const op = todayPlan[i];
      const { mu, sigma } = procParams[op.proc] ?? { mu: 4.06, sigma: 0.28 };
      const skill = SURGEON_SKILL[op.chir] ?? 1;
      const actual = op.isCarryOver
        ? Math.max(15, Math.round(randLognorm(mu, sigma) * skill))
        : Math.max(15, actualsPool[actualIdx++ % actualsPool.length]);
      const planned = getGlobalPlanned(procParams, op.proc, "p50", {});
      const startReal = Math.max(tReal, START);
      const endReal = startReal + actual;
      const endPlan = tPlan + planned;

      if (overflowed || endPlan > HARD_END || endReal > HARD_END) {
        overflowed = true;
        carryQueue.push({ ...op });
        continue;
      }

      rows.push({
        id: rows.length+1, planId: op.planId, dayIdx: d,
        chir: op.chir, proc: op.proc,
        isCarryOver: op.isCarryOver, isAccelerated: op.isAccelerated ?? false, isSor: false,
        startDelay: i === 0 ? startDelay : 0,
        startPlan: tPlan, endPlan,
        startReal, endReal,
        planned, actual, delay: actual - planned,
      });
      tReal = endReal + PREP;
      tPlan = endPlan + PREP;
    }

    // Obsłuż SOR-y na końcu dnia — simulateOptimized nie ma trybu preempt,
    // zawsze wstawiamy wszystkie sorCases na koniec dnia
    const pendingSors = sorCases;
    for (const sor of pendingSors) {
      if (tReal + sor.duration <= SOR_HARD_END) {
        rows.push({
          id: rows.length+1, planId:"SOR", dayIdx:d, chir:"SOR",
          proc:"Emergency (SOR)", isCarryOver:false, isSor:true,
          startPlan:tReal, endPlan:tReal+sor.duration,
          startReal:tReal, endReal:tReal+sor.duration,
          planned:sor.duration, actual:sor.duration, delay:0,
        });
        tReal += sor.duration + PREP;
      } else {
        sorCarryQueue.push(sor);
      }
    }

    days.push({
      dayIdx: d, rows,
      carryOverCount: carryQueue.length,
      sorCarryCount: sorCarryQueue.length,
      lastEnd: rows.at(-1)?.endReal ?? START,
      startDelay, sorCount: sorCases.length,
      sorExecuted: rows.filter(r => r.isSor).length,
    });
  }

  return days;
}

function minToTime(m) {
  const h = Math.floor(m / 60) % 24, mm = m % 60;
  return `${String(h).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
}

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

function buildRandomPlan(n) {
  return Array.from({ length: n }, () => ({
    proc: PROCS[Math.floor(Math.random() * PROCS.length)],
    chir: SURGEONS[Math.floor(Math.random() * SURGEONS.length)],
  }));
}

function buildDemoPlan() {
  return [
    { proc: "Cholecystectomy",  chir: "C" },
    { proc: "Hernia Repair",    chir: "A" },
    { proc: "Major Surgery",    chir: "B" },
    { proc: "Appendectomy",     chir: "C" },
    { proc: "Hernia Repair",    chir: "B" },
  ];
}

function MiniGantt({ slots, matrix, procParams, planMode, customOffsets, planColor, numDays }) {
  const filledSlots = slots.filter(s => s.proc !== null);
  if (filledSlots.length === 0) return null;
  const W = 460;
  const calcDur = (s) => {
    if (planMode === "robust") {
      const robustMap = buildRobustPlan(filledSlots, matrix, procParams, customOffsets?._level ?? 2);
      return robustMap[`${s.proc}__${s.chir}`] ?? 60;
    }
    return getGlobalPlanned(procParams, s.proc, planMode, customOffsets);
  };

  const daysData = Array.from({ length: numDays }, (_, d) => {
    let t = START;
    const bars = filledSlots.map((s, i) => {
      const dur = calcDur(s);
      const start = t; const end = t + dur;
      t = end + PREP;
      const lp = d * filledSlots.length + i + 1;
      return { ...s, start, end, dur, lp };
    });
    const lastEnd = bars[bars.length - 1].end;
    return { d, bars, lastEnd, overtime: lastEnd > END };
  });

  return (
    <div style={{ marginTop:20, background:"#0a0a0f", borderRadius:8, padding:"14px 16px", border:"1px solid #1e1e2a" }}>
      <div style={{ fontSize:10, letterSpacing:"0.1em", color: planColor, textTransform:"uppercase",
        fontFamily:"'JetBrains Mono',monospace", marginBottom:8, fontWeight:700 }}>
        {planMode === "robust"
          ? `🛡 Robust Γ=${(customOffsets?._level ?? 2).toFixed(1)}`
          : `Plan · ${planMode.toUpperCase()}`}
        {" · "}{daysData.length} {daysData.length === 1 ? "day" : "days"}
      </div>
      {daysData.map(({ d, bars, lastEnd, overtime }) => (
        <div key={d} style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
            <span style={{ fontSize:10, color:"#e07b39", fontWeight:700, fontFamily:"'Syne',sans-serif" }}>Day {d + 1}</span>
            <span style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", color: overtime ? "#ff6b6b" : "#6bcb77" }}>
              {minToTime(lastEnd)}{overtime ? " ⚠" : " ✓"}
            </span>
          </div>
          <div style={{ position:"relative", height:14, marginBottom:2 }}>
            {Array.from({ length: 9 }, (_, i) => (8 + i) * 60).map(m => (
              <span key={m} style={{ position:"absolute", left:((m-START)/DAY_W)*W,
                transform:"translateX(-50%)", fontSize:8, color:"#333", fontFamily:"monospace" }}>
                {minToTime(m)}
              </span>
            ))}
          </div>
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

function ScheduleBuilder({ slots, setSlots, opsCount, setOpsCount, onRun, t, matrix, procParams, planMode, customOffsets, planColor, numDays, robustLevel, slotsRobust }) {
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
              const dur = slot.proc
                ? (planMode === "robust"
                    ? getPlanned(matrix, slot.proc, slot.chir, "robust", customOffsets)
                    : getGlobalPlanned(procParams, slot.proc, planMode, customOffsets))
                : null;
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:4 }}>
        <MiniGantt slots={slots} matrix={matrix} procParams={procParams} planMode={planMode}
          customOffsets={customOffsets} planColor={planColor} numDays={numDays} />
        <MiniGantt slots={slotsRobust ?? slots} matrix={matrix} procParams={procParams} planMode="robust"
          customOffsets={{ ...customOffsets, _level: robustLevel }} planColor="#00d4ff" numDays={numDays} />
      </div>
    </div>
  );
}

function MultiDayGantt({ days, planColor, t }) {
  const W = 560;
  return (
    <div>
      {days.map(({ dayIdx, rows, lastEnd, startDelay, sorCount, sorExecuted }) => {
        const overtime = lastEnd > END;
        const carryOvers = rows.filter(r => r.isCarryOver && !r.isSor).length;
        const accelerated = rows.filter(r => r.isAccelerated).length;
        return (
          <div key={dayIdx} style={{ marginBottom:20 }}>
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
                {accelerated > 0 && (
                  <span style={{ fontSize:10, color:"#6bcb77", fontFamily:"'JetBrains Mono',monospace", background:"#6bcb7722", padding:"2px 7px", borderRadius:4 }}>
                    ⏩ +{accelerated}
                  </span>
                )}
                {startDelay > 0 && (
                  <span style={{ fontSize:10, color:"#ff9f43", fontFamily:"'JetBrains Mono',monospace", background:"#ff9f4322", padding:"2px 7px", borderRadius:4 }}>
                    ⏱ +{startDelay}'
                  </span>
                )}
                {sorCount > 0 && (
                  <span style={{ fontSize:10, color:"#ff2244", fontFamily:"'JetBrains Mono',monospace", background:"#ff224422", padding:"2px 7px", borderRadius:4 }}>
                    🚨 SOR ×{sorExecuted ?? sorCount}{sorExecuted !== undefined && sorExecuted < sorCount ? ` (⚠ ${sorCount - sorExecuted} nieobs.)` : ""}
                  </span>
                )}
              </div>
              <div style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", color: overtime?"#ff6b6b":"#6bcb77" }}>
                {minToTime(lastEnd)}{overtime ? " ⚠" : " ✓"}
              </div>
            </div>
            <div style={{ overflowX:"auto" }}>
              <div style={{ minWidth:700 }}>
                <div style={{ display:"grid", gridTemplateColumns:"120px 1fr" }}>
                  <div /><TimeAxis width={W} />
                </div>
                <div style={{ position:"relative" }}>
                  <div style={{ position:"absolute", left: 120 + px(END, W), top:0, bottom:0, width:1, background:"#ff6b6b44", zIndex:1 }} />
                  {rows.map(row => (
                    <div key={row.id} style={{ display:"grid", gridTemplateColumns:"120px 1fr", alignItems:"center" }}>
                      <div style={{ fontSize:10, fontFamily:"'JetBrains Mono',monospace", paddingRight:8,
                        color: row.isSor ? "#ff2244" : row.isAccelerated ? "#6bcb77" : row.isCarryOver ? "#ff2244" : "#666" }}>
                        {row.isSor && <span style={{ fontSize:9, color:"#ff2244" }}>🚨 </span>}
                        {row.isCarryOver && !row.isSor && !row.isAccelerated && <span style={{ fontSize:9, color:"#ff2244" }}>↩ </span>}
                        {row.isAccelerated && <span style={{ fontSize:9, color:"#6bcb77" }}>⏩ </span>}
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


// ── calcKPI — shared KPI computation for all strategy tabs ────────────────
function calcKPI(d, totalD, { overtimeLimit, revenuePerMin, overtimeCostPerMin, dayOperatingCost, saved = 0 } = {}) {
  if (!d) return null;
  const allR = d.flatMap(x => x.rows).filter(r => !r.isSor);
  const totalOTMinAll = d.reduce((a, x) => a + Math.max(0, x.lastEnd - END), 0);
  const carryOver = allR.filter(r => r.isCarryOver && !r.isAccelerated).length;
  const accelerated = allR.filter(r => r.isAccelerated).length;
  const pctAccelerated = allR.length > 0 ? Math.round(accelerated / allR.length * 100) : 0;
  const eff = allR.length ? ((allR.reduce((a,r)=>a+r.actual,0)+PREP*(allR.length-1))/((END-START+(overtimeLimit??0))*totalD)*100).toFixed(1) : "—";
  const util = allR.length ? (allR.reduce((a,r)=>a+r.actual,0)/((END-START+(overtimeLimit??0))*totalD)*100).toFixed(1) : "—";
  const otcr = allR.length ? Math.round(allR.filter(r=>r.delay<=0).length/allR.length*100) : 0;
  const lastEnd = d.at(-1)?.lastEnd ?? END;
  const totalActual = allR.reduce((a,r)=>a+r.actual,0);
  const revenueTotal = Math.round(totalActual * (revenuePerMin ?? 0));
  const otCostTotal = Math.round(totalOTMinAll * (overtimeCostPerMin ?? 0));
  const saleSavingTotal = (saved ?? 0) * (dayOperatingCost ?? 0) * 1000;
  const totalResult = revenueTotal - otCostTotal + saleSavingTotal;
  const financial = Math.round(totalResult / totalD);
  const sorCount = d.reduce((a,x)=>a+(x.sorCount??0),0);
  return {
    otcr, carryOver, eff, util, lastEnd, overtime: lastEnd > END,
    totalOTMin: Math.round(totalOTMinAll/totalD),
    financial, accelerated, pctAccelerated, days: totalD, sorCount,
    revenueTotal, otCostTotal, saleSavingTotal, totalResult,
  };
}

export default function ORSimV5() {
  const [procParams, setProcParams]     = useLocalStorage("or_procParams", DEFAULT_PROC_PARAMS);
  const [planMode, setPlanMode]         = useLocalStorage("or_planMode", "mean");
  const [customOffsets, setCustomOffsets] = useLocalStorage("or_offsets", { Appendectomy:0, Cholecystectomy:0, "Hernia Repair":0, "Major Surgery":0 });
  const [lang, setLang]                 = useLocalStorage("or_lang", "pl");
  const [numDays, setNumDays]           = useLocalStorage("or_numDays", 7);
  const [overtimeLimit, setOvertimeLimit] = useLocalStorage("or_overtime", 60);
  const [opsCount, setOpsCount]         = useLocalStorage("or_opsCount", 5);
  const [slots, setSlots]               = useLocalStorage("or_slots", buildDemoPlan());
  const [slotsRobust, setSlotsRobust]   = useState(null);
  const [optimizedDayPlans, setOptimizedDayPlans] = useState(null);
  const [daysOptimized, setDaysOptimized] = useState(null);
  const [allStrategiesDays, setAllStrategiesDays] = useState(null);

  const [enableDelay, setEnableDelay]   = useLocalStorage("or_enableDelay", false);
  const [delayOnTime, setDelayOnTime]   = useLocalStorage("or_delayOnTime", 0.7);
  const [delayMean, setDelayMean]       = useLocalStorage("or_delayMean", 20);
  const [enableSor, setEnableSor]       = useLocalStorage("or_enableSor", true);
  const [sorLambda, setSorLambda]       = useLocalStorage("or_sorLambda", 0.5);
  const [sorDuration, setSorDuration]   = useLocalStorage("or_sorDuration", 60);
  const [sorPriority, setSorPriority]   = useLocalStorage("or_sorPriority", "end");

  const [runs, setRuns] = useState(0);
  const [aiSoon, setAiSoon] = useState(false);
  const [orSoon, setOrSoon] = useState(false);
  const [importSoon, setImportSoon] = useState(false);
  const [activeTab, setActiveTab] = useState("schedule");
  const [showHelp, setShowHelp] = useState(false);

  const [mcIterations, setMcIterations] = useLocalStorage("or_mcIter", 500);
  const [revenuePerMin, setRevenuePerMin] = useLocalStorage("or_revenue", 160);
  const [overtimeCostPerMin, setOvertimeCostPerMin] = useLocalStorage("or_otcost", 1100/60);
  const [dayOperatingCost, setDayOperatingCost] = useLocalStorage("or_daycost", 100);
  const [robustLevel, setRobustLevel] = useLocalStorage("or_robustLevel", 1.5);
  const [planningWindow, setPlanningWindow] = useLocalStorage("or_planWindow", 3);

  const t = T[lang];
  const matrix = useMemo(() => generateHistory(procParams), [procParams]);

  const initDual = useMemo(() => {
    const m = generateHistory(DEFAULT_PROC_PARAMS);
    const plan = buildRandomPlan(6);
    return simulateDual(plan, DEFAULT_PROC_PARAMS, m, "mean", {}, 0.8, 3, 60);
  }, []);
  const [dualDays, setDualDays] = useState(initDual);

  const days = dualDays.base;
  const daysRobust = dualDays.robust;

  const disruptions = { enableDelay, delayOnTime, delayMean, enableSor, sorLambda, sorDuration, sorPriority };

  const runSim = useCallback(() => {
    const validPlan = slots.filter(s => s.proc !== null);
    if (validPlan.length === 0) return;
    setRuns(r => r + 1);
    const robustPlan = slotsRobust ? slotsRobust.filter(s => s.proc !== null) : null;
    const result = simulateDual(validPlan, procParams, matrix, planMode, customOffsets, robustLevel, numDays, overtimeLimit, disruptions, robustPlan);
    setDualDays(result);
    const rhDayPlans = buildRollingHorizonPlan(slots, procParams, overtimeLimit, numDays, planningWindow);
    const rhDays = simulateOptimized(rhDayPlans, procParams, result.draws, overtimeLimit, disruptions);
    setDaysOptimized(rhDays);
    const allStrats = {};
    for (const mode of ["mean", "p50", "p80", "custom"]) {
      const r = simulateDual(validPlan, procParams, matrix, mode, customOffsets, robustLevel, numDays, overtimeLimit, disruptions, null, result.draws);
      allStrats[mode] = r.base;
    }
    allStrats.robust = result.robust;
    allStrats.rh = rhDays;
    setAllStrategiesDays(allStrats);
    setActiveTab("test");
  }, [slots, slotsRobust, procParams, matrix, planMode, customOffsets, robustLevel, numDays, overtimeLimit, enableDelay, delayOnTime, delayMean, enableSor, sorLambda, sorDuration, sorPriority, planningWindow]);

  const handleModeChange = (mode) => {
    setPlanMode(mode);
    const validPlan = slots.filter(s => s.proc !== null);
    const robustPlan = slotsRobust ? slotsRobust.filter(s => s.proc !== null) : null;
    setDualDays(simulateDual(validPlan, procParams, matrix, mode, customOffsets, robustLevel, numDays, overtimeLimit, disruptions, robustPlan));
  };

  const [mcResults, setMcResults] = useState(null);
  const [selectedStrat, setSelectedStrat] = useState("robust");
  const [mcRunning, setMcRunning] = useState(false);

  const runMonteCarlo = useCallback((iterOverride) => {
    const validPlan = slots.filter(s => s.proc !== null);
    if (validPlan.length === 0) return;
    setMcRunning(true);
    setMcResults(null);

    setTimeout(() => {
      const modes = ["mean", "p50", "p80", "custom", "robust"];
      const robustPlanForMC = (slotsRobust && slotsRobust.filter(s => s.proc !== null).length > 0)
        ? slotsRobust.filter(s => s.proc !== null)
        : validPlan;

      const nIter = Math.max(1, (typeof iterOverride === "number" ? iterOverride : null) ?? mcIterations);
      const results = {};
      for (const mode of modes) {
        const planForMode = mode === "robust" ? robustPlanForMC : validPlan;
        const endTimes = [], delays = [], overtimeDays = [], carryDays = [];
        const overtimeMins = [], carryOvers = [], efficiencies = [], utilizations = [], opsMins = [], financials = [];
        const totalPlannedMins = [], totalActualMins = [], opsOnTime = [], opsLate = [], daysToFinish = [];
        for (let i = 0; i < nIter; i++) {
          const sim = simulateMultiDay(planForMode, procParams, matrix, mode, customOffsets, numDays, overtimeLimit, disruptions);
          const allR = sim.flatMap(d => d.rows).filter(r => !r.isSor);
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
          const totalOpsMinAll = allR.reduce((a,r)=>a+r.actual,0);
          const totalPlanned = allR.reduce((a,r)=>a+r.planned,0);
          const financial = Math.round((totalOpsMinAll * revenuePerMin - totalOTMin * overtimeCostPerMin) / numDays);
          const nOnTime = allR.filter(r => r.delay <= 0).length;
          const nLate   = allR.filter(r => r.delay > 0).length;
          const fullPeriodPlan = Array.from({ length: numDays }, () => planForMode).flat();
          const dtc = simulateDaysToComplete(fullPeriodPlan, procParams, matrix, mode, customOffsets, overtimeLimit, disruptions, null);
          endTimes.push(lastE);
          delays.push(totalD);
          overtimeDays.push(hasOT ? 1 : 0);
          carryDays.push(hasCO ? 1 : 0);
          overtimeMins.push(totalOTMin);
          carryOvers.push(totalCO);
          efficiencies.push(eff);
          utilizations.push(util);
          opsMins.push(opsMin);
          financials.push(financial);
          totalPlannedMins.push(totalPlanned);
          totalActualMins.push(totalOpsMinAll);
          opsOnTime.push(nOnTime);
          opsLate.push(nLate);
          daysToFinish.push(dtc);
        }
        endTimes.sort((a, b) => a - b);
        delays.sort((a, b) => a - b);
        results[mode] = {
          overtimeRate: Math.round(overtimeDays.reduce((a,b)=>a+b,0) / nIter * 100),
          carryOverRate: Math.round(carryDays.reduce((a,b)=>a+b,0) / nIter * 100),
          avgDelay: Math.round(delays.reduce((a,b)=>a+b,0) / nIter),
          p80Delay: delays[Math.floor(nIter * 0.8)],
          avgEnd: Math.round(endTimes.reduce((a,b)=>a+b,0) / nIter),
          avgOvertimeMin: Math.round(overtimeMins.reduce((a,b)=>a+b,0) / nIter / numDays),
          avgCarryOver: numDays > 1 ? Math.round(carryOvers.reduce((a,b)=>a+b,0) / nIter / (numDays-1) * 10) / 10 : 0,
          worstEnd: endTimes.length ? Math.max(...endTimes) : END,
          avgEfficiency: Math.round(efficiencies.reduce((a,b)=>a+b,0) / nIter * 10) / 10,
          avgUtilization: Math.round(utilizations.reduce((a,b)=>a+b,0) / nIter * 10) / 10,
          avgOpsMin: Math.round(opsMins.reduce((a,b)=>a+b,0) / nIter),
          avgFinancial: Math.round(financials.reduce((a,b)=>a+b,0) / nIter),
          totalPlanned: Math.round(totalPlannedMins.reduce((a,b)=>a+b,0) / nIter),
          totalActual: Math.round(totalActualMins.reduce((a,b)=>a+b,0) / nIter),
          totalOpsOnTime: Math.round(opsOnTime.reduce((a,b)=>a+b,0) / nIter),
          totalOpsLate: Math.round(opsLate.reduce((a,b)=>a+b,0) / nIter),
          otcr: (() => { const tot = opsOnTime.reduce((a,b)=>a+b,0) + opsLate.reduce((a,b)=>a+b,0); return tot > 0 ? Math.round(opsOnTime.reduce((a,b)=>a+b,0) / tot * 100) : 0; })(),
          avgDaysToFinish: Math.round(daysToFinish.reduce((a,b)=>a+b,0) / nIter * 10) / 10,
          minDaysToFinish: daysToFinish.length ? Math.min(...daysToFinish) : 0,
          maxDaysToFinish: daysToFinish.length ? Math.max(...daysToFinish) : 0,
          endTimes,
        };
      }
      setMcResults(results);
      setMcRunning(false);
    }, 50);
  }, [slots, slotsRobust, procParams, matrix, customOffsets, numDays, overtimeLimit, disruptions, mcIterations, revenuePerMin, overtimeCostPerMin]);

  const handleRandomize = () => {
    setSlots(buildRandomPlan(opsCount));
    setSlotsRobust(null);
    setLastOptimizeResult(null);
    setOptimizedDayPlans(null);
  };

  const handleResetDemo = () => {
    setSlots(buildDemoPlan());
    setOpsCount(5);
    setNumDays(7);
    setOvertimeLimit(60);
    setEnableSor(true);
    setSorLambda(0.5);
    setRobustLevel(1.5);
    setSlotsRobust(null);
    setLastOptimizeResult(null);
  };

  const [lastOptimizeResult, setLastOptimizeResult] = useState(null);

  const handleOptimize = useCallback(() => {
    // Sortuj sloty po CV (najbardziej przewidywalne pierwsze) — bez cross-day borrowing
    const validSlots = slots.filter(s => s.proc !== null);
    const scored = validSlots.map(s => {
      const { mu, sigma } = procParams[s.proc] ?? { mu: 4.06, sigma: 0.28 };
      return { ...s, cv: sigma / mu };
    });
    const sorted = scored.sort((a, b) => a.cv - b.cv).map(({ cv, ...s }) => s);
    while (sorted.length < slots.length) sorted.push({ proc: null, chir: "A" });
    const result = { slots: sorted, totalDays: numDays, saved: 0 };
    setSlotsRobust(result.slots);
    setLastOptimizeResult(result);
    const basePlan = slots.filter(s => s.proc !== null);
    const robustPlan = result.slots.filter(s => s.proc !== null);
    if (basePlan.length > 0) {
      setDualDays(simulateDual(basePlan, procParams, matrix, planMode, customOffsets, robustLevel, numDays, overtimeLimit, disruptions, robustPlan));
    }
  }, [slots, procParams, matrix, robustLevel, overtimeLimit, numDays, planningWindow, planMode, customOffsets, disruptions]);

  const setParam = (proc, key, val) =>
    setProcParams(prev => ({ ...prev, [proc]: { ...prev[proc], [key]: val } }));
  const setOffset = (proc, val) =>
    setCustomOffsets(prev => ({ ...prev, [proc]: val }));

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
      planned: planMode === "robust"
        ? getPlanned(matrix, proc, surg, "robust", customOffsets)
        : getGlobalPlanned(procParams, proc, planMode, customOffsets),
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
    robust: { color:"#00d4ff", ...t.planning.modes.robust },
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
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#111118", border:"1px solid #1e1e2a", borderRadius:8, padding:"8px 14px" }}>
            <span style={{ fontSize:11, color:"#666", whiteSpace:"nowrap" }}>{t.daysLabel}:</span>
            <input type="range" min={1} max={30} step={1} value={numDays}
              onChange={e => setNumDays(parseInt(e.target.value))}
              style={{ width:80, accentColor:"#e07b39", cursor:"pointer" }} />
            <span style={{ fontSize:14, fontWeight:700, color:"#e07b39", fontFamily:"'JetBrains Mono',monospace", minWidth:16 }}>{numDays}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, background:"#111118", border:"1px solid #1e1e2a", borderRadius:8, padding:"8px 14px" }}>
            <span style={{ fontSize:11, color:"#666", whiteSpace:"nowrap" }}>{t.overtimeLabel}:</span>
            <input type="range" min={0} max={120} step={15} value={overtimeLimit}
              onChange={e => setOvertimeLimit(parseInt(e.target.value))}
              style={{ width:80, accentColor:"#ff6b6b", cursor:"pointer" }} />
            <span style={{ fontSize:14, fontWeight:700, color:"#ff6b6b", fontFamily:"'JetBrains Mono',monospace", minWidth:32 }}>{overtimeLimit}'</span>
          </div>
          <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:"1px solid #252530" }}>
            {["pl","en"].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{ padding:"8px 14px", background: lang===l?"#e07b39":"transparent", color: lang===l?"#fff":"#555", border:"none", cursor:"pointer", fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:12, transition:"all 0.15s" }}>{l.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => setShowHelp(true)} style={{ background:"transparent", color:"#555", border:"1px solid #252530", borderRadius:8, padding:"10px 16px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>{t.help}</button>
          <button onClick={runSim} style={{ background:"linear-gradient(135deg,#e07b39,#c45e1a)", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>{t.runBtn}</button>
        </div>
      </div>

      {showHelp && (
        <div onClick={() => setShowHelp(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#111118", border:"1px solid #1e1e2a", borderRadius:12, padding:"28px 32px", maxWidth:580, width:"100%", maxHeight:"80vh", overflowY:"auto", position:"relative" }}>
            <button onClick={() => setShowHelp(false)} style={{ position:"absolute", top:16, right:16, background:"transparent", border:"none", color:"#555", fontSize:20, cursor:"pointer", lineHeight:1 }}>✕</button>
            <div style={{ fontSize:10, letterSpacing:"0.15em", color:"#444", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", marginBottom:8 }}>{t.helpModal.label}</div>
            <h2 style={{ margin:"0 0 14px", fontSize:18, color:"#f0ede8" }}>{t.helpModal.title}</h2>
            <div style={{ fontSize:12, color:"#888", lineHeight:1.8, marginBottom:20,
              padding:"12px 16px", background:"#0d0d14", borderRadius:8,
              borderLeft:"3px solid #e07b39" }}>
              {t.helpModal.intro}
            </div>
            <div style={{ fontSize:10, letterSpacing:"0.08em", color:"#444", textTransform:"uppercase",
              fontFamily:"'JetBrains Mono',monospace", marginBottom:12 }}>
              {lang==="pl" ? "Jak używać" : "How to use"}
            </div>
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

      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {Object.entries(t.tabs).map(([k,lbl]) => (
          <button key={k} className={`tab ${activeTab===k?"tab-active":"tab-inactive"}`} onClick={()=>setActiveTab(k)}>{lbl}</button>
        ))}
      </div>

      {activeTab === "schedule" && (
        <div className="card">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace" }}>{t.schedule.title}</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={handleResetDemo} style={{ background:"#e07b3918", border:"1px solid #e07b3944", color:"#e07b39", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>🏥 Demo</button>
              <button onClick={handleRandomize} style={{ background:"#1a1a28", border:"1px solid #252530", color:"#aaa", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>{t.schedule.randomize}</button>
              <button onClick={handleOptimize} style={{ background:"#00d4ff18", border:"1px solid #00d4ff44", color:"#00d4ff", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>
                🔧 {lang==="pl" ? "Optymalizuj" : "Optimize"}
              </button>
            </div>
          </div>
          {lastOptimizeResult && (
            <div style={{ marginBottom:12, padding:"8px 14px", borderRadius:6,
              background: lastOptimizeResult.saved > 0 ? "#00d4ff12" : "#6bcb7712",
              border:`1px solid ${lastOptimizeResult.saved > 0 ? "#00d4ff44" : "#6bcb7744"}`,
              fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>
              {lastOptimizeResult.saved > 0
                ? <span style={{ color:"#00d4ff" }}>
                    🔧 {lang==="pl"
                      ? `Robust zoptymalizowany · ${lastOptimizeResult.totalDays} dni zamiast ${numDays} · oszczędność ${lastOptimizeResult.saved} ${lastOptimizeResult.saved === 1 ? "dnia" : "dni"} · Plan bazowy niezmieniony`
                      : `Robust optimized · ${lastOptimizeResult.totalDays} days instead of ${numDays} · saved ${lastOptimizeResult.saved} day(s) · Base plan unchanged`}
                  </span>
                : <span style={{ color:"#6bcb77" }}>
                    🔧 {lang==="pl"
                      ? `Robust zoptymalizowany · ${lastOptimizeResult.totalDays} dni · brak miejsca na skrócenie okresu · Plan bazowy niezmieniony`
                      : `Robust optimized · ${lastOptimizeResult.totalDays} days · no room to shorten period · Base plan unchanged`}
                  </span>
              }
            </div>
          )}
          <div style={{ marginBottom:16, padding:"10px 16px", borderRadius:8,
            background:"#e07b3912", border:"1px solid #e07b3944",
            fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:"#e07b39" }}>
            🏥 {lang==="pl"
              ? "Gotowy plan demonstracyjny · 7 dni · 5 operacji/dzień · SOR włączony — kliknij ▶ Uruchom symulację aby zobaczyć wyniki"
              : "Demo plan ready · 7 days · 5 ops/day · SOR enabled — click ▶ Run simulation to see results"}
          </div>
          <ScheduleBuilder slots={slots} setSlots={setSlots} opsCount={opsCount} setOpsCount={setOpsCount}
            onRun={runSim} t={t.schedule} matrix={matrix} procParams={procParams} planMode={planMode}
            customOffsets={customOffsets} planColor={MODE_CONFIG[planMode].color} numDays={numDays}
            robustLevel={robustLevel} slotsRobust={slotsRobust} />
          <div style={{ marginTop:10, fontSize:11, color:"#555", fontFamily:"'JetBrains Mono',monospace" }}>
            ↳ {lang==="pl" ? "Parametry symulacji w zakładce Ustawienia" : "Simulation parameters in Settings tab"}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div style={{ display:"grid", gap:14 }}>
          <div className="card">
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
              marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>
              📅 {lang==="pl" ? "Harmonogram" : "Schedule"}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:11, color:"#888" }}>{t.daysLabel}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"#e07b39", fontFamily:"'JetBrains Mono',monospace" }}>{numDays}</span>
                </div>
                <input type="range" min={1} max={30} step={1} value={numDays}
                  onChange={e => setNumDays(parseInt(e.target.value))}
                  style={{ width:"100%", accentColor:"#e07b39", cursor:"pointer" }} />
              </div>
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:11, color:"#888" }}>{t.overtimeLabel}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"#ff6b6b", fontFamily:"'JetBrains Mono',monospace" }}>{overtimeLimit}'</span>
                </div>
                <input type="range" min={0} max={120} step={15} value={overtimeLimit}
                  onChange={e => setOvertimeLimit(parseInt(e.target.value))}
                  style={{ width:"100%", accentColor:"#ff6b6b", cursor:"pointer" }} />
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
              marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>
              🎯 {lang==="pl" ? "Strategia planowania" : "Planning strategy"}
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:16 }}>
              {Object.entries(MODE_CONFIG).filter(([m]) => m !== "robust").map(([mode, cfg]) => (
                <ModeBtn key={mode} mode={mode} active={planMode===mode} onClick={handleModeChange}
                  label={cfg.label} desc={cfg.desc} color={cfg.color} />
              ))}
            </div>
            <div style={{ background:"#0d0d1a", borderRadius:8, padding:"14px 16px", border:"1px solid #00d4ff33" }}>
              {/* Header MIT Robust */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
                <div>
                  <span style={{ fontSize:11, color:"#00d4ff", fontWeight:700 }}>MIT Robust Scheduling</span>
                  <span style={{ fontSize:10, color:"#555", marginLeft:8, fontFamily:"'JetBrains Mono',monospace" }}>Denton et al. · Box Uncertainty Set</span>
                </div>
                <span style={{ fontSize:18, fontWeight:700, color:"#00d4ff", fontFamily:"'JetBrains Mono',monospace" }}>Γ = {robustLevel.toFixed(1)}</span>
              </div>
              {/* Wzór */}
              <div style={{ fontSize:10, color:"#555", fontFamily:"'JetBrains Mono',monospace", marginBottom:10,
                background:"#060610", borderRadius:6, padding:"6px 10px", lineHeight:1.8 }}>
                <span style={{ color:"#00d4ff88" }}>budget</span> = min(<span style={{ color:"#00d4ff" }}>Γ</span> × max_deviation, available_time)<br/>
                <span style={{ color:"#00d4ff88" }}>deviation</span> = P80 − P50 <span style={{ color:"#333" }}>per operacja</span><br/>
                <span style={{ color:"#00d4ff88" }}>allocation</span> = budget × (deviation_i / Σdeviation)
              </div>
              {/* Suwak */}
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                <span style={{ fontSize:10, color:"#555", whiteSpace:"nowrap" }}>Γ =</span>
                <input type="range" min={0} max={slots.filter(s=>s.proc).length || 6} step={0.5}
                  value={robustLevel} onChange={e => setRobustLevel(parseFloat(e.target.value))}
                  style={{ flex:1, accentColor:"#00d4ff", cursor:"pointer" }} />
                <span style={{ fontSize:10, color:"#555", whiteSpace:"nowrap", fontFamily:"'JetBrains Mono',monospace" }}>
                  {lang==="pl" ? `chroni ${robustLevel.toFixed(1)} ops` : `protects ${robustLevel.toFixed(1)} ops`}
                </span>
              </div>
              {/* Wykres buforów per operacja */}
              {(() => {
                const validSlots = slots.filter(s => s.proc !== null);
                if (validSlots.length === 0) return null;
                const ops = validSlots.map(op => {
                  const { mu, sigma } = procParams[op.proc] ?? { mu: 4.06, sigma: 0.28 };
                  const p50 = Math.round(Math.exp(mu));
                  const p80 = Math.round(Math.exp(mu + 0.842 * sigma));
                  return { proc: op.proc, chir: op.chir, p50, deviation: Math.max(0, p80 - p50) };
                });
                const maxDev = Math.max(...ops.map(o => o.deviation), 1);
                const totalDev = ops.reduce((a, o) => a + o.deviation, 0) || 1;
                const availBuffer = Math.max(0, (END - START + overtimeLimit) - ops.reduce((a,o)=>a+o.p50,0) - 15*(ops.length-1));
                const totalBudget = Math.min(robustLevel * maxDev, availBuffer);
                const maxBar = Math.max(...ops.map(o => o.p50 + Math.round(o.deviation / totalDev * totalBudget)), 1);
                return (
                  <div>
                    <div style={{ fontSize:9, color:"#333", fontFamily:"'JetBrains Mono',monospace",
                      textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>
                      {lang==="pl" ? "Bufor Γ per operacja" : "Γ buffer per operation"}
                      <span style={{ color:"#555", marginLeft:8 }}>
                        budget={Math.round(totalBudget)}' · available={availBuffer}'
                      </span>
                    </div>
                    {ops.map((op, i) => {
                      const buffer = Math.round(op.deviation / totalDev * totalBudget);
                      const color = PROC_COLORS[op.proc] ?? "#888";
                      const barW = (op.p50 / maxBar) * 100;
                      const bufW = (buffer / maxBar) * 100;
                      return (
                        <div key={i} style={{ display:"grid", gridTemplateColumns:"120px 1fr 48px", alignItems:"center", gap:6, marginBottom:4 }}>
                          <div style={{ fontSize:9, color:`${color}cc`, fontFamily:"'JetBrains Mono',monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            <span style={{ color:SURGEON_COLORS[op.chir], fontWeight:700 }}>{op.chir}</span> {op.proc}
                          </div>
                          <div style={{ position:"relative", height:14, background:"#111118", borderRadius:3, overflow:"hidden" }}>
                            <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${barW}%`,
                              background:`${color}55`, borderRadius:3 }} />
                            <div style={{ position:"absolute", left:`${barW}%`, top:0, height:"100%", width:`${bufW}%`,
                              background:"#00d4ff55", borderRadius:3,
                              borderLeft: buffer > 0 ? "1px solid #00d4ff" : "none" }} />
                          </div>
                          <div style={{ fontSize:9, fontFamily:"'JetBrains Mono',monospace", textAlign:"right",
                            color: buffer > 0 ? "#00d4ff" : "#333" }}>
                            {buffer > 0 ? `+${buffer}'` : "0'"}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display:"flex", gap:14, marginTop:6, fontSize:9, fontFamily:"'JetBrains Mono',monospace", color:"#444" }}>
                      <span><span style={{ display:"inline-block", width:10, height:10, background:"#4a9eff55", borderRadius:2, marginRight:4 }}/>P50</span>
                      <span><span style={{ display:"inline-block", width:10, height:10, background:"#00d4ff55", borderRadius:2, marginRight:4, borderLeft:"1px solid #00d4ff" }}/>Γ buffer</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{ background:"#0d0d1a", borderRadius:8, padding:"14px 16px", border:"1px solid #00d4ff33", marginTop:8 }}>
              {/* Header RH */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
                <div>
                  <span style={{ fontSize:11, color:"#00d4ff", fontWeight:700 }}>Rolling Horizon Optimizer</span>
                  <span style={{ fontSize:10, color:"#555", marginLeft:8, fontFamily:"'JetBrains Mono',monospace" }}>
                    {lang==="pl" ? "okno look-ahead" : "look-ahead window"}
                  </span>
                </div>
                <span style={{ fontSize:18, fontWeight:700, color:"#00d4ff", fontFamily:"'JetBrains Mono',monospace" }}>{planningWindow}d</span>
              </div>
              {/* Opis */}
              <div style={{ fontSize:10, color:"#555", fontFamily:"'JetBrains Mono',monospace", marginBottom:10,
                background:"#060610", borderRadius:6, padding:"6px 10px", lineHeight:1.8 }}>
                {lang==="pl"
                  ? <><span style={{ color:"#00d4ff88" }}>idea</span>{"  "} zamiast sztywnego planu — patrz w przyszłość<br/>
                     <span style={{ color:"#00d4ff88" }}>krok</span>{"  "} po każdym dniu: czy zostało wolne miejsce?<br/>
                     <span style={{ color:"#00d4ff88" }}>akcja</span>{" "} pożycz najkrótszą op z kolejnych {planningWindow} dni ⏩</>
                  : <><span style={{ color:"#00d4ff88" }}>idea</span>{"  "} instead of a fixed plan — look ahead<br/>
                     <span style={{ color:"#00d4ff88" }}>step</span>{"  "} after each day: is there free capacity left?<br/>
                     <span style={{ color:"#00d4ff88" }}>action</span>{" "} borrow shortest op from next {planningWindow} days ⏩</>
                }
              </div>
              {/* Suwak */}
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <span style={{ fontSize:10, color:"#555", whiteSpace:"nowrap" }}>
                  {lang==="pl" ? "okno =" : "window ="}
                </span>
                <input type="range" min={1} max={7} step={1} value={planningWindow}
                  onChange={e => setPlanningWindow(parseInt(e.target.value))}
                  style={{ flex:1, accentColor:"#00d4ff", cursor:"pointer" }} />
                <span style={{ fontSize:10, color:"#555", whiteSpace:"nowrap", fontFamily:"'JetBrains Mono',monospace" }}>
                  {lang==="pl" ? `${planningWindow} dni do przodu` : `${planningWindow} days ahead`}
                </span>
              </div>
              {/* Mini wizualizacja okna */}
              <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                {Array.from({ length: Math.min(numDays, 7) }, (_, i) => {
                  const isToday = i === 0;
                  const inWindow = i > 0 && i <= planningWindow;
                  return (
                    <div key={i} style={{
                      flex:1, height:28, borderRadius:4, display:"flex", alignItems:"center",
                      justifyContent:"center", fontSize:9, fontFamily:"'JetBrains Mono',monospace",
                      fontWeight:700,
                      background: isToday ? "#00d4ff22" : inWindow ? "#00d4ff11" : "#111118",
                      border: isToday ? "1px solid #00d4ff" : inWindow ? "1px dashed #00d4ff55" : "1px solid #1e1e2a",
                      color: isToday ? "#00d4ff" : inWindow ? "#00d4ff88" : "#333",
                    }}>
                      {isToday ? (lang==="pl" ? "dziś" : "today") : inWindow ? `+${i}` : `+${i}`}
                    </div>
                  );
                })}
                {numDays > 7 && <span style={{ fontSize:9, color:"#333" }}>…</span>}
              </div>
              <div style={{ display:"flex", gap:12, marginTop:6, fontSize:9, fontFamily:"'JetBrains Mono',monospace", color:"#444" }}>
                <span><span style={{ display:"inline-block", width:10, height:10, background:"#00d4ff22", border:"1px solid #00d4ff", borderRadius:2, marginRight:4 }}/>
                  {lang==="pl" ? "dzień bieżący" : "current day"}</span>
                <span><span style={{ display:"inline-block", width:10, height:10, background:"#00d4ff11", border:"1px dashed #00d4ff55", borderRadius:2, marginRight:4 }}/>
                  {lang==="pl" ? "zasięg pożyczania" : "borrow range"}</span>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
              marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>
              ⚡ {lang==="pl" ? "Zakłócenia" : "Disruptions"}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
              <div style={{ background: enableDelay ? "#ff9f4314" : "#111118",
                border:`1px solid ${enableDelay ? "#ff9f4366" : "#1e1e2a"}`, borderRadius:8, padding:"14px 16px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: enableDelay ? 14 : 0,
                  cursor:"pointer" }} onClick={() => setEnableDelay(v => !v)}>
                  <div style={{ width:18, height:18, borderRadius:4, flexShrink:0,
                    background: enableDelay ? "#ff9f43" : "transparent",
                    border:`2px solid ${enableDelay ? "#ff9f43" : "#333"}`,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {enableDelay && <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:12, fontWeight:600, color: enableDelay ? "#ff9f43" : "#555" }}>
                    ⏱ {t.schedule.enableDelay}
                  </span>
                </div>
                {enableDelay && (
                  <div>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:10, color:"#888" }}>{t.params.delayOnTime}</span>
                        <span style={{ fontSize:11, color:"#ff9f43", fontFamily:"'JetBrains Mono',monospace" }}>{Math.round(delayOnTime*100)}%</span>
                      </div>
                      <input type="range" min={0} max={1} step={0.05} value={delayOnTime}
                        onChange={e => setDelayOnTime(parseFloat(e.target.value))}
                        style={{ width:"100%", accentColor:"#ff9f43", cursor:"pointer" }} />
                    </div>
                    <div>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:10, color:"#888" }}>{t.params.delayMean}</span>
                        <span style={{ fontSize:11, color:"#ff9f43", fontFamily:"'JetBrains Mono',monospace" }}>{delayMean}'</span>
                      </div>
                      <input type="range" min={5} max={60} step={5} value={delayMean}
                        onChange={e => setDelayMean(parseInt(e.target.value))}
                        style={{ width:"100%", accentColor:"#ff9f43", cursor:"pointer" }} />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ background: enableSor ? "#ff224414" : "#111118",
                border:`1px solid ${enableSor ? "#ff224466" : "#1e1e2a"}`, borderRadius:8, padding:"14px 16px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: enableSor ? 14 : 0,
                  cursor:"pointer" }} onClick={() => setEnableSor(v => !v)}>
                  <div style={{ width:18, height:18, borderRadius:4, flexShrink:0,
                    background: enableSor ? "#ff2244" : "transparent",
                    border:`2px solid ${enableSor ? "#ff2244" : "#333"}`,
                    display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {enableSor && <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:12, fontWeight:600, color: enableSor ? "#ff2244" : "#555" }}>
                    🚨 {t.schedule.enableSor}
                  </span>
                </div>
                {enableSor && (
                  <div>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:10, color:"#888" }}>{t.params.sorLambda}</span>
                        <span style={{ fontSize:11, color:"#ff2244", fontFamily:"'JetBrains Mono',monospace" }}>λ={sorLambda}</span>
                      </div>
                      <input type="range" min={0.5} max={3} step={0.5} value={sorLambda}
                        onChange={e => setSorLambda(parseFloat(e.target.value))}
                        style={{ width:"100%", accentColor:"#ff2244", cursor:"pointer" }} />
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:10, color:"#888" }}>{t.params.sorDuration}</span>
                        <span style={{ fontSize:11, color:"#ff2244", fontFamily:"'JetBrains Mono',monospace" }}>{sorDuration}'</span>
                      </div>
                      <input type="range" min={20} max={120} step={10} value={sorDuration}
                        onChange={e => setSorDuration(parseInt(e.target.value))}
                        style={{ width:"100%", accentColor:"#ff2244", cursor:"pointer" }} />
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      {["preempt","end"].map((p, i) => (
                        <button key={p} onClick={() => setSorPriority(p)} style={{
                          flex:1, padding:"5px 8px", borderRadius:6, cursor:"pointer", fontSize:10,
                          border:`1px solid ${sorPriority===p ? "#ff2244" : "#252530"}`,
                          background: sorPriority===p ? "#ff224420" : "#0d0d14",
                          color: sorPriority===p ? "#ff2244" : "#555",
                          fontFamily:"'Syne',sans-serif", fontWeight:600,
                        }}>{t.params.sorPriorityOptions[i]}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
              marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>
              💰 {lang==="pl" ? "Parametry finansowe" : "Financial parameters"}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 }}>
              {[
                { label: lang==="pl"?"Przychód (zł/min)":"Revenue (zł/min)", value: revenuePerMin, set: setRevenuePerMin, min:50, max:300, step:10, color:"#6bcb77", fmt: v=>`${v} zł` },
                { label: lang==="pl"?"Koszt nadgodzin (zł/h)":"Overtime cost (zł/h)", value: Math.round(overtimeCostPerMin*60), set: v=>setOvertimeCostPerMin(v/60), min:100, max:2000, step:50, color:"#ff6b6b", fmt: v=>`${v} zł` },
                { label: lang==="pl"?"Koszt dnia sali (tys.)":"OR day cost (k zł)", value: dayOperatingCost, set: setDayOperatingCost, min:50, max:300, step:10, color:"#a78bfa", fmt: v=>`${v} tys.` },
              ].map(f => (
                <div key={f.label}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:10, color:"#888" }}>{f.label}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:f.color, fontFamily:"'JetBrains Mono',monospace" }}>{f.fmt(f.value)}</span>
                  </div>
                  <input type="range" min={f.min} max={f.max} step={f.step} value={f.value}
                    onChange={e => f.set(parseInt(e.target.value))}
                    style={{ width:"100%", accentColor:f.color, cursor:"pointer" }} />
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ borderLeft:"3px solid #252530" }}>
            <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
              marginBottom:14, fontFamily:"'JetBrains Mono',monospace" }}>
              🚧 {lang==="pl" ? "Planowane funkcje" : "Coming soon"}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {[
                {
                  key: "or",
                  icon: "🏥",
                  label: lang==="pl" ? "Wiele sal operacyjnych" : "Multiple operating rooms",
                  desc: lang==="pl" ? "2–3 sale · load balancing · wspólna pula chirurgów" : "2–3 ORs · load balancing · shared surgeon pool",
                  clicked: orSoon,
                  setClicked: setOrSoon,
                },
                {
                  key: "ai",
                  icon: "🤖",
                  label: lang==="pl" ? "Import danych z AI" : "AI data import",
                  desc: lang==="pl" ? "predykcja μ/σ z opisu operacji i historii lekarza" : "predict μ/σ from procedure description and surgeon history",
                  clicked: aiSoon,
                  setClicked: setAiSoon,
                },
                {
                  key: "import",
                  icon: "📋",
                  label: lang==="pl" ? "Import planu zabiegów" : "Import surgery schedule",
                  desc: lang==="pl" ? "wczytaj plan z CSV / Excel / HIS szpitala" : "load schedule from CSV / Excel / hospital HIS",
                  clicked: importSoon,
                  setClicked: setImportSoon,
                },
              ].map(({ key, icon, label, desc, clicked, setClicked }) => (
                <button key={key}
                  onClick={() => { setClicked(true); setTimeout(() => setClicked(false), 2500); }}
                  style={{
                    background: clicked ? "#1a1a28" : "#0d0d14",
                    border: `1px solid ${clicked ? "#a78bfa66" : "#252530"}`,
                    borderRadius:10, padding:"16px 18px", cursor:"pointer",
                    textAlign:"left", transition:"all 0.2s",
                    fontFamily:"'Syne',sans-serif",
                  }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:18 }}>{icon}</span>
                    <span style={{ fontSize:13, fontWeight:700,
                      color: clicked ? "#a78bfa" : "#666",
                      transition:"color 0.2s" }}>
                      {clicked ? (lang==="pl" ? "⏳ Wkrótce..." : "⏳ Coming soon...") : label}
                    </span>
                  </div>
                  <div style={{ fontSize:10, color:"#444", fontFamily:"'JetBrains Mono',monospace",
                    lineHeight:1.6 }}>
                    {clicked ? (lang==="pl" ? "pracujemy nad tym 🔧" : "we're working on it 🔧") : desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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

{activeTab === "test" && (() => {
        const planColor = MODE_CONFIG[planMode].color;
        const optDays = daysOptimized ? daysOptimized.length : numDays;
        const saved = Math.max(0, numDays - optDays);

        const STRATS = [
          { key:"mean",   label:"Średnia",                            color:"#ff6b6b", days: allStrategiesDays?.mean ?? days },
          { key:"p50",    label:"P50",                                color:"#e07b39", days: allStrategiesDays?.p50  ?? days },
          { key:"p80",    label:"P80",                                color:"#6bcb77", days: allStrategiesDays?.p80  ?? days },
          { key:"robust", label:`Robust Γ=${robustLevel.toFixed(1)}`, color:"#00d4ff", days: daysRobust },
          { key:"rh",     label:`Rolling Horizon${saved>0?" 🎯-"+saved+"d":""}`, color:"#a78bfa", days: daysOptimized },
        ];

        const active = STRATS.find(s => s.key === selectedStrat) ?? STRATS[3];

        if (!allStrategiesDays) return (
          <div className="card" style={{ textAlign:"center", padding:"32px", color:"#555", fontFamily:"'JetBrains Mono',monospace", fontSize:12 }}>
            {lang==="pl" ? "Kliknij ▶ Uruchom symulację" : "Click ▶ Run simulation"}
          </div>
        );

        const kpiOpts = { overtimeLimit, revenuePerMin, overtimeCostPerMin, dayOperatingCost, saved };

        const kpiData = STRATS.map(s => ({ ...s, kpi: calcKPI(s.days, s.key === "rh" ? optDays : numDays, kpiOpts) }));

        const mcRuns = mcResults ? Object.values(mcResults)[0]?.endTimes?.length ?? 1 : 1;

        const kpiRows = [
          { key:"runs",  label: lang==="pl"?"Przebiegów":"Runs",            fmt: (k, mc, mkey) => mc && mkey !== "rh" ? `${mcRuns}` : "1", isMC: true },
          { key:"days",  label: lang==="pl"?"Dni planu":"Plan days",         fmt: k => `${k?.days ?? "—"}`,                                  better:"less", highlight:true },
          { key:"end",   label: lang==="pl"?"Koniec dnia":"End of day",      fmt: k => k ? `${minToTime(k.lastEnd)}${k.overtime?" ⚠":" ✓"}` : "—" },
          { key:"otcr",  label: "OTCR%",                                       fmt: (k, mc, mkey) => mc && mkey !== "rh" ? `${mc[mkey]?.otcr ?? k?.otcr ?? "—"}%` : `${k?.otcr ?? "—"}%`, better:"more" },
          { key:"co",    label: "Carry-over",                                  fmt: (k, mc, mkey) => mc && mkey !== "rh" ? `${mc[mkey]?.avgCarryOver?.toFixed(1) ?? k?.carryOver ?? "—"}` : `${k?.carryOver ?? "—"}`, better:"less" },
          { key:"eff",   label: lang==="pl"?"Efektywność":"Efficiency",      fmt: (k, mc, mkey) => mc && mkey !== "rh" ? `${mc[mkey]?.avgEfficiency ?? k?.eff ?? "—"}%` : `${k?.eff ?? "—"}%`, better:"more" },
          { key:"util",  label: lang==="pl"?"Wykorzystanie":"Utilization",   fmt: (k, mc, mkey) => mc && mkey !== "rh" ? `${mc[mkey]?.avgUtilization ?? k?.util ?? "—"}%` : `${k?.util ?? "—"}%`, better:"more" },
          { key:"ot",    label: lang==="pl"?"Nadgodz. (min/d)":"OT (min/d)", fmt: (k, mc, mkey) => mc && mkey !== "rh" ? `${mc[mkey]?.avgOvertimeMin ?? k?.totalOTMin ?? "—"}'` : `${k?.totalOTMin ?? "—"}'`, better:"less" },
          { key:"accel", label: "⏩ % "+(lang==="pl"?"przyspieszonych":"accelerated"), fmt: (k, mc, mkey) => mkey === "rh" ? `${k?.pctAccelerated ?? 0}%` : "0%", better:"more" },
          { key:"dtf",   label: lang==="pl"?"Dni do końca":"Days to finish",  fmt: (k, mc, mkey) => mc && mkey !== "rh" ? `${mc[mkey]?.avgDaysToFinish ?? k?.days ?? "—"}` : `${k?.days ?? "—"}`, better:"less" },
          { key:"fin",   label: lang==="pl"?"Wynik/dzień (zł)":"Result/day", fmt: (k, mc, mkey) => mc && mkey !== "rh" ? `${(mc[mkey]?.avgFinancial ?? k?.financial ?? 0).toLocaleString()} zł` : `${(k?.financial ?? 0).toLocaleString()} zł`, better:"more" },
          { key:"rev",   label: lang==="pl"?"Przychód łącznie":"Revenue total",fmt: (k) => `${k?.revenueTotal?.toLocaleString() ?? "—"} zł`, better:"more" },
          { key:"otc",   label: lang==="pl"?"-Koszt OT":"-OT cost",          fmt: (k) => `-${k?.otCostTotal?.toLocaleString() ?? "—"} zł`, better:"less" },
          { key:"sav",   label: lang==="pl"?"Oszczędność sali":"OR savings", fmt: (k, mc, mkey) => mkey==="rh" && saved>0 ? `+${k?.saleSavingTotal?.toLocaleString() ?? 0} zł` : "—", better:"more" },
          { key:"tot",   label: lang==="pl"?"Wynik łącznie":"Total result",  fmt: (k) => `${k?.totalResult?.toLocaleString() ?? "—"} zł`, better:"more", highlight2:true },
        ];

        return (
          <div style={{ display:"grid", gap:12 }}>
            <div className="card" style={{ borderLeft:"3px solid #a78bfa" }}>
              <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#a78bfa", textTransform:"uppercase",
                  fontFamily:"'JetBrains Mono',monospace", fontWeight:700, whiteSpace:"nowrap" }}>
                  Monte Carlo
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:200 }}>
                  <span style={{ fontSize:11, color:"#888", whiteSpace:"nowrap" }}>{t.monte.iterLabel}:</span>
                  <input type="range" min={100} max={1000} step={100} value={mcIterations}
                    onChange={e => setMcIterations(parseInt(e.target.value))}
                    style={{ flex:1, accentColor:"#a78bfa", cursor:"pointer" }} />
                  <span style={{ fontSize:13, fontWeight:700, color:"#a78bfa",
                    fontFamily:"'JetBrains Mono',monospace", minWidth:40 }}>{mcIterations}</span>
                </div>
                <button onClick={runMonteCarlo} disabled={mcRunning} style={{
                  padding:"8px 20px", background: mcRunning ? "#1a1a24" : "linear-gradient(135deg,#a78bfa,#7c5cdb)",
                  color: mcRunning ? "#555" : "#fff", border:"none", borderRadius:8,
                  fontSize:12, fontWeight:700, cursor: mcRunning ? "not-allowed" : "pointer",
                  fontFamily:"'Syne',sans-serif", whiteSpace:"nowrap",
                }}>
                  {mcRunning ? t.monte.running : t.monte.runBtn}
                </button>
                {mcResults && !mcRunning && (
                  <span style={{ fontSize:10, color:"#a78bfa", fontFamily:"'JetBrains Mono',monospace" }}>
                    ✓ {mcRuns} {t.monte.iterations}
                  </span>
                )}
                <span style={{ fontSize:10, color:"#333", fontFamily:"'JetBrains Mono',monospace" }}>
                  {t.monte.hint}
                </span>
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize:10, letterSpacing:"0.1em", color:"#444", textTransform:"uppercase",
                marginBottom:8, fontFamily:"'JetBrains Mono',monospace" }}>
                {lang==="pl"?"Podsumowanie — 5 strategii":"Summary — 5 strategies"}
                <span style={{ color:"#555", marginLeft:8 }}>
                  · {numDays}d · {overtimeLimit}' OT
                  {enableSor?` · SOR λ=${sorLambda}`:""}
                  {enableDelay?` · delay P=${Math.round((1-delayOnTime)*100)}%`:""}
                  {" · "}Γ={robustLevel.toFixed(1)} · okno={planningWindow}d
                </span>
              </div>
              {mcResults && (
                <div style={{ fontSize:10, color:"#a78bfa", fontFamily:"'JetBrains Mono',monospace", marginBottom:12 }}>
                  ✓ {lang==="pl" ? `MC załadowany — ${mcRuns} iteracji` : `MC loaded — ${mcRuns} iterations`}
                  {" · "}{lang==="pl" ? "Rolling Horizon = 1 przebieg" : "Rolling Horizon = 1 run"}
                </div>
              )}
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
                  <thead><tr>
                    <th style={{ color:"#444", textAlign:"left", minWidth:120 }}>KPI</th>
                    {kpiData.map(s => <th key={s.key} style={{ color:s.color, textAlign:"center" }}>{s.label}</th>)}
                  </tr></thead>
                  <tbody>
                    {kpiRows.map(row => {
                      const vals = kpiData.map(s => row.fmt(s.kpi, mcResults, s.key));
                      const nums = vals.map(v => parseFloat(v)).filter(n => !isNaN(n));
                      const best = row.better === "more" ? Math.max(...nums) : row.better === "less" ? Math.min(...nums) : null;
                      return (
                        <tr key={row.label} style={{ background: row.isMC ? "#a78bfa08" : "transparent" }}>
                          <td style={{ color:"#666", fontSize:11 }}>{row.label}</td>
                          {kpiData.map((s, i) => {
                            const num = parseFloat(vals[i]);
                            const isBest = best !== null && !isNaN(num) && num === best;
                            const isDaysRow = row.highlight;
                            const isFinRow = row.highlight2;
                            const isRH = s.key === "rh";
                            const hasSaving = saved > 0;
                            const cellColor = isDaysRow
                              ? (isRH && hasSaving ? "#6bcb77" : hasSaving ? "#ff6b6b" : s.color)
                              : isFinRow ? (isBest ? "#6bcb77" : s.color)
                              : isBest ? "#6bcb77" : s.color;
                            return (
                              <td key={s.key} style={{
                                fontFamily:"'JetBrains Mono',monospace", textAlign:"center",
                                fontWeight: isDaysRow || isFinRow || isBest ? 700 : 400,
                                fontSize: isDaysRow ? 16 : (isFinRow || isBest) ? 13 : 12,
                                color: cellColor,
                                background: isDaysRow ? (isRH && hasSaving ? "#6bcb7712" : hasSaving ? "#ff6b6b12" : "transparent")
                                  : isFinRow ? "#ffffff08" : "transparent",
                                padding: (isDaysRow || isFinRow) ? "6px 8px" : "4px 8px",
                                borderTop: isFinRow ? "1px solid #252530" : "none",
                              }}>{vals[i]}</td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>


            {mcResults && !mcRunning && (() => {
              const modeKeys = Object.keys(mcResults);
              const COLORS = { mean:"#ff6b6b", p50:"#e07b39", p80:"#6bcb77", custom:"#a78bfa", robust:"#00d4ff" };

              // Komunikat diagnostyczny
              const modeVals = modeKeys.map(m => mcResults[m].overtimeRate);
              const minOT = Math.min(...modeVals);
              const maxOT = Math.max(...modeVals);
              const diff = maxOT - minOT;
              const allHigh = modeVals.every(v => v > 70);
              const allLow  = modeVals.every(v => v < 10);

              return (
                <>
                  {allHigh && (
                    <div style={{ background:"#ff224410", border:"1px solid #ff224433", borderRadius:8, padding:"12px 16px", fontSize:11, color:"#ff9f43", fontFamily:"'JetBrains Mono',monospace" }}>
                      ⚠ {lang==="pl" ? "Plan jest zbyt ciasny — wszystkie strategie regularnie przepełniają salę. Zmniejsz liczbę operacji lub zwiększ limit nadgodzin." : "Plan is too tight — all strategies regularly overflow. Reduce operations or increase overtime limit."}
                    </div>
                  )}
                  {!allHigh && allLow && diff < 5 && (
                    <div style={{ background:"#6bcb7710", border:"1px solid #6bcb7733", borderRadius:8, padding:"12px 16px", fontSize:11, color:"#6bcb77", fontFamily:"'JetBrains Mono',monospace" }}>
                      ✓ {lang==="pl" ? "Plan ma duży zapas — wszystkie strategie mieszczą się w dniu. Zwiększ liczbę operacji aby zobaczyć różnicę." : "Plan has a large margin — all strategies fit. Increase operations to see differences."}
                    </div>
                  )}
                  {!allHigh && diff < 5 && !(allLow && diff < 5) && (
                    <div style={{ background:"#e0c03910", border:"1px solid #e0c03933", borderRadius:8, padding:"12px 16px", fontSize:11, color:"#e0c039", fontFamily:"'JetBrains Mono',monospace" }}>
                      ℹ {lang==="pl" ? `Różnica między strategiami wynosi tylko ${diff}%. Spróbuj zwiększyć liczbę operacji lub zmienić parametry rozkładu.` : `Difference between strategies is only ${diff}%. Try increasing operations or changing distribution parameters.`}
                    </div>
                  )}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
                    {modeKeys.map(mode => {
                      const color = COLORS[mode];
                      const r = mcResults[mode];
                      const modeBins = {};
                      for (let m = START; m <= END + 120; m += 15) modeBins[m] = { time: minToTime(m), count: 0 };
                      r.endTimes.forEach(et => {
                        const bucket = Math.floor(et / 15) * 15;
                        if (!modeBins[bucket]) modeBins[bucket] = { time: minToTime(bucket), count: 0 };
                        modeBins[bucket].count += 1;
                      });
                      const modeHistData = Object.values(modeBins).filter(b => b.count > 0);
                      const onTime = r.endTimes.filter(e => e <= END).length;
                      const pctOnTime = Math.round(onTime / r.endTimes.length * 100);
                      return (
                        <div key={mode} className="card" style={{ borderTop:`2px solid ${color}` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
                            <span style={{ fontSize:13, fontWeight:700, color }}>{t.monte.modes[mode]}</span>
                            <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace",
                              color: pctOnTime >= 80 ? "#6bcb77" : pctOnTime >= 50 ? "#e0c039" : "#ff6b6b" }}>
                              {pctOnTime}% {lang==="pl" ? "na czas" : "on time"}
                            </span>
                          </div>
                          <ResponsiveContainer width="100%" height={150}>
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
                            {[
                              { val:`${r.avgOpsMin}'`, lbl:lang==="pl"?"min op./dzień":"op. min/day", color:"#4a9eff" },
                              { val:minToTime(r.avgEnd), lbl:lang==="pl"?"śr. koniec":"avg end", color },
                              { val:`${r.avgOvertimeMin}'`, lbl:lang==="pl"?"śr. nadgodziny":"avg overtime", color: r.avgOvertimeMin > 0 ? "#ff9f43" : "#6bcb77" },
                              { val:r.avgCarryOver.toFixed(1), lbl:lang==="pl"?"śr. carry-over/dzień":"avg carry-over/day", color: r.avgCarryOver > 0 ? "#ff2244" : "#6bcb77" },
                              { val:`${r.otcr}%`, lbl:"OTCR", color: r.otcr>=70?"#6bcb77":r.otcr>=50?"#e0c039":"#ff6b6b", bold:true },
                            ].map(k => (
                              <div key={k.lbl} style={{ background:"#0d0d14", borderRadius:6, padding:"6px 10px" }}>
                                <div style={{ fontSize:16, fontWeight: k.bold ? 700 : 600, color:k.color, fontFamily:"'JetBrains Mono',monospace" }}>{k.val}</div>
                                <div style={{ fontSize:9, color:"#555", marginTop:2 }}>{k.lbl}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {STRATS.map(s => (
                <button key={s.key} onClick={() => setSelectedStrat(s.key)} style={{
                  padding:"7px 14px", borderRadius:6, cursor:"pointer", fontSize:11, fontWeight:600,
                  border:`1px solid ${selectedStrat===s.key ? s.color : "#252530"}`,
                  background: selectedStrat===s.key ? `${s.color}18` : "#0d0d14",
                  color: selectedStrat===s.key ? s.color : "#555",
                  fontFamily:"'Syne',sans-serif",
                }}>{s.label}</button>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div className="card" style={{ borderTop:`2px solid ${planColor}` }}>
                <div style={{ fontSize:11, fontWeight:700, color:planColor, marginBottom:8 }}>
                  {lang==="pl"?"Plan bazowy":"Base plan"} ({MODE_CONFIG[planMode].label}) · {numDays}d
                </div>
                <MultiDayGantt days={days} planColor={planColor} t={t.gantt} />
              </div>
              <div className="card" style={{ borderTop:`2px solid ${active.color}` }}>
                <div style={{ fontSize:11, fontWeight:700, color:active.color, marginBottom:8 }}>
                  {active.label}
                </div>
                {active.days
                  ? <MultiDayGantt days={active.days} planColor={active.color} t={t.gantt} />
                  : <div style={{ color:"#555", fontSize:11, fontFamily:"'JetBrains Mono',monospace" }}>—</div>
                }
              </div>
            </div>

            {(() => {
              const detailTable = (d, color, label) => {
                if (!d) return null;
                const allRows = d.flatMap(x => x.rows);
                const carryOverIds = new Set(allRows.filter(r => r.isCarryOver).map(r => r.planId));
                return (
                  <div className="card" style={{ borderTop:`2px solid ${color}` }}>
                    <div style={{ fontSize:10, letterSpacing:"0.1em", color, textTransform:"uppercase",
                      marginBottom:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>
                      {label}
                    </div>
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                        <thead><tr>
                          {["Op","#","Chir","Procedura","Plan","Rzecz.","Δ","Start plan","Koniec plan","Start real","Koniec real","CO"].map(h =>
                            <th key={h}>{h}</th>
                          )}
                        </tr></thead>
                        <tbody>
                          {allRows.map((r, i) => {
                            const co = carryOverIds.has(r.planId);
                            return (
                              <tr key={i} style={{ background: r.isCarryOver ? "#ff224410" : "transparent" }}>
                                <td style={{ fontFamily:"'JetBrains Mono',monospace", color: co?"#ff2244":"#aaa", fontWeight: co?700:400 }}>D{r.dayIdx+1}-{r.id}</td>
                                <td style={{ fontFamily:"'JetBrains Mono',monospace", color: co?"#ff2244":"#555", fontWeight: co?700:400 }}>#{r.planId??'—'}</td>
                                <td><span style={{ color: r.isCarryOver?"#ff2244":SURGEON_COLORS[r.chir], fontWeight:600 }}>{r.chir}</span></td>
                                <td style={{ color:"#666" }}>{r.isSor ? "🚨 SOR" : r.proc}{r.isCarryOver?" ↩":""}</td>
                                <td style={{ fontFamily:"'JetBrains Mono',monospace", color }}>{r.planned}'</td>
                                <td style={{ fontFamily:"'JetBrains Mono',monospace" }}>{r.actual}'</td>
                                <td style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:600,
                                  color:r.delay>0?"#ff6b6b":r.delay<0?"#6bcb77":"#888" }}>{r.delay>0?"+":""}{r.delay}'</td>
                                <td style={{ fontFamily:"'JetBrains Mono',monospace", color:`${color}99` }}>{minToTime(r.startPlan)}</td>
                                <td style={{ fontFamily:"'JetBrains Mono',monospace", color:`${color}99` }}>{minToTime(r.endPlan)}</td>
                                <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"#666" }}>{minToTime(r.startReal)}</td>
                                <td style={{ fontFamily:"'JetBrains Mono',monospace", color:r.endReal>END?"#ff6b6b":"#666" }}>{minToTime(r.endReal)}</td>
                                <td style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, textAlign:"center" }}>
                                  {r.isCarryOver
                                    ? <span style={{ color:"#ff2244", fontWeight:700 }}>↩D{r.dayIdx}</span>
                                    : co
                                    ? <span style={{ color:"#ff9f43" }}>→D{r.dayIdx+2}</span>
                                    : <span style={{ color:"#333" }}>—</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              };
              return (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  {detailTable(days, planColor, `${MODE_CONFIG[planMode].label} — ${lang==="pl"?"szczegóły":"details"}`)}
                  {detailTable(active.days, active.color, `${active.label} — ${lang==="pl"?"szczegóły":"details"}`)}
                </div>
              );
            })()}
          </div>
        );
      })()}

    </div>
  );
}
