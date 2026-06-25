import { RootState } from "@adapters/store/rootStore";
import { RoutePaths } from "@presentation/utils/routes";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router";
import { ThemeToggle } from "../themeToogle";
import { LanguageSwitcher } from "./language-switcher";
import { AddTransactionModal } from "./transaction/add-transaction-modal";

export function DashboardHeader() {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <header className="sticky top-0 z-10 flex min-h-16 pt-[max(env(safe-area-inset-top),0.5rem)] md:pt-0 flex-shrink-0 border-b bg-white dark:bg-slate-950 dark:border-slate-800">
      <div className="flex flex-1 justify-end px-4">
        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <AddTransactionModal isHeader />
          </div>
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
                <span className="sr-only">{t("dashboard.openUserMenu")}</span>
                <Link
                  to={RoutePaths.App + "/" + RoutePaths.Profile}
                  className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 dark:bg-purple-900 dark:text-purple-400 font-medium"
                >
                  {(user?.name?.charAt(0)?.toUpperCase() || "") +
                    (user?.surname?.charAt(0)?.toUpperCase() || "")}
                </Link>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
