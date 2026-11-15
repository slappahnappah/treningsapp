# Innlogging og synk mellom enheter

Appen lagrer alt lokalt først og virker uten nett. Når du er logget inn, synkes dataene i bakgrunnen til en database i Supabase, slik at telefonen, PC-en og andre nettlesere viser det samme.

## Oppsett (gjøres én gang, ca. 10 minutter)

1. **Opprett prosjekt.** Gå til https://supabase.com, lag en gratis konto og velg «New project». Velg en region i Europa. Databasepassordet trenger du ikke i appen, men ta vare på det.
2. **Lag tabellen.** Åpne «SQL Editor» i prosjektet, lim inn hele innholdet i [`supabase/schema.sql`](../supabase/schema.sql) og trykk «Run».
3. **Gjør innloggingen enkel.** Under «Authentication» → «Sign In / Providers» → «Email»: slå av «Confirm email». Da kan du logge inn rett etter at kontoen er opprettet. Vil du beholde bekreftelsen, må du i stedet sette «Site URL» under «Authentication» → «URL Configuration» til `https://slappahnappah.github.io/treningsapp/`.
4. **Finn adresse og nøkkel.** Under «Project Settings» → «API Keys» (eller «Connect»-knappen) finner du «Project URL» og den offentlige nøkkelen («publishable key», tidligere «anon key»). Bruk aldri «secret» eller «service_role».
5. **Koble til appen.** Åpne appen → Innstillinger → «Konto og synk». Lim inn adressen og nøkkelen, og trykk «Koble til». Dette gjøres én gang per nettleser, til verdiene er lagt inn i `apps/web/src/syncConfig.ts`.
6. **Opprett konto.** Skriv inn e-post og passord og trykk «Opprett konto». Logg inn med det samme på de andre enhetene.
7. **Steng for andre.** Når kontoen din finnes: slå av «Allow new users to sign up» under «Authentication» → «Sign In / Providers».

Den offentlige nøkkelen er laget for å ligge i nettleseren. Tilgangen styres av innloggingen og av radnivåsikkerheten i `schema.sql`, som bare slipper deg til dine egne rader.

## Hvordan synken virker

- Alle øvelser, økter, rutiner, notater og innstillinger ligger som rader i tabellen `records`.
- Appen synker ved innlogging, når den åpnes, noen sekunder etter en endring og hvert annet minutt.
- Økter logget uten nett sendes opp når nettet er tilbake.
- Er samme post endret på to enheter, vinner den som ble synket sist. Unntaket er økta som er i gang: den overskrives aldri av en annen enhet.
- Første innlogging på en ny enhet henter alt fra kontoen. Økter som allerede lå på enheten, beholdes og sendes opp.
- Utlogging fjerner ingenting fra enheten.
- Backupfila under Innstillinger virker som før og er fortsatt lurt å ta av og til.
