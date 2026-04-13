import { NextResponse } from "next/server";

import {
  FREE_BASIC_ANALYSIS_LIMIT,
  GUEST_IP_TRIAL_LIMIT,
  SHARE_PREMIUM_REWARD_CREDITS
} from "@/lib/quota";
import { getServerSession } from "@/lib/server-auth";

export async function GET() {
  const session = await getServerSession();
  if (!session || session.role !== "admin" || session.isDisabled) {
    return NextResponse.json({ error: "需要管理员权限。" }, { status: 403 });
  }

  return NextResponse.json({
    config: {
      googleMapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      geoapifyConfigured: Boolean(process.env.GEOAPIFY_API_KEY),
      billingAccountConfigured: Boolean(process.env.GCP_BILLING_ACCOUNT_ID),
      bigQueryDatasetConfigured: Boolean(process.env.BIGQUERY_DATASET),
      bigQueryApiKeyConfigured: Boolean(process.env.BIGQUERY_API_KEY),
      brevoConfigured: Boolean(process.env.BREVO_API_KEY),
      supabaseSecretConfigured: Boolean(process.env.SUPABASE_SECRET_KEY),
      supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnonConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      liveBillingEnabled: false,
      guestMonthlyLimit: GUEST_IP_TRIAL_LIMIT,
      freeBasicLimit: FREE_BASIC_ANALYSIS_LIMIT,
      sharePremiumRewardCredits: SHARE_PREMIUM_REWARD_CREDITS
    },
    notes: [
      "当前后台的花费与余额基于应用内调用估算，不是 Google 官方实时账单。",
      "BigQuery API key 只能帮助访问部分 Google API，真正读取官方账单仍需要导出表所在项目和服务账号或等效凭证。",
      "Supabase URL、匿名 key 和 service key 配齐后，站点会启用真实邮箱 OTP 与数据库同步。",
      "Brevo 已接通后，普通用户注册会改走 6 位邮箱验证码，不再受 Supabase 默认邮件额度限制。",
      "当前已切换为服务端额度控制：同一 IP 只能试用 1 次，注册用户默认 5 次基础分析免费额度。",
      "分享奖励的数据库结构已经预留，后续可把分享成功回调接到高级分析奖励逻辑上。",
      "若要启用真实付费，请补充 STRIPE_SECRET_KEY、NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 和套餐对应的 lookup key。"
    ]
  });
}
