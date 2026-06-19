import { User } from "./user.entity";
import { UserSettings } from "./userSettings";

export interface UserRepository {
  getAll: () => Promise<User[]>;
  getById: (id: number) => Promise<User> | null;
  getByEmail: (email: string) => Promise<User> | null;
  createUser: (user: Omit<User, "id">) => Promise<User>;
  getCurrentUser: () => Promise<User>;
  updateUser: (id: number, user: Partial<User>) => Promise<User> | null;
  deleteUser: (id: number) => Promise<void>;
  getUserSettings: () => Promise<UserSettings>;
  updateUserSettings: (settings: UserSettings) => Promise<UserSettings> | null;
}
