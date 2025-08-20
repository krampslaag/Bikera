// src/App.tsx
import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  View,
  StatusBar,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import SplashScreen from 'react-native-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Services
import AuthService from './services/AuthService';
import CloudFlareAPI from './services/CloudFlareAPI';

// Screens
import LoginScreen from './screens/LoginScreen';
import MainMiningScreen from './screens/MainMiningScreen';
import WalletScreen from './screens/WalletScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import OnboardingScreen from './screens/OnboardingScreen';

// Components
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { NetworkProvider } from './contexts/NetworkContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Custom theme
const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#41BEEE',
    background: '#09060e',
    card: '#1a2641',
    text: '#c0cae1',
    border: '#2a3651',
    notification: '#FF3EFF',
  },
};

const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#41BEEE',
    background: '#f5f5f5',
    card: '#ffffff',
    text: '#333333',
    border: '#e0e0e0',
    notification: '#FF3EFF',
  },
};

// Tab Navigator
const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Mining':
              iconName = focused ? 'pickaxe' : 'pickaxe';
              break;
            case 'Wallet':
              iconName = focused ? 'wallet' : 'wallet-outline';
              break;
            case 'Leaderboard':
              iconName = focused ? 'trophy' : 'trophy-outline';
              break;
            case 'Profile':
              iconName = focused ? 'account' : 'account-outline';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#41BEEE',
        tabBarInactiveTintColor: '#848da2',
        tabBarStyle: {
          backgroundColor: '#1a2641',
          borderTopColor: '#2a3651',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#1a2641',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#2a3651',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen
        name="Mining"
        component={MainMiningScreen}
        options={{
          headerTitle: 'BlockchainVectorMiner',
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          headerTitle: 'Wallet',
        }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          headerTitle: 'Leaderboard',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

// Auth Stack Navigator
const AuthStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#09060e' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  );
};

// Main App Stack
const AppStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          headerStyle: {
            backgroundColor: '#1a2641',
          },
          headerTintColor: '#fff',
          headerTitle: 'Settings',
        }}
      />
    </Stack.Navigator>
  );
};

// Root Navigator
const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean | null>(null);

  useEffect(() => {
    checkFirstLaunch();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const hasLaunched = await AsyncStorage.getItem('hasLaunched');
      if (hasLaunched === null) {
        setIsFirstLaunch(true);
        await AsyncStorage.setItem('hasLaunched', 'true');
      } else {
        setIsFirstLaunch(false);
      }
    } catch (error) {
      console.error('Error checking first launch:', error);
      setIsFirstLaunch(false);
    }
  };

  if (isLoading || isFirstLaunch === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09060e' }}>
        <ActivityIndicator size="large" color="#41BEEE" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isFirstLaunch && (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      )}
      {isAuthenticated ? (
        <Stack.Screen name="App" component={AppStack} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
};

// Main App Component
const App: React.FC = () => {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize services
      await AuthService.validateSession();
      
      // Hide splash screen
      SplashScreen.hide();
      
      setIsReady(true);
    } catch (error) {
      console.error('App initialization error:', error);
      SplashScreen.hide();
      setIsReady(true);
    }
  };

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <NetworkProvider>
            <NavigationContainer
              theme={colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme}
            >
              <StatusBar
                barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'}
                backgroundColor={colorScheme === 'dark' ? '#09060e' : '#f5f5f5'}
              />
              <RootNavigator />
            </NavigationContainer>
          </NetworkProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default App;