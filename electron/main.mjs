import { app, BrowserWindow, clipboard, dialog, ipcMain, Notification, shell } from 'electron';
import { open, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { InputError, MAX_IMPORT_BYTES, TripPlannerCore, validateSender, notificationMessage } from './core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const devUrl = process.env.TRIP_PLANNER_DEV_URL;
if (devUrl && devUrl !== 'http://127.0.0.1:5173') throw new Error('Development URL must be http://127.0.0.1:5173.');
const expectedUrl = devUrl ? `${devUrl}/` : pathToFileURL(join(here, '..', 'dist', 'index.html')).href;
let window;
let core;
let fileDialogOpen = false;
const activeNotifications = new Set();

async function notify(title, body) {
  const message = (key) => notificationMessage(key, core.config('settings', { locale: 'en' }).locale);
  const supported = Notification.isSupported();
  if (!supported) return { supported: false, delivered: false, message: message('unsupported') };
  if (!core.load().settings.notifications) return { supported: true, delivered: false, message: message('disabled') };
  return new Promise((resolve) => {
    let notification;
    let settled = false;
    let timer;
    const finish = (delivered, key) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ supported: true, delivered, message: message(key) });
    };
    try {
      notification = new Notification({ title, body });
      activeNotifications.add(notification);
      notification.once('show', () => finish(true, 'shown'));
      notification.once('failed', () => {
        activeNotifications.delete(notification);
        finish(false, 'failed');
      });
      notification.once('close', () => activeNotifications.delete(notification));
      notification.once('click', () => {
        if (window && !window.isDestroyed()) { window.restore(); window.show(); window.focus(); }
      });
      timer = setTimeout(() => {
        finish(false, 'timeout');
        activeNotifications.delete(notification);
        notification.close();
      }, 5000);
      notification.show();
    } catch {
      activeNotifications.delete(notification);
      finish(false, 'creationFailed');
    }
  });
}
function register(name, arity, action) {
  ipcMain.handle(`trip:${name}`, async (event, ...args) => {
    try {
      validateSender(event, window, expectedUrl);
      if (args.length !== arity) throw new InputError('Invalid request arguments.');
      return await action(...args);
    } catch (error) {
      throw new Error(error instanceof InputError ? error.message : `Unable to complete ${name}. Check local storage access and try again.`);
    }
  });
}
async function withFileDialog(action) {
  if (fileDialogOpen) throw new InputError('Another import or export dialog is already open.');
  fileDialogOpen = true;
  try { return await action(); } finally { fileDialogOpen = false; }
}
function registerHandlers() {
  register('load', 0, () => core.load());
  register('saveTrip', 1, (input) => core.saveTrip(input));
  register('setSettings', 1, (input) => core.setSettings(input));
  register('markAlert', 1, (id) => core.markAlert(id));
  register('saveQuote', 1, async (input) => {
    const before = core.load().alerts[0]?.id ?? 0;
    const state = core.saveQuote(input);
    const alert = state.alerts.find((item) => item.id > before);
    if (alert) state.notificationStatus = (await notify(alert.title, alert.body)).message;
    return state;
  });
  register('openSource', 1, async (id) => {
    const result = core.openSource(id);
    await shell.openExternal(result.url);
    return result;
  });
  register('copySearch', 0, () => clipboard.writeText(core.copySearch()));
  register('testNotification', 0, () => {
    const { locale } = core.load().settings;
    return notify(notificationMessage('testTitle', locale), notificationMessage('testBody', locale));
  });
  register('exportData', 0, () => withFileDialog(async () => {
    const result = await dialog.showSaveDialog(window, {
      title: 'Export personal trip data (unencrypted JSON)', defaultPath: 'trip-planner-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { cancelled: true };
    if (resolve(result.filePath).toLowerCase() === resolve(core.storagePath).toLowerCase()) throw new InputError('Export cannot overwrite the application database.');
    await writeFile(result.filePath, JSON.stringify(core.exportData(), null, 2), { encoding: 'utf8', mode: 0o600 });
    return { cancelled: false, path: result.filePath };
  }));
  register('importData', 0, () => withFileDialog(async () => {
    const result = await dialog.showOpenDialog(window, {
      title: 'Merge personal trip history', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths.length) return null;
    const file = await open(result.filePaths[0], 'r');
    try {
      const stats = await file.stat();
      if (!stats.isFile() || stats.size > MAX_IMPORT_BYTES) throw new InputError('Import must be a regular JSON file no larger than 5 MB.');
      const buffer = Buffer.alloc(MAX_IMPORT_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await file.read(buffer, length, buffer.length - length, null);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > MAX_IMPORT_BYTES) throw new InputError('Import must be JSON no larger than 5 MB.');
      let raw;
      try { raw = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)); }
      catch { throw new InputError('Import file must contain valid UTF-8 JSON.'); }
      return core.importData(raw);
    } finally { await file.close(); }
  }));
}
async function createWindow() {
  window = new BrowserWindow({
    width: 1240, height: 900, minWidth: 820, minHeight: 640, show: false,
    webPreferences: { preload: join(here, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-frame-navigate', (event) => event.preventDefault());
  window.webContents.on('will-redirect', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.session.on('will-download', (event) => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { window = null; });
  await window.loadURL(expectedUrl);
}
if (process.env.TRIP_PLANNER_TEST !== '1' && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (window) { window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(async () => {
    core = new TripPlannerCore(join(process.env.TRIP_PLANNER_DATA_DIR || app.getPath('userData'), 'trip-planner.sqlite'));
    registerHandlers();
    await createWindow();
  }).catch(() => {
    dialog.showErrorBox('Trip Planner could not start', 'Check application installation and local storage access, then restart.');
    app.quit();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => {
    for (const notification of activeNotifications) notification.close();
    activeNotifications.clear();
    core?.close();
  });
}
