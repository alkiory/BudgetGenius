import { CatalogEntryKind } from "@adapters/http/catalog.repository";
import { RoutePaths } from "./routes";

/** Full path of the page that renders a catalogue entry. */
export const catalogHref = (key: string) =>
  `${RoutePaths.App}/${RoutePaths.Catalog}/${key}`;

/**
 * Modules group pages, and pages are screens: both deserve a sidebar entry.
 * Components, integrations and tabs are reached from their parent.
 */
export const isNavigableEntry = (kind: CatalogEntryKind) =>
  kind === "module" || kind === "page";
