export type CommercialPlanId = "guest" | "free" | "starter" | "growth" | "scale";

export type CommercialPlan = {
  id: CommercialPlanId;
  name: string;
  priceMonthlyUsd: number;
  analysisLimitMonthly: number;
  premiumAnalysisLimitMonthly: number;
  seats: number;
  features: string[];
  stripeLookupKey?: string;
};

export const commercialPlans: CommercialPlan[] = [
  {
    id: "guest",
    name: "Guest",
    priceMonthlyUsd: 0,
    analysisLimitMonthly: 1,
    premiumAnalysisLimitMonthly: 0,
    seats: 1,
    features: [
      "同一 IP 仅 1 次试用",
      "基础选址分析",
      "不含历史协作与导出"
    ]
  },
  {
    id: "free",
    name: "Free",
    priceMonthlyUsd: 0,
    analysisLimitMonthly: 5,
    premiumAnalysisLimitMonthly: 0,
    seats: 1,
    features: [
      "注册用户 5 次基础分析",
      "支持项目历史",
      "可通过分享获得高级分析额度"
    ]
  },
  {
    id: "starter",
    name: "Starter",
    priceMonthlyUsd: 39,
    analysisLimitMonthly: 60,
    premiumAnalysisLimitMonthly: 0,
    seats: 1,
    stripeLookupKey: "radarone_starter_monthly",
    features: [
      "60 次 / 月分析",
      "项目历史与收藏",
      "基础成本看板"
    ]
  },
  {
    id: "growth",
    name: "Growth",
    priceMonthlyUsd: 129,
    analysisLimitMonthly: 250,
    premiumAnalysisLimitMonthly: 0,
    seats: 5,
    stripeLookupKey: "radarone_growth_monthly",
    features: [
      "250 次 / 月分析",
      "团队成员 5 席",
      "管理员后台与用户管理",
      "CSV 导出"
    ]
  },
  {
    id: "scale",
    name: "Scale",
    priceMonthlyUsd: 399,
    analysisLimitMonthly: 1000,
    premiumAnalysisLimitMonthly: 0,
    seats: 20,
    stripeLookupKey: "radarone_scale_monthly",
    features: [
      "1000 次 / 月分析",
      "团队成员 20 席",
      "高级报表",
      "优先支持"
    ]
  }
];
