import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localPhone } from "@/lib/validation";

export function Field({
  label, htmlFor, error, hint, required, labelAside, className, children,
}: {
  label: string;
  /** shown at the right end of the label row, e.g. a "Forgot your password?" link */
  labelAside?: React.ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="text-[13px] font-medium text-navy-900">
          {label}
          {required && <span className="text-brand-red" aria-hidden> *</span>}
        </Label>
        {labelAside}
      </div>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Native select styled like <Input>: native pickers on phones, works in plain GET forms. */
export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full appearance-none rounded-xl border border-input bg-white bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%235b6478%22><path d=%22M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z%22/></svg>')] bg-[length:1.1rem] bg-[right_0.6rem_center] bg-no-repeat pr-9 pl-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

/** Phone field with a fixed +63 prefix: people type only their number (917 123 4567). The server normalises it. */
export function PhoneInput({ className, value, defaultValue, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-base text-muted-foreground md:text-sm" aria-hidden>+63</span>
      <Input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="917 123 4567" className={cn("pl-12", className)}
        value={typeof value === "string" ? localPhone(value) : value} defaultValue={typeof defaultValue === "string" ? localPhone(defaultValue) : defaultValue} {...props} />
    </div>
  );
}
