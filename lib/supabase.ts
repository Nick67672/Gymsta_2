import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Enhanced storage implementation for web with better error handling
const webStorage = {
  getItem: async (key: string) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage is not available');
      }
      const item = localStorage.getItem(key);
      return Promise.resolve(item);
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return Promise.reject(error);
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage is not available');
      }
      localStorage.setItem(key, value);
      return Promise.resolve();
    } catch (error) {
      console.error('Error setting localStorage:', error);
      return Promise.reject(error);
    }
  },
  removeItem: async (key: string) => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        throw new Error('localStorage is not available');
      }
      localStorage.removeItem(key);
      return Promise.resolve();
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return Promise.reject(error);
    }
  },
};

// Create Supabase client with enhanced configuration
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: false,
      autoRefreshToken: true,
      storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
    },
    global: {
      headers: {
        'X-Client-Info': 'expo-router',
      },
    },
    // Enhanced realtime configuration for better React Native compatibility
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
      // Add heartbeat and connection handling for React Native
      heartbeatIntervalMs: 30000,
      reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
      // Enable logger for debugging connection issues
      logger: __DEV__ ? console.log : undefined,
    },
  }
);