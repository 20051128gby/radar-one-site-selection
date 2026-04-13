import { CommercialPlanId } from "@/lib/plans";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export type AnalysisAccessState = {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  analysisTier: "basic" | "premium";
  source:
    | "guest_trial"
    | "free_basic"
    | "plan_basic"
    | "bonus_basic"
    | "bonus_premium"
    | "plan_premium";
  reason?: string;
  bucketKey: string;
  bucketType: "guest" | "member";
  remainingBasic?: number;
  remainingPremium?: number;
};

export type AnalysisEventLog = {
  id: string;
  actorKey: string;
  actorType: "guest" | "user";
  projectId: string;
  createdAt: string;
  address: string;
  businessType: string;
  cuisineFocus: string;
  provider: string;
  status: "success" | "failed";
  estimatedUsd: number;
  analysisTier: "basic" | "premium";
  creditSource:
    | "guest_trial"
    | "free_basic"
    | "plan_basic"
    | "bonus_basic"
    | "bonus_premium"
    | "plan_premium";
  failureReason?: string;
};

export type SubscriptionRecord = {
  userId: string;
  planId: CommercialPlanId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status: SubscriptionStatus;
  currentPeriodEnd?: string;
};

export type UsageBalanceRecord = {
  userId: string;
  planId: CommercialPlanId;
  basicIncluded: number;
  basicBonus: number;
  basicUsed: number;
  basicRemaining: number;
  premiumIncluded: number;
  premiumBonus: number;
  premiumUsed: number;
  premiumRemaining: number;
  createdAt: string;
  updatedAt: string;
};

export type ShareRewardRecord = {
  id: string;
  userId: string;
  rewardType: "share_premium_analysis";
  shareReference: string | null;
  shareChannel: string | null;
  status: "pending" | "awarded" | "reversed";
  premiumCreditsAwarded: number;
  awardedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
