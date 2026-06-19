export function isValidEmail(email: string): boolean {
  const emailRegex = /^(?=.{4,}@)[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function UserEmailNotValidError(email: string): Error {
  return new Error(`User ${email} is not valid`);
}
