type SendVerificationEmailInput = {
  to: string;
  code: string;
};

function cleanEnv(value: string | undefined) {
  return value?.trim() ?? "";
}

export function isBrevoConfigured() {
  return Boolean(cleanEnv(process.env.BREVO_API_KEY));
}

export async function sendVerificationEmail({ to, code }: SendVerificationEmailInput) {
  const apiKey = cleanEnv(process.env.BREVO_API_KEY);
  if (!apiKey) {
    throw new Error("Brevo 未配置完成。");
  }

  const senderEmail =
    cleanEnv(process.env.BREVO_SENDER_EMAIL) || "gongboyin01@gmail.com";
  const senderName = cleanEnv(process.env.BREVO_SENDER_NAME) || "Radar One";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [{ email: to }],
      subject: "你的 Radar One 邮箱验证码",
      htmlContent: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
          <h2 style="margin-bottom:12px;">确认你的邮箱</h2>
          <p>你的 Radar One 验证码是：</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;margin:20px 0;">${code}</div>
          <p>验证码 10 分钟内有效。如果这不是你的操作，请忽略这封邮件。</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Brevo 发送失败: ${payload}`);
  }
}
