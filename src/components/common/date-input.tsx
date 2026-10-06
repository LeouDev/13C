"use client";

import { useState } from "react";
import { cn } from "cn";

/**
 * A date field that shows `placeholder` (e.g. "Any date") while empty: iPhones show an empty date field as a blank
 * box, and computers a bare mm/dd/yyyy. Tapping it still opens the phone's own date picker.
 */
export function DateInput({ placeholder, className, defaultValue = "", ...props }:
  Omit<React.ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & { placeholder: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [shown, setShown] = useState(defaultValue);
  if (defaultValue !== shown) { setShown(defaultValue); setValue(defaultValue); } // a new search brings its own dates
  return (
    <span className="relative block">
      <input type="date" {...props} value={value} onChange={(e) => setValue(e.target.value)}
        className={cn("peer", className, !value && "[&:not(:focus)]:text-transparent")} />
      {!value && (
        <span aria-hidden className={cn(className, "pointer-events-none absolute inset-0 flex items-center border-transparent bg-transparent peer-focus:hidden")}>
          {placeholder}
        </span>
      )}
    </span>
  );
}
