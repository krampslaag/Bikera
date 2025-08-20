import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  gradient?: boolean;
}

export function Container({ children, gradient = true, className, ...props }: ContainerProps) {
  return (
    <div
      className={cn(
        "relative bg-card/95 rounded-lg p-4 overflow-hidden shadow-[inset_0px_0px_4px_3px_rgba(255,62,255,0.21)] shadow-[inset_0px_-2px_4px_1px_rgba(71,186,239,0.40)] border-2 border-white/10",
        className
      )}
      {...props}
    >
      {children}
      {gradient && (
        <div className="absolute inset-0 bg-gradient-to-bl from-[#ff3eff] to-[#41beee] opacity-10 blur-[24px] -z-10" />
      )}
    </div>
  );
}
