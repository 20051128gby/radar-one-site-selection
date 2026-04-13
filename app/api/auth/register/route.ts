import { NextRequest, NextResponse } from "next/server";

import {
  getVerificationCooldown,
  issueEmailVerificationCode,
  VERIFICATION_WINDOW_MINUTES
} from "@/lib/email-verification";
import { sendVerificationEmail } from "@/lib/brevo";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 未配置完成。" }, { status: 503 });
  }

  const payload = (await request.json()) as {
    email?: string;
    password?: string;
  };

  const email = payload.email?.trim().toLowerCase() ?? "";
  const password = payload.password?.trim() ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "邮箱和密码不能为空。" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "密码至少需要 8 位。" }, { status: 400 });
  }

  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const existingUser = (existingUsers.users ?? []).find(
    (user) => (user.email ?? "").toLowerCase() === email
  );

  if (existingUser?.email_confirmed_at) {
    return NextResponse.json({ error: "这个邮箱已经注册，请直接登录。" }, { status: 400 });
  }

  const cooldown = getVerificationCooldown(
    (existingUser?.app_metadata ?? {}) as Record<string, unknown>
  );

  if (cooldown) {
    return NextResponse.json(
      {
        error: `验证码已发送，请在 ${cooldown.remainingMinutes} 分钟后再试。`,
        remainingMinutes: cooldown.remainingMinutes
      },
      { status: 429 }
    );
  }

  const { data, error } = existingUser
    ? await supabase.auth.admin.updateUserById(existingUser.id, {
        password
      })
    : await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false
      });

  const user = "user" in data ? data.user : null;
  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "注册失败，请稍后再试。" },
      { status: 400 }
    );
  }

  try {
    const { code } = await issueEmailVerificationCode(user.id);
    await sendVerificationEmail({ to: email, code });
  } catch (sendError) {
    return NextResponse.json(
      {
        error: sendError instanceof Error ? sendError.message : "验证码发送失败。"
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    requiresEmailVerification: true,
    message: `验证码已发送到你的邮箱，请输入 6 位验证码完成注册。验证码 ${VERIFICATION_WINDOW_MINUTES} 分钟内有效，且 ${VERIFICATION_WINDOW_MINUTES} 分钟内不可重复发送。`
  });
}
