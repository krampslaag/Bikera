import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/header";

export default function GeneralSettings() {
  return (
    <div className="w-full min-h-screen bg-[#09060e] overflow-hidden pt-20">
      <Header title="General Settings" />

      <div className="container mx-auto px-4 space-y-10">
        <Button 
          className="w-full h-12 bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-slate-900 font-bold uppercase hover:opacity-90 transition-opacity duration-200 active:opacity-100"
        >
          Network Settings
        </Button>

        <Button 
          className="w-full h-12 bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-slate-900 font-bold uppercase hover:opacity-90 transition-opacity duration-200 active:opacity-100"
        >
          Security Settings
        </Button>

        <Button 
          className="w-full h-12 bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-slate-900 font-bold uppercase hover:opacity-90 transition-opacity duration-200 active:opacity-100"
        >
          Display Settings
        </Button>

        <Button 
          className="w-full h-12 bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-slate-900 font-bold uppercase hover:opacity-90 transition-opacity duration-200 active:opacity-100"
        >
          Notification Settings
        </Button>

        <Button 
          className="w-full h-12 bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-slate-900 font-bold uppercase hover:opacity-90 transition-opacity duration-200 active:opacity-100"
        >
          Advanced Settings
        </Button>
      </div>
    </div>
  );
}