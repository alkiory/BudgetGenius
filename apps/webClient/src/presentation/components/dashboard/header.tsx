
import { useTranslation } from 'react-i18next';
import { Search } from "lucide-react"
import { ThemeToggle } from "../themeToogle"
import { LanguageSwitcher } from "./language-switcher"
import { Link } from "react-router";
import { RoutePaths } from "@presentation/utils/routes";
import { useSelector } from "react-redux";
import { RootState } from "@adapters/store/rootStore";
import { AddTransactionModal } from "./transaction/add-transaction-modal";

export function DashboardHeader() {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <header className="sticky top-0 z-10 flex h-16 flex-shrink-0 border-b bg-white dark:bg-slate-950 dark:border-slate-800">
      <div className="flex flex-1 justify-between px-4">
        <div className="flex flex-1">
          <div className="flex w-full md:ml-0">
            <label htmlFor="search-field" className="sr-only">
              {t('common.search')}
            </label>
            <div className="relative w-full text-slate-400 focus-within:text-slate-600 dark:focus-within:text-slate-300">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-5 w-5" aria-hidden="true" />
              </div>
              <input
                id="search-field"
                className="block h-full w-full border-transparent bg-transparent py-2 pl-10 pr-3 text-slate-900 placeholder-slate-500 focus:border-transparent focus:placeholder-slate-400 focus:outline-none focus:ring-0 sm:text-sm dark:text-white"
                placeholder={t('dashboard.searchPlaceholder')}
                type="search"
                name="search"
              />
            </div>
          </div>
        </div>
        <div className="ml-4 flex items-center md:ml-6">
          <AddTransactionModal isHeader />
          <div className="ml-3">
            <ThemeToggle />
          </div>
          <LanguageSwitcher />
          <div className="relative ml-3">
            <div>
              <button
                type="button"
                className="flex max-w-xs items-center rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:bg-slate-950"
                id="user-menu-button"
              >
                <span className="sr-only">{t('dashboard.openUserMenu')}</span>
                <Link to={RoutePaths.App + "/" + RoutePaths.Profile} className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 dark:bg-purple-900 dark:text-purple-400 font-medium">
                  {(user?.name?.charAt(0)?.toUpperCase() || '') + (user?.surname?.charAt(0)?.toUpperCase() || '')}
                </Link>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}