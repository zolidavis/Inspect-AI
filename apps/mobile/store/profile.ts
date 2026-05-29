/**
 * Local user profile (Zustand + AsyncStorage).
 *
 * Today this gates the app on the welcome screen; later it'll link to
 * server-side inspector records. Same shape as the Wishbone profile
 * store — the `provider` field flips to "google" on real OAuth sign-in.
 */
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AuthProvider = "local" | "apple" | "google";

export interface Profile {
  displayName: string;
  email: string;
  /** Auth provider that produced this profile. "local" = no real auth yet. */
  provider: AuthProvider;
  /** Provider-issued user id when applicable. Empty for local profiles. */
  providerUserId: string;
  createdAt: string;
  updatedAt: string;
}

interface ProfileStore {
  profile: Profile | null;
  signedIn: boolean;
  /** False until the AsyncStorage read completes. Used to avoid flashing
   *  the welcome screen for an already-onboarded user on cold start. */
  hydrated: boolean;
  saveProfile: (patch: {
    displayName: string;
    email?: string;
    provider?: AuthProvider;
    providerUserId?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = "inspect-ai:profile-v1";

export const useProfile = create<ProfileStore>((set, get) => ({
  profile: null,
  signedIn: false,
  hydrated: false,

  saveProfile: async ({ displayName, email, provider, providerUserId }) => {
    const now = new Date().toISOString();
    const existing = get().profile;
    const next: Profile = {
      displayName: displayName.trim(),
      email: (email ?? existing?.email ?? "").trim(),
      provider: provider ?? existing?.provider ?? "local",
      providerUserId: providerUserId ?? existing?.providerUserId ?? "",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    set({ profile: next, signedIn: next.displayName.length > 0 });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  },

  signOut: async () => {
    set({ profile: null, signedIn: false });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Profile;
        set({
          profile: saved,
          signedIn: !!saved?.displayName && saved.displayName.length > 0,
        });
      }
    } catch {}
    // Mark hydrated even on error / missing key so the welcome screen
    // can show instead of an infinite loading state.
    set({ hydrated: true });
  },
}));

/** Convenience: first letter of display name, uppercase. Falls back to "?". */
export function initialsFor(profile: Profile | null): string {
  const name = profile?.displayName?.trim() ?? "";
  if (!name) return "?";
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
