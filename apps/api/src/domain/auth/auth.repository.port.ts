import { PasswordResetToken } from './password-reset.entity';

export interface AuthRepositoryPort {
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  register(email: string, password: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  refreshToken(id: number, refreshToken: string): Promise<void>;
  googleLogin(): Promise<void>;
  googleAuthRedirect(code: string): Promise<void>;
  saveToken(email: string, token: string): Promise<PasswordResetToken>;
  findToken(token: string): Promise<PasswordResetToken | null>;
  deleteToken(id: string): Promise<void>;
}
