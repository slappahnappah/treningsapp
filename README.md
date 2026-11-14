# Stige

En personlig app for styrketrening og calisthenics: rask logging under økta, historikk, rekorder og en regelbasert progresjonsmotor. Webapp (PWA) for iPhone først, bygget slik at en native app kan komme senere. «Stige» er et arbeidsnavn.

Appen ligger på GitHub Pages: https://slappahnappah.github.io/treningsapp/

## Status

Byggerekkefølgen står i kapittel 9 i [byggebriefen](docs/byggebrief.md).

- [x] 1. Monorepo og `packages/core` med datamodell, formler og tester
- [x] 2. Logging av økt med lokal lagring, forrige gang og settyper
- [x] 3. Hviletimer og holdeklokke
- [ ] 4. Øvelsesbibliotek, egne øvelser, nivåstiger og øvelsesside med rekorder og grafer
- [ ] 5. Redigering av rutiner og maler, platekalkulator og oppvarmingsforslag
- [ ] 6. Dagbok med kalender, notater og markering av lettuke
- [ ] 7. Øktsammendrag med navnekobling for Whoop og Bevel
- [ ] 8. Progresjon steg 1 (piler)
- [ ] 9. Eksport og import som backup
- [ ] 10. Backend, innlogging og synk

## Struktur

```
apps/web        React + TypeScript + Vite, PWA. Data i IndexedDB (Dexie).
packages/core   Ren TypeScript uten UI: datamodell, formler, pauseberegning,
                platekalkulator, startbibliotek og startrutiner. Enhetstester med Vitest.
```

## Kjøre lokalt

```
npm install
npm run dev        # utviklingsserver
npm test           # enhetstester i packages/core
npm run typecheck
npm run build      # bygger apps/web til apps/web/dist
```

## Publisering

Hver push til `main` tester, bygger og publiserer til GitHub Pages (`.github/workflows/ci.yml`). Under Settings → Pages må kilden være satt til «GitHub Actions».

## Legge appen på hjemskjermen på iPhone

Åpne adressen over i Safari, trykk på Del og velg «Legg til på Hjem-skjerm». Alle data ligger bare på telefonen.
