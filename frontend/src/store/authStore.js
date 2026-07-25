import { create } from 'zustand';
import api from '../api/axios';

/**
 * Auth store (Zustand)
 *
 * Persists user + token in memory (token also in localStorage for the axios
 * interceptor). On app boot, `bootstrap()` re-fetches /api/auth/me using the
 * stored token to rehydrate the user object without a fresh login.
 */
const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('streakup_token') || null,
  loading: true, // true until bootstrap() resolves
  error: null,

  /** Called once on app mount to rehydrate session from stored token. */
  bootstrap: async () => {
    const token = get().token;
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const { data } = await api.get('/api/auth/me');
      set({ user: data, loading: false });
    } catch {
      // Token invalid/expired — clear it
      localStorage.removeItem('streakup_token');
      set({ user: null, token: null, loading: false });
    }
  },

  /** Log in: store token, fetch user profile. */
  login: async (email, password) => {
    set({ error: null });
    const { data } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('streakup_token', data.token);
    set({ token: data.token, user: data.user });
    return data;
  },

  /** Register: same flow as login. */
  register: async (name, email, password) => {
    set({ error: null });
    const { data } = await api.post('/api/auth/register', { name, email, password });
    localStorage.setItem('streakup_token', data.token);
    set({ token: data.token, user: data.user });
    return data;
  },

  /** Clear session. */
  logout: () => {
    localStorage.removeItem('streakup_token');
    set({ user: null, token: null });
  },

  /** Update user profile fields locally (after a PATCH /api/auth/profile). */
  setUser: (user) => set({ user }),
}));

export default useAuthStore;
