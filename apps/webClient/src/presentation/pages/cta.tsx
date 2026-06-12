import { useTranslation } from 'react-i18next';
import { RoutePaths } from "@presentation/utils/routes"
import { Button } from "@presentation/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@presentation/components/ui/card"
import HeaderComponent from "@presentation/components/ui/header"
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Calendar, ChevronDown, CreditCard, DollarSign, PieChart, Plus, TrendingUp, Wallet } from "lucide-react"
import { Link } from "react-router"
import { Logo } from "@presentation/components/logo"


export default function HomePage() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-purple-500 dark:bg-purple-950">
      {/* Navigation */}
      <HeaderComponent />

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-purple-500 to-cyan-50 py-20 dark:from-purple-900 dark:to-slate-900">
        <div className="container mx-auto px-4 text-center">
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
            <span>{t('landing.heroTitle')}</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-white">
            {t('landing.heroSubtitle')}
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="bg-purple-700 hover:bg-purple-800 hover:scale-110 transition-all">
              <Link to={RoutePaths.Auth + "/" + RoutePaths.Signup}>
                {t('landing.getStarted')}
              </Link>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="outline" size="lg" className="bg-white hover:scale-110 transition-all dark:bg-transparent dark:text-white dark:border-white">
              <Link to={RoutePaths.HowItWorks}>
                {t('landing.seeHowItWorks')}
              </Link>
            </Button>
          </div>

          {/* App Preview */}
          <div className="mt-16 rounded-lg border bg-white p-4 shadow-xl dark:bg-slate-800 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4 px-2 dark:text-slate-100">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-purple-600" />
                <span className="font-semibold text-lg dark:text-white">{t('landing.dashboardTitle')}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-sm bg-slate-100 px-3 py-1 rounded-full dark:bg-slate-700">
                  <Calendar className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span>April 2023</span>
                  <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </div>
                <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 dark:bg-purple-900 dark:text-purple-300 font-medium">
                  JD
                </div>
              </div>
            </div>

            <div className="aspect-[16/9] overflow-hidden rounded-md bg-slate-50 dark:bg-slate-900">
              <div className="grid h-full grid-cols-3 gap-4 p-6">
                <div className="col-span-2 rounded-md bg-white p-4 shadow-sm dark:bg-slate-800 dark:text-slate-100">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{t('demo.monthlyOverview')}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t('demo.incomeVsExpenses')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t('demo.income')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-3 w-3 rounded-full bg-cyan-400"></div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t('demo.expenses')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-[220px] rounded-md bg-slate-50 p-4 relative dark:bg-slate-900">
                    {/* Chart grid lines */}
                    <div className="absolute inset-x-4 inset-y-4 grid grid-rows-4 gap-y-[calc((100%-16px)/4)]">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="border-t border-slate-200 -mt-px dark:border-slate-700"></div>
                      ))}
                    </div>

                    {/* Y-axis labels */}
                    <div className="absolute left-0 inset-y-4 flex flex-col justify-between">
                      <span className="text-[10px] text-slate-400">$6k</span>
                      <span className="text-[10px] text-slate-400">$4.5k</span>
                      <span className="text-[10px] text-slate-400">$3k</span>
                      <span className="text-[10px] text-slate-400">$1.5k</span>
                      <span className="text-[10px] text-slate-400">$0</span>
                    </div>

                    {/* X-axis labels */}
                    <div className="absolute bottom-0 inset-x-4 flex justify-between">
                      {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((month) => (
                        <span key={month} className="text-[10px] text-slate-400">
                          {month}
                        </span>
                      ))}
                    </div>

                    {/* Chart bars */}
                    <div className="absolute inset-x-4 bottom-6 top-4 flex items-end justify-between">
                      {/* Each month has two bars - income and expenses */}
                      <div className="flex gap-1">
                        <div className="w-4 rounded-t bg-purple-500" style={{ height: "40%" }}></div>
                        <div className="w-4 rounded-t bg-cyan-400" style={{ height: "30%" }}></div>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-4 rounded-t bg-purple-500" style={{ height: "50%" }}></div>
                        <div className="w-4 rounded-t bg-cyan-400" style={{ height: "45%" }}></div>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-4 rounded-t bg-purple-500" style={{ height: "60%" }}></div>
                        <div className="w-4 rounded-t bg-cyan-400" style={{ height: "50%" }}></div>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-4 rounded-t bg-purple-500" style={{ height: "75%" }}></div>
                        <div className="w-4 rounded-t bg-cyan-400" style={{ height: "55%" }}></div>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-4 rounded-t bg-purple-500" style={{ height: "65%" }}></div>
                        <div className="w-4 rounded-t bg-cyan-400" style={{ height: "60%" }}></div>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-4 rounded-t bg-purple-500" style={{ height: "80%" }}></div>
                        <div className="w-4 rounded-t bg-cyan-400" style={{ height: "65%" }}></div>
                      </div>
                      <div className="flex gap-1">
                        <div className="w-4 rounded-t bg-purple-500" style={{ height: "90%" }}></div>
                        <div className="w-4 rounded-t bg-cyan-400" style={{ height: "70%" }}></div>
                      </div>
                    </div>

                    {/* Highlight for current month */}
                    <div className="absolute right-[calc(12.5%-8px)] bottom-0 h-1.5 w-10 bg-purple-600 rounded"></div>
                  </div>

                  {/* Recent Transactions */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">{t('dashboard.recentTransactions')}</h4>
                      <button className="text-xs text-purple-600 hover:underline dark:text-purple-400">{t('common.viewAll')}</button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center dark:bg-red-900">
                            <CreditCard className="h-4 w-4 text-red-500 dark:text-red-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Grocery Store</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Apr 12, 2023</p>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-red-500 dark:text-red-400">-$84.32</span>
                      </div>
                      <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-900">
                            <DollarSign className="h-4 w-4 text-green-500 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Salary Deposit</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Apr 10, 2023</p>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-green-500 dark:text-green-400">+$2,750.00</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 dark:text-slate-100">
                  {/* Monthly Summary Card */}
                  <div className="rounded-md bg-white p-4 shadow-sm dark:bg-slate-800">
                    <h3 className="mb-3 font-semibold flex items-center justify-between">
                      <span>{t('demo.monthlySummary')}</span>
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center dark:bg-green-900">
                            <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
                          </div>
                          <span className="text-sm">{t('demo.income')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">$5,240</span>
                          <ArrowUpRight className="h-3 w-3 text-green-500 dark:text-green-400" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center dark:bg-red-900">
                            <ArrowDownRight className="h-4 w-4 text-red-500 dark:text-red-400" />
                          </div>
                          <span className="text-sm">{t('demo.expenses')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">$3,890</span>
                          <ArrowUpRight className="h-3 w-3 text-red-500 dark:text-red-400" />
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{t('common.balance')}</span>
                          <span className="font-semibold text-green-600 dark:text-green-400">+$1,350</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Budget Card */}
                  <div className="rounded-md bg-white p-4 shadow-sm dark:bg-slate-800">
                    <h3 className="mb-2 font-semibold flex items-center justify-between">
                      <span>{t('demo.budgetNav')}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{t('demo.percentUsed', { percent: 70 })}</span>
                    </h3>
                    <div className="space-y-3">
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                        <div className="h-2 w-[70%] rounded-full bg-purple-500 relative">
                          <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-purple-500 dark:border-slate-800"></div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>$0</span>
                        <span>$2,000</span>
                      </div>
                      <div className="pt-1">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          $1,400 spent of $2,000 monthly budget
                        </p>
                      </div>
                      <button className="w-full text-center text-xs text-purple-600 hover:underline dark:text-purple-400">
                        {t('demo.adjustBudget')}
                      </button>
                    </div>
                  </div>

                  {/* Savings Card */}
                  <div className="rounded-md bg-white p-4 shadow-sm dark:bg-slate-800">
                    <h3 className="mb-2 font-semibold">{t('savings.title')}</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Vacation</p>
                          <div className="mt-1 h-1.5 w-32 rounded-full bg-slate-100 dark:bg-slate-700">
                            <div className="h-1.5 w-[80%] rounded-full bg-green-500"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500 dark:text-slate-400">80%</span>
                          <p className="text-sm font-medium">$4,000/$5,000</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">New Car</p>
                          <div className="mt-1 h-1.5 w-32 rounded-full bg-slate-100 dark:bg-slate-700">
                            <div className="h-1.5 w-[45%] rounded-full bg-amber-500"></div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500 dark:text-slate-400">45%</span>
                          <p className="text-sm font-medium">$9,000/$20,000</p>
                        </div>
                      </div>
                      <button className="flex items-center justify-center w-full text-xs text-purple-600 hover:underline gap-1 mt-1 dark:text-purple-400">
                        <Plus className="h-3 w-3" />
                        <span>{t('common.addNewGoal')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 dark:bg-auto dark:bg-slate-900">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-white text-3xl font-bold tracking-tight sm:text-4xl">
            {t('landing.featuresTitle')}
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <Card className="rounded-lg border bg-slate-50 p-6 hover:scale-105 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
              <CardHeader className="mb-4 inline-grid h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
                <BarChart3 className="md:-my-10 h-6 w-6 text-purple-600 dark:text-purple-400" />
              </CardHeader>
              <CardTitle className="mb-2 text-xl font-semibold">{t('landing.expenseTracking')}</CardTitle>
              <CardDescription>{t('landing.expenseTrackingDesc')}</CardDescription>
            </Card>
            <Card className="rounded-lg border bg-slate-50 p-6 hover:scale-105 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
              <CardHeader className="mb-4 inline-grid h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
                <PieChart className="md:-my-10 h-6 w-6 text-purple-600 dark:text-purple-400" />
              </CardHeader>
              <CardTitle className="mb-2 text-xl font-semibold">{t('landing.budgetPlanning')}</CardTitle>
              <CardDescription>{t('landing.budgetPlanningDesc')}</CardDescription>
            </Card>
            <Card className="rounded-lg border bg-slate-50 p-6 hover:scale-105 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
              <CardHeader className="mb-4 inline-grid h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
                <CreditCard className="md:-my-10 h-6 w-6 text-purple-600 dark:text-purple-400" />
              </CardHeader>
              <CardTitle className="mb-2 text-xl font-semibold">{t('landing.financialGoals')}</CardTitle>
              <CardDescription>{t('landing.financialGoalsDesc')}</CardDescription>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-slate-50 py-20 dark:bg-slate-900 dark:text-slate-100">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">
            {t('landing.trustedBy')}
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-white p-6 drop-shadow-lg dark:bg-slate-800 hover:bg-slate-200">
              <div className="mb-4 flex">
                {[1, 2, 3, 4].map((star) => (
                  <svg
                    key={star}
                    className="h-5 w-5 fill-amber-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                ))}
              </div>
              <p className="mb-4 text-slate-500">
                {t('landing.testimonial1')}
              </p>
              <div className="flex items-center gap-2">
                <img
                  src="https://xsgames.co/randomusers/assets/avatars/female/15.jpg"
                  alt="User"
                  className="h-10 w-10 rounded-full"
                />
                <div>
                  <p className="font-medium">Ximena Smith</p>
                  <p className="text-sm text-slate-500">Marketing Manager</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-white p-6 drop-shadow-lg dark:bg-slate-800 hover:bg-slate-200">
              <div className="mb-4 flex">
                {[1, 2, 3, 4].map((star) => (
                  <svg
                    key={star}
                    className="h-5 w-5 fill-amber-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                ))}
              </div>
              <p className="mb-4 text-slate-500">
                {t('landing.testimonial2')}
              </p>
              <div className="flex items-center gap-2">
                <img
                  src="https://xsgames.co/randomusers/assets/avatars/male/75.jpg"
                  alt="User"
                  className="h-10 w-10 rounded-full"
                />
                <div>
                  <p className="font-medium">Michael Chen</p>
                  <p className="text-sm text-slate-500">Software Engineer</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-white p-6 drop-shadow-lg dark:bg-slate-800 hover:bg-slate-200">
              <div className="mb-4 flex">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className="h-5 w-5 fill-amber-400"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                  </svg>
                ))}
              </div>
              <p className="mb-4 text-slate-500">
                {t('landing.testimonial3')}
              </p>
              <div className="flex items-center gap-2">
                <img
                  src="https://xsgames.co/randomusers/assets/avatars/female/67.jpg"
                  alt="User"
                  className="h-10 w-10 rounded-full"
                />
                <div>
                  <p className="font-medium">Jessica Rodriguez</p>
                  <p className="text-sm text-slate-500">Freelance Designer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 text-slate-50 revealing-image">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
            {t('landing.finalCta')}
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-950-foreground/80">
            {t('landing.finalCtaDesc')}
          </p>
          <Button size="lg" variant="secondary" className="hover:scale-110">
            <Link to={RoutePaths.Auth + "/" + RoutePaths.Signup}>
              {t('landing.getStarted')}
            </Link>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="mt-4 text-sm text-slate-950-foreground/70">
            {t('landing.noCreditCard')}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-12 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <Logo size="sm" variant="default" />
            </div>
            <div className="flex gap-8">
              <Link to="#" className="text-sm text-slate-500 hover:text-slate-900">
                {t('landing.features')}
              </Link>
              <Link to={RoutePaths.Upgrade} className="text-sm text-slate-500 hover:text-slate-900">
                {t('landing.pricing')}
              </Link>
              <Link to="#" className="text-sm text-slate-500 hover:text-slate-900">
                {t('landing.blog')}
              </Link>
              <Link to={RoutePaths.ContactSales} className="text-sm text-slate-500 hover:text-slate-900">
                {t('landing.support')}
              </Link>
            </div>
            <div className="flex gap-4">
              <Link to="#" className="text-slate-500 hover:text-slate-900">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                </svg>
              </Link>
              <Link to="#" className="text-slate-500 hover:text-slate-900">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </Link>
              <Link to="#" className="text-slate-500 hover:text-slate-900">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
                </svg>
              </Link>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} {t('app.name')}. {t('landing.allRightsReserved')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

