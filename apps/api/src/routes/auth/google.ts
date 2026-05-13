/**
 * Google OAuth Setup Checklist
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Before enabling this route, complete ALL steps below:
 *
 * 1. SUPABASE DASHBOARD
 *    - Authentication → Providers → Google → Enable
 *    - Paste Client ID and Client Secret from Google Cloud Console
 *    - Add redirect URL shown in Supabase to Google OAuth authorized redirects
 *
 * 2. GOOGLE CLOUD CONSOLE  (console.cloud.google.com)
 *    - APIs & Services → Credentials → Create OAuth 2.0 Client ID
 *    - Application type: Web application
 *    - Authorized redirect URIs: add the Supabase callback URL
 *      (e.g. https://<project>.supabase.co/auth/v1/callback)
 *    - Copy Client ID and Client Secret into Supabase
 *
 * 3. EXPO / MOBILE
 *    - Install: expo-auth-session, expo-web-browser
 *    - In app.json add scheme (e.g. "ironsynk") for deep link redirect
 *    - Add to expo.plugins: ["expo-auth-session"]
 *    - Implement Google sign-in flow in LoginScreen using
 *      Google.useIdTokenAuthRequest() or supabase.auth.signInWithOAuth()
 *
 * 4. ENVIRONMENT VARIABLES
 *    - No new vars needed — Supabase handles the OAuth secrets
 *
 * 5. WHEN READY
 *    - Replace the 501 stub in apps/api/src/routes/auth/index.ts POST /google
 *      with the actual Supabase OAuth URL generation or remove the route
 *      entirely if mobile calls Supabase SDK directly (recommended)
 *
 * NOTE: The recommended approach for Expo is to call Supabase Auth directly
 * from the mobile app using the JS SDK, bypassing this API route entirely.
 * The POST /google route in index.ts can be removed once mobile OAuth is live.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export {}
