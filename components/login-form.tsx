"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/app-providers";
import { getSupabasePublicClient } from "@/lib/supabase";

export function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register" | "magic-link">("login");
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const supabase = getSupabasePublicClient();
    setMessage(null);
    setIsSubmitting(true);

    try {
      if (supabase) {
        if (mode === "magic-link") {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/projects`
            }
          });

          if (error) {
            setMessage(error.message);
            return;
          }

          setMessage("登录链接已发送到你的邮箱，请点击邮件继续。");
          return;
        }

        if (!password) {
          setMessage("请输入密码。");
          return;
        }

        if (mode === "register") {
          const registerResponse = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
          });

          const payload = (await registerResponse.json()) as {
            error?: string;
            message?: string;
            requiresEmailVerification?: boolean;
            remainingMinutes?: number;
          };

          if (!registerResponse.ok) {
            setMessage(payload.error ?? "注册失败，请稍后再试。");
            return;
          }

          setAwaitingVerification(true);
          setMessage(payload.message ?? "验证码已发送，请输入 6 位验证码完成注册。");
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          setMessage(error.message);
          return;
        }

        router.push("/projects");
        return;
      }

      signIn(email);
      router.push("/projects");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="soft-panel stack" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Login</p>
        <h1 className="section-title">保存你的选址项目。</h1>
        <p className="section-copy">
          现在支持邮箱密码和邮箱验证码验证。普通用户注册后需要先确认邮箱归属，再进入系统。
        </p>
      </div>

      <div className="segmented">
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => setMode("login")}
          type="button"
        >
          密码登录
        </button>
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => setMode("register")}
          type="button"
        >
          注册并验证邮箱
        </button>
        <button
          className={mode === "magic-link" ? "active" : ""}
          onClick={() => setMode("magic-link")}
          type="button"
        >
          魔法链接
        </button>
      </div>

      <div className="field">
        <label htmlFor="email">邮箱</label>
        <input
          id="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@brand.com"
          type="email"
          value={email}
        />
      </div>

      {mode !== "magic-link" ? (
        <div className="field">
          <label htmlFor="password">密码</label>
          <input
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 8 位"
            type="password"
            value={password}
          />
        </div>
      ) : null}

      {mode === "register" && awaitingVerification ? (
        <div className="field">
          <label htmlFor="verificationCode">邮箱验证码</label>
          <input
            id="verificationCode"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setVerificationCode(event.target.value)}
            placeholder="输入 6 位验证码"
            value={verificationCode}
          />
        </div>
      ) : null}

      <button aria-busy={isSubmitting} className="primary-button" disabled={isSubmitting} type="submit">
        {mode === "magic-link"
          ? isSubmitting
            ? "发送中..."
            : "发送登录链接"
          : mode === "register"
            ? awaitingVerification
              ? isSubmitting
                ? "提交中..."
                : "重新发送验证码"
              : isSubmitting
                ? "发送中..."
                : "注册并发送验证码"
            : isSubmitting
              ? "登录中..."
              : "登录"}
      </button>

      {mode === "register" && awaitingVerification ? (
        <button
          aria-busy={isVerifying}
          className="ghost-button"
          onClick={async () => {
            if (isVerifying) {
              return;
            }

            setMessage(null);
            setIsVerifying(true);

            try {
              const response = await fetch("/api/auth/verify-code", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: verificationCode })
              });

              const payload = (await response.json()) as { error?: string; message?: string };
              if (!response.ok) {
                setMessage(payload.error ?? "验证码验证失败。");
                return;
              }

              setAwaitingVerification(false);
              setMode("login");
              setVerificationCode("");
              setMessage(payload.message ?? "邮箱已确认，现在可以登录。");
            } finally {
              setIsVerifying(false);
            }
          }}
          disabled={isVerifying || verificationCode.trim().length !== 6}
          type="button"
        >
          {isVerifying ? "验证中..." : "验证邮箱"}
        </button>
      ) : null}

      {message ? <p className="helper-text">{message}</p> : null}

      <p className="helper-text">
        管理员权限现在以数据库角色为准，不再靠邮箱名称猜测。注册用户默认有 5 次基础分析免费额度，后续可通过分享获得高级分析奖励。验证码有效期 10 分钟，发送后 10 分钟内不能再次发送。
      </p>
    </form>
  );
}
