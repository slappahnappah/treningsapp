import { expect, test } from '@playwright/test';
import { addExercise, card, closeSummary, exerciseOrder, finishWorkout, goTab, logSet, openApp, openMenu, skipRest, startEmptyWorkout } from './helpers';

test('logge en økt: sett, hviletimer, fullføre og se den i dagboka', async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, 'Knebøy (stang)');
  await logSet(page, 'Knebøy (stang)', 0, '102,5', '5');
  await expect(page.locator('.restbar')).toBeVisible();
  await expect(page.locator('.restbar')).toContainText('Hvile');
  await skipRest(page);
  await finishWorkout(page);
  await expect(page.locator('.summary-text')).toContainText('102.5×5');
  await closeSummary(page);
  await goTab(page, 'Dagbok');
  await expect(page.locator('.card', { hasText: 'Knebøy (stang)' }).first()).toContainText('102,5×5');
});

test('en økt uten avhakede sett lagres ikke', async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, 'Benkpress');
  await page.getByRole('button', { name: 'Fullfør', exact: true }).click();
  await expect(page.locator('.sheet')).toContainText('økta blir ikke lagret');
  await page.getByRole('button', { name: 'Avslutt uten å lagre' }).click();
  await expect(page.getByRole('button', { name: 'Start tom økt' })).toBeVisible();
  await goTab(page, 'Dagbok');
  await expect(page.getByText('Ingen økt denne dagen.')).toBeVisible();
});

test('et sett uten verdier kan ikke hakes av', async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, 'Benkpress');
  await card(page, 'Benkpress').locator('.check').first().click();
  await expect(card(page, 'Benkpress').locator('.check').first()).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.restbar')).toHaveCount(0);
});

test('rutine A starter med øvelser, og økta overlever at siden lastes på nytt', async ({ page }) => {
  await openApp(page);
  await page.locator('.btn-tile').first().click();
  await expect(page.locator('.workout .card').first()).toBeVisible();
  const before = await exerciseOrder(page);
  expect(before.length).toBeGreaterThan(3);
  await page.reload();
  await expect(page.locator('.workout')).toBeVisible();
  expect(await exerciseOrder(page)).toEqual(before);
});

test('endre rekkefølgen på øvelsene med pilene', async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, 'Knebøy (stang)');
  await addExercise(page, 'Benkpress');
  await addExercise(page, 'Markløft');
  await page.getByRole('button', { name: /Endre rekkefølgen/ }).click();
  await page.getByRole('button', { name: 'Flytt Markløft opp' }).click();
  await page.getByRole('button', { name: 'Flytt Markløft opp' }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Ferdig' }).click();
  expect(await exerciseOrder(page)).toEqual(['Markløft', 'Knebøy (stang)', 'Benkpress']);
  await page.reload();
  await expect(page.locator('.workout')).toBeVisible();
  expect(await exerciseOrder(page)).toEqual(['Markløft', 'Knebøy (stang)', 'Benkpress']);
});

test('dra en øvelse til toppen', async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, 'Knebøy (stang)');
  await addExercise(page, 'Benkpress');
  await addExercise(page, 'Markløft');
  await page.getByRole('button', { name: /Endre rekkefølgen/ }).click();
  const box = (await page.getByRole('button', { name: 'Dra Markløft' }).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 60, { steps: 5 });
  await page.mouse.move(x, y - 130, { steps: 5 });
  await page.mouse.up();
  await page.locator('.sheet').getByRole('button', { name: 'Ferdig' }).click();
  expect(await exerciseOrder(page)).toEqual(['Markløft', 'Knebøy (stang)', 'Benkpress']);
});

test('ensidig øvelse: høyre side først, og hviletimeren venter på begge sider', async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, 'Pistol squat');
  const c = card(page, 'Pistol squat');
  await expect(c.locator('.set-label')).toHaveText(['1V', '1H']);
  const sheet = await openMenu(page, 'Pistol squat');
  await sheet.getByRole('button', { name: 'Høyre' }).click();
  await sheet.getByRole('button', { name: 'Lukk' }).click();
  await expect(c.locator('.set-label')).toHaveText(['1H', '1V']);
  await c.getByRole('button', { name: '+ Sett' }).click();
  await expect(c.locator('.set-label')).toHaveText(['1H', '1V', '2H', '2V']);

  await c.getByLabel('Reps').nth(0).fill('5');
  await c.locator('.check').nth(0).click();
  await expect(c.locator('.check').nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.restbar')).toHaveCount(0);
  await c.getByLabel('Reps').nth(1).fill('4');
  await c.locator('.check').nth(1).click();
  await expect(page.locator('.restbar')).toBeVisible();
  await skipRest(page);
  await finishWorkout(page);
  // Sammendraget skriver alltid venstre/høyre.
  await expect(page.locator('.summary-text')).toContainText('4/5');
});

test('RPE på alle arbeidssett og nivå på alle sett', async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, 'Front lever (hold)');
  const c = card(page, 'Front lever (hold)');
  await c.getByRole('button', { name: '+ Sett' }).click();
  const sheet = await openMenu(page, 'Front lever (hold)');
  await sheet.getByRole('button', { name: 'P3 på alle sett' }).click();
  await sheet.getByRole('button', { name: 'RPE 8,5 på alle arbeidssett' }).click();
  await sheet.getByRole('button', { name: 'Lukk' }).click();
  await expect(c.locator('.rpe-btn')).toHaveText(['8,5', '8,5']);
  for (const select of await c.locator('.level-select').all()) {
    await expect(select.locator('option:checked')).toContainText('P3');
  }
});

test('bytte øvelse: samme type beholder tallene, annen type spør først', async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, 'Knebøy (stang)');
  await logSet(page, 'Knebøy (stang)', 0, '100', '5');
  await skipRest(page);

  let sheet = await openMenu(page, 'Knebøy (stang)');
  await sheet.getByRole('button', { name: 'Bytt til en annen øvelse' }).click();
  await expect(page.getByRole('heading', { name: 'Bytt ut Knebøy (stang)' })).toBeVisible();
  await page.locator('.overlay .search').fill('Frontknebøy');
  await page.locator('.overlay .list-item').first().click();
  const front = card(page, 'Frontknebøy');
  await expect(front).toBeVisible();
  await expect(card(page, 'Knebøy (stang)')).toHaveCount(0);
  await expect(front.getByLabel('Kg', { exact: true }).first()).toHaveValue('100');
  await expect(front.locator('.check').first()).toHaveAttribute('aria-pressed', 'true');

  sheet = await openMenu(page, 'Frontknebøy');
  await sheet.getByRole('button', { name: 'Bytt til en annen øvelse' }).click();
  await page.locator('.overlay .search').fill('L-sit');
  await page.locator('.overlay .list-item').first().click();
  await expect(page.getByRole('heading', { name: 'Bytte til L-sit?' })).toBeVisible();
  await page.locator('.sheet').getByRole('button', { name: 'Bytt øvelse' }).click();
  await expect(card(page, 'L-sit')).toBeVisible();
  await expect(card(page, 'L-sit').locator('.check').first()).toHaveAttribute('aria-pressed', 'false');
});

test('kommentar per øvelse og dagbok for økta vises i dagboka', async ({ page }) => {
  await startEmptyWorkout(page);
  await addExercise(page, 'Benkpress');
  await logSet(page, 'Benkpress', 0, '80', '6');
  await skipRest(page);
  await card(page, 'Benkpress').getByLabel('Kommentar til Benkpress i denne økta').fill('Litt vondt i skulderen');
  await page.locator('.workout-note textarea').fill('Skrevet underveis');
  await page.getByRole('button', { name: 'Fullfør', exact: true }).click();
  const diary = page.locator('.sheet textarea');
  await expect(diary).toHaveValue('Skrevet underveis');
  await diary.fill('God økt, men trøtt');
  await page.locator('.sheet').getByRole('button', { name: 'Fullfør økta' }).click();
  await closeSummary(page);
  await goTab(page, 'Dagbok');
  await expect(page.locator('.note-quote').first()).toHaveText('God økt, men trøtt');
  await expect(page.locator('.we-comment').first()).toHaveText('Litt vondt i skulderen');
});

test('holdeklokka åpnes fra økta og teller', async ({ page }) => {
  await startEmptyWorkout(page);
  await page.getByRole('button', { name: 'Åpne holdeklokka' }).first().click();
  const clock = page.getByRole('dialog', { name: 'Holdeklokke' });
  await clock.getByRole('button', { name: 'Av', exact: true }).click();
  await clock.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(clock.locator('.hold-number')).toHaveText('1', { timeout: 5000 });
  await clock.getByRole('button', { name: 'Stopp' }).click();
  await clock.getByRole('button', { name: 'Lukk' }).click();
  await expect(clock).toHaveCount(0);
});

test('lage en ny øvelse rett fra «Legg til øvelse» legger den inn i økta', async ({ page }) => {
  await startEmptyWorkout(page);
  await page.getByRole('button', { name: '+ Legg til øvelse' }).click();
  await page.locator('.overlay .search').fill('Kettlebell swing');
  await page.getByRole('button', { name: '+ Lag ny øvelse «Kettlebell swing»' }).click();
  await page.getByRole('dialog', { name: 'Ny øvelse' }).getByRole('button', { name: 'Lagre' }).click();
  await expect(page.locator('.overlay')).toHaveCount(0);
  await expect(card(page, 'Kettlebell swing')).toBeVisible();
  await logSet(page, 'Kettlebell swing', 0, '24', '15');
  await skipRest(page);
  await page.reload();
  await expect(card(page, 'Kettlebell swing')).toBeVisible();
  await finishWorkout(page);
  await expect(page.locator('.summary-text')).toContainText('Kettlebell swing');
});

test('en øvelse laget under økta kan legges til og blir med når økta lagres', async ({ page }) => {
  await openApp(page);
  await page.locator('.btn-tile').first().click();
  await expect(page.locator('.workout .card').first()).toBeVisible();
  await goTab(page, 'Øvelser');
  await page.getByRole('button', { name: '+ Ny øvelse' }).click();
  await page.getByRole('dialog', { name: 'Ny øvelse' }).getByLabel('Navn', { exact: false }).first().fill('Landmine press');
  await page.getByRole('dialog', { name: 'Ny øvelse' }).getByRole('button', { name: 'Lagre' }).click();
  await goTab(page, 'Økt');
  await addExercise(page, 'Landmine press');
  await logSet(page, 'Landmine press', 0, '20', '10');
  await skipRest(page);
  await finishWorkout(page);
  await expect(page.locator('.summary-text')).toContainText('Landmine press');
});
