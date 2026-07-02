import { User, UserRepository } from "@domain/index";
import { UserSettings } from "@domain/user/userSettings";
import api from "@infrastructure/api.config";

export const userRepository: UserRepository = {
  async getById(id: number) {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  async getByEmail(email: string) {
    const response = await api.get(`/users/email/${email}`);
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get("/user/profile");
    return response.data;
  },

  async createUser(user: Omit<User, "id">) {
    const response = await api.post("/auth/signup", user);
    return response.data;
  },

  async updateUser(id: number, user: Partial<User>) {
    const response = await api.put(`/user/${id}`, user);
    return response.data;
  },

  async deleteUser(id: number) {
    await api.delete(`/user/${id}`);
  },

  async getUserSettings() {
    const response = await api.get("/user-settings");
    return response.data;
  },
  async updateUserSettings(settings: UserSettings) {
    const response = await api.patch(`/user-settings`, settings);
    return response.data;
  },
};
