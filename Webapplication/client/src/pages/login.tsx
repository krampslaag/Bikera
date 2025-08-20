import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Image } from "@/components/ui/image";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { useUser } from "@/context/UserContext";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [_, navigate] = useLocation();
  const { username, solanaAddress, updateUser } = useUser();
  const [localUsername, setLocalUsername] = useState(username || '');
  const [localAddress, setLocalAddress] = useState(solanaAddress || '');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();

  // Check for stored credentials and auto-redirect
  useEffect(() => {
    if (username && solanaAddress) {
      const isMobile = window.innerWidth <= 768;
      navigate(isMobile ? '/active' : '/dashboard');
    }
  }, [navigate, username, solanaAddress]);

  const handleLogin = () => {
    if (localUsername && localAddress) {
      updateUser({
        username: localUsername,
        solanaAddress: localAddress,
      });

      toast({
        title: "Success",
        description: "Successfully logged in",
      });

      const isMobile = window.innerWidth <= 768;
      navigate(isMobile ? '/active' : '/dashboard');
    }
  };

  const isFormFilled = localUsername.length > 0 && localAddress.length > 0;

  return (
    <div className="flex flex-col h-screen bg-[#09060e]">
      <div className="flex-grow flex items-center justify-center h-[50vh]">
        <Image
          src="./images/iMERA_TOKEN.png"
          alt="iMERA Token"
          className="w-48 h-48 md:w-64 md:h-64"
          fallbackSrc="./images/fallback.svg"
        />
      </div>

      <div className="pb-12 px-4">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <Button 
              className="w-full h-12 bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-[#09060e] font-bold hover:opacity-90"
            >
              Begin
            </Button>
          </DrawerTrigger>
          <DrawerContent className="bg-[#09060e] rounded-t-[20px] border-t-2 border-[#414D6A]/20 min-h-[60vh] pb-8">
            <div className="px-4 py-12">
              <div className="space-y-6">
                <div className="relative">
                  <div className="absolute inset-[-1px] bg-gradient-to-r from-[#ff3eff] to-[#41beee] rounded-lg" />
                  <Input
                    type="text"
                    placeholder="Telegram username"
                    value={localUsername}
                    onChange={(e) => setLocalUsername(e.target.value)}
                    className={`relative h-12 w-full bg-[#09060e] rounded-lg ${
                      localUsername.length > 0
                        ? "text-[#c0cae1] border-2 border-[#414D6A]/20"
                        : "text-[#c0cae1] placeholder:text-[#848da2] border-2 border-transparent z-10"
                    }`}
                  />
                </div>
                <div className="relative">
                  <div className="absolute inset-[-1px] bg-gradient-to-r from-[#ff3eff] to-[#41beee] rounded-lg" />
                  <Input
                    type="text"
                    placeholder="Solana address"
                    value={localAddress}
                    onChange={(e) => setLocalAddress(e.target.value)}
                    className={`relative h-12 w-full bg-[#09060e] rounded-lg ${
                      localAddress.length > 0
                        ? "text-[#c0cae1] border-2 border-[#414D6A]/20"
                        : "text-[#c0cae1] placeholder:text-[#848da2] border-2 border-transparent z-10"
                    }`}
                  />
                </div>
                <div className="pt-8">
                  <Button
                    onClick={handleLogin}
                    disabled={!isFormFilled}
                    className={`w-full h-12 font-bold ${
                      isFormFilled
                        ? "bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-[#09060e]"
                        : "bg-[#09060e] text-[#414D6A] border-2 border-[#414D6A]/20"
                    }`}
                  >
                    Login
                  </Button>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </div>
  );
}