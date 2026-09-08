export const roundToCurrency = (amount: number): number => {
  return Math.round((Number(amount) || 0) * 100) / 100;
};
