import { User } from "@domain/user/user.entity";
import { Auth } from "./auth.entity";

export interface AuthRepository {
  login: (email: string, password: string) => Promise<Auth>;
  logout: () => Promise<void>;
  signup: (user: Omit<User, "id">) => Promise<User>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (newPassword: string, token: string) => Promise<void>;
  refreshToken: (refreshToken: string) => Promise<Auth>;
  googleLogin: () => Promise<void>;
  googleAuthRedirect: (code: string) => Promise<Auth>;
}
