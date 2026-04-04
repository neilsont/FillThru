"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Tooltip({ children, content }: { children: React.ReactNode; content: string }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div
          className={cn(
            "absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md"
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export { Tooltip };
