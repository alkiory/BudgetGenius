import { RootState } from "@adapters/store/rootStore";
import { RoutePaths } from "@presentation/utils/routes";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Link } from "react-router";
import { ThemeToggle } from "../themeToogle";
import { AddTransactionModal } from "./transaction/add-transaction-modal";
import { SupportDevButton } from "./support-dev-button";

export function DashboardHeader() {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <header className="sticky top-0 z-20 flex min-h-16 flex-shrink-0 border-b border-slate-200/70 bg-white/65 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur-2xl dark:border-white/[0.06] dark:bg-[#050a12]/65 md:pt-0">
      <div className="flex flex-1 justify-end px-4">
        <div className="flex items-center gap-3">
          <div className="hidden md:block" data-tour="quick-add">
            <AddTransactionModal isHeader />
          </div>
          <SupportDevButton />
          <div className="ml-3">
            <ThemeToggle />
          </div>
          <div className="relative ml-3">
            <div>
              <button
                type="button"
                className="flex max-w-xs items-center rounded-full bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-teal-400/70 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#050a12]"
                id="user-menu-button"
              >
                <span className="sr-only">{t("dashboard.openUserMenu")}</span>
                <Link
                  to={RoutePaths.App + "/" + RoutePaths.Profile}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/15 font-medium text-teal-700 ring-1 ring-inset ring-teal-500/25 transition hover:bg-teal-500/25 dark:bg-teal-400/10 dark:text-teal-300"
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
