"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
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
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "calc(var(--radius) * 1.1)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "cn-toast premium-card !ring-1 !ring-border/80 !shadow-[0_4px_16px_-6px_color-mix(in_oklch,black_18%,transparent),0_1px_0_0_color-mix(in_oklch,white_50%,transparent)_inset] dark:!shadow-[0_8px_24px_-8px_black]",
          title: "font-heading !text-[13.5px] !font-medium tracking-tight",
          description: "!text-[12px] !text-muted-foreground",
          actionButton: "!font-medium",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
