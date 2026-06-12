import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@adapters/store/rootStore';
import { updateSettingsAction } from '@adapters/slices/user-settings/settingsSlice';
import { updateUserSettings } from '@application/user/user.service';
import { Languages } from 'lucide-react';

const LANGUAGES = [
  { locale: 'en-US', label: 'English', short: 'EN' },
  { locale: 'es-CO', label: 'Español', short: 'ES' },
];

export function LanguageSwitcher() {
  const dispatch = useDispatch();
  const currentLocale = useSelector((state: RootState) => state.userSettings.settings.locale) || 'en-US';
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = LANGUAGES.find(l => l.locale === currentLocale) || LANGUAGES[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (locale: string) => {
    if (locale === currentLocale) {
      setIsOpen(false);
      return;
    }

    // Update Redux (LocaleProvider will pick this up and call switchLanguage)
    dispatch(updateSettingsAction({ locale }));

    // Persist to backend
    updateUserSettings({ locale }).catch((err) => {
      console.error('Failed to persist language preference:', err);
    });

    setIsOpen(false);
  };

  return (
    <div className="relative ml-3" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Switch language"
      >
        <Languages className="h-4 w-4" />
        <span className="hidden sm:inline">{currentLang.short}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-36 origin-top-right rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="py-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.locale}
                onClick={() => handleSelect(lang.locale)}
                className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                  lang.locale === currentLocale
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                    : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span className="mr-2 text-xs font-semibold uppercase text-slate-400">{lang.short}</span>
                <span>{lang.label}</span>
                {lang.locale === currentLocale && (
                  <span className="ml-auto text-purple-600 dark:text-purple-400">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
