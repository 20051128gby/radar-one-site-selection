"use client";

import { useMemo } from "react";

import { commercialPlans } from "@/lib/plans";
import { useAuth } from "@/components/app-providers";

export function BillingPage() {
  const { session } = useAuth();

  const visiblePlans = useMemo(
    () => commercialPlans.filter((plan) => plan.id !== "guest" && plan.id !== "free"),
    []
  );

  return (
    <div className="stack">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">Billing</p>
          <h1>套餐与付费</h1>
          <p>
            当前项目已经具备套餐结构、访客限次和 Stripe-ready 的服务端骨架。等你补齐 Stripe
            密钥后，就可以把这里接成正式 Checkout。
          </p>
        </div>
      </div>

      {!session ? (
        <div className="callout">
          <strong>建议先登录</strong>
          <span>未登录用户只有游客试用额度。升级套餐后，分析次数、项目历史和团队能力都会提升。</span>
        </div>
      ) : null}

      <div className="admin-metric-grid">
        {visiblePlans.map((plan) => (
          <article className="soft-panel stack" key={plan.id}>
            <div>
              <p className="eyebrow">{plan.name}</p>
              <h2 className="admin-metric-value">${plan.priceMonthlyUsd}</h2>
              <p className="helper-text">每月 {plan.analysisLimitMonthly} 次分析</p>
            </div>
            <div className="bullet-box">
              <h4>包含内容</h4>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
            <form action="/api/billing/checkout" method="post">
              <input name="planId" type="hidden" value={plan.id} />
              <button className="primary-button" type="submit">
                {session ? `升级到 ${plan.name}` : `登录后购买 ${plan.name}`}
              </button>
            </form>
          </article>
        ))}
      </div>
    </div>
  );
}
