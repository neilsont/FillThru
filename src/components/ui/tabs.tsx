"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextType {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextType>({ value: "", setValue: () => {} });

function Tabs({ defaultValue, value: controlledValue, onValueChange, className, children, ...props }: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? "");
  const value = controlledValue ?? uncontrolledValue;
  const setValue = onValueChange ?? setUncontrolledValue;
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className} {...props}>{children}</div>
    </TabsContext.Provider>
  );
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}
      {...props}
    />
  );
}

function TabsTrigger({ value, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { value: selectedValue, setValue } = React.useContext(TabsContext);
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        selectedValue === value && "bg-background text-foreground shadow-sm",
        className
      )}
      onClick={() => setValue(value)}
      {...props}
    />
  );
}

function TabsContent({ value, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { value: selectedValue } = React.useContext(TabsContext);
  if (selectedValue !== value) return null;
  return (
    <div
      className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
