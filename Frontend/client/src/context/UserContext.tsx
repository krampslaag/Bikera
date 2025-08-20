import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UserContextType {
  username: string | null;
  solanaAddress: string | null;
  updateUser: (data: { username?: string; solanaAddress?: string }) => Promise<void>;
  clearUserData: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Load initial values from localStorage
  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    const storedAddress = localStorage.getItem('solanaAddress');

    if (storedUsername) setUsername(storedUsername);
    if (storedAddress) setSolanaAddress(storedAddress);
  }, []);

  const updateUser = async (data: { username?: string; solanaAddress?: string }) => {
    try {
      if (data.username !== undefined) {
        localStorage.setItem('username', data.username);
        setUsername(data.username);
      }

      if (data.solanaAddress !== undefined) {
        localStorage.setItem('solanaAddress', data.solanaAddress);
        setSolanaAddress(data.solanaAddress);
      }

      // Verify storage was successful
      if (data.username && localStorage.getItem('username') !== data.username) {
        throw new Error('Failed to save username');
      }
      if (data.solanaAddress && localStorage.getItem('solanaAddress') !== data.solanaAddress) {
        throw new Error('Failed to save solana address');
      }

      // Invalidate and refetch all user-related queries
      await queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });

    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  };

  const clearUserData = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('solanaAddress');
    setUsername(null);
    setSolanaAddress(null);
    queryClient.invalidateQueries();
  };

  return (
    <UserContext.Provider value={{ 
      username, 
      solanaAddress, 
      updateUser,
      clearUserData
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}