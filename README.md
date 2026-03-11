# 🏥 Symulator Sali Operacyjnej

Interaktywny symulator planowania operacji oparty na rozkładzie log-normalnym i danych historycznych Monte Carlo.

## Co robi

Symuluje przebieg dnia operacyjnego na jednej sali — porównuje plan z rzeczywistością, analizuje błędy planowania i wizualizuje rozkład czasów operacji per chirurg i procedura.

### Główne funkcje

- **Wykres Gantta** — plan vs rzeczywistość dla każdej operacji
- **Błąd planowania** — suma opóźnień, bias per chirurg i per procedura, scatter plan vs rzeczywiste
- **Macierz P50/P80** — automatycznie generowane percentyle dla każdej kombinacji chirurg × procedura
- **Parametry rozkładów** — suwaki μ i σ per procedura z podglądem mediany i P80 na żywo

### Jak działa symulacja

Czasy operacji losowane są z rozkładu log-normalnego `X ~ LN(μ, σ²)` przemnożonego przez współczynnik umiejętności chirurga. Plan = P50 wyliczone z 200 symulowanych operacji historycznych, zaokrąglone do 5 minut.

## Uruchomienie

```bash
cd or-simulator
npm install
npm run dev
```

Aplikacja dostępna pod `http://localhost:5173`

## Stos technologiczny

- **React** + **Vite**
- **Recharts** — wykresy
- **JavaScript** — symulacja Monte Carlo, rozkład log-normalny

## Struktura projektu

```
or-simulator/
├── src/
│   ├── App.jsx        # główny komponent — cała logika i UI
│   └── main.jsx
├── index.html
└── package.json
```

## Chirurdzy i procedury

| Chirurg | Współczynnik |
|---------|-------------|
| A       | 0.92 (szybki) |
| B       | 1.10 (wolniejszy) |
| C       | 1.00 (bazowy) |

| Procedura       | Mediana | P80 |
|-----------------|---------|-----|
| Appendectomy    | ~58 min | ~80 min |
| Cholecystectomy | ~72 min | ~100 min |
| Hernia repair   | ~50 min | ~68 min |

## Autor

Stanisław Szulc — projekt edukacyjny, symulacja oparta na metodach stosowanych w badaniach nad robust scheduling (Denton et al., MIT).# operating-room-simulator
