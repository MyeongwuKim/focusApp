import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthUser = {
  id: string;
  email: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
};

type AuthActions = {
  setAuthToken: (token: string | null) => void;
  setAuthUser: (user: AuthUser | null) => void;
  clearAuth: () => void;
};

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuthToken: (token) => {
        set({ token: token?.trim() || null });
      },
      setAuthUser: (user) => {
        set({ user });
      },
      clearAuth: () => {
        set({
          token: null,
          user: null,
        });
      },
    }),
    {
      name: "focus-web-auth",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
);
