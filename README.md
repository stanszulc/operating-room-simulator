# 🏥 OR Simulator — Operating Room Simulator

**Author:** Stanisław Szulc  
**Live demo:** https://or-symulator.netlify.app  
**Repo:** https://github.com/stanszulc/operating-room-simulator

---

## About

The operating room is one of the most expensive resources in a hospital. Most hospitals schedule operations using average durations — a mathematical mistake. Operation times follow a log-normal distribution with a long right tail: a few extremely long cases inflate the mean, causing **half of all operations to systematically exceed the plan**.

This simulator shows how different planning strategies handle that uncertainty — from the naive mean to advanced methods robust to disruptions.

---

## Features

- 📋 **Schedule builder** — drag & drop procedures, assign surgeons, configure disruptions
- 🎯 **5 planning strategies** — Mean / P50 / P80 / MIT Robust / Rolling Horizon
- 🛡 **MIT Robust Scheduling** (Denton et al.) — Box Uncertainty Set with Γ parameter
- ⏩ **Rolling Horizon Optimizer** — dynamic borrowing of ops from future days
- 🚨 **SOR / ED cases** — unplanned emergency cases drawn from Poisson distribution
- 📊 **Monte Carlo analysis** — compare strategies across hundreds of random realizations
- 📈 **Gantt + KPI** — plan vs actual visualization, carry-over, OTCR%
- 🌍 **PL / EN** — full bilingual support

---

## Tech stack

| Technology | Usage |
|------------|-------|
| React 18 + Vite | Frontend |
| Recharts | Charts and Gantt |
| Netlify | Hosting |

---

## Run locally
```bash
git clone https://github.com/stanszulc/operating-room-simulator
cd operating-room-simulator/or-simulator
npm install
npm run dev
```

App available at `http://localhost:5173`

---

## Theoretical background

- **Log-normal distribution of operation times** — Strum et al. (2000)
- **MIT Robust OR Scheduling** — Denton & Gupta (2003), Box Uncertainty Set
- **Rolling Horizon** — dynamic scheduling with look-ahead window
- **Monte Carlo** — strategy evaluation across multiple random realizations

---

## Roadmap

- [ ] Multiple operating rooms (2–3 ORs, load balancing, shared surgeon pool)
- [ ] Surgery schedule import from CSV / Excel / hospital HIS
- [ ] AI-based μ/σ prediction from procedure description and surgeon history

---

## Author

**Stanisław Szulc**  
Portfolio project in data engineering, simulation and optimization.  
GitHub: [@stanszulc](https://github.com/stanszulc)

---

*Educational project — not intended for clinical use.*
