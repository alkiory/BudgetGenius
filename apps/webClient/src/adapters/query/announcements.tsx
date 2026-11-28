import { HttpAnnouncementRepository } from "@adapters/http/announcement.repository";
import { shouldRetryQuery } from "@infrastructure/queryClient";
import { useQuery } from "@tanstack/react-query";

/**
 * Announcements published from the backoffice. Polled on a slow cadence so a
 * timestamp-scheduled announcement appears once its window opens; ordinary
 * edits arrive earlier through the cross-device revision check.
 */
export const useLiveAnnouncements = () =>
  useQuery({
    queryKey: ["announcements"],
    queryFn: HttpAnnouncementRepository.getLive,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: shouldRetryQuery,
  });
