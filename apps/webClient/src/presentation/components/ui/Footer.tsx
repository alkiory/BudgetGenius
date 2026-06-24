import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Logo } from "../logo";

export default function FooterComponent() {
  const { t } = useTranslation();
  return (
    <footer className="border-t bg-background pt-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] dark:text-neutral dark:border-t-slate-800">
      <div className="container mx-auto px-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <Logo size="md" variant="default" />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("common.needHelp")}{" "}
          <Link
            to="#"
            className="text-purple-600 hover:underline dark:text-purple-400"
          >
            {t("contact.support")}
          </Link>
        </p>
      </div>
    </footer>
  );
}
