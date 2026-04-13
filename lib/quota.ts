import { commercialPlans } from "@/lib/plans";

export const GUEST_IP_TRIAL_LIMIT = 1;
export const FREE_BASIC_ANALYSIS_LIMIT = 5;
export const SHARE_PREMIUM_REWARD_CREDITS = 1;

export function planForUser(planId?: string) {
  return (
    commercialPlans.find((plan) => plan.id === planId) ??
    commercialPlans.find((plan) => plan.id === "free")!
  );
}
