import { create } from "zustand";
export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  hydrated: false,
  setSession: ({ user, accessToken }) => set({ user, accessToken, hydrated: true }),
  clear: () => set({ user: null, accessToken: null, hydrated: true }),
  setHydrated: () => set({ hydrated: true })
}));
