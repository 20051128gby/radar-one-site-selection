import crypto from "node:crypto";

import { cookies, headers } from "next/headers";

import { SESSION_COOKIE } from "@/lib/auth-constants";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { UserSession } from "@/lib/types";

type SessionCookiePayload = {
  v: 1;
  session: UserSession;
};

function cleanEnv(value: string | undefined) {
  return value?.trim() ?? "";
}

function getSessionSigningSecret() {
  const configured = cleanEnv(process.env.APP_SIGNING_SECRET);
  return configured || "dev-signing-secret";
}

function signValue(value: string) {
  return crypto
    .createHmac("sha256", getSessionSigningSecret())
    .update(value)
    .digest("base64url");
}

function encodePayload(payload: SessionCookiePayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string) {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    return JSON.parse(json) as SessionCookiePayload;
  } catch {
    return null;
  }
}

export function serializeSessionCookie(session: UserSession) {
  const payload = encodePayload({ v: 1, session });
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function parseSessionCookie(raw: string | undefined) {
  if (!raw) {
    return null;
  }

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signValue(payload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  const decoded = decodePayload(payload);
  if (!decoded || decoded.v !== 1) {
    return null;
  }

  return decoded.session;
}

async function hydrateSessionFromProfile(session: UserSession) {
  if (!session.id || !isSupabaseConfigured()) {
    return session;
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return session;
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email,display_name,role,plan_id")
      .eq("id", session.id)
      .maybeSingle();

    if (!profile) {
      return {
        ...session,
        role: session.role ?? "viewer",
        planId: session.planId ?? "free",
        isDisabled: session.isDisabled ?? false
      };
    }

    return {
      ...session,
      email: profile.email ?? session.email,
      displayName: profile.display_name ?? session.displayName,
      role: profile.role ?? session.role ?? "operator",
      planId: profile.plan_id ?? session.planId ?? "free",
      isDisabled: session.isDisabled ?? false
    } satisfies UserSession;
  } catch {
    return session;
  }
}

export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  const parsed = parseSessionCookie(raw);

  if (!parsed) {
    return null;
  }

  return hydrateSessionFromProfile(parsed);
}

export async function getRequestIp() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return headerStore.get("x-real-ip");
}

export async function getRequestUserAgent() {
  const headerStore = await headers();
  return headerStore.get("user-agent");
}

export function sessionCookieName() {
  return SESSION_COOKIE;
}
