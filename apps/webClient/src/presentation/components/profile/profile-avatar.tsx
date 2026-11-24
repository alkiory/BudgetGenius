import { BrandDots } from "@presentation/components/loader";
import { Camera } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface ProfileAvatarProps {
  imageUrl?: string;
  name: string;
  onImageChange?: (file: File) => Promise<void>;
}

export function ProfileAvatar({
  imageUrl,
  name,
  onImageChange,
}: ProfileAvatarProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(imageUrl);

  // Get initials from name
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageChange) return;

    try {
      setIsUploading(true);

      // Create a preview URL
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload the file
      await onImageChange(file);
    } catch (error) {
      console.error("Error uploading image:", error);
      // Reset preview on error
      setPreviewUrl(imageUrl);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-full">
      {previewUrl ? (
        <img
          src={previewUrl || "/placeholder.svg"}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-teal-500/10 text-xl font-medium text-teal-600 dark:bg-teal-400/15 dark:text-teal-400">
          {initials}
        </div>
      )}

      {onImageChange && (
        <label
          htmlFor="avatar-upload"
          className={`"absolute inset-0 flex cursor-pointer items-center justify-center bg-black bg-opacity-50 opacity-0 transition-opacity hover:opacity-100",
            ${isUploading ? "opacity-100" : ""}`}
        >
          {isUploading ? (
            <BrandDots size="md" className="text-white" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      )}
    </div>
  );
}
