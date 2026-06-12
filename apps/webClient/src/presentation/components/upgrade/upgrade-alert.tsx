import { RoutePaths } from "@presentation/utils/routes";
import { useNavigate } from "react-router";

export default function UpgradeAlert({ setShowUpgradeAlert }: { setShowUpgradeAlert: (show: boolean) => void }) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl max-w-md mx-4">
        <h3 className="text-lg font-bold mb-2">Upgrade Required</h3>
        <p className="mb-4">
          You need a premium plan to access this feature. Upgrade now to unlock all features.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowUpgradeAlert(false)}
            className="px-4 py-2 text-sm rounded-md border border-slate-200 dark:border-slate-700"
          >
            Later
          </button>
          <button
            onClick={() => navigate(RoutePaths.Upgrade)}
            className="px-4 py-2 text-sm rounded-md bg-purple-600 text-white hover:bg-purple-700"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  )
}