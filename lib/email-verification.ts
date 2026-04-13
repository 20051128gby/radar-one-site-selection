import crypto from "node:crypto";

import { getSupabaseAdminClient } from "@/lib/supabase";

export const VERIFICATION_WINDOW_MINUTES = 10;
export const VERIFICATION_MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getExpiry(appMetadata: Record<string, unknown> | undefined) {
  const expiresAt =
    typeof appMetadata?.verification_code_expires_at === "string"
      ? appMetadata.verification_code_expires_at
      : null;

  if (!expiresAt) {
    return null;
  }

  return new Date(expiresAt).getTime();
}

export function getVerificationCooldown(
  appMetadata: Record<string, unknown> | undefined
) {
  const expiresAt = getExpiry(appMetadata);
  if (!expiresAt) {
    return null;
  }

  const remainingMs = expiresAt - Date.now();
  if (remainingMs <= 0) {
    return null;
  }

  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
  return {
    remainingMs,
    remainingMinutes,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

export async function issueEmailVerificationCode(userId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase 未配置完成。");
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_WINDOW_MINUTES * 60 * 1000).toISOString();

  const {
    data: { user },
    error
  } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: {
      verification_code_hash: hashCode(code),
      verification_code_expires_at: expiresAt,
      verification_code_attempts: 0,
      disabled: false
    }
  });

  if (error || !user) {
    throw new Error(error?.message ?? "验证码生成失败。");
  }

  return { code, expiresAt };
}

export function matchesVerificationCode(
  appMetadata: Record<string, unknown> | undefined,
  candidateCode: string
) {
  const attempts =
    typeof appMetadata?.verification_code_attempts === "number"
      ? appMetadata.verification_code_attempts
      : 0;
  const storedHash = typeof appMetadata?.verification_code_hash === "string"
    ? appMetadata.verification_code_hash
    : null;
  const expiresAt = getExpiry(appMetadata);

  if (attempts >= VERIFICATION_MAX_ATTEMPTS) {
    return { valid: false, reason: "验证码尝试次数过多，请重新获取。" };
  }

  if (!storedHash || !expiresAt) {
    return { valid: false, reason: "验证码不存在或已失效。" };
  }

  if (expiresAt < Date.now()) {
    return { valid: false, reason: "验证码已过期，请重新获取。" };
  }

  if (hashCode(candidateCode) !== storedHash) {
    return { valid: false, reason: "验证码错误。" };
  }

  return { valid: true as const };
}

export async function registerVerificationAttempt(
  userId: string,
  currentAppMetadata: Record<string, unknown> | undefined
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase 未配置完成。");
  }

  const attempts =
    typeof currentAppMetadata?.verification_code_attempts === "number"
      ? currentAppMetadata.verification_code_attempts
      : 0;

  const {
    data: { user },
    error
  } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...(currentAppMetadata ?? {}),
      verification_code_attempts: attempts + 1
    }
  });

  if (error || !user) {
    throw new Error(error?.message ?? "验证码尝试记录失败。");
  }

  return user;
}
