# Treningsapp – byggebrief

14. november 2026 · Halfdan

Dette dokumentet er grunnlaget for å bygge appen. Det samler beslutningene fra planleggingen og tavla og er skrevet for at en AI-utvikler (Fable 5.2) skal kunne starte direkte. Der noe er et forslag og ikke en beslutning, står det **(forslag)**.

- Kode: GitHub-repoet `slappahnappah/treningsapp` (opprettes i en egen tråd før byggingen starter).
- Tavle: https://claude.ai/artifact/1GCzXV2maxpspVYy27TBGT
- Research og kilder: https://claude.ai/artifact/5bGc2JdpQBjQCCU7h1iWrt

---

## 1. Hva appen er

En personlig app for styrketrening og calisthenics med logging under økta, historikk, rekorder og en regelbasert progresjonsmotor. Den har én bruker (Halfdan), som trener styrke 2–4 ganger i uka og bruker Whoop og Bevel ved siden av.

Inspirasjon: funksjonene og flyten i **Strong** (favoritten) og **Hevy**. Appen har eget navn, eget design og eget utseende. Ikke kopier navn, ikoner, farger eller grafikk fra noen av dem.

## 2. Rammer

| Tema | Beslutning |
|---|---|
| Plattform | Webapp (PWA) som legges på hjemskjermen på iPhone. Bygges slik at en native iPhone-app kan legges til senere. |
| Brukere | Én bruker. Ingen sosiale funksjoner, ikke noe abonnement. |
| AI | Ingen AI i appen foreløpig. Alle tilbakemeldinger lages med faste regler i kode. |
| Utenfor omfang | Kroppsmål, kroppsvekt, restitusjon (søvn, HRV), sosialt feed, løping, Strava, total treningsbelastning/strain og import fra Strong. |
| Historikk | Appen starter med blanke ark. Ingen historikk importeres fra andre apper. |
| Enheter | Kun kg. |
| Stil | Mørkt tema, store trykkflater, skal kunne brukes med én hånd i studio. |
| Kode | `slappahnappah/treningsapp` på GitHub. |
| Språk | Norsk i grensesnittet **(forslag)**. Øvelsesnavn kan være norske eller engelske, og sammendraget bruker engelske navn. |

Fordi kroppsvekt ikke registreres, kan appen ikke regne kilo for kroppsvektøvelser. De logges som reps eller sekunder, eventuelt med ekstravekt eller assistanse i kg, og vises som `BW×8`, `BW+10×5` eller `BW−20×6` (forslag til notasjon for assistert).

## 3. MVP – funksjoner

1. **Rask sett-logging.** Hver rad: kg, reps, RPE og en hake. Skal gå like fort som i Strong. RPE er valgfritt per sett, skala 6–10 i halve steg, valgt med ett trykk. RPE 10 = ingen reps igjen.
2. **Forrige gang ved hvert sett.** Verdiene fra forrige gang øvelsen ble gjort vises ved hver rad og er forhåndsutfylt.
3. **Egen side per øvelse** med fanene Historikk, Grafer (estimert 1RM og volum) og Rekorder (estimert 1RM, tyngste sett, flest reps, lengste hold). Åpnes ved å trykke på en øvelse.
4. **Automatisk hviletimer per øvelse.** Starter når et sett hakes av. Lyd når tiden er ute, og vibrasjon der nettleseren støtter det (ikke i Safari på iPhone). Standard hviletid settes per øvelse.
   - **Supersett:** hviletimeren starter først når siste øvelse i runden er hakt av. Mellom øvelsene i samme runde går man rett videre uten timer. Hviletiden for runden er den lengste `defaultRestSec` blant øvelsene i supersettet **(forslag)**.
5. **Holdeklokke for holdeøvelser.** Lages på nytt fra denne spesifikasjonen:
   - Teller opp i hele sekunder med stort tall som kan leses på avstand.
   - Hørbart tikk hvert sekund (Web Audio API), så man kan telle uten å se på skjermen.
   - Ekstra, tydeligere pip hvert 10. sekund (kan slås av).
   - Volumkontroll.
   - Holder skjermen våken (Screen Wake Lock API).
   - Start og stopp med én stor knapp. Holdetiden lagres som settets varighet (`durationSec`).
   - Lyden må «låses opp» av brukerens trykk på Start (krav i Safari på iPhone).
   - Tiden regnes fra lagret starttidspunkt, ikke ved å telle intervaller, så den stemmer hvis appen har vært i bakgrunnen.
   - Mulige tillegg: nedtelling før start (3, 2, 1) og måltid med signal.
6. **Rutiner og maler** uten tak på antall. En økt kan startes tom eller fra en mal.
7. **Øvelsesbibliotek pluss egne øvelser.** Hver øvelse har en type (se datamodell). Calisthenics-øvelser har en redigerbar **nivåstige**, for eksempel front lever: tuck → advanced tuck → one leg → straddle → full. For hvert sett velger man nivå og logger sekunder eller reps. Rekorder og historikk vises per nivå.
8. **Settyper:** oppvarming, arbeidssett, drop set og failure, pluss supersett (øvelser gruppert og gjort annenhver).
9. **Platekalkulator og oppvarmingsforslag.**
   - Platekalkulator: stang 20 kg som standard; tilgjengelige plater kan settes i innstillingene (forslag: 25, 20, 15, 10, 5, 2,5, 1,25 kg). Viser plater per side.
   - Oppvarmingsforslag (forslag): stang × 10, 40 % × 5, 60 % × 3, 80 % × 2 av arbeidsvekten, rundet til nærmeste plateoppsett. Kan redigeres.
10. **Kopierbart øktsammendrag for Whoop og Bevel** (se kapittel 6).
11. **Dagbok med kalender.** Kalenderen viser treningsdager, og lettuker er markert. Trykk på en dag for å se økta og et dagboknotat. Notatet vises også i historikken.
12. **Progresjon mot forrige like økt.** Hver øvelse i en ferdig økt får pil opp, lik eller ned (se kapittel 5, steg 1).
13. **Markere lettuke.** En økt kan markeres som lettuke når den startes eller i etterkant, og en hel uke kan markeres i kalenderen (det markerer alle øktene den uka). Markeringen brukes av lettuke-signal 4 og holder lettuke-økter utenfor sammenligningene i steg 1 og 2.
14. **Praktisk i studio:** kun kg, mørkt tema, store trykkflater, én hånd.
15. **Eksport og import (CSV/JSON) som backup.** Alle data kan eksporteres til fil og leses inn igjen i appen. Dette er bare backup av appens egne data, ikke import fra andre apper.

### Faner (forslag, inspirert av Strong-flyten)

Rutiner · Dagbok · Start økt · Øvelser · Innstillinger

## 4. Datamodell (forslag)

Ligger i `packages/core`. Alle ID-er er strenger (UUID). Alle tider lagres som ISO 8601.

```ts
type ExerciseType =
  | 'weight_reps'   // vekt × reps (stang, manualer, maskin, kabel)
  | 'bodyweight'    // reps, valgfri ekstravekt i kg
  | 'assisted'      // reps, assistanse i kg (strikk/maskin)
  | 'time'          // sekunder (hold)
  | 'level';        // progresjonsnivå + sekunder eller reps

type Equipment = 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable' | 'bodyweight' | 'rings' | 'other';

// Brukes først senere (volum per muskelgruppe). Listen kan utvides.
type Muscle =
  | 'chest' | 'front_delts' | 'side_delts' | 'rear_delts' | 'lats' | 'upper_back'
  | 'biceps' | 'triceps' | 'forearms' | 'core' | 'glutes' | 'quads' | 'hamstrings' | 'calves';

interface Exercise {
  id: string;
  name: string;              // visningsnavn i appen (norsk eller engelsk, valgfritt)
  nameEn: string;            // engelsk standardnavn, brukes i sammendraget når koblinger mangler
  type: ExerciseType;
  levelMetric?: 'seconds' | 'reps';   // for type 'level'
  equipment: Equipment;
  perHand: boolean;          // manualer og kettlebells: vekt oppgis per hånd
  unilateral: boolean;       // én side om gangen (pistol, one arm push-up …): sett logges per side
  levels?: Level[];          // for type 'level', redigerbar stige
  defaultRestSec: number;
  isMainLift: boolean;       // brukes av varselet om lettuke
  externalNames: { whoop?: string; bevel?: string };  // se kapittel 6
  muscles?: { direct: Muscle[]; indirect: Muscle[] }; // brukes senere (volum per muskelgruppe)
  isCustom: boolean;
  archived: boolean;
}

interface Level { id: string; name: string; order: number }

type SetKind = 'warmup' | 'working' | 'drop' | 'failure';

interface SetEntry {
  id: string;
  kind: SetKind;
  weightKg?: number;        // weight_reps, ekstravekt for bodyweight og level (f.eks. pistol med vekt)
  assistanceKg?: number;    // assisted
  reps?: number;
  durationSec?: number;     // time, og level med levelMetric 'seconds'
  levelId?: string;         // level
  side?: 'left' | 'right';  // for unilaterale øvelser
  rpe?: number;             // 6, 6.5 … 10
  done: boolean;
  completedAt?: string;     // når haken ble satt
  restBeforeSec?: number;   // FAKTISK pause før settet – påkrevd for progresjonsmotoren
}

interface WorkoutExercise {
  id: string;
  exerciseId: string;
  order: number;
  supersetGroup?: string;   // samme verdi = samme supersett
  sets: SetEntry[];
}

interface Workout {
  id: string;
  startedAt: string;
  endedAt?: string;
  routineId?: string;
  title?: string;
  isDeload: boolean;        // markert som lettuke (økt eller hel uke)
  exercises: WorkoutExercise[];
}

interface Routine {
  id: string;
  name: string;
  exercises: { exerciseId: string; order: number; supersetGroup?: string;
               plannedSets: Omit<SetEntry, 'id' | 'done' | 'completedAt' | 'restBeforeSec'>[] }[];
}

interface DiaryNote { date: string /* YYYY-MM-DD */; text: string }

interface ProgressionThresholds {
  restDiffSec: number;            // 15 – maks avvik i snittpause for «like» økter
  restDiffPct: number;            // 15
  rpeDiff: number;                // 1 – RPE-endring som teller som bedre/dårligere
  trendSessions: number;          // 6
  trendProgressPctPerWeek: number; // 0.5
  trendPlateauPctPerWeek: number;  // 0.5
  trendPlateauWeeks: number;       // 3
  trendDeclinePctPerWeek: number;  // 1
  declineSessionsInRow: number;    // 2
  deloadDeclineSharePct: number;   // 40
  deloadWindowDays: number;        // 10
  deloadMainLiftSessions: number;  // 3
  deloadRpeSessions: number;       // 3
  deloadWeeksSinceLast: number;    // 6
  deloadSignalsNeeded: number;     // 2
}

interface Settings {
  barKg: number;
  platesKg: number[];
  warmupScheme: { percent: number; reps: number }[];
  thresholds: ProgressionThresholds;   // alle terskler i kapittel 5, med startverdiene over
  holdClock: { volume: number; beepEverySec: number; countdownSec?: number };
}
```

Unilaterale øvelser vises med to rader per sett (venstre og høyre) under økta. Forrige gang, rekorder og progresjon regnes per side, og sammendraget skriver for eksempel `Pistol Squat (L/R): 5/5, 5/4`.

`restBeforeSec` måles automatisk som tiden fra forrige sett ble hakt av (i samme øvelse, eller forrige øvelse i et supersett) til dette settet hakes av, minus settets egen varighet når den er kjent.

## 5. Beregninger og progresjonsmotor (uten AI)

### Grunnformler

- **Volum** = Σ kg × reps for arbeidssett (ikke oppvarming) av type `weight_reps`. Øvelser med `perHand: true` regnes ×2. Kroppsvektøvelser er ikke med i volumet.
- **Estimert 1RM (Epley)** = vekt × (1 + reps / 30).
- **Estimert 1RM med RPE** = vekt × (1 + (reps + (10 − RPE)) / 30), altså reps pluss reps i reserve.
- Estimert 1RM regnes bare for `weight_reps`. For kroppsvekt, assistert, tid og nivå er rekordene flest reps, mest ekstravekt, minst assistanse og lengste hold, per nivå der det gjelder.

Kontroll med eksempelet i kapittel 6: knebøy 3 × 100 × 5 = 1 500, rumensk markløft 3 × 80 × 8 = 1 920, manualbenk (30 × 10 + 30 × 10 + 30 × 9) × 2 = 1 740. Sum volum 5 160 kg. Antall arbeidssett er 12: 3 knebøy, 3 rumensk markløft, 3 manualbenk og 3 pull-ups. Pull-ups telles som arbeidssett, men er ikke med i volumet fordi de er kroppsvekt. Oppvarmingssettet er verken med i antallet eller i volumet.

### Steg 1 – Sammenligning med forrige like økt (MVP)

To forekomster av en øvelse er **like** når øvelsen og antall arbeidssett er de samme, og snittpausen avviker med høyst 15 sekunder eller 15 prosent. Økter markert som lettuke (`isDeload`) sammenlignes ikke med vanlige økter.

Reps og RPE summeres og snittes over arbeidssettene.

| Status | Regel |
|---|---|
| Fremgang ↑ | Minst 1 rep mer totalt på samme vekt, eller høyere vekt med minst like mange reps, eller samme reps og vekt med minst 1 lavere snitt-RPE. |
| Lik → | Samme reps (±0) og samme vekt, og snitt-RPE har endret seg mindre enn 1. |
| Tilbakegang ↓ | Minst 1 rep færre totalt på samme vekt, eller samme reps og vekt med minst 1 høyere snitt-RPE. |

- Holdeøvelser: sekunder i stedet for reps.
- Calisthenics med nivåer: et høyere nivå er alltid fremgang. På samme nivå sammenlignes sekunder eller reps.
- RPE brukes bare når det er logget i begge øktene.
- Assistert: «samme vekt» betyr samme assistanse, og mindre assistanse med minst like mange reps er fremgang.
- Bodyweight og level med ekstravekt: ekstravekten behandles som «vekt» i reglene over.
- Oppvarmingssett er aldri med i sammenligningen.
- Uten en tidligere lik økt vises ingen pil.
- Tilfeller som ikke dekkes av reglene (f.eks. høyere vekt og færre reps) vises som «lik» til trend (steg 2) finnes. **(forslag)**

### Steg 2 – Trend over tid (rett etter MVP)

- Estimert 1RM for beste arbeidssett i hver økt, med RPE-formelen når RPE er logget.
- Lineær trendlinje gjennom de 6 siste like øktene (lettuke-økter holdes utenfor). Stigningen uttrykkes i prosent per uke av snittet.

| Status | Regel |
|---|---|
| Progresjon | Over +0,5 % per uke. |
| Platå | ±0,5 % per uke i minst 3 uker. |
| Nedgang | Under −1 % per uke, eller færre reps 2 økter på rad. |

### Steg 3 – Varsel om lettuke (rett etter MVP)

Appen foreslår en lettuke når minst 2 av disse 4 signalene slår ut:

1. Minst 40 % av øvelsene de siste 10 dagene har status Nedgang.
2. Minst én hovedøvelse (`isMainLift`) har hatt status Tilbakegang 3 økter på rad.
3. Snitt-RPE på samme vekt og reps har steget med minst 1 over de 3 siste øktene, for minst 2 øvelser.
4. Det har gått mer enn 6 uker siden siste økt med `isDeload: true`. Hvis ingen økt er markert, regnes tiden fra første økt i appen.

Lettuka har omtrent halvparten så mange sett og samme vekt. Når Halfdan godtar forslaget, markeres øktene den uka som lettuke.

### Felles for alle meldinger

- Hver melding forklarer hvorfor den kommer, for eksempel «reps på benk har falt 3 økter på rad».
- Alle terskler kan justeres i innstillingene (se `ProgressionThresholds`).

## 6. Kopierbart øktsammendrag for Whoop og Bevel

Verken Whoop eller Bevel kan importere styrkeøkter fra andre apper, så sammendraget kopieres eller deles som tekst når økta er ferdig.

### Format

- Én øvelse per linje. Sett skrives som `kg×reps`, og oppvarmingssett er merket.
- Start- og sluttid er med, så Whoop og Bevel kan koble økta til pulsdataene.
- Manualer og kettlebells oppgis per hånd.
- Én knapp for kopiering og én for deling (iOS-delingsarket via Web Share API).

```
Strength workout – 14 Nov 2026, 14:52–15:17 (25 min)

Back Squat: warm-up 60×5; 100×5, 100×5, 100×5
Romanian Deadlift: 80×8, 80×8, 80×8
Dumbbell Bench Press (per hand): 30×10, 30×10, 30×9
Pull-up: BW×8, BW×7, BW×6

Working sets: 12 (incl. pull-ups) · Volume: 5 160 kg (weighted sets only, excl. pull-ups)
```

Forslag til format for andre typer: hold `Front Lever (tuck): 12s, 10s, 9s`, assistert `Pull-up (assisted): BW−20×6`.

### Navnekobling per app

Whoop og Bevel har ikke de samme øvelsene som appen, og de navngir øvelser ulikt. Derfor:

- Hver øvelse har to egne felter: navnet i Whoop og navnet i Bevel (`externalNames.whoop`, `externalNames.bevel`).
- **Beslutning:** Øvelser som mangler i Whoop eller Bevel (f.eks. front lever, planche, dragon flag) lager Halfdan selv i begge appene og skriver navnet inn i feltet.
- I sammendragsvisningen velger man mål: **Whoop** eller **Bevel**. Teksten bygges med det valgte navnet. Uten kobling brukes `nameEn`.
- **(forslag)** En liste i innstillingene over øvelser som mangler navn i Whoop eller Bevel. Den kan kopieres som en sjekkliste over hva som må opprettes i hver app. Utkastet som kommer fra `nameEn`, brukes som startpunkt.

## 7. Startbibliotek og startrutiner

Halfdans program består av tre økter (A, B og C) med en felles oppvarming. Disse legges inn som ferdige rutiner ved første oppstart. Antall sett, reps og hviletid er ikke oppgitt ennå, så rutinene starter med øvelsene i riktig rekkefølge, og Halfdan fyller inn resten første gang. Punkter merket **(tolket)** står i listen «Til bekreftelse» nederst i kapitlet.

### Startrutiner

**Felles oppvarming** (alle sett har typen `warmup`, ett sett hver). Den legges først i hver av rutinene A, B og C, slik at en økt startes med ett trykk. Øvelsene er de samme som i biblioteket, så oppvarmingssettene havner i samme historikk, men holdes utenfor volum, rekorder og progresjon:

1. Pull-up
2. Dips
3. Handstand push-up på lav progresjon: pike push-up **(tolket)**
4. Handstand hold
5. Mageøvelse: hanging leg raise **(tolket)**

**Økt A** (oppvarming + disse):

1. Handstand hold
2. Pistol squat (begge sider)
3. Sissy squat
4. One arm pull-up (begge sider)
5. Single-leg hamstring curl, liggende (begge sider) **(tolket)**
6. Handstand push-up, chest to wall
7. Headstand pike **(tolket)**
8. Pseudo planche push-up
9. Hanging leg raise

**Økt B** (oppvarming + disse):

1. Knebøy (stang)
2. Chest-to-bar pull-up
3. Handstand push-up, back to wall
4. Dragon flag
5. Nordic hamstring curl (variant) **(tolket)**
6. One arm push-up (begge sider)

**Økt C** (oppvarming + disse):

1. Pull-up med ekstravekt
2. Handstand push-up, back to wall **(tolket: «vanlig»)**
3. Pistol squat (begge sider)
4. Sissy squat
5. Front lever (variant) **(tolket)**
6. Markløft
7. Dips med ekstravekt

Vektet pull-up og vektet dips er de samme øvelsene som pull-up og dips, logget med ekstravekt. Da samles historikk og rekorder på ett sted.

### Øvelser i programmet

| Øvelse (visningsnavn) | Type | Unilateral | Nivåstige (forslag, redigerbar) |
|---|---|---|---|
| Pull-up | `bodyweight` (ekstravekt) | nei | – |
| Chest-to-bar pull-up | `bodyweight` | nei | – |
| One arm pull-up | `level` (reps) | ja | assistert (strikk/hånd) → negativ → full |
| Dips | `bodyweight` (ekstravekt) | nei | – |
| Pike push-up | `bodyweight` | nei | – |
| Handstand push-up, back to wall | `bodyweight` | nei | – |
| Handstand push-up, chest to wall | `bodyweight` | nei | – |
| Handstand hold | `level` (sekunder) | nei | mot vegg → frittstående |
| Headstand pike | `bodyweight` | nei | – |
| Pseudo planche push-up | `level` (reps) | nei | på knær → full → føttene hevet |
| One arm push-up | `level` (reps) | ja | skrå → full |
| Hanging leg raise | `level` (reps) | nei | bøyde knær → strake bein → toes to bar |
| Dragon flag | `level` (reps) | nei | tuck → one leg → straddle → full |
| Front lever | `level` (sekunder) | nei | tuck → advanced tuck → one leg → straddle → full |
| Pistol squat | `level` (reps) | ja | assistert (holder i noe) → til benk → full → med vekt |
| Sissy squat | `level` (reps) | nei | assistert (holder i stolpe) → frittstående |
| Single-leg hamstring curl, liggende | `bodyweight` | ja | – |
| Nordic hamstring curl | `level` (reps) | nei | negativ med strikk → negativ → full |
| Knebøy (stang) | `weight_reps` | nei | – |
| Markløft | `weight_reps` | nei | – |

Hovedøvelser (`isMainLift`) **(forslag)**: knebøy, markløft, pull-up, dips og handstand push-up (begge varianter).

### Resten av startbiblioteket

Disse fra tavla legges også inn, så de finnes når de trengs:

**Styrke:** frontknebøy, rumensk markløft, benkpress, skråbenk, skulderpress, roing, nedtrekk, hip thrust, utfall, bulgarsk splittknebøy, leg curl, leg extension, biceps curl, triceps pushdown, sidehev, face pull, tåhev.

**Calisthenics:** chin-up, eksplosiv pull-up, muscle-up, ringdips, push-up, front lever raise, planche hold, planche push-up, frittstående handstand push-up, L-sit.

| Øvelse | Nivåer (forslag) |
|---|---|
| Front lever raise | tuck → advanced tuck → one leg → straddle → full |
| Planche (hold/push-up) | lean → tuck → advanced tuck → straddle → full |

### Til bekreftelse (tolket)

1. **Mageøvelse i oppvarmingen:** tolket som hanging leg raise. Er det samme mageøvelse i B og C, eller en annen?
2. **HSPU på lav progresjon i oppvarmingen:** tolket som pike push-up. Stemmer det, eller er det en annen variant?
3. **«Vanlig» HSPU i økt C:** tolket som back to wall, som i økt B. Eller mener du frittstående?
4. **Enbeins hamstring-øvelsen i økt A:** tolket som liggende på ryggen med strake bein, der én fot trekkes inn under deg som en hamstring curl (for eksempel på sokk eller glidebrett). Hva vil du kalle den?
5. **Hodestående med hoftefleksjon i økt A:** kalt «Headstand pike» (fra strak hodestående, senke strake bein til gulvet og løfte opp igjen). Passer navnet?
6. **Nordic curl-varianten i økt B:** hvilken variant (for eksempel bare negativ, med strikk eller full)?
7. **Front lever-varianten i økt C:** er det hold eller raise, og på hvilket nivå?
8. **Handstand hold** står både i oppvarmingen og først i økt A. Er det riktig at det er to omganger?
9. **Sett, reps og hvile** per øvelse er ikke oppgitt. Fylles inn i appen første gang, eller vil du gi dem nå?

## 8. Arkitektur (anbefalt)

Koden ligger i `slappahnappah/treningsapp` på GitHub.

```
apps/web        React + TypeScript, PWA (nå)
apps/mobile     Expo / React Native (senere)
packages/core   Ren TypeScript uten UI: datamodell, 1RM, volum, rekorder,
                platekalkulator, progresjonsmotor, sammendragsformat
```

- **Lokal først:** økta lagres i IndexedDB under trening og synkes etterpå. Loggingen skal aldri vente på nettet.
- **Backend:** enkelt API med innlogging, f.eks. Supabase eller Postgres. Valg av hosting og innlogging er et åpent spørsmål. **Trinn 1–9 i byggerekkefølgen bygges uten backend**, med all data lokalt i IndexedDB og eksport som backup. Backend kommer i trinn 10.
- **Hosting av PWA-en (forslag):** statisk hosting med HTTPS fra starten, for eksempel GitHub Pages fra repoet, slik at appen kan installeres og testes på iPhone allerede i trinn 3.
- **`packages/core`** skal ha enhetstester for alle formler og alle regler i progresjonsmotoren, inkludert eksempelet i kapittel 6 (12 arbeidssett, 5 160 kg).

### Kjent risiko – test tidlig

Safari på iPhone kan stoppe lyd og tidtakere når skjermen låses eller appen går i bakgrunnen. I tillegg støtter Safari ikke vibrasjon fra web (`navigator.vibrate`). Hviletimeren og holdeklokka må derfor testes på Halfdans iPhone som hjemskjerm-app tidlig.

- Tidtakere skal regnes ut fra lagrede tidsstempler, ikke fra et tellende intervall, så tiden stemmer når appen kommer tilbake.
- Hvis lyd ved låst skjerm ikke fungerer godt nok, er det den sterkeste grunnen til å lage en native app.

## 9. Foreslått byggerekkefølge

1. Monorepo i `slappahnappah/treningsapp` og `packages/core` med datamodell, formler og tester.
2. Logging av økt med lokal lagring, forrige gang og settyper.
3. Hviletimer (også for supersett) og holdeklokke, og **test på iPhone** (risikoen over).
4. Øvelsesbibliotek, egne øvelser, nivåstiger, unilaterale øvelser og øvelsesside med rekorder og grafer.
5. Rutiner og maler (med startrutinene A, B og C), platekalkulator og oppvarmingsforslag.
6. Dagbok med kalender, notater og markering av lettuke.
7. Øktsammendrag med navnekobling for Whoop og Bevel.
8. Progresjon steg 1 (piler).
9. Eksport og import (CSV/JSON) som backup.
10. Backend, innlogging og synk.

## 10. Senere

- Trend og varsel om lettuke (steg 2 og 3).
- Volum per muskelgruppe per uke, med muskelkart. Utkast fra tavla:
  - Telling: direkte sett = 1, indirekte sett = 0,5 (fraksjonell telling, Pelland mfl. 2024).
  - Vurdering per uke (startverdier): under 4 lite, 4–9 nok for styrke, 10–20 godt for hypertrofi, over 20 avtagende gevinst.
  - Eksempel på kobling: benkpress = bryst (direkte), triceps og fremre skulder (indirekte); pull-up = lats (direkte), biceps og bakre skulder (indirekte); front lever = lats og core (direkte), bakre skulder og biceps (indirekte); planche = fremre skulder (direkte), bryst, triceps og core (indirekte).
- Program over flere uker, med periodisering og lettuker.
- Notater per øvelse, for eksempel setehøyde eller grep.
- Native iPhone-app, og på sikt Apple Watch.

**Parkert:** strain per økt (Whoop-lignende skår). Ikke med, fordi total belastning håndteres i Whoop.

## 11. Åpne spørsmål

- Navn på appen og visuell stil.
- Bekrefte de tolkede punktene i kapittel 7 («Til bekreftelse»).
- Hvor backend skal ligge, og hvilken innlogging som skal brukes (trengs først i trinn 10).
