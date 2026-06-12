import { Link, useNavigate } from "react-router";
import { Button } from "./button";
import { ThemeToggle } from "../themeToogle";
import { LanguageSwitcher } from "../dashboard/language-switcher";
import { useSelector } from "react-redux";
import { RootState } from "@adapters/store/rootStore";
import { RoutePaths } from "@presentation/utils/routes";
import { Logo } from "../logo";
import { useTranslation } from 'react-i18next';

export default function HeaderComponent() {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);
  const navigate = useNavigate();
  const handleBack = () => {
    const currentPath = window.location.pathname;
    const isOnDashboard = currentPath.includes(`${RoutePaths.App}/${RoutePaths.Dashboard}`);
    if (isOnDashboard) {
      navigate(`${RoutePaths.App}`);
    } else {
      navigate(`${RoutePaths.App}/${RoutePaths.Dashboard}`);
    }

    if (!user) {
      navigate("/");
    }
  }
  return (
    <header className="border-b bg-slate-50 dark:bg-slate-800">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div onClick={handleBack} className="flex items-center gap-2 cursor-pointer">
          <Logo size="md" variant="default" />
        </div>
        <nav className="flex items-center gap-4">
          <ThemeToggle />
          <LanguageSwitcher />
          {user ? (
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
          ) : (
            <>
              <Link to="/auth/login" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                {t('auth.logIn')}
              </Link>
              <Button size="sm">
                <Link to="/auth/signup">{t('auth.signUp')}</Link>
              </Button>
            </>
          )}
        </nav>
      </div >
    </header >
  )
}