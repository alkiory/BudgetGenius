import { Navigate, useLocation } from 'react-router';
import { useSelector } from 'react-redux';
import MainLayout from '@presentation/layouts/main';
import { RootState } from '@adapters/store/rootStore';
import { RoutePaths } from '@presentation/utils/routes';
import { useState, useEffect } from 'react';

/**
 * A component that acts as a protected route, ensuring that only authenticated users
 * can access certain parts of the application. It checks the authentication status
 * and user information from the Redux store. If the user is not authenticated and
 * the loading state is false, it redirects to the login page. Otherwise, it renders
 * the main layout of the application.
 *
 * @returns {JSX.Element} - The main layout if authenticated, or a redirect to the login page.
 */
const ProtectedRoute = () => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const user = useSelector((state: RootState) => state.auth.user);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('accessToken');
  const location = useLocation();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  if (!location.pathname.includes(RoutePaths.Auth || RoutePaths.App)) {
    return <MainLayout />;
  }
  if (!!token) {
    console.debug("No token found, redirecting to login");
    return <Navigate to={RoutePaths.Auth + "/" + RoutePaths.Login} replace />;
  }

  if (!isAuthenticated && !user && !loading) {
    return <Navigate to={RoutePaths.Auth + "/" + RoutePaths.Login} replace />;
  }

  return <MainLayout />;
};

export default ProtectedRoute;