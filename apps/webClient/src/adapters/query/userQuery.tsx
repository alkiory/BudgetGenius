import { userRepository } from "@adapters/http/user.repository";
import { useQuery } from "@tanstack/react-query";

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ["user"],
    queryFn: userRepository.getCurrentUser,
    retry: 3,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};

export const useGetSettings = () => {
  return useQuery({
    queryKey: ["user-settings"],
    queryFn: userRepository.getUserSettings,
    retry: 3,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 5,
  });
};
