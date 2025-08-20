import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { PlayerStats } from "@/components/stats/player-stats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useParams } from "wouter";
import { useUser } from "@/context/UserContext";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

const profileSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  bio: z.string().max(160, "Bio must not exceed 160 characters").optional(),
  solanaAddress: z.string().min(32, "Invalid Solana address"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function Profile() {
  const { username: urlUsername } = useParams();
  const { username, solanaAddress, updateUser, clearUserData } = useUser();
  const { toast } = useToast();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: "",
      bio: "",
      solanaAddress: "",
    },
    mode: "onChange",
  });

  const { data: profile } = useQuery<{
    username: string;
    bio?: string;
    followerCount: number;
    followingCount: number;
  }>({
    queryKey: ['/api/profile'],
    placeholderData: {
      username: username || 'Crypto Miner',
      bio: '',
      followerCount: 0,
      followingCount: 0
    }
  });

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      console.log('Form submitted:', values);

      // Compare with existing values
      const hasUsernameChanged = values.username.trim() && values.username.trim() !== username;
      const hasAddressChanged = values.solanaAddress.trim() && values.solanaAddress.trim() !== solanaAddress;

      if (!hasUsernameChanged && !hasAddressChanged) {
        toast({
          title: "No Changes Detected",
          description: "Please make changes to your username or Solana address before saving",
          variant: "destructive",
        });
        return;
      }

      // Only include fields that have changed
      const updates: { username?: string; solanaAddress?: string } = {};
      if (hasUsernameChanged) {
        updates.username = values.username.trim();
      }
      if (hasAddressChanged) {
        updates.solanaAddress = values.solanaAddress.trim();
      }

      toast({
        title: "Saving...",
        description: "Updating your profile settings",
      });

      await updateUser(updates);

      toast({
        title: "Success",
        description: "Profile settings updated successfully",
      });

      // Reset form after successful update
      form.reset({
        username: "",
        bio: "",
        solanaAddress: "",
      });

    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update settings",
        variant: "destructive",
      });
    }
  };

  const handleClearData = () => {
    clearUserData();
    form.reset({
      username: "",
      bio: "",
      solanaAddress: "",
    });
    toast({
      title: "Data Cleared",
      description: "All user data has been removed",
    });
  };

  return (
    <div className="w-full min-h-screen bg-[#09060e] overflow-hidden pt-20">
      <Header title="Profile" />

      <div className="px-4">
        <Card className="bg-card/80 p-[4px] relative rounded-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#41BEEE] to-[#FF3EFF] opacity-75" />
          <div className="relative bg-card/95 rounded-lg p-4">
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-[#1a2641]">
                <TabsTrigger value="profile" className="data-[state=active]:text-slate-900 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff3eff] data-[state=active]:to-[#41beee] transition-colors">
                  User Stats
                </TabsTrigger>
                <TabsTrigger value="settings" className="data-[state=active]:text-slate-900 data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#ff3eff] data-[state=active]:to-[#41beee] transition-colors">
                  User Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="mt-4">
                {/* Profile Content */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-[#1a2641] rounded-[14px]">
                      <Avatar className="h-16 w-16 rounded" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-[#c0cae1] text-xl font-bold">{username || "Crypto Miner"}</h2>
                      <p className="text-[#848da2] text-sm">{profile?.bio || "No bio yet"}</p>
                      <div className="flex gap-4 mt-2">
                        <div>
                          <span className="text-[#c0cae1] font-semibold">{profile?.followerCount}</span>
                          <span className="text-[#848da2] text-sm ml-1">Followers</span>
                        </div>
                        <div>
                          <span className="text-[#c0cae1] font-semibold">{profile?.followingCount}</span>
                          <span className="text-[#848da2] text-sm ml-1">Following</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <PlayerStats />
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#c0cae1]">Username</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter new username"
                              className="bg-[#1a2641] border-[#414D6A]/20 text-[#c0cae1]"
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
                              placeholder="Enter new Solana address"
                              className="bg-[#1a2641] border-[#414D6A]/20 text-[#c0cae1]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#c0cae1]">Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Tell us about yourself"
                              className="bg-[#1a2641] border-[#414D6A]/20 text-[#c0cae1]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-4">
                      <Button
                        type="submit"
                        className="flex-1 bg-gradient-to-r from-[#ff3eff] to-[#41beee] text-slate-900 font-bold hover:opacity-90 transition-all duration-200 active:text-white active:bg-[#1a2641] disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!form.formState.isDirty || form.formState.isSubmitting}
                      >
                        {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
                      </Button>

                      <Button
                        type="button"
                        onClick={handleClearData}
                        variant="destructive"
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </div>
        </Card>
      </div>
    </div>
  );
}