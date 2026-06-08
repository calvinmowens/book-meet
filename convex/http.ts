import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Step 1: Redirect to Google OAuth consent screen
http.route({
  path: "/auth/google",
  method: "GET",
  handler: httpAction(async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID!;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI!;
    const scope = [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scope);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");

    return new Response(null, {
      status: 302,
      headers: { Location: url.toString() },
    });
  }),
});

// Step 2: Handle Google OAuth callback
http.route({
  path: "/auth/google/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      return new Response(`OAuth error: ${error || "no code received"}`, {
        status: 400,
      });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
          grant_type: "authorization_code",
        }),
      },
    );

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      return new Response(`Token exchange failed: ${err}`, { status: 500 });
    }

    const tokens = await tokenResponse.json();

    // Get user email from userinfo
    const userinfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );
    const userinfo = await userinfoResponse.json();
    const email = userinfo.email as string;

    // Store tokens
    await ctx.runMutation(internal.adminTokens.store, {
      email,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
    });

    // Generate a simple session token
    const sessionToken = crypto.randomUUID();

    // Store session (we'll use the email as the session for simplicity)
    // In production, you'd want a proper session table
    // For now, encode email in the session token via a simple approach
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    return new Response(null, {
      status: 302,
      headers: {
        Location: `${frontendUrl}/admin/login?session=${sessionToken}:${email}`,
      },
    });
  }),
});

export default http;
