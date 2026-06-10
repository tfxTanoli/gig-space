# Full-Screen Google OAuth Implementation

## Overview

Replaces Firebase's `signInWithPopup` (which opens a small popup window) with a full-page redirect flow identical to how Stripe, Linear, and Notion handle Google sign-in. The user is taken to Google's account picker, then returned seamlessly to the app.

## Why not Firebase's built-in `signInWithRedirect`?

Firefox and Chrome 115+ enforce **third-party storage partitioning** — cross-site iframes can no longer access their own storage when embedded inside a different origin. Firebase's redirect handler relies on an iframe from `firebaseapp.com` to relay the auth token back to your app. In Chrome 115+, this iframe's storage is blocked, causing `getRedirectResult()` to return `null` and the sign-in to silently fail.

## Architecture: PKCE + Server-Side Token Exchange

The flow uses the industry-standard **Authorization Code + PKCE** (Proof Key for Code Exchange) pattern:

```
Browser                      Your Server           Google
   |                              |                    |
   |-- generate code_verifier --->|                    |
   |-- SHA-256 → code_challenge ->|                    |
   |                              |                    |
   |-------- redirect to Google with code_challenge -->|
   |                              |                    |
   |<------- redirect back with ?code=... -------------|
   |                              |                    |
   |-- POST /api/auth/google ---->|                    |
   |   { code, code_verifier }    |-- token request -->|
   |                              |   + client_secret  |
   |                              |<-- { id_token } ---|
   |<-- { id_token } -------------|                    |
   |                              |                    |
   |-- Firebase signInWithCredential(id_token)         |
   |-- onAuthStateChanged fires, user is signed in     |
```

The `client_secret` never leaves your server. The `code_verifier` prevents any intercepted authorization code from being exchanged by a third party.

## Files Changed

### `src/Signin.tsx`, `src/Signup.tsx`, `src/AffiliateSignin.tsx`, `src/AffiliateSignup.tsx`

`handleGoogleSignIn` was replaced with a PKCE flow:

```typescript
const handleGoogleSignIn = async () => {
  const codeVerifier = generateCodeVerifier();           // random 32-byte base64url string
  const codeChallenge = await generateCodeChallenge(codeVerifier); // SHA-256(verifier)
  const state = generateCodeVerifier();                  // CSRF protection token

  sessionStorage.setItem('oauthCodeVerifier', codeVerifier);
  sessionStorage.setItem('oauthState', state);

  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    redirect_uri: `${window.location.origin}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};
```

### `src/AuthCallback.tsx`

New component mounted at `/auth/callback`. Handles the return from Google:

1. Reads `?code=` and `?state=` from the URL
2. Validates the `state` against the stored CSRF token
3. POSTs `{ code, code_verifier, redirect_uri }` to `/api/auth/google`
4. Receives `{ id_token }` back
5. Calls `Firebase.signInWithCredential(GoogleAuthProvider.credential(id_token))`
6. Navigates to the appropriate dashboard

**Two guards prevent duplicate exchanges:**

- `oauthExchangeInProgress` — set before the fetch, blocks React StrictMode's simulated second effect invocation (happens synchronously before the first async call completes)
- `oauthExchangeComplete` — set after `signInWithCredential` resolves, blocks the re-run that occurs when `AuthContext`'s global loading spinner unmounts/remounts the component while fetching the user profile

Both are cleaned up automatically: `oauthExchangeInProgress` is removed immediately after the fetch (success or error); `oauthExchangeComplete` is removed in the navigation `useEffect` the moment we leave `/auth/callback`.

### `src/App.tsx`

```typescript
const AuthCallback = lazy(() => import('./AuthCallback'));
// ...
<Route path="/auth/callback" element={<AuthCallback />} />
```

### `api/auth/google.js` (Vercel serverless function)

Performs the token exchange server-side so `client_secret` is never in the browser bundle:

```javascript
export default async function handler(req, res) {
  const { code, client_id, redirect_uri, code_verifier } = req.body;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri,
      grant_type: 'authorization_code',
      code_verifier,
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokenRes.ok || tokens.error) return res.status(400).json(tokens);
  return res.json({ id_token: tokens.id_token, access_token: tokens.access_token });
}
```

### `server/src/app.ts`

Mirrors `api/auth/google.js` for the local Express server (Vite proxies `/api` → port 3001 in development):

```typescript
app.post('/api/auth/google', async (req, res) => {
  const { code, client_id, redirect_uri, code_verifier } = req.body;
  // same logic — exchanges code + client_secret for tokens
});
```

## Environment Variables

| Variable | Where | Value |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | root `.env` | `325504600846-xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `server/.env` | `GOCSPX-xxxx` |
| `GOOGLE_CLIENT_SECRET` | Vercel dashboard → Environment Variables | same `GOCSPX-xxxx` |

`VITE_GOOGLE_CLIENT_ID` is safe to expose in the browser (it's the public client identifier). `GOOGLE_CLIENT_SECRET` must stay server-side only.

## Google Cloud Console Configuration

In **APIs & Services → Credentials → edit your OAuth 2.0 Web Application client**:

**Authorized JavaScript origins:**
```
http://localhost:5173
https://gig-space.vercel.app
```

**Authorized redirect URIs:**
```
http://localhost:5173/auth/callback
https://gig-space.vercel.app/auth/callback
```

## SessionStorage Keys Used

| Key | Purpose | Lifetime |
|---|---|---|
| `oauthCodeVerifier` | PKCE verifier for the token exchange | Cleared in `AuthCallback` before fetch |
| `oauthState` | CSRF token to validate the callback | Cleared in `AuthCallback` before fetch |
| `oauthNext` | Post-sign-in redirect path (from `?next=` param) | Cleared when navigation fires |
| `oauthExchangeInProgress` | Mutex: blocks StrictMode double-invocation | Cleared after fetch completes |
| `oauthExchangeComplete` | Blocks re-run on AuthContext remount | Cleared when navigating away from `/auth/callback` |
| `authRedirectError` | Error code shown on the sign-in page | Cleared when Signin reads it |
