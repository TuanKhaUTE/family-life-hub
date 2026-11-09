export const MAX_VND_AMOUNT = 1000000000n
export const MONEY_INPUT_ERROR = 'Số tiền phải từ 1 đến 1.000.000.000 đ.'

export function sanitizeMoneyInput(value: string) {
  return value.replace(/[^0-9]/g, '')
}

export function normalizeMoneyInput(value: string) {
  const digits = sanitizeMoneyInput(value)
  return digits.replace(/^0+(?=\d)/, '')
}

export function isValidMoneyInput(value: string) {
  const normalized = normalizeMoneyInput(value)
  return normalized !== '' && normalized !== '0' && BigInt(normalized) <= MAX_VND_AMOUNT
}
