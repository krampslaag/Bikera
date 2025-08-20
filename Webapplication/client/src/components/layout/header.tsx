import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { ConnectionStatus } from "@/components/websocket/connection-status";

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  rightContent?: React.ReactNode;
}

export function Header({ title, showBackButton = true, rightContent }: HeaderProps) {
  const [location, navigate] = useLocation();

  const handleBack = () => {
    window.history.back();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Header bar with blur effect */}
      <div className="w-full h-[54px] bg-slate-900/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {showBackButton ? (
            <Button 
              variant="ghost" 
              className="p-1.5 bg-[#1a2641] hover:bg-[#FF3EFF] hover:text-slate-900 transition-all"
              onClick={handleBack}
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          ) : (
            <div className="w-9" aria-hidden="true" />
          )}

          <span className="text-[#c0cae1] text-base font-semibold font-['Inter'] uppercase">
            {title}
          </span>
        </div>

        {rightContent || (
          <ConnectionStatus className="w-auto" />
        )}
      </div>
    </header>
  );
}