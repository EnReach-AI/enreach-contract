import _ from 'lodash';

export function toHexString(value: bigint) {
  const isNegative = value < 0n;
  const hexString = (isNegative ? -value : value).toString(16).toUpperCase();
  return (isNegative ? "-0x" : "0x") + hexString;
}

export function expandTo18Decimals(n: number) {
  return BigInt(n) * (10n ** 18n);
}

export function numberToPercent(num: number) {
  return new Intl.NumberFormat("default", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(num);
}

export function power(pow: number | bigint) {
  return 10n ** BigInt(pow);
}

export function abs(n: bigint) {
  return n < 0n ? -n : n;
}

export function absNum(n: number) {
  return n < 0 ? -n : n;
}