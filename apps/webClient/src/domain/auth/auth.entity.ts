import { User } from "@domain/user/user.entity";

export type Auth = {
  accessToken: string;
  refreshToken: string;
  user: User;
};
