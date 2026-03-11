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

## Słownik pojęć dla laika

### Monte Carlo
Metoda polegająca na losowaniu wielu scenariuszy żeby zrozumieć coś niepewnego.
Nie wiemy ile potrwa następna operacja — ale wiemy że czasy mają pewien rozkład.
Zamiast zgadywać, losujemy 200 razy i patrzymy co wychodzi. Z tych 200 wyników
wyliczamy P50, P80 i średnią. Nazwa pochodzi od kasyna w Monte Carlo.

> Analogia: chcesz wiedzieć ile zajmuje dojazd do pracy. Nie liczysz matematycznie —
> jedziesz 200 razy i mierzysz. Połowa przejazdów trwała poniżej 25 minut → P50 = 25 min.

### P50 (mediana)
Czas w którym kończy się dokładnie połowa operacji. Połowa trwa krócej, połowa dłużej.
**Nie to samo co średnia** — mediana jest odporna na wartości skrajne.

> Przykład: operacje trwają 50, 55, 60, 65, 120 minut.
> Mediana = 60 min. Średnia = 70 min (zawyżona przez jedną długą operację).

### P80
Czas w którym kończy się 80% operacji. Tylko 20% trwa dłużej.
Używany jako bezpieczniejsza podstawa planu — daje bufor na niespodzianki.

| Podstawa planu | Szansa zmieszczenia się |
|----------------|------------------------|
| Średnia        | ~40–45%                |
| P50 (mediana)  | 50%                    |
| P80            | 80%                    |

### Rozkład log-normalny
Czasy operacji nie rozkładają się symetrycznie — mają długi ogon po prawej stronie.
Operacja rzadko kończy się dużo wcześniej niż zwykle, ale może trwać znacznie dłużej.
Właśnie taki kształt opisuje rozkład log-normalny. Dlatego **średnia jest zawsze wyższa
od mediany** — kilka bardzo długich operacji zawyża ją w górę.

### Dlaczego planowanie ze średniej jest błędem?
Jeśli planujesz ze średniej, ponad połowa operacji systematycznie przekracza plan —
nie z winy chirurga, ale dlatego że użyłeś złego narzędzia statystycznego.
P50 (mediana) jest właściwą podstawą planu dla zdarzeń z rozkładem asymetrycznym.

## Autor

Stanisław Szulc — projekt edukacyjny, symulacja oparta na metodach stosowanych w badaniach nad robust scheduling (Denton et al., MIT).
