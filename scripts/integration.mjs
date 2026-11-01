import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { _electron as electron } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(path.join(tmpdir(), 'trip-planner-integration-'));
const artifacts = path.join(root, 'test-results');
await mkdir(artifacts, { recursive: true });
const environment = { ...process.env, TRIP_PLANNER_DATA_DIR: temporary, TRIP_PLANNER_TEST: '1' };
delete environment.ELECTRON_RUN_AS_NODE;
delete environment.TRIP_PLANNER_DEV_URL;
const results = [];
let application;
let clipboardRestored = false;
let clipboardWritten;
const trip = {
  name: 'Synthetic coast trip', destination: 'Seattle', origin: 'DEN', arrival: 'SEA',
  departureDate: '2027-06-10', returnDate: '2027-06-15', adults: 2, childAges: [8],
  rooms: 1, currency: 'USD', budgetMinor: 300000, resortUrl: 'https://example.com/hotel', notes: 'Synthetic integration test',
};

async function check(name, work) {
  try { await work(); } catch (error) {
    results.push({ name, passed: false, error: error.message });
    console.error(`FAIL ${name}:`, error);
    throw error;
  }
  results.push({ name, passed: true });
  console.log(`PASS ${name}`);
}

async function launch() {
  const executablePath = process.env.TRIP_PLANNER_EXECUTABLE || require('electron');
  application = await electron.launch({ executablePath, args: process.env.TRIP_PLANNER_EXECUTABLE ? [] : [root], env: environment });
  const page = await application.firstWindow();
  await page.waitForFunction(() => Boolean(window.tripPlanner));
  return page;
}

async function navigate(page, label) {
  await page.getByRole('navigation', { name: 'Trip Planner', exact: true }).getByRole('button', { name: label, exact: typeof label === 'string' }).click();
}

try {
  let page = await launch();
  await application.evaluate(async ({ clipboard, ClipboardItem }) => {
    globalThis.testOriginalClipboard = await Promise.all((await clipboard.read()).map(async item =>
      new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type => [type, await item.getType(type)]))))));
  });
  await check('Fresh desktop database, isolation, and preload', async () => {
    const result = await page.evaluate(async () => ({
      state: await window.tripPlanner.load(), node: typeof window.require, process: typeof window.process,
    }));
    assert.equal(result.state.trip, null);
    assert.equal(result.node, 'undefined');
    assert.equal(result.process, 'undefined');
    await page.getByRole('button', { name: 'Set up a trip', exact: true }).click();
  });
  await check('Explicit load error and retry control recover without losing state', async () => {
    await application.evaluate(({ ipcMain }) => {
      const key = [...ipcMain._invokeHandlers.keys()].find(key => key.endsWith(':load'));
      if (!key) throw new Error('The application load handler was not registered.');
      const handler = ipcMain._invokeHandlers.get(key);
      ipcMain.removeHandler(key);
      ipcMain.handle(key, () => {
        ipcMain.removeHandler(key);
        ipcMain.handle(key, handler);
        throw new Error('Synthetic load failure');
      });
    });
    await page.reload();
    await page.getByRole('alert').filter({ hasText: /Synthetic load failure/ }).waitFor();
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('button', { name: 'Set up a trip', exact: true }).waitFor();
  });
  await check('Trip configuration through the UI', async () => {
    await navigate(page, 'Trip settings');
    for (const [label, value] of [
      ['Trip name', trip.name], ['Destination', trip.destination], ['Departure airport (IATA)', trip.origin],
      ['Arrival airport (IATA)', trip.arrival], ['Departure / check-in', trip.departureDate],
      ['Return / check-out', trip.returnDate], ['Child ages at travel', '8'],
      ['Adults', '2'], ['Rooms', '1'], ['Notes', trip.notes],
      ['Total trip budget', '3000'], ['Official accommodation search URL', trip.resortUrl],
    ]) await page.getByLabel(label, { exact: true }).fill(value);
    await page.getByLabel('Home currency', { exact: true }).selectOption('USD');
    await page.getByRole('button', { name: 'Save trip', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Trip saved' }).waitFor();
    const state = await page.evaluate(() => window.tripPlanner.load());
    assert.equal(state.trip.origin, 'DEN');
    assert.equal(state.trip.budgetMinor, 300000);
    assert.deepEqual(state.trip.childAges, [8]);
    await page.getByLabel('Return / check-out', { exact: true }).fill('2027-06-01');
    await page.getByRole('button', { name: 'Save trip', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'alert');
    assert.equal((await page.evaluate(() => window.tripPlanner.load())).trip.returnDate, trip.returnDate);
    await page.getByLabel('Return / check-out', { exact: true }).fill(trip.returnDate);
    await page.getByRole('button', { name: 'Save trip', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Trip saved' }).waitFor();
  });
  await check('Clipboard integration writes the actual search checklist', async () => {
    await navigate(page, 'Update prices');
    await page.getByRole('button', { name: /^Copy/ }).click();
    await page.getByRole('status').filter({ hasText: /copied/i }).waitFor();
    const clipboard = await application.evaluate(({ clipboard }) => clipboard.readText());
    clipboardWritten = clipboard;
    assert.match(clipboard, /DEN/);
    assert.match(clipboard, /SEA/);
    assert.match(clipboard, /2027-06-10/);
    assert.match(clipboard, /8/);
  });
  await check('Every source opener dispatches only its validated URL', async () => {
    await application.evaluate(({ shell }) => {
      globalThis.testOpened = [];
      globalThis.realOpenExternal = shell.openExternal;
      shell.openExternal = async url => { globalThis.testOpened.push(url); };
    });
    try {
      const sources = await page.evaluate(async () => (await window.tripPlanner.load()).sources);
      await navigate(page, 'Update prices');
      for (const source of sources) {
        await page.getByRole('button', { name: `${source.label} (external browser)`, exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Opened' }).waitFor();
      }
      const opened = await application.evaluate(() => globalThis.testOpened);
      assert.deepEqual(opened, sources.map(s => s.url));
      await assert.rejects(page.evaluate(() => window.tripPlanner.openSource('javascript:alert(1)')));
    } finally {
      await application.evaluate(({ shell }) => { shell.openExternal = globalThis.realOpenExternal; });
    }
  });
  if (process.env.TRIP_PLANNER_BROWSER_CHECK === '1') {
    await check('Real OS external-browser launch reaches a local test receiver', async () => {
      let received;
      const reached = new Promise(resolve => { received = resolve; });
      const server = createServer((request, response) => {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<!doctype html><html lang="en"><title>Trip Planner browser check</title><body><h1>Browser launch checked</h1><p>This temporary local test has finished. You can close this tab.</p></body></html>');
        if (request.url === '/browser-check') received();
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();
      let timeout;
      try {
        await application.evaluate(({ shell }, url) => shell.openExternal(url), `http://127.0.0.1:${port}/browser-check`);
        await Promise.race([reached, new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('The default browser did not reach the local test receiver.')), 20000);
        })]);
      } finally { clearTimeout(timeout); await new Promise(resolve => server.close(resolve)); }
    });
  }
  await check('Quote capture through UI and lower-price alert via IPC', async () => {
    await navigate(page, 'Update prices');
    await page.getByLabel('Itinerary or room / rate plan', { exact: true }).fill('Synthetic return economy');
    await page.getByLabel('Party total (USD)', { exact: true }).fill('800');
    await page.getByLabel('Baggage / inclusions', { exact: true }).fill('One checked bag each');
    await page.getByLabel('Cancellation / refund terms', { exact: true }).fill('Refundable');
    await page.getByLabel('I checked that taxes and mandatory fees are included', { exact: true }).check();
    await page.getByLabel('I verified the exact dates, party, room count, currency and total against the source', { exact: true }).check();
    await page.getByRole('button', { name: 'Save confirmed quote', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Quote saved' }).waitFor();
    let state = await page.evaluate(() => window.tripPlanner.load());
    assert.equal(state.quotes.length, 1);
    const { id, revision, fingerprint, ...quote } = state.quotes[0];
    state = await page.evaluate(q => window.tripPlanner.saveQuote(q), { ...quote, totalMinor: 70000, observedAt: new Date().toISOString() });
    assert.equal(state.alerts.length, 1);
    state = await page.evaluate(q => window.tripPlanner.saveQuote(q), { ...quote, totalMinor: 70000, observedAt: new Date().toISOString() });
    assert.equal(state.alerts.length, 1);
    await assert.rejects(page.evaluate(q => window.tripPlanner.saveQuote(q), { ...quote, startDate: '2027-06-11' }));
    await assert.rejects(page.evaluate(q => window.tripPlanner.saveQuote(q), { ...quote, totalMinor: 0 }));
    await page.reload();
    await navigate(page, 'Update prices');
    await page.getByLabel('Quote type', { exact: true }).selectOption('hotel');
    await page.getByLabel('Source', { exact: true }).selectOption({ label: 'Google Hotels' });
    await page.getByLabel('Itinerary or room / rate plan', { exact: true }).fill('Synthetic complete room');
    await page.getByLabel('Party total (USD)', { exact: true }).fill('1300');
    await page.getByLabel('Baggage / inclusions', { exact: true }).fill('All-inclusive');
    await page.getByLabel('Cancellation / refund terms', { exact: true }).fill('Cancelable');
    await page.getByLabel('Notes', { exact: true }).fill('Synthetic promotion conditions: verify eligibility and expiry.');
    await page.getByLabel('I checked that taxes and mandatory fees are included', { exact: true }).check();
    await page.getByLabel('I verified the exact dates, party, room count, currency and total against the source', { exact: true }).check();
    await page.getByRole('button', { name: 'Save confirmed quote', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Quote saved' }).waitFor();
    await navigate(page, 'Overview');
    await page.getByText('$2,000.00', { exact: true }).waitFor();
    await page.getByText('Synthetic promotion conditions: verify eligibility and expiry.', { exact: true }).waitFor();
    await page.getByRole('main').getByRole('button', { name: 'Update prices', exact: true }).click();
    await page.getByLabel('Quote type', { exact: true }).waitFor();
    await navigate(page, 'Overview');
    await page.getByLabel('Include previous trip configurations', { exact: true }).check();
    await page.getByText('Price history across trip configurations', { exact: false }).waitFor();
    await page.getByLabel('Include previous trip configurations', { exact: true }).uncheck();
    await navigate(page, /^Alert inbox/);
    await page.getByRole('button', { name: 'Mark read', exact: true }).click();
    state = await page.evaluate(() => window.tripPlanner.load());
    assert.equal(state.alerts[0].read, true);
    await page.getByRole('button', { name: 'Test Windows notification', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Your inbox remains the reliable record' }).waitFor();
    await page.getByLabel('Minimum comparable price drop (%)', { exact: true }).fill('10');
    await page.getByLabel('Target party price (USD)', { exact: true }).fill('750');
    await page.getByLabel('Enable Windows notifications', { exact: true }).check();
    await page.getByRole('button', { name: 'Save alert rules', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'saved' }).waitFor();
    state = await page.evaluate(() => window.tripPlanner.load());
    assert.equal(state.settings.dropPercent, 10);
    assert.equal(state.settings.targetMinor, 75000);
  });
  await check('Native notifications report observed OS delivery, not assumed success', async () => {
    await page.evaluate(async () => {
      const state = await window.tripPlanner.load();
      return window.tripPlanner.setSettings({ ...state.settings, notifications: true });
    });
    const notification = await page.evaluate(() => window.tripPlanner.testNotification());
    assert.equal(typeof notification.supported, 'boolean');
    assert.equal(typeof notification.delivered, 'boolean');
    assert.equal(typeof notification.message, 'string');
    results.push({ name: 'Native notification outcome', ...notification });
    console.log('Native notification:', JSON.stringify(notification));
  });
  await check('Export/import file handling with real JSON IO and cancelled dialogs', async () => {
    await navigate(page, 'Trip settings');
    const file = path.join(temporary, 'synthetic-export.json');
    await application.evaluate(({ dialog }, file) => {
      globalThis.realSave = dialog.showSaveDialog;
      globalThis.realOpen = dialog.showOpenDialog;
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, file);
    try {
      await page.getByRole('button', { name: 'Export personal data', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Personal data exported' }).waitFor();
      const exported = await page.evaluate(() => window.tripPlanner.exportData());
      assert.equal(exported.cancelled, false);
      const content = JSON.parse(await readFile(file, 'utf8'));
      assert.equal(content.schemaVersion, 1);
      const before = await page.evaluate(() => window.tripPlanner.load());
      await page.getByRole('button', { name: 'Import personal data', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Personal data imported' }).waitFor();
      const imported = await page.evaluate(() => window.tripPlanner.importData());
      assert.equal(imported.quotes.length, before.quotes.length);
      await writeFile(file, '{"schemaVersion":999}', 'utf8');
      await assert.rejects(page.evaluate(() => window.tripPlanner.importData()));
      const after = await page.evaluate(() => window.tripPlanner.load());
      assert.equal(after.quotes.length, before.quotes.length);
      await application.evaluate(({ dialog }) => {
        dialog.showSaveDialog = async () => ({ canceled: true });
        dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
      });
      assert.equal((await page.evaluate(() => window.tripPlanner.exportData())).cancelled, true);
      assert.equal(await page.evaluate(() => window.tripPlanner.importData()), null);
      await page.getByRole('button', { name: 'Import personal data', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'File selection cancelled' }).waitFor();
    } finally {
      await application.evaluate(({ dialog }) => {
        dialog.showSaveDialog = globalThis.realSave; dialog.showOpenDialog = globalThis.realOpen;
      });
    }
  });
  await check('English and Spanish workflows, accessibility, keyboard and reflow', async () => {
    for (const locale of ['en', 'es']) {
      await page.getByLabel('Language', { exact: true }).selectOption(locale);
      await page.waitForFunction(language => document.documentElement.lang === language, locale);
      const labels = locale === 'en'
        ? ['Overview', 'Update prices', 'Trip settings', 'Alert inbox']
        : ['Resumen', 'Actualizar precios', 'Configurar viaje', 'Bandeja de alertas'];
      for (const label of labels) {
        await navigate(page, label);
        assert.equal(await page.locator('h1').count(), 1);
        const axe = await new AxeBuilder({ page }).setLegacyMode().withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        assert.deepEqual(axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })), []);
      }
      await navigate(page, labels[0]);
      await page.screenshot({ path: path.join(artifacts, `desktop-${locale}.png`) });
      await navigate(page, labels[1]);
      await page.screenshot({ path: path.join(artifacts, `update-${locale}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    for (const label of ['Resumen', 'Actualizar precios', 'Configurar viaje', 'Bandeja de alertas']) {
      await navigate(page, label);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, label);
    }
    await navigate(page, 'Actualizar precios');
    await page.screenshot({ path: path.join(artifacts, 'narrow-es.png') });
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement !== document.body), true);
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    assert.notEqual(outline, 'none');
    await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
    const axe = await new AxeBuilder({ page }).setLegacyMode().withTags(['wcag2a', 'wcag2aa']).analyze();
    assert.equal(axe.violations.length, 0);
    await page.emulateMedia({ forcedColors: 'none' });
  });
  const beforeRestart = await page.evaluate(() => window.tripPlanner.load());
  await application.evaluate(async ({ clipboard }, written) => {
    if (await clipboard.readText() === written) await clipboard.write(globalThis.testOriginalClipboard);
  }, clipboardWritten);
  clipboardRestored = true;
  await application.close(); application = undefined;
  await check('SQLite persistence survives a fresh desktop process', async () => {
    page = await launch();
    const state = await page.evaluate(() => window.tripPlanner.load());
    assert.equal(state.trip.name, trip.name);
    assert.equal(state.quotes.length, beforeRestart.quotes.length);
    assert.equal(state.alerts.length, beforeRestart.alerts.length);
    assert.equal(state.settings.locale, 'es');
  });
  await writeFile(path.join(artifacts, 'integration.json'), JSON.stringify({
    checkedAt: new Date().toISOString(), results,
    limitations: ['External browser dispatch is intercepted in IPC tests; website accessibility is checked separately.', 'Native save/open dialog choices are simulated; filesystem writes/import validation are real.', 'Google account enrollment and email delivery are not automated or tested.', 'NVDA narration and a complete Windows installer wizard are not automated.'],
  }, null, 2));
} finally {
  if (application) {
    try {
      if (!clipboardRestored && clipboardWritten) await application.evaluate(async ({ clipboard }, written) => {
        if (await clipboard.readText() === written) await clipboard.write(globalThis.testOriginalClipboard);
      }, clipboardWritten);
    } finally { await application.close(); }
  }
  await rm(temporary, { recursive: true, force: true });
}
