import { expect, type Locator, type Page } from '@playwright/test';

/** Åpner appen med tom database (hver test har sin egen nettleserkontekst). */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start tom økt' })).toBeVisible();
}

export async function startEmptyWorkout(page: Page): Promise<void> {
  await openApp(page);
  await page.getByRole('button', { name: 'Start tom økt' }).click();
  await expect(page.locator('.workout')).toBeVisible();
}

export async function addExercise(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: '+ Legg til øvelse' }).click();
  await page.locator('.overlay .search').fill(name);
  await page.locator('.overlay .list-item').first().click();
  await expect(card(page, name)).toBeVisible();
}

/** Kortet for en øvelse i økta. */
export function card(page: Page, name: string): Locator {
  return page.locator('.workout .card', { has: page.locator('.card-title', { hasText: name }) });
}

export async function openMenu(page: Page, name: string): Promise<Locator> {
  await card(page, name).getByRole('button', { name: `Valg for ${name}` }).click();
  const sheet = page.locator('.sheet');
  await expect(sheet).toBeVisible();
  return sheet;
}

/** Fører inn og haker av ett sett med kg og reps. */
export async function logSet(page: Page, name: string, index: number, kg: string, reps: string): Promise<void> {
  const c = card(page, name);
  await c.getByLabel('Kg', { exact: true }).nth(index).fill(kg);
  await c.getByLabel('Reps').nth(index).fill(reps);
  await c.locator('.check').nth(index).click();
  await expect(c.locator('.check').nth(index)).toHaveAttribute('aria-pressed', 'true');
}

export async function skipRest(page: Page): Promise<void> {
  const skip = page.locator('.restbar').getByRole('button', { name: 'Hopp over' });
  if (await skip.count()) await skip.click();
  await expect(page.locator('.restbar')).toHaveCount(0);
}

export async function finishWorkout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Fullfør', exact: true }).click();
  await page.locator('.sheet').getByRole('button', { name: 'Fullfør økta' }).click();
  await expect(page.getByRole('heading', { name: 'Økta er lagret' })).toBeVisible();
}

export async function closeSummary(page: Page): Promise<void> {
  await page.getByRole('dialog', { name: 'Øktsammendrag' }).getByRole('button', { name: 'Lukk' }).click();
}

export async function goTab(page: Page, label: string): Promise<void> {
  await page.locator('.tabbar').getByRole('button', { name: label }).click();
}

/** Navnene på øvelsene i økta, i rekkefølgen de står. */
export async function exerciseOrder(page: Page): Promise<string[]> {
  return page.locator('.workout .card-title').evaluateAll((els) => els.map((e) => e.firstChild?.textContent ?? ''));
}
