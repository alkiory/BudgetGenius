import { RootState } from "@adapters/store/rootStore";
import { useEffect, type ReactNode } from "react";
import { useSelector } from "react-redux";
import { switchLanguage, detectBrowserLocale } from "./i18n";

interface LocaleProviderProps {
  children: ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const locale = useSelector(
    (state: RootState) => state.userSettings.settings.locale,
  );

  useEffect(() => {
    if (locale) {
      switchLanguage(locale);
    } else {
      switchLanguage(detectBrowserLocale());
    }
  }, [locale]);

  return <>{children}</>;
}
