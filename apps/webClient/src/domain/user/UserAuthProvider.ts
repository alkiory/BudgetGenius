export function isValidProvider(provider: string): boolean {
  return ["google", "email"].includes(provider);
}

export function UserAuthProviderNotValidError(provider: string): Error {
  return new Error(`User auth provider ${provider} is not valid`);
}
