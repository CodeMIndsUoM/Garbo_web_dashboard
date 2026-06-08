import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-[color,box-shadow] outline-none",
        "placeholder:text-gray-400 selection:bg-primary selection:text-primary-foreground",
        "focus-visible:border-green-500 focus-visible:ring-green-500/25 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60",
        "aria-invalid:border-red-400 aria-invalid:ring-red-500/20",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "dark:bg-input/30 dark:border-input",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
