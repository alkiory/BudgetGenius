export const validateTransactionSelection = (values: number[]): boolean => {
  if (!values || values.length === 0) {
    return false;
  }

  return values.every((value) => Number.isInteger(value) && value > 0);
};
