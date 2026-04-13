import { NextRequest, NextResponse } from "next/server";

import {
  matchesVerificationCode,
  registerVerificationAttempt
} from "@/lib/email-verification";
import { upsertProfile } from "@/lib/repository";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 未配置完成。" }, { status: 503 });
  }

  const payload = (await request.json()) as {
    email?: string;
    code?: string;
  };

  const email = payload.email?.trim().toLowerCase() ?? "";
  const code = payload.code?.trim() ?? "";

  if (!email || !code) {
    return NextResponse.json({ error: "邮箱和验证码不能为空。" }, { status: 400 });
  }

  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const user = (data.users ?? []).find((item) => (item.email ?? "").toLowerCase() === email);
  if (!user) {
    return NextResponse.json({ error: "未找到待验证账号。" }, { status: 404 });
  }

  const verification = matchesVerificationCode(
    (user.app_metadata ?? {}) as Record<string, unknown>,
    code
  );

  if (!verification.valid) {
    await registerVerificationAttempt(
      user.id,
      (user.app_metadata ?? {}) as Record<string, unknown>
    );
    return NextResponse.json({ error: verification.reason }, { status: 400 });
  }

  const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    app_metadata: {
      disabled: false,
      verification_code_hash: null,
      verification_code_expires_at: null,
      verification_code_attempts: 0
    }
  });

  if (updateError || !updated.user) {
    return NextResponse.json(
      { error: updateError?.message ?? "邮箱确认失败。" },
      { status: 500 }
    );
  }

  await upsertProfile({
    id: updated.user.id,
    email,
    displayName: email.split("@")[0] ?? "Founder",
    role: "operator",
    planId: "free",
    isDisabled: false
  });

  return NextResponse.json({
    ok: true,
    message: "邮箱已确认，现在可以使用密码登录。"
  });
}
