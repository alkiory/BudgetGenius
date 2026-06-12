import { useTranslation } from 'react-i18next';
import { useMobile } from "@adapters/hooks/useMobile";
import { logoutAction } from "@adapters/slices/auth/authSlice";
import { logout } from "@application/auth/auth.service";
import { useMutation } from "@tanstack/react-query";
import { BarChart3, CreditCard, DollarSign, Home, PieChart, Settings, Wallet, Goal, LogOut, ChevronLeft, ChevronRight, Menu, ChartCandlestick, PiggyBank, Crown } from "lucide-react"
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation } from "react-router"
import { useSidebar } from "@adapters/hooks/sidebarContext";
import { RoutePaths } from "@presentation/utils/routes";
import { RootState } from "@adapters/store/rootStore";
import { Logo } from "../logo";

const navigation = [
  { key: 'dashboard', href: RoutePaths.App + "/" + RoutePaths.Dashboard, icon: Home, isPremium: false },
  { key: 'transactions', href: RoutePaths.App + "/" + RoutePaths.Transactions, icon: CreditCard, isPremium: false },
  { key: 'budgets', href: RoutePaths.App + "/" + RoutePaths.Budgets, icon: PieChart, isPremium: false },
  { key: 'reports', href: RoutePaths.App + "/" + RoutePaths.Reports, icon: BarChart3, isPremium: true },
  { key: 'income', href: RoutePaths.App + "/" + RoutePaths.Income, icon: DollarSign, isPremium: false },
  { key: 'goals', href: RoutePaths.App + "/" + RoutePaths.Goals, icon: Goal, isPremium: false },
  { key: 'investments', href: RoutePaths.App + "/" + RoutePaths.Investments, icon: ChartCandlestick, isPremium: true },
  { key: 'savings', href: RoutePaths.App + "/" + RoutePaths.Savings, icon: PiggyBank, isPremium: true },
  { key: 'settings', href: RoutePaths.App + "/" + RoutePaths.Profile, icon: Settings, isPremium: false },
]

export function DashboardSidebar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const user = useSelector((state: RootState) => state.auth.user);

  const { isOpen, isCollapsed, toggleSidebar, closeSidebar } = useSidebar()

  const pathname = useLocation().pathname;

  const { mutate: logoutMutation } = useMutation({
    mutationKey: ['logout'],
    mutationFn: logout,
    onSuccess() {
      dispatch(logoutAction());
      window.location.href = `${RoutePaths.Auth}/${RoutePaths.Login}`
    },
    onError(error) {
      console.error(error.message);
    }
  });

  const handleLogut = () => {
    logoutMutation();
  }

  const isMobile = useMobile()

  const getLinkClasses = (item: any, isActive: boolean) => {
    return `
    group flex items-center rounded-md px-2 text-sm font-medium transition-colors duration-200
      ${isCollapsed ? "justify-center py-3" : "py-2"}
      gap-2
      ${isActive && item.isPremium && "bg-purple-50 text-purple-600 dark:bg-purple-800 dark:text-purple-400"}
      ${isActive && !item.isPremium && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}
      ${!isActive && "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"}
      ${isCollapsed && "animate-shake"}
    `;
  };

  const getIconClasses = (item: any, isActive: boolean) => {
    return `
    ${isCollapsed ? "h-6 w-6" : "h-5 w-5 flex-shrink-0 mr-3"}
      transition-colors duration-200
      ${isActive && item.isPremium && "text-purple-600 dark:text-purple-400"}
      ${isActive && !item.isPremium && "text-slate-600 dark:text-slate-300"}
      ${!isActive && "text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-300"}
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
            className={`flex items-center gap-2 ${isCollapsed ? "justify-center" : ""}`}>
            <Logo size="sm" variant={isCollapsed ? "minimal" : "default"} />
          </Link>

          {/* Botón de toggle para escritorio */}
          <button
            onClick={toggleSidebar}
            className={`
              hidden rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 md:block
              ${isCollapsed && "absolute right-0 top-5 -mr-3 bg-white dark:bg-slate-950"}
              `}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
          <nav className={`mt-2 flex-1 space-y-1 ${isCollapsed ? "px-1" : "px-2"}`}>
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const label = t('sidebar.' + item.key);
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
                  {!isCollapsed && <span className="flex-1 transition-opacity duration-200">{label}</span>}
                  {item.isPremium && !isCollapsed && (
                    <span className="flex gap-2 items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                      {t('sidebar.premium')}
                      <Crown
                        size={15}
                        className="text-purple-600 dark:text-purple-400"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </Link>
              );
            })}
            {/* Enlace de "Upgrade" */}
            {!user?.isPremium && (
              <Link
                to={RoutePaths.Upgrade}
                className={`
                  group flex items-center rounded-md px-2 text-sm font-medium mt-4 transition-colors duration-200
                  ${pathname === RoutePaths.Upgrade
                    ? "bg-purple-50 text-purple-600 dark:bg-slate-800 dark:text-purple-400"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"}
                  ${isCollapsed ? "justify-center py-3" : "py-2"}
                  `}
                title={isCollapsed ? t('sidebar.upgrade') : ""}
              >
                <Crown
                  className={`
                    ${pathname === RoutePaths.Upgrade
                      ? "text-purple-600 dark:text-purple-400"
                      : "text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-300"}
                    ${isCollapsed ? "h-6 w-6" : "mr-3 h-5 w-5 flex-shrink-0"}
                    transition-colors duration-200
                    `}
                  aria-hidden="true"
                />
                {!isCollapsed && (
                  <span className="transition-opacity duration-200 font-medium text-purple-600 dark:text-purple-400">
                    {t('sidebar.upgrade')}
                  </span>
                )}
              </Link>
            )}
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
            title={isCollapsed ? t('sidebar.logout') : ""}
            onClick={handleLogut}
          >
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 dark:bg-purple-900 dark:text-purple-400 font-medium">
                {(user?.name?.charAt(0).toUpperCase() ?? "") + (user?.surname?.charAt(0).toUpperCase() ?? "")}
              </div>
              {!isCollapsed && (
                <div className="ml-3">
                  <p className="text-sm font-medium">{user?.name.split(" ")[0] + " " + user?.surname?.split(" ")[0]}</p>
                  <div className="flex items-center text-xs text-slate-500 dark:text-slate-400">
                    <LogOut className="mr-1 h-3 w-3" />
                    {t('sidebar.logout')}
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
  )
}