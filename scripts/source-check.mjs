import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const sources = [
  ['google-flights', 'https://www.google.com/travel/flights'],
  ['google-hotels', 'https://www.google.com/travel/hotels'],
  ['aeromexico', 'https://aeromexico.com/'],
  ['volaris', 'https://www.volaris.com/'],
  ['viva', 'https://www.vivaaerobus.com/'],
];
if (process.env.TRIP_PLANNER_RESORT_URL) sources.push(['resort', process.env.TRIP_PLANNER_RESORT_URL]);
const selectedSources = process.env.TRIP_PLANNER_SOURCE
  ? sources.filter(([source]) => source === process.env.TRIP_PLANNER_SOURCE)
  : sources;
if (!selectedSources.length) throw new Error('The requested source is not in the source registry.');
const results = [];
try {
  const context = await browser.newContext({ locale: 'en-US' });
  for (const [source, url] of selectedSources) {
    const page = await context.newPage();
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      const title = await page.title();
      const text = (await page.locator('body').innerText()).slice(0, 2000);
      const blocked = /access denied|forbidden|verify you are human|captcha|just a moment|no autorizado/i.test(title + text);
      const status = response?.status() ?? null;
      results.push({ source, url, finalUrl: page.url(), status, title, outcome: blocked || (status !== null && status >= 400) ? 'blocked-or-unavailable' : text.trim().length < 30 ? 'shell-only' : 'page-visible' });
    } catch (error) {
      results.push({ source, url, outcome: 'navigation-failed', error: error.message });
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
await mkdir(path.join(root, 'test-results'), { recursive: true });
await writeFile(path.join(root, 'test-results', 'sources.json'), JSON.stringify({
  checkedAt: new Date().toISOString(), results,
  scope: 'Landing-page visibility only. No booking searches, anti-bot bypass, personal information, account login, subscriptions, or quote extraction.',
}, null, 2));
for (const result of results) console.log(`${result.source}: ${result.outcome} (${result.status ?? 'no response'})`);
