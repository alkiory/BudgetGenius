import { loginAction, setUser } from "@adapters/slices/auth/authSlice";
import { googleLogin } from "@application/auth/auth.service";
import { RoutePaths } from "@presentation/utils/routes";
import { errorToast, successToast } from "@presentation/utils/toast";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";

export function SocialLoginButtons() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const { mutate: signInWithGoogle } = useMutation({
    mutationKey: ["google-auth"],
    mutationFn: googleLogin,
    onSuccess: (data: any) => {
      if (data?.user) {
        dispatch(setUser(data.user));
      }
      dispatch(loginAction());
      successToast("Autenticación exitosa");
      setLoading(true);
      setTimeout(() => {
        navigate(RoutePaths.App + "/" + RoutePaths.Dashboard);
        setLoading(false);
      }, 1000);
    },
    onError: (error) => {
      errorToast(error.message);
    },
  });

  const handleLoginWithGoogle = () => {
    try {
      signInWithGoogle();
    } catch (error) {
      console.error("Google auth error:", error);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <svg
          className="animate-spin h-8 w-8 text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            strokeWidth="4"
            stroke="currentColor"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2.93 6.364A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3.93-1.574zM12 20a8 8 0 008-8h4c0 5.627-4.373 10-10 10v-4zm6.364-2.93A7.962 7.962 0 0120 12h4c0 3.042 1.135 5.824-3 7.938l-3.636-1.868zM12 4a8 8 0 00-8 8H0c0-5.627 4.373-10 10-10v4zm2.93-.636A7.962 7.962 0 0112 4V0c3.042 0 5.824 1.135 7.938 3l-1.574 3.93z"
          ></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="flex">
      <Button
        onClick={handleLoginWithGoogle}
        variant="outline"
        className="bg-white w-full"
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
          <path d="M1 1h22v22H1z" fill="none" />
        </svg>
        Google
      </Button>
    </div>
  );
}
