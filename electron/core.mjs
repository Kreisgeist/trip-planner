import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class InputError extends Error {}
const fail = (message) => { throw new InputError(message); };
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const DEFAULT_SETTINGS = Object.freeze({ locale: 'en', notifications: false, targetMinor: 0, dropPercent: 5 });
const SOURCES = [
  { id: 'google-flights', label: 'Google Flights', url: 'https://www.google.com/travel/flights', description: 'Search flights.' },
  { id: 'google-hotels', label: 'Google Hotels', url: 'https://www.google.com/travel/hotels', description: 'Search hotels.' },
  { id: 'aeromexico', label: 'Aeroméxico', url: 'https://aeromexico.com/', description: 'Search airline fares.' },
  { id: 'volaris', label: 'Volaris', url: 'https://www.volaris.com/', description: 'Search airline fares.' },
  { id: 'viva', label: 'Viva', url: 'https://www.vivaaerobus.com/', description: 'Search airline fares.' },
];
const TRIP_KEYS = ['name', 'destination', 'origin', 'arrival', 'departureDate', 'returnDate', 'adults', 'childAges', 'rooms', 'currency', 'budgetMinor', 'resortUrl', 'notes'];
const QUOTE_KEYS = ['kind', 'source', 'product', 'startDate', 'endDate', 'adults', 'childAges', 'rooms', 'currency', 'totalMinor', 'feesIncluded', 'baggage', 'cancellation', 'notes', 'observedAt', 'confirmed'];
const normalize = (s) => s.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function objectShape(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      required.some((key) => !Object.hasOwn(value, key)) ||
      Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) fail('Invalid input fields.');
}
export function validateSender(event, mainWindow, loadedUrl) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents ||
      !event.senderFrame || event.senderFrame !== mainWindow.webContents.mainFrame ||
      event.senderFrame.url !== loadedUrl || mainWindow.webContents.getURL() !== loadedUrl) {
    fail('Request rejected: untrusted application frame.');
  }
}
function text(value, label, max = 500, required = true) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) ||
      (required && !value.trim())) fail(`${label} must be ${required ? 'nonempty ' : ''}text of at most ${max} characters.`);
  return value.trim();
}
function integer(value, label, min, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${label} must be an integer between ${min} and ${max}.`);
  return value;
}
function boolean(value, label) {
  if (typeof value !== 'boolean') fail(`${label} must be true or false.`);
  return value;
}
function dates(start, end) {
  for (const value of [start, end]) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
        !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Dates must be real YYYY-MM-DD calendar dates.');
  }
  if (start >= end) fail('Departure/start date must be before return/end date.');
}
function ages(value) {
  if (!Array.isArray(value) || value.length > 9) fail('Child ages must be an array with at most 9 children.');
  return value.map((age) => integer(age, 'Child age', 0, 17));
}
function currency(value) {
  if (typeof value !== 'string' || !/^[A-Z]{3}$/u.test(value) || !Intl.supportedValuesOf('currency').includes(value)) fail('Currency must be a supported uppercase currency code.');
  return value;
}
export function validateResortUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\u0000-\u001f\u007f\\]/u.test(value)) fail('Resort URL must be a valid public HTTPS URL.');
  let url;
  try { url = new URL(value); } catch { fail('Resort URL must be a valid public HTTPS URL.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      isIP(host.replace(/^\[|\]$/gu, '')) || !host.includes('.') || host.endsWith('.') ||
      /(^|\.)(localhost|local|internal|lan|home|test|invalid|example)$/u.test(host) ||
      host.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))) fail('Resort URL must use HTTPS and a public hostname without credentials or a nonstandard port.');
  return url.href;
}
export function validateTrip(input) {
  objectShape(input, TRIP_KEYS);
  dates(input.departureDate, input.returnDate);
  return {
    name: text(input.name, 'Trip name', 120), destination: text(input.destination, 'Destination', 200),
    origin: text(input.origin, 'Origin', 120), arrival: text(input.arrival, 'Arrival', 120),
    departureDate: input.departureDate, returnDate: input.returnDate,
    adults: integer(input.adults, 'Adults', 1, 9), childAges: ages(input.childAges),
    rooms: integer(input.rooms, 'Rooms', 1, 9), currency: currency(input.currency),
    budgetMinor: integer(input.budgetMinor, 'Budget', 0),
    resortUrl: input.resortUrl === '' ? '' : validateResortUrl(input.resortUrl),
    notes: text(input.notes, 'Notes', 4000, false),
  };
}
function comparisonIdentity(trip) {
  return [normalize(trip.destination), normalize(trip.origin), normalize(trip.arrival),
    trip.departureDate, trip.returnDate, trip.adults, [...trip.childAges].sort((a, b) => a - b), trip.rooms, trip.currency];
}
function legacyTripRevision(trip) {
  return trip ? hash(comparisonIdentity(trip)) : null;
}
export function tripRevision(trip) {
  if (!trip) return null;
  return hash([...comparisonIdentity(trip), trip.resortUrl ? validateResortUrl(trip.resortUrl) : '']);
}
export function validateSettings(input) {
  objectShape(input, Object.keys(DEFAULT_SETTINGS));
  if (!['en', 'es'].includes(input.locale)) fail('Locale must be en or es.');
  return { locale: input.locale, notifications: boolean(input.notifications, 'Notifications'),
    targetMinor: integer(input.targetMinor, 'Target', 0), dropPercent: integer(input.dropPercent, 'Drop percentage', 1, 100) };
}
export function validateQuote(input, now = Date.now(), exported = false) {
  objectShape(input, QUOTE_KEYS, exported ? ['id', 'revision', 'fingerprint'] : []);
  if (exported) {
    integer(input.id, 'Quote ID', 1);
    if (typeof input.revision !== 'string' || !/^[a-f0-9]{64}$/u.test(input.revision) ||
        typeof input.fingerprint !== 'string' || !/^[a-f0-9]{64}$/u.test(input.fingerprint)) fail('Imported quote metadata is malformed.');
  }
  if (!['flight', 'hotel'].includes(input.kind)) fail('Quote kind must be flight or hotel.');
  dates(input.startDate, input.endDate);
  if (typeof input.observedAt !== 'string' || input.observedAt.length > 40) fail('Observed time must be a valid ISO timestamp with a timezone.');
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/u.exec(input.observedAt);
  if (!parts || !Number.isFinite(Date.parse(input.observedAt))) fail('Observed time must be a valid ISO timestamp with a timezone.');
  if (new Date(parts[1]).toISOString().slice(0, 10) !== parts[1] ||
      Number(parts[2]) > 23 || Number(parts[3]) > 59 || Number(parts[4]) > 59 ||
      Number(parts[6] || 0) > 23 || Number(parts[7] || 0) > 59) fail('Observed time must be a real ISO timestamp.');
  const observed = Date.parse(input.observedAt);
  const canonical = new Date(observed).toISOString();
  if (observed > now + 5 * 60_000) fail('Observed time cannot be more than five minutes in the future.');
  if (input.confirmed !== true) fail('Confirm the quote details before saving.');
  return {
    kind: input.kind, source: text(input.source, 'Source', 120), product: text(input.product, 'Product', 300),
    startDate: input.startDate, endDate: input.endDate, adults: integer(input.adults, 'Adults', 1, 9),
    childAges: ages(input.childAges), rooms: integer(input.rooms, 'Rooms', 1, 9), currency: currency(input.currency),
    totalMinor: integer(input.totalMinor, 'Total', 1), feesIncluded: boolean(input.feesIncluded, 'Fees included'),
    baggage: text(input.baggage, 'Baggage', 500, false), cancellation: text(input.cancellation, 'Cancellation', 1000, false),
    notes: text(input.notes, 'Notes', 4000, false), observedAt: canonical, confirmed: true,
  };
}
export function assertCompatible(quote, trip) {
  if (!trip) fail('Configure a trip before saving a quote.');
  if (quote.startDate !== trip.departureDate || quote.endDate !== trip.returnDate) fail('Quote dates must exactly match the configured trip.');
  if (quote.adults !== trip.adults || quote.rooms !== trip.rooms ||
      JSON.stringify([...quote.childAges].sort((a, b) => a - b)) !== JSON.stringify([...trip.childAges].sort((a, b) => a - b))) fail('Quote adults, child ages and rooms must exactly match the trip.');
  if (quote.currency !== trip.currency) fail('Quote currency must match the trip currency; currency conversion is not available.');
}
export function quoteFingerprint(quote, revision) {
  return hash([revision, quote.kind, normalize(quote.source), normalize(quote.product), quote.startDate,
    quote.endDate, quote.adults, [...quote.childAges].sort((a, b) => a - b), quote.rooms,
    quote.currency, quote.feesIncluded, normalize(quote.baggage), normalize(quote.cancellation)]);
}
function amount(minor, code, locale = 'en') {
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency: code });
  return `${code} ${formatter.format(minor / 10 ** formatter.resolvedOptions().maximumFractionDigits)}`;
}
const MESSAGES = {
  unsupported: ['Native notifications are not supported on this system.', 'Este sistema no admite notificaciones nativas.'],
  disabled: ['Enable notifications in settings before sending a notification.', 'Activa las notificaciones en la configuración antes de enviar una notificación.'],
  shown: ['The operating system reported that the notification was shown.', 'El sistema operativo confirmó que se mostró la notificación.'],
  failed: ['The operating system could not show the notification.', 'El sistema operativo no pudo mostrar la notificación.'],
  timeout: ['Notification delivery was not confirmed within five seconds; the inbox remains authoritative.', 'No se confirmó la entrega en cinco segundos; consulta la bandeja de alertas.'],
  creationFailed: ['Native notification could not be created or shown.', 'No se pudo crear o mostrar la notificación nativa.'],
  testTitle: ['Trip Planner', 'Planificador de viajes'],
  testBody: ['This is a test notification. No search or monitoring was performed.', 'Esta es una notificación de prueba. No se realizó ninguna búsqueda ni seguimiento.'],
};
export function notificationMessage(key, locale) {
  if (!Object.hasOwn(MESSAGES, key)) fail('Unknown notification message.');
  return MESSAGES[key][locale === 'es' ? 1 : 0];
}
const archiveRevision = (legacyRevision) => hash(['trip-planner-archive-v1', legacyRevision]);
function renderAlert(quote, details, locale) {
  const es = locale === 'es';
  const reasons = [];
  if (details.targetReached) reasons.push(es ? 'Objetivo alcanzado' : 'Target reached');
  if (details.dropPercent) reasons.push(es ? `El precio bajó al menos un ${details.dropPercent}%` : `Price dropped at least ${details.dropPercent}%`);
  return {
    title: es ? 'Alerta de precio del viaje' : 'Trip price alert',
    body: `${quote.product}: ${amount(quote.totalMinor, quote.currency, locale)}${details.previousMinor
      ? `; ${es ? 'anterior' : 'previous'} ${amount(details.previousMinor, quote.currency, locale)}` : ''}.${reasons.length ? ` ${reasons.join('; ')}.` : ''}`,
  };
}

export class TripPlannerCore {
  constructor(storagePath, { now = () => Date.now() } = {}) {
    this.storagePath = storagePath;
    this.now = now;
    this.closed = false;
    if (storagePath !== ':memory:') mkdirSync(dirname(storagePath), { recursive: true });
    this.db = new DatabaseSync(storagePath);
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    if (version !== 0 && version !== 1) { this.db.close(); fail('This database version is not supported.'); }
    this.db.exec(`PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions (revision TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT, revision TEXT NOT NULL, fingerprint TEXT NOT NULL,
        observed_at TEXT NOT NULL, total_minor INTEGER NOT NULL, value TEXT NOT NULL,
        UNIQUE(fingerprint, observed_at, total_minor));
      CREATE INDEX IF NOT EXISTS quote_comparison ON quotes(fingerprint, observed_at, id);
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id INTEGER NOT NULL REFERENCES quotes(id),
        created_at TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, title TEXT NOT NULL, body TEXT NOT NULL);
      PRAGMA user_version = 1;`);
    if (!this.db.prepare('PRAGMA table_info(alerts)').all().some((column) => column.name === 'details')) {
      this.db.exec('ALTER TABLE alerts ADD COLUMN details TEXT');
    }
    this.transaction(() => {
      const trip = this.config('trip', null);
      if (trip) this.putRevision({ revision: tripRevision(trip), trip });
      for (const row of this.db.prepare('SELECT alerts.*, quotes.value AS quote_value FROM alerts JOIN quotes ON quotes.id = alerts.quote_id WHERE details IS NULL').all()) {
        const quote = JSON.parse(row.quote_value);
        const previousRow = this.db.prepare('SELECT value FROM quotes WHERE fingerprint = (SELECT fingerprint FROM quotes WHERE id = ?) AND id < ? AND observed_at <= ? ORDER BY observed_at DESC, id DESC LIMIT 1')
          .get(row.quote_id, row.quote_id, quote.observedAt);
        const previousMinor = previousRow ? JSON.parse(previousRow.value).totalMinor : null;
        const prefix = `${quote.product}: ${amount(quote.totalMinor, quote.currency)}${previousMinor
          ? `; previous ${amount(previousMinor, quote.currency)}` : ''}. `;
        // Only the generated suffix is metadata; product text is never parsed as a reason.
        const suffix = row.body.startsWith(prefix) ? row.body.slice(prefix.length) : '';
        const reasons = /^(Target reached)?(?:; )?(?:Price dropped at least ([1-9]\d?|100)%)?\.$/u.exec(suffix);
        const details = { targetReached: Boolean(reasons?.[1]), dropPercent: reasons?.[2] ? Number(reasons[2]) : null,
          previousMinor: reasons ? previousMinor : null };
        this.db.prepare('UPDATE alerts SET details = ? WHERE id = ?').run(JSON.stringify(details), row.id);
      }
    });
  }
  close() { if (!this.closed) { this.db.close(); this.closed = true; } }
  transaction(action) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  config(key, fallback) {
    const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    return row ? JSON.parse(row.value) : fallback;
  }
  putConfig(key, value) {
    this.db.prepare('INSERT INTO config(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, JSON.stringify(value));
  }
  putRevision(context) {
    this.db.prepare('INSERT OR IGNORE INTO revisions(revision, value) VALUES (?, ?)').run(context.revision, JSON.stringify(context));
  }
  load() {
    const trip = this.config('trip', null);
    const settings = this.config('settings', { ...DEFAULT_SETTINGS });
    return {
      trip, revision: tripRevision(trip),
      settings,
      quotes: this.db.prepare('SELECT * FROM quotes ORDER BY id DESC').all().map((row) => ({
        ...JSON.parse(row.value), id: row.id, revision: row.revision, fingerprint: row.fingerprint,
      })),
      alerts: this.db.prepare('SELECT alerts.*, quotes.value AS quote_value FROM alerts JOIN quotes ON quotes.id = alerts.quote_id ORDER BY alerts.id DESC').all().map((row) => ({
        id: row.id, quoteId: row.quote_id, createdAt: row.created_at, read: Boolean(row.is_read),
        ...renderAlert(JSON.parse(row.quote_value), JSON.parse(row.details), settings.locale),
      })),
      sources: [...SOURCES.map((source) => ({ ...source })), ...(trip?.resortUrl
        ? [{ id: 'resort', label: 'Resort', url: trip.resortUrl, description: 'Open your selected resort website.' }] : [])],
      storagePath: this.storagePath,
    };
  }
  saveTrip(input) {
    const trip = validateTrip(input);
    this.transaction(() => {
      const previous = this.config('trip', null);
      if (previous && previous.currency !== trip.currency) {
        this.putConfig('settings', { ...this.config('settings', { ...DEFAULT_SETTINGS }), targetMinor: 0 });
      }
      this.putRevision({ revision: tripRevision(trip), trip });
      this.putConfig('trip', trip);
    });
    return this.load();
  }
  setSettings(input) {
    const settings = validateSettings(input);
    this.transaction(() => this.putConfig('settings', settings));
    return this.load();
  }
  insertQuote(quote, revision) {
    const fingerprint = quoteFingerprint(quote, revision);
    const result = this.db.prepare('INSERT OR IGNORE INTO quotes(revision, fingerprint, observed_at, total_minor, value) VALUES (?, ?, ?, ?, ?)')
      .run(revision, fingerprint, quote.observedAt, quote.totalMinor, JSON.stringify(quote));
    return { id: Number(result.lastInsertRowid), inserted: result.changes !== 0, fingerprint };
  }
  saveQuote(input) {
    const now = this.now();
    const quote = validateQuote(input, now);
    this.transaction(() => {
      const trip = this.config('trip', null);
      assertCompatible(quote, trip);
      const revision = tripRevision(trip);
      const fingerprint = quoteFingerprint(quote, revision);
      const previousRow = this.db.prepare('SELECT * FROM quotes WHERE fingerprint = ? ORDER BY observed_at DESC, id DESC LIMIT 1').get(fingerprint);
      const previous = previousRow ? JSON.parse(previousRow.value) : null;
      const saved = this.insertQuote(quote, revision);
      if (!saved.inserted || !quote.feesIncluded || now - Date.parse(quote.observedAt) > 24 * 60 * 60_000 ||
          (previous && (previous.observedAt > quote.observedAt || previous.totalMinor === quote.totalMinor))) return;
      const baseline = previous?.feesIncluded && now - Date.parse(previous.observedAt) <= 24 * 60 * 60_000 ? previous : null;
      // A stale observation cannot rearm a target or supply a drop baseline.
      if (previous && !baseline) return;
      const settings = this.config('settings', { ...DEFAULT_SETTINGS });
      const reasons = [];
      if (settings.targetMinor > 0 && quote.totalMinor <= settings.targetMinor && (!baseline || baseline.totalMinor > settings.targetMinor)) reasons.push('Target reached');
      if (baseline && baseline.totalMinor > quote.totalMinor &&
          BigInt(baseline.totalMinor - quote.totalMinor) * 100n >= BigInt(baseline.totalMinor) * BigInt(settings.dropPercent)) reasons.push(`Price dropped at least ${settings.dropPercent}%`);
      if (!reasons.length) return;
      const body = `${quote.product}: ${amount(quote.totalMinor, quote.currency)}${baseline ? `; previous ${amount(baseline.totalMinor, quote.currency)}` : ''}. ${reasons.join('; ')}.`;
      const details = { targetReached: reasons.includes('Target reached'),
        dropPercent: reasons.some((reason) => reason.startsWith('Price dropped')) ? settings.dropPercent : null,
        previousMinor: baseline?.totalMinor ?? null };
      this.db.prepare('INSERT INTO alerts(quote_id, created_at, title, body, details) VALUES (?, ?, ?, ?, ?)')
        .run(saved.id, new Date(now).toISOString(), 'Trip price alert', body, JSON.stringify(details));
    });
    return this.load();
  }
  markAlert(id) {
    integer(id, 'Alert ID', 1);
    if (!this.db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(id).changes) fail('Alert not found.');
    return this.load();
  }
  openSource(id) {
    if (typeof id !== 'string' || id.length > 40) fail('Invalid source ID.');
    const source = id === 'resort' ? { url: this.config('trip', null)?.resortUrl } : SOURCES.find((item) => item.id === id);
    if (!source?.url) fail('Source is not in the approved registry.');
    return { url: id === 'resort' ? validateResortUrl(source.url) : source.url, prefilled: false };
  }
  copySearch() {
    const trip = this.config('trip', null);
    if (!trip) fail('Configure a trip before copying a search.');
    return [
      `Trip: ${trip.name}`, `Destination: ${trip.destination}`, `Route: ${trip.origin} → ${trip.arrival}`,
      `Departure: ${trip.departureDate}`, `Return: ${trip.returnDate}`, `Adults: ${trip.adults}`,
      `Child ages: ${trip.childAges.length ? trip.childAges.join(', ') : 'None'}`, `Rooms: ${trip.rooms}`,
      `Currency: ${trip.currency}`, `Budget: ${amount(trip.budgetMinor, trip.currency)}`,
      `Resort: ${trip.resortUrl || 'Not specified'}`, `Notes: ${trip.notes || 'None'}`,
      'Check: total for all travelers and rooms, taxes and fees, baggage, cancellation, availability and observation time.',
    ].join('\n');
  }
  exportData() {
    const { trip, settings, quotes, alerts } = this.load();
    const contexts = new Map(this.db.prepare('SELECT value FROM revisions').all().map((row) => {
      const context = JSON.parse(row.value);
      return [context.revision, context];
    }));
    const revisions = new Map();
    if (trip) revisions.set(tripRevision(trip), { revision: tripRevision(trip), trip });
    const exportedQuotes = quotes.map((quote) => {
      const stored = contexts.get(quote.revision);
      const context = stored && (!stored.trip || tripRevision(stored.trip) === quote.revision) ? stored : {
        revision: archiveRevision(quote.revision), trip: null, legacyRevision: quote.revision,
      };
      revisions.set(context.revision, context);
      return { ...quote, revision: context.revision, fingerprint: quoteFingerprint(quote, context.revision) };
    });
    return { schemaVersion: 1, trip, settings, quotes: exportedQuotes, alerts, revisions: [...revisions.values()] };
  }
  importData(raw) {
    if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_IMPORT_BYTES) fail('Import must be JSON no larger than 5 MB.');
    let data;
    try { data = JSON.parse(raw); } catch { fail('Import file is not valid JSON.'); }
    objectShape(data, ['schemaVersion', 'trip', 'settings', 'quotes', 'alerts'], ['revisions']);
    if (data.schemaVersion !== 1) fail('Import schema version must be 1.');
    const trip = data.trip === null ? null : validateTrip(data.trip);
    const settings = validateSettings(data.settings);
    if (!Array.isArray(data.quotes) || !Array.isArray(data.alerts) || data.quotes.length > 10_000 || data.alerts.length > 10_000) fail('Import history is too large or malformed.');
    const quotes = data.quotes.map((input) => ({
      quote: validateQuote(input, this.now(), true), oldRevision: input.revision, originalId: input.id,
    })).sort((a, b) => a.originalId - b.originalId);
    if (new Set(quotes.map((item) => item.originalId)).size !== quotes.length) fail('Imported quote IDs must be unique.');
    if (quotes.length && !trip) fail('Imported quotes require a configured trip.');
    const contexts = new Map();
    if (Object.hasOwn(data, 'revisions')) {
      if (!Array.isArray(data.revisions) || data.revisions.length > 10_001) fail('Imported revision contexts are malformed.');
      for (const input of data.revisions) {
        objectShape(input, ['revision', 'trip'], ['legacyRevision']);
        if (typeof input.revision !== 'string' || !/^[a-f0-9]{64}$/u.test(input.revision) || contexts.has(input.revision)) fail('Invalid or duplicate revision context.');
        let context;
        if (input.trip === null) {
          if (typeof input.legacyRevision !== 'string' || !/^[a-f0-9]{64}$/u.test(input.legacyRevision) ||
              input.revision !== archiveRevision(input.legacyRevision) || input.revision === tripRevision(trip)) fail('Invalid isolated archival revision.');
          context = { revision: input.revision, trip: null, legacyRevision: input.legacyRevision };
        } else {
          const snapshot = validateTrip(input.trip);
          if (Object.hasOwn(input, 'legacyRevision')) fail('Revision snapshot does not match its comparison hash.');
          if (tripRevision(snapshot) === input.revision) {
            context = { revision: tripRevision(snapshot), trip: snapshot };
          } else if (legacyTripRevision(snapshot) === input.revision) {
            // Old hashes omitted property identity; their snapshot cannot prove which property each quote used.
            context = { revision: archiveRevision(input.revision), trip: null, legacyRevision: input.revision };
            for (const { quote, oldRevision } of quotes) {
              if (oldRevision === input.revision) assertCompatible(quote, snapshot);
            }
          } else fail('Revision snapshot does not match its comparison hash.');
        }
        contexts.set(input.revision, context);
      }
    } else {
      // Legacy v1 has no route snapshots: retain unknown contexts in an isolated archive.
      for (const { oldRevision } of quotes) contexts.set(oldRevision, oldRevision === tripRevision(trip)
        ? { revision: tripRevision(trip), trip }
        : { revision: archiveRevision(oldRevision), trip: null, legacyRevision: oldRevision });
    }
    for (const item of quotes) {
      const context = contexts.get(item.oldRevision);
      if (!context) fail('Every imported observation requires a revision context.');
      if (context.trip) assertCompatible(item.quote, context.trip);
      item.context = context;
    }
    for (const alert of data.alerts) {
      objectShape(alert, ['id', 'quoteId', 'createdAt', 'read', 'title', 'body']);
      integer(alert.id, 'Alert ID', 1); integer(alert.quoteId, 'Quote ID', 1);
      boolean(alert.read, 'Alert read'); text(alert.title, 'Alert title', 500); text(alert.body, 'Alert body', 4000);
      if (typeof alert.createdAt !== 'string' || alert.createdAt.length > 40 || !Number.isFinite(Date.parse(alert.createdAt))) fail('Invalid imported alert timestamp.');
    }
    this.transaction(() => {
      const existing = this.config('trip', null);
      if (existing && tripRevision(existing) !== tripRevision(trip)) fail('Imported trip is incompatible with the current trip. Use an empty profile for a different trip.');
      if (trip) this.putRevision({ revision: tripRevision(trip), trip });
      if (!existing) { this.putConfig('trip', trip); this.putConfig('settings', settings); }
      for (const { quote, context } of quotes) {
        this.putRevision(context);
        // Deduplicate a canonical archival export merged back into its legacy source DB.
        const legacyDuplicate = context.legacyRevision && this.db.prepare('SELECT id FROM quotes WHERE fingerprint = ? AND observed_at = ? AND total_minor = ?')
          .get(quoteFingerprint(quote, context.legacyRevision), quote.observedAt, quote.totalMinor);
        const archivedDuplicate = context.trip && this.db.prepare('SELECT id FROM quotes WHERE fingerprint = ? AND observed_at = ? AND total_minor = ?')
          .get(quoteFingerprint(quote, archiveRevision(context.revision)), quote.observedAt, quote.totalMinor);
        if (!legacyDuplicate && !archivedDuplicate) this.insertQuote(quote, context.revision);
      }
    });
    return this.load();
  }
}
