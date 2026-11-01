import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { amount, formatMoney, minor } from './money';
import { messages, type MessageKey } from './strings';
import type { Kind, Locale, Quote, QuoteInput, State, Trip } from './types';

type Page = 'overview' | 'update' | 'trip' | 'alerts';
const pages: Page[] = ['overview', 'update', 'trip', 'alerts'];

function localNow(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function Field({ label, id, help, children }: { label: string; id: string; help?: string; children: ReactNode }) {
  return <div className="field"><label htmlFor={id}>{label}</label>{children}{help && <p id={`${id}-help`} className="help">{help}</p>}</div>;
}

function latestEligible(quotes: Quote[], kind: Kind, now: number): Quote | undefined {
  const products = new Map<string, Quote>();
  for (const quote of [...quotes].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || b.id - a.id)) {
    if (quote.kind === kind && !products.has(quote.fingerprint)) products.set(quote.fingerprint, quote);
  }
  return [...products.values()].filter(q => q.feesIncluded && now - Date.parse(q.observedAt) <= 86_400_000)
    .sort((a, b) => a.totalMinor - b.totalMinor)[0];
}

export function App() {
  const [state, setState] = useState<State | null>(null);
  const [page, setPage] = useState<Page>('overview');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [allHistory, setAllHistory] = useState(false);
  const [now, setNow] = useState(Date.now);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const locale = state?.settings.locale ?? 'en';
  const t = (key: MessageKey) => messages[locale][key];
  const money = (value: number, currency = state?.trip?.currency ?? 'MXN') => formatMoney(value, currency, locale);
  const api = () => {
    if (!window.tripPlanner) throw new Error(t('desktopRequired'));
    return window.tripPlanner;
  };

  async function perform(work: () => Promise<void>) {
    setBusy(true); setError(''); setStatus('');
    try { await work(); } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { setBusy(false); }
  }

  function navigate(next: Page) {
    setPage(next); setStatus(''); setError('');
    requestAnimationFrame(() => heading.current?.focus());
  }

  useEffect(() => { void perform(async () => setState(await api().load())); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${messages[locale][page]} - Trip Planner`;
  }, [locale, page]);

  const current = state?.quotes.filter(q => q.revision === state.revision) ?? [];
  const shown = allHistory ? state?.quotes ?? [] : current;
  const flight = latestEligible(current, 'flight', now);
  const hotel = latestEligible(current, 'hotel', now);
  const combined = flight && hotel ? flight.totalMinor + hotel.totalMinor : null;
  const freshCombined = combined !== null && Number.isSafeInteger(combined) ? combined : null;
  const unread = state?.alerts.filter(a => !a.read).length ?? 0;
  const trip = state?.trip;

  async function submitTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await perform(async () => {
      const text = (key: string) => String(data.get(key) ?? '').trim();
      const ages = text('childAges') ? text('childAges').split(',').map(age => {
        if (!/^\d{1,2}$/.test(age.trim())) throw new Error(t('childrenHelp'));
        return Number(age.trim());
      }) : [];
      const currency = text('currency');
      const input: Trip = {
        name: text('name'), destination: text('destination'), origin: text('origin').toUpperCase(), arrival: text('arrival').toUpperCase(),
        departureDate: text('departureDate'), returnDate: text('returnDate'), adults: Number(text('adults')),
        childAges: ages, rooms: Number(text('rooms')), currency, budgetMinor: minor(text('budget'), currency),
        resortUrl: text('resortUrl'), notes: text('notes'),
      };
      setState(await api().saveTrip(input)); setStatus(t('tripSaved'));
    });
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await perform(async () => {
      if (!trip) throw new Error(t('noTrip'));
      const text = (key: string) => String(data.get(key) ?? '').trim();
      const quote: QuoteInput = {
        kind: text('kind') as Kind, source: text('source'), product: text('product'),
        startDate: trip.departureDate, endDate: trip.returnDate, adults: trip.adults,
        childAges: trip.childAges, rooms: trip.rooms, currency: trip.currency,
        totalMinor: minor(text('total'), trip.currency), feesIncluded: data.get('fees') === 'on',
        baggage: text('baggage'), cancellation: text('cancellation'), notes: text('notes'),
        observedAt: new Date(text('observedAt')).toISOString(), confirmed: data.get('confirmed') === 'on',
      };
      setState(await api().saveQuote(quote)); setStatus(t('quoteSaved'));
      form.reset();
      const observed = form.elements.namedItem('observedAt');
      if (observed instanceof HTMLInputElement) observed.value = localNow();
    });
  }

  async function submitRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await perform(async () => {
      if (!state) return;
      setState(await api().setSettings({
        ...state.settings, targetMinor: minor(String(data.get('target') || '0'), trip?.currency ?? 'MXN', true),
        dropPercent: Number(data.get('drop')), notifications: data.get('notifications') === 'on',
      }));
      setStatus(t('rulesSaved'));
    });
  }

  return <div className="app">
    <a className="skip" href="#main">{t('skip')}</a>
    <header className="masthead">
      <div className="brand"><span aria-hidden="true" className="brand-mark">↗</span><strong>Trip Planner</strong></div>
      <div className="utility">
        <span className="local-label">{t('local')}</span>
        <label htmlFor="locale" className="sr-only">{t('language')}</label>
        <select id="locale" value={locale} disabled={busy || !state} onChange={e => {
          const next = e.target.value as Locale;
          void perform(async () => { if (state) setState(await api().setSettings({ ...state.settings, locale: next })); });
        }}><option value="en">English</option><option value="es">Español</option></select>
      </div>
    </header>
    <nav className="navigation" aria-label="Trip Planner">
      {pages.map(p => <button key={p} aria-current={page === p ? 'page' : undefined} disabled={busy} onClick={() => navigate(p)}>
        {t(p)}{p === 'alerts' && unread > 0 && <span className="count"> {unread}</span>}
      </button>)}
    </nav>
    <main id="main" tabIndex={-1} aria-busy={busy}>
      <div className="page-heading"><div><h1 ref={heading} tabIndex={-1}>{t(page)}</h1>
        {trip && <p className="trip-line">{trip.name} · {trip.origin} → {trip.arrival} · {trip.departureDate} / {trip.returnDate}</p>}</div>
        {trip && page === 'overview' && <button className="primary" disabled={busy} onClick={() => navigate('update')}>{t('update')} <span aria-hidden="true">↗</span></button>}
      </div>
      <div className="status" role="status" aria-live="polite">{busy ? t('loading') : status}</div>
      <div ref={errorRef} className={error ? 'error' : 'sr-only'} tabIndex={-1} role="alert">{error}</div>
      {!state && <section className="empty"><p>{error || t('loading')}</p><button disabled={busy} onClick={() => void perform(async () => setState(await api().load()))}>{t('retry')}</button></section>}
      {state && page === 'overview' && <>
        {!trip ? <section className="welcome"><div className="welcome-copy"><h2>{t('emptyTitle')}</h2><p>{t('emptyBody')}</p><button className="primary" onClick={() => navigate('trip')}>{t('create')} <span aria-hidden="true">→</span></button></div><div className="welcome-map" aria-hidden="true"><span>·</span><div></div><span>×</span></div></section> : <>
          <p className="intro">{t('intro')}</p>
          <section className="cost-ledger" aria-label={t('combined')}>
            <div className="cost-row"><h2>{t('flight')}</h2><div><strong>{flight ? money(flight.totalMinor) : '-'}</strong><p>{flight?.product ?? t('noQuote')}</p></div></div>
            <div className="cost-row"><h2>{t('hotel')}</h2><div><strong>{hotel ? money(hotel.totalMinor) : '-'}</strong><p>{hotel?.product ?? t('noQuote')}</p></div></div>
            <div className="cost-row combined"><h2>{t('combined')}</h2><div><strong>{freshCombined === null ? '-' : money(freshCombined)}</strong><p>{freshCombined === null ? t('missing') : t('combinedNote')}</p></div></div>
            <div className="budget-row"><span>{t('budget')}: <strong>{money(trip.budgetMinor)}</strong></span><span>{freshCombined === null ? '-' : `${t(freshCombined > trip.budgetMinor ? 'overBudget' : 'remaining')}: ${money(Math.abs(trip.budgetMinor - freshCombined))}`}</span></div>
          </section>
          <p className="help">{t('latestOnly')}</p>
          <section className="history">
            <div className="section-heading"><h2>{t('historical')}</h2><label className="check"><input type="checkbox" checked={allHistory} onChange={e => setAllHistory(e.target.checked)} />{t('allHistory')}</label></div>
            {shown.length === 0 ? <p className="empty-note">{t('historyEmpty')}</p> : <div className="table-scroll" tabIndex={0} role="region" aria-label={t('historical')}>
              <table><caption>{t(allHistory ? 'historyAllCaption' : 'historyCaption')} · {shown.length} {t('savedCount')}</caption><thead><tr>
                <th scope="col">{t('product')}</th><th scope="col">{t('source')}</th><th scope="col">{t('total')}</th><th scope="col">{t('observed')}</th><th scope="col">{t('coverage')}</th>
              </tr></thead><tbody>{[...shown].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || b.id - a.id).map(q => <tr key={q.id}>
                <th scope="row"><span className="type-label">{t(q.kind)}</span>{q.product}<small>{q.startDate} / {q.endDate} · {q.adults} {t('adults')} · {t('children')}: {q.childAges.join(', ') || t('noChildren')} · {q.rooms} {t('rooms')}</small><small>{q.baggage} · {q.cancellation}</small>{q.notes && <small>{q.notes}</small>}</th>
                <td>{q.source}</td><td className="money">{money(q.totalMinor, q.currency)}</td><td>{new Date(q.observedAt).toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')}</td>
                <td>{q.revision !== state.revision && <span className="tag">{t('old')}</span>}<span className="tag">{t(q.feesIncluded ? 'complete' : 'incomplete')}</span><small>{t(now - Date.parse(q.observedAt) > 86_400_000 ? 'stale' : 'fresh')}</small></td>
              </tr>)}</tbody></table>
            </div>}
          </section>
        </>}
        <section className="explanation"><h2>{t('evidence')}</h2><p>{t('evidenceText')}</p><p>{t('alertIntro')}</p></section>
      </>}
      {state && page === 'trip' && <>
        <p className="intro">{t('tripIntro')}</p>
        <form key={trip ? JSON.stringify(trip) : 'new-trip'} className="editor" onSubmit={submitTrip}>
          <fieldset disabled={busy}><legend>{t('trip')}</legend><div className="form-grid">
            <Field id="name" label={t('name')}><input id="name" name="name" required maxLength={100} defaultValue={trip?.name ?? ''} /></Field>
            <Field id="destination" label={t('destination')}><input id="destination" name="destination" required maxLength={100} defaultValue={trip?.destination ?? ''} /></Field>
            <Field id="origin" label={t('origin')}><input id="origin" name="origin" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={trip?.origin ?? ''} /></Field>
            <Field id="arrival" label={t('arrival')}><input id="arrival" name="arrival" required pattern="[A-Za-z]{3}" maxLength={3} defaultValue={trip?.arrival ?? ''} /></Field>
            <Field id="departureDate" label={t('departure')}><input id="departureDate" name="departureDate" type="date" required defaultValue={trip?.departureDate ?? ''} /></Field>
            <Field id="returnDate" label={t('returnDate')}><input id="returnDate" name="returnDate" type="date" required defaultValue={trip?.returnDate ?? ''} /></Field>
            <Field id="adults" label={t('adults')}><input id="adults" name="adults" type="number" min={1} max={9} required defaultValue={trip?.adults ?? 2} /></Field>
            <Field id="childAges" label={t('children')} help={t('childrenHelp')}><input id="childAges" name="childAges" aria-describedby="childAges-help" maxLength={100} defaultValue={trip?.childAges.join(', ') ?? ''} /></Field>
            <Field id="rooms" label={t('rooms')}><input id="rooms" name="rooms" type="number" min={1} max={9} required defaultValue={trip?.rooms ?? 1} /></Field>
            <Field id="currency" label={t('currency')} help={t('currencyHelp')}><select id="currency" name="currency" aria-describedby="currency-help" defaultValue={trip?.currency ?? 'MXN'}>{['MXN', 'USD', 'CAD', 'EUR', 'GBP', 'JPY'].map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field id="budget" label={t('budget')} help={t('totalHelp')}><input id="budget" name="budget" inputMode="decimal" required aria-describedby="budget-help" defaultValue={trip ? amount(trip.budgetMinor, trip.currency) : ''} /></Field>
            <Field id="resortUrl" label={t('resortUrl')} help={t('urlHelp')}><input id="resortUrl" name="resortUrl" type="url" maxLength={2000} aria-describedby="resortUrl-help" defaultValue={trip?.resortUrl ?? ''} /></Field>
          </div><Field id="tripNotes" label={t('notes')}><textarea id="tripNotes" name="notes" maxLength={2000} rows={3} defaultValue={trip?.notes ?? ''} /></Field><button className="primary" type="submit">{t('saveTrip')}</button></fieldset>
        </form>
        <section className="explanation"><h2>{t('privacy')}</h2><p className="help">{t('exportWarning')}</p><div className="actions">
          <button disabled={busy} onClick={() => void perform(async () => { const result = await api().exportData(); setStatus(t(result.cancelled ? 'cancelled' : 'exported')); })}>{t('export')}</button>
          <button disabled={busy} onClick={() => void perform(async () => { const result = await api().importData(); if (result) setState(result); setStatus(t(result ? 'imported' : 'cancelled')); })}>{t('import')}</button>
        </div><p className="help">{t('path')}: <code>{state.storagePath}</code></p></section>
      </>}
      {state && page === 'update' && (!trip ? <section className="empty"><p>{t('noTrip')}</p><button className="primary" onClick={() => navigate('trip')}>{t('create')}</button></section> : <>
        <p className="intro">{t('updateIntro')}</p>
        <div className="update-layout"><section className="sources"><h2>{t('sourceHeading')}</h2><p className="help">{t('notPrefilled')}</p>
          <button disabled={busy} onClick={() => void perform(async () => { await api().copySearch(); setStatus(t('copied')); })}>{t('copy')}</button>
          <ul className="source-list">{state.sources.map(source => <li key={source.id}>
            <button disabled={busy} onClick={() => void perform(async () => { await api().openSource(source.id); setStatus(t('opened')); })}>{source.label} <span aria-hidden="true">↗</span><span className="sr-only"> ({locale === 'es' ? 'navegador externo' : 'external browser'})</span></button>
            <p>{t(source.id === 'google-flights' ? 'sourceFlightHelp' : source.id === 'google-hotels' ? 'sourceHotelHelp' : source.id === 'resort' ? 'sourceResortHelp' : 'sourceDirectHelp')}</p>
          </li>)}</ul><p className="help">{t('browserPrivacy')}</p><p className="notice">{t('unsupported')}</p>
        </section><section><h2>{t('record')}</h2><div className="search-context"><strong>{trip.origin} → {trip.arrival}</strong><p>{trip.departureDate} / {trip.returnDate} · {trip.adults} {t('adults')} · {t('children')}: {trip.childAges.join(', ') || t('noChildren')} · {trip.rooms} {t('rooms')} · {trip.currency}</p></div>
          <form className="quote-form" onSubmit={submitQuote}><fieldset disabled={busy}><legend className="sr-only">{t('record')}</legend>
            <div className="form-grid"><Field id="kind" label={t('kind')}><select id="kind" name="kind"><option value="flight">{t('flight')}</option><option value="hotel">{t('hotel')}</option></select></Field>
              <Field id="quoteSource" label={t('source')}><select id="quoteSource" name="source">{state.sources.map(s => <option key={s.id} value={s.label}>{s.label}</option>)}</select></Field></div>
            <Field id="product" label={t('product')} help={t('productHelp')}><input id="product" name="product" required maxLength={200} aria-describedby="product-help" /></Field>
            <Field id="total" label={`${t('total')} (${trip.currency})`} help={t('totalHelp')}><input id="total" name="total" inputMode="decimal" required aria-describedby="total-help" /></Field>
            <Field id="baggage" label={t('baggage')}><input id="baggage" name="baggage" required maxLength={200} /></Field>
            <Field id="cancellation" label={t('cancellation')}><input id="cancellation" name="cancellation" required maxLength={200} /></Field>
            <Field id="observedAt" label={t('observedTime')} help={t('observedHelp')}><input id="observedAt" name="observedAt" type="datetime-local" required defaultValue={localNow()} aria-describedby="observedAt-help" /></Field>
            <Field id="quoteNotes" label={t('notes')}><textarea id="quoteNotes" name="notes" rows={2} maxLength={2000} /></Field>
            <label className="check"><input name="fees" type="checkbox" />{t('fees')}</label>
            <label className="check"><input name="confirmed" type="checkbox" required />{t('confirm')}</label>
            <button className="primary" type="submit">{t('saveQuote')}</button>
          </fieldset></form>
        </section></div>
      </>)}
      {state && page === 'alerts' && <>
        <p className="intro">{t('alertIntro')}</p>
        <div className="alert-layout"><section><h2>{t('rules')}</h2><form className="editor" key={`${state.settings.targetMinor}-${state.settings.dropPercent}-${state.settings.notifications}`} onSubmit={submitRules}><fieldset disabled={busy}><legend className="sr-only">{t('rules')}</legend>
          <Field id="target" label={`${t('target')} (${trip?.currency ?? 'MXN'})`} help={t('targetHelp')}><input id="target" name="target" inputMode="decimal" required defaultValue={amount(state.settings.targetMinor, trip?.currency ?? 'MXN')} aria-describedby="target-help" /></Field>
          <Field id="drop" label={t('drop')}><input id="drop" name="drop" type="number" required min={1} max={100} step="0.1" defaultValue={state.settings.dropPercent} /></Field>
          <label className="check"><input name="notifications" type="checkbox" defaultChecked={state.settings.notifications} />{t('notifications')}</label><button className="primary" type="submit">{t('saveRules')}</button>
        </fieldset></form><button disabled={busy} onClick={() => void perform(async () => {
          const result = await api().testNotification(); setStatus(result.delivered ? result.message : `${t('noNative')} ${result.message}`);
        })}>{t('testNotification')}</button>{state.notificationStatus && <p className="help">{state.notificationStatus}</p>}</section>
        <section><h2>{t('alerts')} {unread > 0 && <span className="count">{unread}</span>}</h2>{state.alerts.length === 0 ? <p className="empty-note">{t('inboxEmpty')}</p> : <ul className="inbox">{[...state.alerts].reverse().map(alert => <li key={alert.id}>
          <span className="tag">{t(alert.read ? 'readLabel' : 'unread')}</span><h3>{alert.title}</h3><p>{alert.body}</p><small>{new Date(alert.createdAt).toLocaleString(locale === 'es' ? 'es-MX' : 'en-US')}</small>
          {!alert.read && <button disabled={busy} onClick={() => void perform(async () => setState(await api().markAlert(alert.id)))}>{t('read')}</button>}
        </li>)}</ul>}</section></div>
      </>}
    </main>
    <footer><span>Trip Planner · 0.1.0</span><span>{t('local')}</span></footer>
  </div>;
}
