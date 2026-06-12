import { useState } from "react"
import { useTranslation } from 'react-i18next';
import { Check, HelpCircle, X } from "lucide-react"
import { Button } from "@presentation/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@presentation/components/ui/card"
import { Switch } from "@presentation/components/ui/switch"
import { SidebarProvider } from "@adapters/hooks/sidebarContext"
import { DashboardHeader } from "@presentation/components/dashboard/header"
import { MainContent } from "@presentation/components/dashboard/main-content"
import { DashboardSidebar } from "@presentation/components/dashboard/sidebar"
import HeaderComponent from "@presentation/components/ui/header"

interface PricingFeature {
  name: string
  free: boolean
  premium: boolean
  tooltip?: string
}

const pricingFeatures: PricingFeature[] = [
  {
    name: "Expense Tracking",
    free: true,
    premium: true,
  },
  {
    name: "Budget Creation",
    free: true,
    premium: true,
  },
  {
    name: "Basic Reports",
    free: true,
    premium: true,
  },
  {
    name: "Transaction Categories",
    free: true,
    premium: true,
    tooltip: "Categorize your transactions for better tracking",
  },
  {
    name: "Custom Categories",
    free: true,
    premium: true,
  },
  {
    name: "Unlimited Transactions",
    free: false,
    premium: true,
    tooltip: "Free plan limited to 100 transactions per month",
  },
  {
    name: "Advanced Reports & Analytics",
    free: false,
    premium: true,
  },
  {
    name: "Data Export (CSV, PDF)",
    free: false,
    premium: true,
  },
  {
    name: "Savings Goals",
    free: false,
    premium: true,
  },
  {
    name: "Bill Reminders",
    free: false,
    premium: true,
  },
  {
    name: "Multiple Accounts",
    free: false,
    premium: true,
    tooltip: "Connect and manage multiple bank accounts",
  },
]

export default function UpgradePage() {
  const { t } = useTranslation();

  const faqs = [
    {
      question: t('upgrade.faqCancel'),
      answer: t('upgrade.faqCancelAnswer'),
    },
    {
      question: t('upgrade.faqUpgrade'),
      answer: t('upgrade.faqUpgradeAnswer'),
    },
    {
      question: t('upgrade.faqTrial'),
      answer: t('upgrade.faqTrialAnswer'),
    },
    {
      question: t('upgrade.faqPayment'),
      answer: t('upgrade.faqPaymentAnswer'),
    },
    {
      question: t('upgrade.faqBilling'),
      answer: t('upgrade.faqBillingAnswer'),
    },
  ]
  const user = JSON.parse(localStorage.getItem("user") as string)
  const [isAnnual, setIsAnnual] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<"free" | "premium">("premium")

  // Calculate prices with annual discount
  const premiumMonthly = 4.99
  const annualDiscount = 0.2 // 20% discount

  const premiumPrice = isAnnual ? (premiumMonthly * 12 * (1 - annualDiscount)).toFixed(2) : premiumMonthly.toFixed(2)

  return (
    <>
      {user !== null ? (
        <SidebarProvider>
          <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
            <DashboardSidebar />
            <MainContent>
              <DashboardHeader />
              <main className="flex-1 p-4 md:p-6 text-primary dark:text-neutral">
                <div className="space-y-10">
                  <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('upgrade.title')}</h1>
                    <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                      {t('upgrade.description')}
                    </p>
                  </div>

                  <div className="flex justify-center items-center space-x-2 mb-8">
                    <span className={`text-sm ${!isAnnual ? "font-medium" : "text-slate-500 dark:text-slate-400"}`}>{t('upgrade.monthly')}</span>
                    <Switch checked={isAnnual} onChange={setIsAnnual} id="billing-toggle" />
                    <span className={`text-sm ${isAnnual ? "font-medium" : "text-slate-500 dark:text-slate-400"}`}>
                      {t('upgrade.annual')} <span className="text-green-600 dark:text-green-400">({t('upgrade.savePercent', { percent: 20 })})</span>
                    </span>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Free Plan */}
                    <Card
                      className={`border-2 ${selectedPlan === "free" ? "border-purple-600 dark:border-purple-400" : "border-transparent"} bg-card dark:bg-card dark:text-neutral`}
                    >
                      <CardHeader>
                        <CardTitle>{t('upgrade.free')}</CardTitle>
                        <CardDescription>{t('upgrade.basicBudgeting')}</CardDescription>
                        <div className="mt-4">
                          <span className="text-3xl font-bold">$0</span>
                          <span className="text-slate-500 dark:text-slate-400 ml-1">{t('upgrade.forever')}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="h-64 overflow-y-auto">
                        <ul className="space-y-2">
                          {pricingFeatures.map((feature) => (
                            <li key={feature.name} className="flex items-start">
                              {feature.free ? (
                                <Check className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                              ) : (
                                <X className="h-5 w-5 text-slate-300 dark:text-slate-600 mr-2 flex-shrink-0" />
                              )}
                              <span className={feature.free ? "" : "text-slate-400 dark:text-slate-500"}>{feature.name}</span>
                              {feature.tooltip && <HelpCircle className="h-4 w-4 text-slate-400 ml-1 flex-shrink-0" />}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => setSelectedPlan("free")}
                          disabled={selectedPlan === "free"}
                        >
                          {selectedPlan === "free" ? t('upgrade.currentPlan') : t('upgrade.selectPlan')}
                        </Button>
                      </CardFooter>
                    </Card>

                    {/* Premium Plan */}
                    <Card
                      className={`border-2 ${selectedPlan === "premium" ? "border-purple-600 dark:border-purple-400" : "border-transparent"} relative bg-card dark:bg-card dark:text-neutral`}
                    >
                      <div className="absolute top-0 right-0 bg-purple-600 text-white px-3 py-1 text-xs font-medium rounded-bl-lg rounded-tr-lg">
                        {t('upgrade.popular')}
                      </div>
                      <CardHeader>
                        <CardTitle>{t('upgrade.premium')}</CardTitle>
                        <CardDescription>{t('upgrade.advancedFeatures')}</CardDescription>
                        <div className="mt-4">
                          <span className="text-3xl font-bold">${premiumPrice}</span>
                          <span className="text-slate-500 dark:text-slate-400 ml-1">{isAnnual ? t('upgrade.perYear') : t('upgrade.perMonth')}</span>
                        </div>
                      </CardHeader>
                      <CardContent className="h-64 overflow-y-auto">
                        <ul className="space-y-2">
                          {pricingFeatures.map((feature) => (
                            <li key={feature.name} className="flex items-start">
                              {feature.premium ? (
                                <Check className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                              ) : (
                                <X className="h-5 w-5 text-slate-300 dark:text-slate-600 mr-2 flex-shrink-0" />
                              )}
                              <span className={feature.premium ? "" : "text-slate-400 dark:text-slate-500"}>{feature.name}</span>
                              {feature.tooltip && <HelpCircle className="h-4 w-4 text-slate-400 ml-1 flex-shrink-0" />}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                      <CardFooter>
                        <Button
                          className="w-full bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600"
                          onClick={() => setSelectedPlan("premium")}
                          disabled={selectedPlan === "premium"}
                        >
                          {selectedPlan === "premium" ? t('upgrade.currentPlan') : t('upgrade.upgradeNow')}
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>

                  <div className="mt-16">
                    <h2 className="text-2xl font-bold text-center mb-8">{t('upgrade.comparePlans')}</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b dark:border-slate-700">
                            <th className="py-4 px-6 text-left">{t('upgrade.feature')}</th>
                            <th className="py-4 px-6 text-center">{t('upgrade.free')}</th>
                            <th className="py-4 px-6 text-center">{t('upgrade.premium')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pricingFeatures.map((feature, index) => (
                            <tr
                              key={feature.name}
                              className={`${index % 2 === 0 ? "bg-slate-50 dark:bg-slate-800/50" : ""} border-b dark:border-slate-700`}
                            >
                              <td className="py-3 px-6 flex items-center">
                                {feature.name}
                                {feature.tooltip && <HelpCircle className="h-4 w-4 text-slate-400 ml-1" />}
                              </td>
                              <td className="py-3 px-6 text-center">
                                {feature.free ? (
                                  <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                                ) : (
                                  <X className="h-5 w-5 text-slate-300 dark:text-slate-600 mx-auto" />
                                )}
                              </td>
                              <td className="py-3 px-6 text-center">
                                {feature.premium ? (
                                  <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                                ) : (
                                  <X className="h-5 w-5 text-slate-300 dark:text-slate-600 mx-auto" />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-16">
                    <h2 className="text-2xl font-bold text-center mb-8">{t('upgrade.faq')}</h2>
                    <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
                      {faqs.map((faq, index) => (
                        <Card key={index} className="bg-card dark:bg-card dark:text-neutral">
                          <CardHeader>
                            <CardTitle className="text-lg">{faq.question}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-slate-500 dark:text-slate-400">{faq.answer}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="mt-16 text-center bg-purple-50 dark:bg-purple-900/20 rounded-lg p-8">
                    <h2 className="text-2xl font-bold mb-4">{t('upgrade.needHelp')}</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-2xl mx-auto">
                      {t('upgrade.needHelpDescription')}
                    </p>
                    <Button className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600">
                      {t('upgrade.contactSales')}
                    </Button>
                  </div>
                </div>
              </main>
            </MainContent>
          </div>
        </SidebarProvider>
      ) : (
        <div className="min-h-screen bg-background text-primary">
          <HeaderComponent />
          <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
            <div className="flex-1 p-4 md:p-6 text-primary dark:text-neutral">
              <div className="space-y-10">
                <div className="text-center">
                  <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('upgrade.title')}</h1>
                  <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                    {t('upgrade.description')}
                  </p>
                </div>

                <div className="flex justify-center items-center space-x-2 mb-8">
                  <span className={`text-sm ${!isAnnual ? "font-medium" : "text-slate-500 dark:text-slate-400"}`}>{t('upgrade.monthly')}</span>
                  <Switch checked={isAnnual} onChange={setIsAnnual} id="billing-toggle" />
                  <span className={`text-sm ${isAnnual ? "font-medium" : "text-slate-500 dark:text-slate-400"}`}>
                    {t('upgrade.annual')} <span className="text-green-600 dark:text-green-400">({t('upgrade.savePercent', { percent: 20 })})</span>
                  </span>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Free Plan */}
                  <Card
                    className={`border-2 ${selectedPlan === "free" ? "border-purple-600 dark:border-purple-400" : "border-transparent"} bg-card dark:bg-card dark:text-neutral`}
                  >
                    <CardHeader>
                      <CardTitle>{t('upgrade.free')}</CardTitle>
                      <CardDescription>{t('upgrade.basicBudgeting')}</CardDescription>
                      <div className="mt-4">
                        <span className="text-3xl font-bold">$0</span>
                        <span className="text-slate-500 dark:text-slate-400 ml-1">{t('upgrade.forever')}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="h-64 overflow-y-auto">
                      <ul className="space-y-2">
                        {pricingFeatures.map((feature) => (
                          <li key={feature.name} className="flex items-start">
                            {feature.free ? (
                              <Check className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                            ) : (
                              <X className="h-5 w-5 text-slate-300 dark:text-slate-600 mr-2 flex-shrink-0" />
                            )}
                            <span className={feature.free ? "" : "text-slate-400 dark:text-slate-500"}>{feature.name}</span>
                            {feature.tooltip && <HelpCircle className="h-4 w-4 text-slate-400 ml-1 flex-shrink-0" />}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setSelectedPlan("free")}
                        disabled={selectedPlan === "free"}
                      >
                        {selectedPlan === "free" ? t('upgrade.currentPlan') : t('upgrade.selectPlan')}
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* Premium Plan */}
                  <Card
                    className={`border-2 ${selectedPlan === "premium" ? "border-purple-600 dark:border-purple-400" : "border-transparent"} relative bg-card dark:bg-card dark:text-neutral`}
                  >
                    <div className="absolute top-0 right-0 bg-purple-600 text-white px-3 py-1 text-xs font-medium rounded-bl-lg rounded-tr-lg">
                      {t('upgrade.popular')}
                    </div>
                    <CardHeader>
                      <CardTitle>{t('upgrade.premium')}</CardTitle>
                      <CardDescription>{t('upgrade.advancedFeatures')}</CardDescription>
                      <div className="mt-4">
                        <span className="text-3xl font-bold">${premiumPrice}</span>
                        <span className="text-slate-500 dark:text-slate-400 ml-1">{isAnnual ? t('upgrade.perYear') : t('upgrade.perMonth')}</span>
                      </div>
                    </CardHeader>
                    <CardContent className="h-64 overflow-y-auto">
                      <ul className="space-y-2">
                        {pricingFeatures.map((feature) => (
                          <li key={feature.name} className="flex items-start">
                            {feature.premium ? (
                              <Check className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                            ) : (
                              <X className="h-5 w-5 text-slate-300 dark:text-slate-600 mr-2 flex-shrink-0" />
                            )}
                            <span className={feature.premium ? "" : "text-slate-400 dark:text-slate-500"}>{feature.name}</span>
                            {feature.tooltip && <HelpCircle className="h-4 w-4 text-slate-400 ml-1 flex-shrink-0" />}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600"
                        onClick={() => setSelectedPlan("premium")}
                        disabled={selectedPlan === "premium"}
                      >                          {selectedPlan === "premium" ? t('upgrade.currentPlan') : t('upgrade.upgradeNow')}
                        </Button>
                    </CardFooter>
                  </Card>
                </div>

                <div className="mt-16">
                  <h2 className="text-2xl font-bold text-center mb-8">{t('upgrade.comparePlans')}</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b dark:border-slate-700">
                          <th className="py-4 px-6 text-left">{t('upgrade.feature')}</th>
                          <th className="py-4 px-6 text-center">{t('upgrade.free')}</th>
                          <th className="py-4 px-6 text-center">{t('upgrade.premium')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingFeatures.map((feature, index) => (
                          <tr
                            key={feature.name}
                            className={`${index % 2 === 0 ? "bg-slate-50 dark:bg-slate-800/50" : ""} border-b dark:border-slate-700`}
                          >
                            <td className="py-3 px-6 flex items-center">
                              {feature.name}
                              {feature.tooltip && <HelpCircle className="h-4 w-4 text-slate-400 ml-1" />}
                            </td>
                            <td className="py-3 px-6 text-center">
                              {feature.free ? (
                                <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-slate-300 dark:text-slate-600 mx-auto" />
                              )}
                            </td>
                            <td className="py-3 px-6 text-center">
                              {feature.premium ? (
                                <Check className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-slate-300 dark:text-slate-600 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-16">
                  <h2 className="text-2xl font-bold text-center mb-8">{t('upgrade.faq')}</h2>
                  <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
                    {faqs.map((faq, index) => (
                      <Card key={index} className="bg-card dark:bg-card dark:text-neutral">
                        <CardHeader>
                          <CardTitle className="text-lg">{faq.question}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-slate-500 dark:text-slate-400">{faq.answer}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="mt-16 text-center bg-purple-50 dark:bg-purple-900/20 rounded-lg p-8">
                  <h2 className="text-2xl font-bold mb-4">{t('upgrade.needHelp')}</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-2xl mx-auto">
                    {t('upgrade.needHelpDescription')}
                  </p>
                  <Button className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600">
                    {t('upgrade.contactSales')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}