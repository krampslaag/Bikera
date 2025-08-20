import { Badge } from "@/components/ui/badge";
import { Wifi } from "lucide-react";

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  // For static deployment, always show connected state
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Badge variant="default">
        <Wifi className="w-3 h-3 mr-1" />
        Connected
      </Badge>
    </div>
  );
}