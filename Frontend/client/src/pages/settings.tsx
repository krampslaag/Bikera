import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useUser } from "@/context/UserContext";
import { useToast } from "@/hooks/use-toast";

const settingsSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  solanaAddress: z.string().min(32, "Solana address must be at least 32 characters"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { username, solanaAddress, updateUser } = useUser();
  const { toast } = useToast();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      username: username || "",
      solanaAddress: solanaAddress || "",
    },
  });

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      // Attempt to update user data
      await updateUser({
        username: data.username,
        solanaAddress: data.solanaAddress,
      });

      // Verify the data was saved to localStorage
      const savedUsername = localStorage.getItem('username');
      const savedAddress = localStorage.getItem('solanaAddress');

      if (savedUsername !== data.username || savedAddress !== data.solanaAddress) {
        throw new Error("Failed to save settings");
      }

      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#09060e] overflow-hidden pt-[54px]">
      <Header title="Settings" />

      <div className="px-4">
        <Card className="bg-card/80 p-[4px] relative rounded-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
          <div className="relative bg-card/95 rounded-lg p-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-[#1a2641] rounded-[14px]">
                    <Avatar className="h-16 w-16 rounded" />
                  </div>
                  <div>
                    <h2 className="text-[#c0cae1] text-lg font-bold">Profile Settings</h2>
                    <p className="text-[#848da2] text-sm">Update your profile information</p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#c0cae1]">Username</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          className="bg-[#1a2641] border-[#414D6A]/20 text-[#c0cae1]"
                          placeholder="Enter your username"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="solanaAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[#c0cae1]">Solana Address</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          className="bg-[#1a2641] border-[#414D6A]/20 text-[#c0cae1]"
                          placeholder="Enter your Solana address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-slate-900 font-bold hover:opacity-90 transition-all duration-200 active:text-white active:bg-[#1a2641] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Changes
                </Button>
              </form>
            </Form>
          </div>
        </Card>
      </div>
    </div>
  );
}