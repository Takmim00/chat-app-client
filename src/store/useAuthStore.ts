import { create } from 'zustand';
import { User } from '@/types';
import { fetchApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  fetchProfile: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => void;
}

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('aurora_user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('aurora_token');
};

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),
  token: getStoredToken(),
  // Don't trust localStorage alone — start as loading if a token exists,
  // so fetchProfile() can verify it with the server before showing the app
  isAuthenticated: false,
  isLoading: Boolean(getStoredToken()),

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aurora_token', token);
      localStorage.setItem('aurora_user', JSON.stringify(user));
    }
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aurora_token');
      localStorage.removeItem('aurora_user');
    }
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  fetchProfile: async () => {
    const token = localStorage.getItem('aurora_token');
    if (!token) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('aurora_user');
      }
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      return;
    }

    // Show loading screen while verifying token with the server
    set({ isLoading: true });

    try {
      const data = await fetchApi('/auth/me');
      if (data.user && typeof window !== 'undefined') {
        localStorage.setItem('aurora_user', JSON.stringify(data.user));
      }
      set({ user: data.user, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      // Only logout if explicit 401 token invalid error
      if (err.message && err.message.includes('401')) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('aurora_token');
          localStorage.removeItem('aurora_user');
        }
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      } else {
        // Keep existing user session active on minor network glitches
        set({ isLoading: false });
      }
    }
  },

  updateUser: (updatedUser) => {
    set((state) => {
      const newUser = state.user ? { ...state.user, ...updatedUser } : null;
      if (newUser && typeof window !== 'undefined') {
        localStorage.setItem('aurora_user', JSON.stringify(newUser));
      }
      return { user: newUser };
    });
  },
}));
