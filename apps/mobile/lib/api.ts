import Constants from "expo-constants";
import type {
  Address,
  Inspection,
  InspectionType,
  InspectorLicenseType,
  Photo,
  PropertyLookup,
} from "@inspect-ai/shared";

/**
 * Resolution order:
 *   1. EXPO_PUBLIC_API_BASE_URL — baked in at build time by EAS profile
 *      env (preview/production point at https://inspect-ai-api.vercel.app)
 *   2. app.json#extra.apiBaseUrl — fallback for dev builds / Expo Go
 *   3. localhost:8787 — fallback for local Node dev
 */
const BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ??
  "http://localhost:8787";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} ${path}`);
  return (await res.json()) as T;
}

export const api = {
  listInspections: () => req<Inspection[]>("/inspections"),
  getInspection: (id: string) => req<Inspection>(`/inspections/${id}`),
  createInspection: (body: {
    type: InspectionType;
    address: Address;
    inspectorName?: string;
    inspectorLicense?: string;
    inspectorLicenseType?: InspectorLicenseType;
    inspectorCompany?: string;
    inspectorPhone?: string;
    inspectorEmail?: string;
    inspectorSignaturePng?: string;
    businessLogoPng?: string;
    ownerEmail?: string;
    ownerPhone?: string;
  }) =>
    req<Inspection>("/inspections", { method: "POST", body: JSON.stringify(body) }),
  patchInspection: (id: string, body: Partial<Inspection>) =>
    req<Inspection>(`/inspections/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteInspection: (id: string) =>
    req<{ ok: boolean }>(`/inspections/${id}`, { method: "DELETE" }),

  lookupAddress: (address: Address) =>
    req<PropertyLookup>("/address/lookup", {
      method: "POST",
      body: JSON.stringify(address),
    }),

  analyzePhoto: (photoId: string) =>
    req<{ summary: string; findings: any[] }>("/ai/analyze", {
      method: "POST",
      body: JSON.stringify({ photoId }),
    }),

  /**
   * Auto-tag + analyze a photo in a single server-side call. Used by the
   * "shoot anything, AI figures it out" camera flow. The server runs a
   * cheap classification pass to pick the best tag for the photo, re-
   * tags the stored Photo, then runs the existing field-extraction
   * analyze with the new tag.
   */
  autoAnalyzePhoto: (photoId: string) =>
    req<{
      classifiedAs: string;
      classifyConfidence: number;
      summary: string;
      findings: any[];
    }>("/ai/auto-analyze", {
      method: "POST",
      body: JSON.stringify({ photoId }),
    }),

  uploadPhoto: async (params: {
    inspectionId: string;
    tag: string;
    uri: string;
  }): Promise<Photo> => {
    const form = new FormData();
    form.append("inspectionId", params.inspectionId);
    form.append("tag", params.tag);
    // @ts-expect-error RN FormData file shape
    form.append("file", {
      uri: params.uri,
      name: `${params.tag}-${Date.now()}.jpg`,
      type: "image/jpeg",
    });
    const res = await fetch(`${BASE}/photos`, { method: "POST", body: form as any });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
    return res.json();
  },

  // Cache-bust param (`v`) forces the browser/CDN to re-fetch a freshly
  // generated PDF after the inspection was edited, instead of replaying a
  // cached copy. The server also sends Cache-Control: no-store.
  listPhotos: (inspectionId: string) =>
    req<Photo[]>(`/photos/inspection/${inspectionId}`),

  deletePhoto: (photoId: string) =>
    req<{ ok: boolean }>(`/photos/${photoId}`, { method: "DELETE" }),

  /**
   * Re-tag a photo (used by the photo editor to correct an AI
   * misclassification). The server clears the stale aiAnalysis; callers
   * should follow with analyzePhoto() to repopulate findings for the new tag.
   */
  setPhotoTag: (photoId: string, tag: string) =>
    req<Photo>(`/photos/${photoId}`, {
      method: "PATCH",
      body: JSON.stringify({ tag }),
    }),

  pdfUrl: (inspectionId: string, type: InspectionType) =>
    `${BASE}/pdf/${inspectionId}?type=${type}&v=${Date.now()}`,

  getSuggestions: (inspectionId: string) =>
    req<{ suggestions: Suggestion[] }>(`/inspections/${inspectionId}/suggestions`),

  applySuggestions: (
    inspectionId: string,
    applied: Array<{ form: "fourPoint" | "windMit"; path: string; value: unknown }>
  ) =>
    req<Inspection>(`/inspections/${inspectionId}/apply`, {
      method: "POST",
      body: JSON.stringify({ applied }),
    }),

  /**
   * Resolves with the updated inspection on success.
   * Rejects with a CompleteError carrying per-form field errors on 400.
   */
  completeInspection: async (inspectionId: string): Promise<Inspection> => {
    const res = await fetch(`${BASE}/inspections/${inspectionId}/complete`, { method: "POST" });
    if (res.ok) return res.json();
    if (res.status === 400) {
      const body = await res.json();
      throw new CompleteError("Incomplete form", body);
    }
    throw new Error(`${res.status} ${res.statusText}`);
  },
};

export class CompleteError extends Error {
  constructor(msg: string, public payload: any) { super(msg); }
}

export interface Suggestion {
  form: "fourPoint" | "windMit";
  path: string;
  value: unknown;
  rawValue: string;
  confidence: number;
  notes?: string;
  sourcePhotoId: string;
  sourcePhotoTag: string;
  currentValue: unknown;
  conflictsWithCurrent: boolean;
}
