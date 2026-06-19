import { useSidebar } from "@adapters/hooks/sidebarContext";
import { useMobile } from "@adapters/hooks/useMobile";
import { logoutAction } from "@adapters/slices/auth/authSlice";
import { RootState } from "@adapters/store/rootStore";
import { logout } from "@application/auth/auth.service";
import { RoutePaths } from "@presentation/utils/routes";
import { useMutation } from "@tanstack/react-query";
import {
  BarChart3,
  CreditCard,
  DollarSign,
  Home,
  PieChart,
  Settings,
  Wallet,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation } from "react-router";
import { Logo } from "../logo";
// Phase 6 (T6.1 + T6.5): every primary nav entry now resolves its
// label through the canonical `routes.app.dashboard.<key>` namespace
// (single source of truth for sidebar + route-config + breadcrumb +
// notFound.tsx back-link + demo/components/mobile-demo.tsx). The
// `sidebar.*` keys are reserved for non-route chrome (settings,
// logout, premium nav) which don't have a route binding.
const navigation = [
  {
    key: "dashboard",
    href: RoutePaths.App + "/" + RoutePaths.Dashboard,
    icon: Home,
    i18nKey: "routes.app.dashboard.dashboard",
  },
  {
    key: "transactions",
    href: RoutePaths.App + "/" + RoutePaths.Transactions,
    icon: CreditCard,
    i18nKey: "routes.app.dashboard.transactions",
  },
  {
    key: "budgets",
    href: RoutePaths.App + "/" + RoutePaths.Budgets,
    icon: PieChart,
    i18nKey: "routes.app.dashboard.budgets",
  },
  {
    key: "reports",
    href: RoutePaths.App + "/" + RoutePaths.Reports,
    icon: BarChart3,
    i18nKey: "routes.app.dashboard.reports",
  },
  {
    key: "income",
    href: RoutePaths.App + "/" + RoutePaths.Income,
    icon: DollarSign,
    i18nKey: "routes.app.dashboard.income",
  },
  {
    key: "settings",
    href: RoutePaths.App + "/" + RoutePaths.Profile,
    icon: Settings,
  },
];

export function DashboardSidebar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const user = useSelector((state: RootState) => state.auth.user);

  const { isOpen, isCollapsed, toggleSidebar, closeSidebar } = useSidebar();

  const pathname = useLocation().pathname;

  const { mutate: logoutMutation } = useMutation({
    mutationKey: ["logout"],
    mutationFn: logout,
    onSuccess() {
      dispatch(logoutAction());
      window.location.href = `${RoutePaths.Auth}/${RoutePaths.Login}`;
    },
    onError(error) {
      console.error(error.message);
    },
  });

  const handleLogut = () => {
    logoutMutation();
  };

  const isMobile = useMobile();

  const getLinkClasses = (_item: any, isActive: boolean) => {
    return `
    group flex items-center rounded-md px-2 text-sm font-medium transition-colors duration-200
      ${isCollapsed ? "justify-center py-3" : "py-2"}
      gap-2
      ${
        isActive &&
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }
      ${
        !isActive &&
        "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      }
      ${isCollapsed && "animate-shake"}
    `;
  };

  const getIconClasses = (_item: any, isActive: boolean) => {
    return `
    ${isCollapsed ? "h-6 w-6" : "h-5 w-5 flex-shrink-0 mr-3"}
      transition-colors duration-200
      ${isActive && "text-slate-600 dark:text-slate-300"}
      ${
        !isActive &&
        "text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-300"
      }
    `;
  };

  return (
    <>
      {/* Botón de toggle para móvil */}
      <button
        onClick={toggleSidebar}
        className={`
          fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg transition-all duration-300 md:hidden
          ${isOpen ? "rotate-90" : "rotate-0"}
          `}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-30 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          ${isCollapsed ? "md:w-20" : "md:w-64"}
          md:translate-x-0
          `}
      >
        <div
          className={`
            flex items-center border-b border-slate-200 px-4 py-5 dark:border-slate-800
            ${isCollapsed ? "justify-center" : "justify-between"}
            `}
        >
          <Link
            to={RoutePaths.App + "/" + RoutePaths.Dashboard}
            className={`flex items-center gap-2 ${
              isCollapsed ? "justify-center" : ""
            }`}
          >
            <Logo size="sm" variant={isCollapsed ? "minimal" : "default"} />
          </Link>

          {/* Botón de toggle para escritorio */}
          <button
            onClick={toggleSidebar}
            className={`
              hidden rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:block
              ${
                isCollapsed &&
                "absolute right-0 top-5 -mr-3 bg-white dark:bg-slate-950"
              }
              `}
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
          <nav
            className={`mt-2 flex-1 space-y-1 ${isCollapsed ? "px-1" : "px-2"}`}
          >
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              // Phase 6 (T6.1): every primary nav entry supplies an
              // `i18nKey` pointing at `routes.app.dashboard.<key>`.
              // Entries without `i18nKey` (settings) still fall back to
              // `sidebar.<key>` for legacy chrome labels.
              const label = t(item.i18nKey ?? "sidebar." + item.key);
              return (
                <Link
                  key={item.key}
                  to={item.href}
                  className={getLinkClasses(item, isActive)}
                  title={isCollapsed ? label : ""}
                >
                  <item.icon
                    className={getIconClasses(item, isActive)}
                    aria-hidden="true"
                  />
                  {!isCollapsed && (
                    <span className="flex-1 transition-opacity duration-200">
                      {label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div
          className={`
            flex flex-shrink-0 border-t border-slate-200 p-4 dark:border-slate-800
            ${isCollapsed ? "justify-center" : ""}
            `}
        >
          <button
            className="group block flex-shrink-0 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            title={isCollapsed ? t("sidebar.logout") : ""}
            onClick={handleLogut}
          >
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 dark:bg-purple-900 dark:text-purple-400 font-medium">
                {(user?.name?.charAt(0).toUpperCase() ?? "") +
                  (user?.surname?.charAt(0).toUpperCase() ?? "")}
              </div>
              {!isCollapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium">
                    {user?.name.split(" ")[0] +
                      " " +
                      user?.surname?.split(" ")[0]}
                  </p>
                  <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                    <LogOut className="mr-1 h-3 w-3" />
                    {t("sidebar.logout")}
                  </div>
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Overlay para móvil */}
      {isOpen && isMobile && (
        <div
          className="fixed inset-0 z-20 bg-slate-900 bg-opacity-50 transition-opacity md:hidden"
          onClick={closeSidebar}
        />
      )}
    </>
  );
}
