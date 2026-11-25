import { HttpModulesRepository } from "@adapters/http/modules.repository";
import { useQuery } from "@tanstack/react-query";

/** Changes rarely; the cross-device revision still refreshes it after a toggle. */
export const useModules = () =>
  useQuery({
    queryKey: ["modules"],
    queryFn: HttpModulesRepository.getVisible,
    staleTime: 60_000,
    retry: 1,
  });
