import { ApiError } from '../../utils/api-error.js';

type ParsedDecimal = { value: bigint; scale: number };

export function assertPositiveDecimal(value: string, field: string): void {
  if (compareDecimals(value, '0') <= 0) throw new ApiError(400, `${field} sıfırdan büyük olmalıdır.`, 'INVALID_DECIMAL');
}

export function compareDecimals(left: string, right: string): number {
  const [a, b] = align(parseDecimal(left), parseDecimal(right));
  return a < b ? -1 : a > b ? 1 : 0;
}

export function multiplyDecimals(left: string, right: string, maximumScale = 18): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  let value = a.value * b.value;
  let scale = a.scale + b.scale;
  if (scale > maximumScale) {
    value /= 10n ** BigInt(scale - maximumScale);
    scale = maximumScale;
  }
  return formatDecimal({ value, scale });
}

export function isStepAligned(value: string, step: string): boolean {
  const [a, b] = align(parseDecimal(value), parseDecimal(step));
  return b !== 0n && a % b === 0n;
}

export function normalizeDecimal(value: string): string {
  return formatDecimal(parseDecimal(value));
}

function parseDecimal(input: string): ParsedDecimal {
  const normalized = input.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) throw new ApiError(400, 'Geçersiz ondalık değer.', 'INVALID_DECIMAL');
  const negative = normalized.startsWith('-');
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  return { value: BigInt(`${negative ? '-' : ''}${whole}${fraction}`), scale: fraction.length };
}

function align(left: ParsedDecimal, right: ParsedDecimal): [bigint, bigint] {
  const scale = Math.max(left.scale, right.scale);
  return [left.value * 10n ** BigInt(scale - left.scale), right.value * 10n ** BigInt(scale - right.scale)];
}

function formatDecimal(decimal: ParsedDecimal): string {
  const negative = decimal.value < 0n;
  const digits = (negative ? -decimal.value : decimal.value).toString().padStart(decimal.scale + 1, '0');
  if (decimal.scale === 0) return `${negative ? '-' : ''}${digits}`;
  const value = `${digits.slice(0, -decimal.scale)}.${digits.slice(-decimal.scale)}`.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  return `${negative ? '-' : ''}${value}`;
}
