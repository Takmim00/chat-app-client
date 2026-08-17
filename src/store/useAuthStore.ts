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

export const useAuthStore = create<AuthState>((set) => {
  const initialUser = getStoredUser();
  const initialToken = getStoredToken();
  const hasAuth = Boolean(initialUser && initialToken);

  return {
    user: initialUser,
    token: initialToken,
    isAuthenticated: hasAuth,
    isLoading: false,

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
      const storedUser = getStoredUser();

      if (!token) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('aurora_user');
        }
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        return;
      }

      try {
        const data = await fetchApi('/auth/me');
        if (data.user && typeof window !== 'undefined') {
          localStorage.setItem('aurora_user', JSON.stringify(data.user));
        }
        set({ user: data.user, token, isAuthenticated: true, isLoading: false });
      } catch (err: any) {
        const msg = err?.message || '';
        // Only logout if explicit 401 token invalid error or user deleted
        if (msg.includes('401') || msg.includes('Invalid') || msg.includes('expired') || msg.includes('User not found')) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('aurora_token');
            localStorage.removeItem('aurora_user');
          }
          set({ user: null, token: null, isAuthenticated: false, isLoading: false });
        } else {
          // Keep existing local user session active on minor network glitches / backend wake-up
          if (storedUser && token) {
            set({ user: storedUser, token, isAuthenticated: true, isLoading: false });
          } else {
            set({ isLoading: false });
          }
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
  };
});
