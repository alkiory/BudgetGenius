import HeaderComponent from '@presentation/components/ui/header';
import { Outlet } from 'react-router';

export default function LandingLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <HeaderComponent />
      <main className="flex-1 p-4 bg-background">
        <Outlet />
      </main>
    </div>
  )
}
