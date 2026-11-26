import { HttpCatalogRepository } from "@adapters/http/catalog.repository";
import { useQuery } from "@tanstack/react-query";

/** Shared key so the backoffice can invalidate it after authoring a change. */
export const CATALOG_QUERY_KEY = ["catalog", "entries"] as const;

/**
 * Catalogue of screens the app can render. Polled slowly so an entry
 * activated in the backoffice reaches an already-open tab; authoring surfaces
 * invalidate the key immediately instead of waiting for the poll.
 */
export function useCatalogEntries() {
  return useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: HttpCatalogRepository.getEntries,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
