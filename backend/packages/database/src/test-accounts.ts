export const TEST_ACCOUNT_PHONE_NUMBERS = Object.freeze(
  Array.from({ length: 10 }, (_, digit) => {
    const repeated = String(digit).repeat(10);
    return `+7${repeated}`;
  }),
);

const TEST_ACCOUNT_PHONE_SET = new Set<string>(TEST_ACCOUNT_PHONE_NUMBERS);

export function isSeededTestAccountPhoneNumber(phoneNumber: string): boolean {
  return TEST_ACCOUNT_PHONE_SET.has(phoneNumber);
}

export function buildSeededTestAccountIds(): string[] {
  return TEST_ACCOUNT_PHONE_NUMBERS.map((phoneNumber) => {
    const suffix = phoneNumber.slice(2);
    return `test-user-${suffix}`;
  });
}
