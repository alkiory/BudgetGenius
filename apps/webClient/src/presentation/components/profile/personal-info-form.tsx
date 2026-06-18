import { useTranslation } from 'react-i18next';
import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "../ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "../ui/card"
import { Input } from "../ui/input"
import { ProfileAvatar } from "./profile-avatar"
import { Label } from "../ui/label"
import { useSelector, useDispatch } from "react-redux"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateUser } from "@application/user/user.service"
import { updateUserAction } from "@adapters/slices/auth/authSlice"
import { errorToast, successToast } from "@presentation/utils/toast"
import { RootState } from "@adapters/store/rootStore"

// Mock user data
const userData = {
  name: "John",
  surname: "Doe",
  email: "john.doe@example.com",
  phone: "+1 (555) 123-4567",
  address: "123 Main St, Anytown, USA",
  imageUrl: undefined,
}

export function PersonalInfoForm() {
  const { t } = useTranslation();
  const dispatch = useDispatch()
  const queryClient = useQueryClient()
  const user = useSelector((state: RootState) => state.auth.user)
  const [formData, setFormData] = useState(user ? user : userData)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const { mutate: updateUserMutation } = useMutation({
    mutationKey: ["updateUser"],
    mutationFn: updateUser,
    onSuccess: (data) => {
      setIsSaving(true)
      dispatch(updateUserAction(data))
      queryClient.invalidateQueries({ queryKey: ["user"] })
      successToast(t('profile.updateSuccess'), 3000, "user-update");
      setIsEditing(false)
      setIsSaving(false)
    },
    onError: (error) => {
      console.error("Error updating user:", error)
      errorToast(t('profile.updateError'), 3000, "user-update")
      setIsSaving(false)
      setIsEditing(true)
      setFormData(user ? user : userData)
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      updateUserMutation({
        id: Number(user?.id),
        user: formData,
      })
    } catch (error) {
      console.error("Error submitting form:", error)
      errorToast(t('profile.saveError'), 3000, "user-update")
    }
  }

  const handleImageChange = async (file: File) => {
    // Simulate image upload
    await new Promise((resolve) => setTimeout(resolve, 1500))
    console.log("Image uploaded:", file.name)
  }

  useEffect(() => {
    if (formData.name.length > 20) {
      errorToast(t('profile.nameLengthError'), 3000, "user-update-name")
      setFormData((prev) => ({ ...prev, name: prev.name.slice(0, 20) }))
    }
    if (formData.surname && formData.surname.length > 20) {
      errorToast(t('profile.surnameLengthError'), 3000, "user-update-surname")
      setFormData((prev) => ({ ...prev, surname: (prev.surname ?? "").slice(0, 20) }))
    }
  }, [formData])

  return (
    <Card className="bg-card dark:bg-card dark:text-neutral">
      <CardHeader>
        <CardTitle>{t('profile.personalInfo')}</CardTitle>
        <CardDescription>{t('profile.personalInfoDesc')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4 sm:flex-row sm:space-x-6 sm:space-y-0">
            <ProfileAvatar
              imageUrl={formData.imageUrl}
              name={formData.name.split(" ")[0] + " " + (formData.surname?.split(" ")[0] || "")}
              onImageChange={handleImageChange}
            />
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="text-lg font-medium">{formData.name} {formData.surname}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{formData.email}</p>
              {/* <p className="text-xs text-slate-500 dark:text-slate-400">Upload a new photo by clicking on the avatar</p> */}
            </div>
          </div>

          <div className="grid gap-4 pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">{t('profile.name')}</Label>
              <Input id="name" name="name" value={formData.name} onChange={handleChange} disabled={!isEditing} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">{t('profile.surname')}</Label>
              <Input id="surname" name="surname" value={formData.surname} onChange={handleChange} disabled={!isEditing} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('profile.emailAddress')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{t('profile.phoneNumber')}</Label>
              <Input id="phone" name="phone" value={formData.phone} onChange={handleChange} disabled={!isEditing} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t('profile.address')}</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                disabled={!isEditing}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          {isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setFormData(userData)
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t('profile.saving') : t('profile.saveChanges')}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => setIsEditing(true)}>
              {t('profile.editInformation')}
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  )
}
