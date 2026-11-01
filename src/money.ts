export function digits(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function minor(text: string, currency: string, allowZero = false): number {
  const decimal = text.trim().replace(',', '.');
  const places = digits(currency);
  if (!/^\d+(?:\.\d+)?$/.test(decimal)) throw new Error('Enter an amount without thousands separators / Escribe un importe sin separadores de miles.');
  const [whole, fraction = ''] = decimal.split('.');
  if (fraction.length > places) throw new Error(`Use at most ${places} decimal places / Usa como máximo ${places} decimales.`);
  const value = Number(whole) * 10 ** places + Number(fraction.padEnd(places, '0'));
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) throw new Error('Amount is outside the supported range / El importe está fuera del rango permitido.');
  return value;
}

export function amount(value: number, currency: string): string {
  return (value / 10 ** digits(currency)).toFixed(digits(currency));
}

export function formatMoney(value: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', { style: 'currency', currency }).format(value / 10 ** digits(currency));
}
