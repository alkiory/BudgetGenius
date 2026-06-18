import { Toaster } from "react-hot-toast";

export default function ToastConfig() {
  return (
    <Toaster
      position="top-center"
      reverseOrder={false}
      gutter={8}
      containerClassName=""
      containerStyle={{}}
      toastOptions={{
        className: "bg-card dark:bg-card dark:text-neutral",
        duration: 5000,
        removeDelay: 1000,
        success: {
          duration: 3000,
          iconTheme: {
            primary: "green",
            secondary: "white",
          },
        },
        error: {
          iconTheme: {
            primary: "red",
            secondary: "white",
          },
        },
      }}
    />
  );
}
