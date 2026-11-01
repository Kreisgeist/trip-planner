import { test } from 'node:test';
import assert from 'node:assert/strict';
import { minor, amount, digits, formatMoney } from '../src/money.ts';

test('exact minor units for decimal, comma-decimal, and zero-decimal currencies', () => {
  assert.equal(minor('123.45', 'USD'), 12345);
  assert.equal(minor('123,45', 'MXN'), 12345);
  assert.equal(minor('100', 'JPY'), 100);
  assert.equal(minor('1.234', 'KWD'), 1234);
  assert.equal(amount(12345, 'USD'), '123.45');
  assert.equal(digits('JPY'), 0);
  assert.equal(minor('0', 'USD', true), 0);
});

test('rejects ambiguous separators, fractions, nonpositive amounts, and unsafe arithmetic', () => {
  for (const input of ['-1', '0', '1,000.00', '$100', '1e5', 'abc', '1.234', '90071992547409910']) {
    assert.throws(() => minor(input, 'USD'));
  }
  assert.throws(() => minor('1.1', 'JPY'));
  assert.throws(() => minor('1', 'NOT-A-CURRENCY'));
});

test('English and Spanish formatting preserves currency value', () => {
  assert.match(formatMoney(12345, 'USD', 'en'), /123\.45/);
  assert.match(formatMoney(12345, 'MXN', 'es'), /123\.45/);
});
