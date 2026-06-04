/**
 * Local user profile (Zustand + AsyncStorage).
 *
 * Stores both the auth identity (displayName + email from OAuth) AND
 * the licensed-inspector info (inspectorName + inspectorLicense + license
 * type + company + phone) that stamps onto every inspection. Type-once,
 * applies forever (until sign-out or storage clear).
 */
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AuthProvider = "local" | "apple" | "google";

/**
 * "I hold an active license as a:" — the six categories listed on the
 * Qualified Inspector section of the OIR-B1-1802 (Rev. 04/26) form.
 * Stamped on every wind-mit report.
 */
export type InspectorLicenseType =
  | "home_inspector"            // §468.8314, FL Statutes (home inspector)
  | "building_code_inspector"   // §468.607 (building code inspector)
  | "contractor"                // §489.111 (general / building / residential contractor)
  | "engineer"                  // §471.015 (professional engineer)
  | "architect"                 // §481.213 (professional architect)
  | "other_authorized";         // any other entity recognized by the insurer

export const INSPECTOR_LICENSE_TYPES: {
  value: InspectorLicenseType;
  label: string;
  sub: string;
}[] = [
  { value: "home_inspector",          label: "Home Inspector",          sub: "§468.8314, F.S." },
  { value: "building_code_inspector", label: "Building Code Inspector", sub: "§468.607" },
  { value: "contractor",              label: "Contractor",              sub: "§489.111 — general / building / residential" },
  { value: "engineer",                label: "Professional Engineer",   sub: "§471.015" },
  { value: "architect",               label: "Professional Architect",  sub: "§481.213" },
  { value: "other_authorized",        label: "Other authorized entity", sub: "Recognized by the insurer" },
];

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
  /** Category of license held (OIR-B1-1802 "check one" box). */
  inspectorLicenseType: InspectorLicenseType | "";
  /** Inspection company name (top of the certification block). */
  inspectorCompany: string;
  /** Inspector phone number. */
  inspectorPhone: string;
  /**
   * Inspector's drawn signature as a base64 data URI ("data:image/png;base64,...")
   * captured via the signature pad on the Profile screen. Stamped on every
   * inspection's signature line.
   */
  inspectorSignaturePng: string;
  /**
   * Optional business logo as a base64 data URI (PNG or JPEG). When set,
   * a cover page is prepended to every generated PDF: logo centered up
   * top, inspection address + owner + date below.
   */
  businessLogoPng: string;
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
    inspectorLicenseType?: InspectorLicenseType | "";
    inspectorCompany?: string;
    inspectorPhone?: string;
    inspectorSignaturePng?: string;
    businessLogoPng?: string;
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
      inspectorLicenseType:
        patch.inspectorLicenseType ?? existing?.inspectorLicenseType ?? "",
      inspectorCompany: (patch.inspectorCompany ?? existing?.inspectorCompany ?? "").trim(),
      inspectorPhone: (patch.inspectorPhone ?? existing?.inspectorPhone ?? "").trim(),
      inspectorSignaturePng: patch.inspectorSignaturePng ?? existing?.inspectorSignaturePng ?? "",
      businessLogoPng: patch.businessLogoPng ?? existing?.businessLogoPng ?? "",
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
          inspectorLicenseType:
            (saved.inspectorLicenseType as InspectorLicenseType | "") ?? "",
          inspectorCompany: saved.inspectorCompany ?? "",
          inspectorPhone: saved.inspectorPhone ?? "",
          inspectorSignaturePng: saved.inspectorSignaturePng ?? "",
          businessLogoPng: saved.businessLogoPng ?? "",
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

/** Human-friendly label for the stored license-type enum. */
export function inspectorLicenseTypeLabel(
  v: InspectorLicenseType | "" | undefined,
): string {
  if (!v) return "";
  return INSPECTOR_LICENSE_TYPES.find((t) => t.value === v)?.label ?? "";
}
