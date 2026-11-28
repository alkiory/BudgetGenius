import { userRepository } from "@adapters/http/user.repository";
import { shouldRetryQuery } from "@infrastructure/queryClient";
import { useQuery } from "@tanstack/react-query";

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ["user"],
    queryFn: userRepository.getCurrentUser,
    retry: shouldRetryQuery,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};

export const useGetSettings = () => {
  return useQuery({
    queryKey: ["user-settings"],
    queryFn: userRepository.getUserSettings,
    retry: shouldRetryQuery,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};
