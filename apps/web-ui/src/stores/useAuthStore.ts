import { create } from "zustand";
import { persist } from "zustand/middleware";

type AuthUser = {
  id: string;
  email: string;
};

export type AuthProvider = "apple" | "kakao" | "naver";

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  provider: AuthProvider | null;
  apiOrigin: string | null;
};

type AuthActions = {
  setAuthToken: (token: string | null) => void;
  setAuthUser: (user: AuthUser | null) => void;
  setAuthProvider: (provider: AuthProvider | null) => void;
  setAuthApiOrigin: (apiOrigin: string | null) => void;
  clearAuth: () => void;
};

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      provider: null,
      apiOrigin: null,
      setAuthToken: (token) => {
        const nextToken = token?.trim() || null;
        set((state) => ({
          token: nextToken,
          user: state.token === nextToken ? state.user : null,
          provider: state.token === nextToken ? state.provider : null,
          apiOrigin: nextToken ? state.apiOrigin : null,
        }));
      },
      setAuthUser: (user) => {
        set({ user });
      },
      setAuthProvider: (provider) => {
        set({ provider });
      },
      setAuthApiOrigin: (apiOrigin) => {
        set({ apiOrigin: apiOrigin?.trim() || null });
      },
      clearAuth: () => {
        set({
          token: null,
          user: null,
          provider: null,
          apiOrigin: null,
        });
      },
    }),
    {
      name: "focus-web-auth",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        provider: state.provider,
        apiOrigin: state.apiOrigin,
      }),
    }
  )
);

export const selectIsLoggedIn = (state: Pick<AuthState, "token">) => Boolean(state.token);
