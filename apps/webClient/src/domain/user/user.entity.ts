import {
  isValidProvider,
  UserAuthProviderNotValidError,
} from "./UserAuthProvider";
import { isValidEmail, UserEmailNotValidError } from "./UserEmail";
import { isValidPassword, UserPasswordNotValidError } from "./UserPassword";

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 20;

export type User = {
  id: number;
  name: string;
  surname?: string;
  username?: string;
  email: string;
  password: string;
  authProvider: "email" | "google";
  role: string;
  refreshToken?: string;
  isPremium: boolean;
  phone?: string;
  address?: string;
  imageUrl?: string;
};

export function ensureUserIsValid({
  name,
  surname,
  username,
  email,
  password,
  authProvider,
  role,
  isPremium,
}: Omit<User, "id">) {
  if (!name) {
    throw new Error("You must provide a name");
  }

  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    throw new Error(
      `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters`,
    );
  }

  if (surname && surname.length > NAME_MAX_LENGTH) {
    throw new Error(`Surname must be less than ${NAME_MAX_LENGTH} characters`);
  }

  if (!isValidEmail(email)) {
    throw UserEmailNotValidError(email);
  }
  if (!isValidPassword(password)) {
    throw UserPasswordNotValidError();
  }
  if (!isValidProvider(authProvider)) {
    throw UserAuthProviderNotValidError(authProvider);
  }
  if (!role) {
    throw new Error("User role is required");
  }

  return {
    name,
    surname,
    username,
    email,
    password,
    authProvider,
    role,
    isPremium,
  };
}
