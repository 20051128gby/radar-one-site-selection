import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth-constants";
import { upsertProfile } from "@/lib/repository";
import { serializeSessionCookie } from "@/lib/server-auth";
import { getSupabaseServerAuthClient } from "@/lib/supabase";
import { UserSession } from "@/lib/types";

function buildAppSession(user: {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: {
    display_name?: string;
    full_name?: string;
    name?: string;
  };
}): UserSession {
  const email = user.email?.trim().toLowerCase() ?? "unknown@user.local";
  const displayName =
    user.user_metadata?.display_name ??
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    email.split("@")[0] ??
    "Founder";

  return {
    id: user.id,
    email,
    displayName,
    planId: "free",
    role: "operator",
    isDisabled: Boolean(user.app_metadata?.disabled)
  };
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServerAuthClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 未配置完成。" }, { status: 503 });
  }

  const payload = (await request.json()) as { accessToken?: string };
  if (!payload.accessToken) {
    return NextResponse.json({ error: "缺少 access token。" }, { status: 400 });
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser(payload.accessToken);

  if (error || !user) {
    return NextResponse.json({ error: error?.message ?? "登录态校验失败。" }, { status: 401 });
  }

  const session = await upsertProfile(buildAppSession(user));

  if (session.isDisabled) {
    return NextResponse.json({ error: "当前账号已被禁用，请联系管理员。" }, { status: 403 });
  }

  const response = NextResponse.json({ session });
  response.cookies.set(SESSION_COOKIE, serializeSessionCookie(session), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
