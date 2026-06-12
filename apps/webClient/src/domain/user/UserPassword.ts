export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 20;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,20}$/; // 1 uppercase, 1 number, 1 special character

export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH && PASSWORD_REGEX.test(password);
}

export function UserPasswordNotValidError(): Error {
  return new Error(
    `🔑 Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters and must have 1 uppercase, 1 number, and 1 special character`,
  );
}

export function UserPasswordNotMatchError(): Error {
  return new Error('🛑 Passwords do not match');
}