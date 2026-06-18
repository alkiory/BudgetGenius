import { authRepository } from "@adapters/http/auth.repository";
import { Auth } from "@domain/auth/auth.entity";
import { User } from "@domain/index";
import { isValidEmail, UserEmailNotValidError } from "@domain/user/UserEmail";
import {
  isValidPassword,
  UserPasswordNotMatchError,
  UserPasswordNotValidError,
} from "@domain/user/UserPassword";
import { ensureUserIsValid } from "@domain/user/user.entity";

export const signup = async (user: Omit<User, "id">): Promise<User> => {
  ensureUserIsValid(user);
  return authRepository.signup(user);
};

export const login = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<Auth> => {
  if (!isValidEmail(email)) {
    throw UserEmailNotValidError(email);
  }
  if (!isValidPassword(password)) {
    throw UserPasswordNotValidError();
  }

  return authRepository.login(email, password);
};

export const logout = async () => {
  return authRepository.logout();
};

export const forgotPassword = async (email: string) => {
  if (!isValidEmail(email)) {
    throw UserEmailNotValidError(email);
  }

  return authRepository.forgotPassword(email);
};

export const resetPassword = async ({
  newPassword,
  confirmPassword,
  token,
}: {
  newPassword: string;
  confirmPassword: string;
  token: string;
}) => {
  if (!isValidPassword(newPassword)) {
    throw UserPasswordNotValidError();
  }
  if (!isValidPassword(confirmPassword)) {
    throw UserPasswordNotValidError();
  }

  if (newPassword !== confirmPassword) {
    throw UserPasswordNotMatchError();
  }

  return authRepository.resetPassword(newPassword, token);
};

export const refreshToken = async (refreshToken: string) => {
  return authRepository.refreshToken(refreshToken);
};

export const googleLogin = async () => {
  return authRepository.googleLogin();
};

export const googleAuthRedirect = async (code: string) => {
  return authRepository.googleAuthRedirect(code);
};
