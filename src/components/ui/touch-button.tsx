import type {ButtonHTMLAttributes, ReactNode} from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-loxam-red text-white active:bg-loxam-red-dark disabled:bg-loxam-line disabled:text-loxam-muted",
  secondary:
    "bg-white text-loxam-black border-2 border-loxam-black active:bg-loxam-paper",
  ghost: "bg-transparent text-loxam-black border-2 border-loxam-line",
  danger: "bg-loxam-occupied-soft text-loxam-occupied border-2 border-loxam-occupied",
};

export function TouchButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-16 w-full items-center justify-center px-5 text-lg font-black tracking-wide uppercase disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
