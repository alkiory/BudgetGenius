import api from "@infrastructure/api.config";

export type AnnouncementLevel = "info" | "success" | "warning" | "critical";

export interface AnnouncementRow {
  id: number;
  title: string;
  body: string;
  level: AnnouncementLevel;
  audience: "all" | "free" | "premium";
  publishedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
}

/** Live announcements for the signed-in user (published + inside its window). */
export const HttpAnnouncementRepository = {
  async getLive(): Promise<AnnouncementRow[]> {
    const { data } = await api.get("/notifications");
    return data;
  },
};
