import { useTranslation } from 'react-i18next';
import type React from "react"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Button } from "../ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { useMutation } from "@tanstack/react-query"
import { updateUser } from "@application/user/user.service"
import { errorToast, successToast } from "@presentation/utils/toast"
import { isValidPassword, UserPasswordNotMatchError, UserPasswordNotValidError } from "@domain/user/UserPassword"
import { useSelector } from "react-redux"
import { RootState } from "@adapters/store/rootStore"

export function SecuritySettings() {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user)
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    setError(null)
    setSuccess(null)
  }

  const { mutate: updatePasswordMutation } = useMutation({
    mutationKey: ["updateUser"],
    mutationFn: updateUser,
    onSuccess: (data) => {
      console.debug(data)
      setIsSaving(true)
      successToast(t('profile.passwordUpdateSuccess'), 3000, "password-update");
      setIsSaving(false)
      setFormData({
        newPassword: "",
        confirmPassword: "",
      })
    },
    onError: (error: unknown & { response: { data: { message: string } } }) => {
      console.error(error)
      setError(error?.response?.data?.message)
      errorToast(error?.response?.data?.message, 3000, "password-update")
      setIsSaving(false)
    }
  })

  const togglePasswordVisibility = (field: "current" | "new" | "confirm") => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValidPassword(formData.newPassword)) {
      setError(UserPasswordNotValidError().message)
      return
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError(UserPasswordNotMatchError().message)
      return
    }

    updatePasswordMutation({
      id: Number(user?.id),
      user: {
        password: formData.newPassword,
      },
    })
  }

  return (
    <Card className="bg-card dark:bg-card dark:text-neutral">
      <CardHeader>
        <CardTitle>{t('profile.securitySettings')}</CardTitle>
        <CardDescription>{t('profile.securitySettingsDesc')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-3 text-sm text-green-600 dark:bg-green-900/30 dark:text-green-400">
              {success}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
            <div className="relative">
              <Input
                id="newPassword"
                name="newPassword"
                type={showPasswords.new ? "text" : "password"}
                value={formData.newPassword}
                onChange={handleChange}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                onClick={() => togglePasswordVisibility("new")}
              >
                {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('profile.passwordHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('profile.confirmNewPassword')}</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPasswords.confirm ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                onClick={() => togglePasswordVisibility("confirm")}
              >
                {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t('profile.updating') : t('profile.updatePassword')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
