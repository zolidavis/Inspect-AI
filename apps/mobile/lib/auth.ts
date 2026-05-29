/**
 * Google Sign-In wrapper for expo-auth-session.
 *
 * Lifted from the Wishbone playbook (after we burned three days finding
 * the right combination). Key callouts:
 *
 *  - `expo-application` MUST be an explicit `apps/mobile` dep — it's a
 *    transitive of expo-auth-session, and Expo's autolinker only walks
 *    DIRECT deps in pnpm monorepos. Missing this = launch crash with
 *    "Cannot find native module 'ExpoApplication'".
 *
 *  - The reverse Android client ID (`com.googleusercontent.apps.<id>`)
 *    must be registered as an `android.intentFilters` scheme in app.json
 *    for the OAuth redirect to land back in the app. Without it the
 *    browser side succeeds but the token never arrives.
 *
 *  - Google Cloud Console: the Android OAuth client's "Custom URI scheme"
 *    toggle must be ON. Google disabled it by default for new clients in
 *    July 2022. Without it: Error 400 invalid_request.
 *
 *  - SHA-1 fingerprint registration was NOT required in Wishbone, but
 *    Google's docs still recommend it. If we hit auth errors later, that's
 *    the next thing to add. Get it via the Expo dashboard credentials page.
 */
import { useCallback, useEffect, useState } from "react";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { useProfile } from "../store/profile";

void WebBrowser.maybeCompleteAuthSession();

const extra = Constants.expoConfig?.extra ?? {};
const WEB_CLIENT_ID = extra.googleWebClientId as string | undefined;
const ANDROID_CLIENT_ID = extra.googleAndroidClientId as string | undefined;
const IOS_CLIENT_ID = (extra.googleIosClientId as string | undefined) || undefined;

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  verified_email?: boolean;
}

async function fetchGoogleUser(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/userinfo/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function useGoogleSignIn() {
  const saveProfile = useProfile((s) => s.saveProfile);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: WEB_CLIENT_ID,
    androidClientId: ANDROID_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type !== "success") {
      if (response.type === "error") {
        setError(response.error?.message ?? "Sign-in failed");
      }
      setSigningIn(false);
      return;
    }
    const token = response.authentication?.accessToken;
    if (!token) {
      setError("No access token returned");
      setSigningIn(false);
      return;
    }
    (async () => {
      try {
        const user = await fetchGoogleUser(token);
        await saveProfile({
          displayName: user.name || user.email.split("@")[0]!,
          email: user.email,
          provider: "google",
          providerUserId: user.id,
        });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSigningIn(false);
      }
    })();
  }, [response, saveProfile]);

  const start = useCallback(async () => {
    if (!ANDROID_CLIENT_ID && !IOS_CLIENT_ID && !WEB_CLIENT_ID) {
      setError("Google client IDs not configured");
      return;
    }
    setError(null);
    setSigningIn(true);
    try {
      await promptAsync();
    } catch (e) {
      setError((e as Error).message);
      setSigningIn(false);
    }
  }, [promptAsync]);

  return {
    ready: !!request,
    signingIn,
    error,
    promptAsync: start,
    clearError: () => setError(null),
  };
}
