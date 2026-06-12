import { useState } from "react"
import { ArrowLeft, Building, Mail, Phone, User, Check } from "lucide-react"
import { Button } from "@presentation/components/ui/button"
import { Input } from "@presentation/components/ui/input"
import { Textarea } from "@presentation/components/ui/textarea"
import { RoutePaths } from "@presentation/utils/routes"
import { Link } from "react-router"
import { Label } from "@presentation/components/ui/label"
import { errorToast } from "@presentation/utils/toast"
import { useTranslation } from 'react-i18next';

export default function ContactSalesPage() {
  const { t } = useTranslation();
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    employees: "",
    message: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const regex = /^\+?([0-9]{1,3})\s?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/
    if (!formState.phone.match(regex)) {
      errorToast(t('contact.invalidPhone'), 3000, "invalid-phone")
      return
    }

    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false)
      setIsSubmitted(true)
      // Reset form after submission
      setFormState({
        name: "",
        email: "",
        company: "",
        phone: "",
        employees: "",
        message: "",
      })
    }, 1500)
  }

  return (
    <div className="container py-12 md:p-5 text-primary dark:text-neutral">
      <div className="mb-8 flex items-center justify-between">
        <Link
          to={RoutePaths.Home}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('contact.backToHome')}</span>
        </Link>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('contact.contactSales')}</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {t('contact.pageDescription')}
          </p>

          <div className="mt-8 space-y-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
                <Check className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium">{t('contact.enterpriseSecurity')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('contact.enterpriseSecurityDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
                <Check className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium">{t('contact.teamCollaboration')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('contact.teamCollaborationDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
                <Check className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium">{t('contact.advancedReporting')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('contact.advancedReportingDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-full bg-purple-100 p-2 dark:bg-purple-900">
                <Check className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium">{t('contact.dedicatedSupport')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('contact.dedicatedSupportDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {isSubmitted ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">{t('contact.thankYou')}</h2>
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                {t('contact.responseTime')}
              </p>
              <Button className="mt-6" onClick={() => setIsSubmitted(false)}>
                {t('contact.sendAnotherInquiry')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('contact.fullName')}</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="name"
                    name="name"
                    value={formState.name}
                    onChange={handleChange}
                    className="pl-10 w-full"
                    placeholder={t('contact.fullNamePlaceholder')}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('contact.emailAddress')}</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formState.email}
                    onChange={handleChange}
                    className="pl-10 w-full"
                    placeholder={t('contact.emailPlaceholder')}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">{t('contact.companyName')}</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Building className="h-4 w-4 text-slate-400" />
                  </div>
                  <Input
                    id="company"
                    name="company"
                    value={formState.company}
                    onChange={handleChange}
                    className="pl-10 w-full"
                    placeholder={t('contact.companyPlaceholder')}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('contact.phoneNumber')}</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formState.phone}
                      onChange={handleChange}
                      className="pl-10 w-full"
                      placeholder={t('contact.phonePlaceholder')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="employees">{t('contact.companySize')}</Label>
                  <select
                    id="employees"
                    name="employees"
                    value={formState.employees}
                    onChange={handleChange}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    required
                  >
                    <option value="" disabled>
                      {t('contact.selectSize')}
                    </option>
                    <option value="1-10">{t('contact.employees1to10')}</option>
                    <option value="11-50">{t('contact.employees11to50')}</option>
                    <option value="51-200">{t('contact.employees51to200')}</option>
                    <option value="201-500">{t('contact.employees201to500')}</option>
                    <option value="501+">{t('contact.employees501plus')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">{t('contact.howCanWeHelp')}</Label>
                <Textarea
                  id="message"
                  name="message"
                  value={formState.message}
                  onChange={handleChange}
                  rows={4}
                  placeholder={t('contact.messagePlaceholder')}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? t('contact.sending') : t('contact.contactSales')}
              </Button>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('contact.legalAgreement')}{" "}
                <Link to={RoutePaths.PrivacyPolicy} className="text-purple-600 hover:underline dark:text-purple-400">
                  {t('contact.privacyPolicy')}
                </Link>{" "}
                {t('common.and')}{" "}
                <Link to={RoutePaths.TersmsAndConditions} className="text-purple-600 hover:underline dark:text-purple-400">
                  {t('contact.termsOfService')}
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
