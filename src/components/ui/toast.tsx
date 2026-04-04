"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type ToastVariant = "default" | "destructive" | "success";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto relative flex w-80 items-start gap-3 rounded-lg border p-4 shadow-lg transition-all animate-in slide-in-from-bottom-5",
              toast.variant === "destructive" && "border-destructive bg-destructive text-destructive-foreground",
              toast.variant === "success" && "border-emerald-500 bg-emerald-50 text-emerald-900",
              (!toast.variant || toast.variant === "default") && "border-border bg-background text-foreground"
            )}
          >
            <div className="flex-1">
              {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
              {toast.description && <p className="text-sm opacity-90">{toast.description}</p>}
            </div>
            <button onClick={() => removeToast(toast.id)} className="opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  return { toast: context.addToast, dismiss: context.removeToast, toasts: context.toasts };
}
