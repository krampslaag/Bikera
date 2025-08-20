// src/services/AuthService.ts
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Configuration - These should be in environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
}

interface UserProfile {
  id: string;
  username: string;
  wallet_address: string;
  telegram_id?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  total_distance: number;
  total_rewards: number;
  blocks_mined: number;
  rank?: number;
}

class AuthService {
  private supabase: SupabaseClient;
  private authStateListeners: Set<(state: AuthState) => void> = new Set();
  private currentAuthState: AuthState = {
    user: null,
    session: null,
    loading: false,
    initialized: false,
  };

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    this.initializeAuth();
  }

  // Initialize authentication state
  private async initializeAuth() {
    try {
      this.updateAuthState({ loading: true });

      // Get initial session
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) throw error;

      if (session) {
        this.updateAuthState({
          user: session.user,
          session,
          loading: false,
          initialized: true,
        });
      } else {
        this.updateAuthState({
          user: null,
          session: null,
          loading: false,
          initialized: true,
        });
      }

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event);
        this.updateAuthState({
          user: session?.user || null,
          session,
          loading: false,
          initialized: true,
        });
      });
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      this.updateAuthState({
        user: null,
        session: null,
        loading: false,
        initialized: true,
      });
    }
  }

  // Update auth state and notify listeners
  private updateAuthState(updates: Partial<AuthState>) {
    this.currentAuthState = { ...this.currentAuthState, ...updates };
    this.authStateListeners.forEach(listener => listener(this.currentAuthState));
  }

  // Sign up with email and password
  async signUpWithEmail(
    email: string,
    password: string,
    metadata?: {
      username?: string;
      wallet_address?: string;
      telegram_id?: string;
    }
  ): Promise<{ user: User | null; error: Error | null }> {
    try {
      this.updateAuthState({ loading: true });

      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Create user profile
        await this.createUserProfile(data.user.id, metadata);
      }

      this.updateAuthState({ loading: false });
      return { user: data.user, error: null };
    } catch (error) {
      this.updateAuthState({ loading: false });
      console.error('Sign up error:', error);
      return { user: null, error: error as Error };
    }
  }

  // Sign in with email and password
  async signInWithEmail(
    email: string,
    password: string
  ): Promise<{ user: User | null; error: Error | null }> {
    try {
      this.updateAuthState({ loading: true });

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      this.updateAuthState({ loading: false });
      return { user: data.user, error: null };
    } catch (error) {
      this.updateAuthState({ loading: false });
      console.error('Sign in error:', error);
      return { user: null, error: error as Error };
    }
  }

  // Sign in with wallet
  async signInWithWallet(
    walletAddress: string,
    signature: string
  ): Promise<{ user: User | null; error: Error | null }> {
    try {
      this.updateAuthState({ loading: true });

      // Verify wallet signature on the server
      const response = await fetch(`${SUPABASE_URL}/functions/v1/auth-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          signature,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Wallet authentication failed');
      }

      // Sign in with the returned token
      const { data: authData, error } = await this.supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (error) throw error;

      this.updateAuthState({ loading: false });
      return { user: authData.user, error: null };
    } catch (error) {
      this.updateAuthState({ loading: false });
      console.error('Wallet sign in error:', error);
      return { user: null, error: error as Error };
    }
  }

  // Sign in with Telegram
  async signInWithTelegram(
    telegramData: {
      id: string;
      first_name: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      auth_date: number;
      hash: string;
    }
  ): Promise<{ user: User | null; error: Error | null }> {
    try {
      this.updateAuthState({ loading: true });

      // Verify Telegram data on the server
      const response = await fetch(`${SUPABASE_URL}/functions/v1/auth-telegram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(telegramData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Telegram authentication failed');
      }

      // Sign in with the returned token
      const { data: authData, error } = await this.supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (error) throw error;

      this.updateAuthState({ loading: false });
      return { user: authData.user, error: null };
    } catch (error) {
      this.updateAuthState({ loading: false });
      console.error('Telegram sign in error:', error);
      return { user: null, error: error as Error };
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      this.updateAuthState({ loading: true });
      
      const { error } = await this.supabase.auth.signOut();
      
      if (error) throw error;

      // Clear local storage
      await AsyncStorage.multiRemove([
        'authToken',
        'userId',
        'userProfile',
        'miningSession',
      ]);

      this.updateAuthState({
        user: null,
        session: null,
        loading: false,
      });
    } catch (error) {
      console.error('Sign out error:', error);
      this.updateAuthState({ loading: false });
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    return this.currentAuthState.user;
  }

  // Get current session
  getCurrentSession(): Session | null {
    return this.currentAuthState.session;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.currentAuthState.user && !!this.currentAuthState.session;
  }

  // Get user profile
  async getUserProfile(userId?: string): Promise<UserProfile | null> {
    try {
      const id = userId || this.currentAuthState.user?.id;
      if (!id) return null;

      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      return data as UserProfile;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  // Create user profile
  private async createUserProfile(
    userId: string,
    metadata?: {
      username?: string;
      wallet_address?: string;
      telegram_id?: string;
    }
  ): Promise<void> {
    try {
      const { error } = await this.supabase.from('users').insert({
        id: userId,
        username: metadata?.username || `user_${userId.substring(0, 8)}`,
        wallet_address: metadata?.wallet_address || '',
        telegram_id: metadata?.telegram_id,
        total_distance: 0,
        total_rewards: 0,
        blocks_mined: 0,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to create user profile:', error);
    }
  }

  // Update user profile
  async updateUserProfile(
    updates: Partial<UserProfile>
  ): Promise<UserProfile | null> {
    try {
      const userId = this.currentAuthState.user?.id;
      if (!userId) throw new Error('No authenticated user');

      const { data, error } = await this.supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return data as UserProfile;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      return null;
    }
  }

  // Reset password
  async resetPassword(email: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'blockchainvectorminer://reset-password',
      });

      if (error) throw error;

      Alert.alert(
        'Password Reset',
        'Check your email for the password reset link.',
        [{ text: 'OK' }]
      );

      return { error: null };
    } catch (error) {
      console.error('Password reset error:', error);
      return { error: error as Error };
    }
  }

  // Update password
  async updatePassword(newPassword: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        'Your password has been updated successfully.',
        [{ text: 'OK' }]
      );

      return { error: null };
    } catch (error) {
      console.error('Password update error:', error);
      return { error: error as Error };
    }
  }

  // Add auth state listener
  addAuthStateListener(listener: (state: AuthState) => void): () => void {
    this.authStateListeners.add(listener);
    // Call immediately with current state
    listener(this.currentAuthState);
    // Return unsubscribe function
    return () => {
      this.authStateListeners.delete(listener);
    };
  }

  // Get Supabase client (for direct access if needed)
  getSupabaseClient(): SupabaseClient {
    return this.supabase;
  }
}

export default new AuthService();
export { AuthService, AuthState, UserProfile };