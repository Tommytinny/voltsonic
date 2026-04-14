import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner";
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      duration={8000}
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "hsl(var(--midnight-light) / 0.96)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "hsl(var(--primary) / 0.2)",
          "--border-radius": "var(--radius)"
        }
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast border bg-[hsl(var(--midnight-light)/0.96)] shadow-[0_10px_30px_hsl(var(--midnight)/0.45)] backdrop-blur-md",
          title: "font-semibold text-foreground",
          description: "text-muted-foreground",
        },
      }}
      {...props} />
  );
}

export { Toaster }
