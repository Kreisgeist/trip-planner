export type Locale = 'en' | 'es';
export type Kind = 'flight' | 'hotel';

export interface Trip {
  name: string;
  destination: string;
  origin: string;
  arrival: string;
  departureDate: string;
  returnDate: string;
  adults: number;
  childAges: number[];
  rooms: number;
  currency: string;
  budgetMinor: number;
  resortUrl: string;
  notes: string;
}

export interface QuoteInput {
  kind: Kind;
  source: string;
  product: string;
  startDate: string;
  endDate: string;
  adults: number;
  childAges: number[];
  rooms: number;
  currency: string;
  totalMinor: number;
  feesIncluded: boolean;
  baggage: string;
  cancellation: string;
  notes: string;
  observedAt: string;
  confirmed: boolean;
}

export interface Quote extends QuoteInput {
  id: number;
  revision: string;
  fingerprint: string;
}

export interface Alert {
  id: number;
  quoteId: number;
  createdAt: string;
  read: boolean;
  title: string;
  body: string;
}

export interface Settings {
  locale: Locale;
  notifications: boolean;
  targetMinor: number;
  dropPercent: number;
}

export interface Source {
  id: string;
  label: string;
  url: string;
  description: string;
}

export interface State {
  trip: Trip | null;
  revision: string | null;
  quotes: Quote[];
  alerts: Alert[];
  settings: Settings;
  sources: Source[];
  storagePath: string;
  notificationStatus?: string;
}

export interface DesktopApi {
  load(): Promise<State>;
  saveTrip(input: Trip): Promise<State>;
  saveQuote(input: QuoteInput): Promise<State>;
  markAlert(id: number): Promise<State>;
  setSettings(input: Settings): Promise<State>;
  openSource(id: string): Promise<{ url: string; prefilled: false }>;
  copySearch(): Promise<void>;
  testNotification(): Promise<{ supported: boolean; delivered: boolean; message: string }>;
  exportData(): Promise<{ cancelled: boolean; path?: string }>;
  importData(): Promise<State | null>;
}

declare global {
  interface Window {
    tripPlanner?: DesktopApi;
  }
}
