"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  defaultValue?: string;
}

const SelectContext = React.createContext<{
  value: string;
  setValue: (v: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
}>({ value: "", setValue: () => {}, open: false, setOpen: () => {} });

function Select({ value: controlledValue, onValueChange, defaultValue = "", children }: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const value = controlledValue ?? uncontrolledValue;
  const setValue = (v: string) => {
    onValueChange?.(v);
    if (controlledValue === undefined) setUncontrolledValue(v);
    setOpen(false);
  };
  return <SelectContext.Provider value={{ value, setValue, open, setOpen }}>{children}</SelectContext.Provider>;
}

function SelectTrigger({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = React.useContext(SelectContext);
  return (
    <button
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={() => setOpen(!open)}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = React.useContext(SelectContext);
  return <span className={cn(!value && "text-muted-foreground")}>{value || placeholder}</span>;
}

function SelectContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { open, setOpen } = React.useContext(SelectContext);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, setOpen]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function SelectItem({ value, children, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { value: selectedValue, setValue } = React.useContext(SelectContext);
  return (
    <div
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-secondary",
        selectedValue === value && "bg-secondary",
        className
      )}
      onClick={() => setValue(value)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
