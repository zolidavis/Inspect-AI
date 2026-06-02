/**
 * Local user profile (Zustand + AsyncStorage).
 *
 * Stores both the auth identity (displayName + email from OAuth) AND
 * the licensed-inspector info (inspectorName + inspectorLicense) that
 * stamps onto every inspection. Type-once, applies forever (until
 * sign-out or storage clear).
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
  /**
   * Licensed name on the inspector's FL license. Often matches displayName
   * but can differ ("John Smith" vs "John A. Smith Jr."). Falls back to
   * displayName when empty.
   */
  inspectorName: string;
  /** FL inspector license / certificate number. Stamped on every report. */
  inspectorLicense: string;
  createdAt: string;
  updatedAt: string;
}

interface ProfileStore {
  profile: Profile | null;
  signedIn: boolean;
  hydrated: boolean;
  saveProfile: (patch: {
    displayName?: string;
    email?: string;
    provider?: AuthProvider;
    providerUserId?: string;
    inspectorName?: string;
    inspectorLicense?: string;
  }) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = "inspect-ai:profile-v1";

export const useProfile = create<ProfileStore>((set, get) => ({
  profile: null,
  signedIn: false,
  hydrated: false,

  saveProfile: async (patch) => {
    const now = new Date().toISOString();
    const existing = get().profile;
    const next: Profile = {
      displayName: (patch.displayName ?? existing?.displayName ?? "").trim(),
      email: (patch.email ?? existing?.email ?? "").trim(),
      provider: patch.provider ?? existing?.provider ?? "local",
      providerUserId: patch.providerUserId ?? existing?.providerUserId ?? "",
      inspectorName: (patch.inspectorName ?? existing?.inspectorName ?? "").trim(),
      inspectorLicense: (patch.inspectorLicense ?? existing?.inspectorLicense ?? "").trim(),
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
        const saved = JSON.parse(raw) as Partial<Profile>;
        // Backfill any fields missing from older stored profiles.
        const filled: Profile = {
          displayName: saved.displayName ?? "",
          email: saved.email ?? "",
          provider: (saved.provider as AuthProvider) ?? "local",
          providerUserId: saved.providerUserId ?? "",
          inspectorName: saved.inspectorName ?? "",
          inspectorLicense: saved.inspectorLicense ?? "",
          createdAt: saved.createdAt ?? new Date().toISOString(),
          updatedAt: saved.updatedAt ?? new Date().toISOString(),
        };
        set({
          profile: filled,
          signedIn: filled.displayName.length > 0,
        });
      }
    } catch {}
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

/**
 * Resolve the "inspector name" used on reports. Inspector-licensed name
 * has priority; falls back to OAuth display name; finally empty.
 */
export function inspectorNameOf(profile: Profile | null): string {
  if (!profile) return "";
  return profile.inspectorName?.trim() || profile.displayName?.trim() || "";
}

/** True iff the licensed-inspector info is present + non-blank. */
export function isInspectorComplete(profile: Profile | null): boolean {
  if (!profile) return false;
  return (
    (profile.inspectorName?.trim().length ?? 0) > 0 &&
    (profile.inspectorLicense?.trim().length ?? 0) > 0
  );
}
