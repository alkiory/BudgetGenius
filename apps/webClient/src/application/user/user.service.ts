import { userRepository } from "@adapters/http/user.repository";
import { User } from "@domain/index";
import { ensureUserIsValid } from "@domain/user/user.entity";
import { UserSettings } from "@domain/user/userSettings";

export const createUser = async (user: Omit<User, "id">): Promise<User> => {
  ensureUserIsValid(user); // pre validation of user entity
  return userRepository.createUser(user);
};

export const getUserById = async (id: number): Promise<User | null> => {
  return await userRepository.getById(id);
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  return await userRepository.getByEmail(email);
};

export const getAllUsers = async (): Promise<User[]> => {
  return await userRepository.getAll();
};

export const updateUser = async ({
  id,
  user,
}: {
  id: number;
  user: Partial<User>;
}): Promise<User | null> => {
  return await userRepository.updateUser(id, user);
};
export const deleteUser = async (id: number): Promise<void> => {
  return await userRepository.deleteUser(id);
};

export const getUserSettings = async (): Promise<UserSettings | null> => {
  return await userRepository.getUserSettings();
};
export const updateUserSettings = async (
  settings: Partial<UserSettings>,
): Promise<UserSettings | null> => {
  return await userRepository.updateUserSettings({
    ...settings,
  } as UserSettings);
};
