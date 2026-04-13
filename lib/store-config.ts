import { PreferredAreaType, ScoringDimensionKey } from "@/lib/types";

export type StoreTypeId =
  | "hotpot"
  | "cafe"
  | "bakery"
  | "tea"
  | "bbq"
  | "casual_dining"
  | "convenience_store";

type StoreTypeProfile = {
  id: StoreTypeId;
  label: string;
  description: string;
  defaultPreferredAreaType: PreferredAreaType;
  weights: Record<ScoringDimensionKey, number>;
  initialSearchQueries: string[];
  competitorQuery: string;
  complementaryQuery: Record<PreferredAreaType, string>;
  anchorQuery: Record<PreferredAreaType, string>;
};

const storeTypeProfiles: Record<StoreTypeId, StoreTypeProfile> = {
  hotpot: {
    id: "hotpot",
    label: "火锅店",
    description: "重堂食、重聚餐，晚餐和周末客流重要。",
    defaultPreferredAreaType: "office",
    weights: {
      footTraffic: 0.22,
      competition: 0.13,
      complementary: 0.18,
      accessibility: 0.14,
      maturity: 0.18,
      rentPressure: 0.15
    },
    initialSearchQueries: ["hot pot restaurant", "restaurant", "food"],
    competitorQuery: "hot pot restaurant",
    complementaryQuery: {
      office: "movie theater",
      residential: "family entertainment",
      mall: "shopping mall"
    },
    anchorQuery: {
      office: "office building",
      residential: "supermarket",
      mall: "shopping mall"
    }
  },
  cafe: {
    id: "cafe",
    label: "咖啡馆",
    description: "重日间消费、停留体验和复购。",
    defaultPreferredAreaType: "office",
    weights: {
      footTraffic: 0.2,
      competition: 0.16,
      complementary: 0.16,
      accessibility: 0.16,
      maturity: 0.12,
      rentPressure: 0.2
    },
    initialSearchQueries: ["cafe", "coffee shop", "bakery cafe"],
    competitorQuery: "cafe",
    complementaryQuery: {
      office: "coworking space",
      residential: "community center",
      mall: "shopping mall"
    },
    anchorQuery: {
      office: "office building",
      residential: "apartment building",
      mall: "shopping mall"
    }
  },
  bakery: {
    id: "bakery",
    label: "烘焙甜品",
    description: "重高频路过客和社区稳定复购。",
    defaultPreferredAreaType: "residential",
    weights: {
      footTraffic: 0.18,
      competition: 0.14,
      complementary: 0.16,
      accessibility: 0.18,
      maturity: 0.12,
      rentPressure: 0.22
    },
    initialSearchQueries: ["bakery", "dessert shop", "cake shop"],
    competitorQuery: "bakery",
    complementaryQuery: {
      office: "office building",
      residential: "school",
      mall: "shopping mall"
    },
    anchorQuery: {
      office: "transit station",
      residential: "supermarket",
      mall: "shopping mall"
    }
  },
  tea: {
    id: "tea",
    label: "茶饮店",
    description: "重年轻客群、逛街客流和高频快消。",
    defaultPreferredAreaType: "mall",
    weights: {
      footTraffic: 0.22,
      competition: 0.15,
      complementary: 0.16,
      accessibility: 0.18,
      maturity: 0.12,
      rentPressure: 0.17
    },
    initialSearchQueries: ["milk tea shop", "tea shop", "bubble tea"],
    competitorQuery: "milk tea shop",
    complementaryQuery: {
      office: "office building",
      residential: "college campus",
      mall: "shopping mall"
    },
    anchorQuery: {
      office: "transit station",
      residential: "school",
      mall: "shopping mall"
    }
  },
  bbq: {
    id: "bbq",
    label: "烧烤 / 烤肉",
    description: "重夜间消费、聚餐和成熟餐饮氛围。",
    defaultPreferredAreaType: "office",
    weights: {
      footTraffic: 0.2,
      competition: 0.13,
      complementary: 0.17,
      accessibility: 0.14,
      maturity: 0.2,
      rentPressure: 0.16
    },
    initialSearchQueries: ["barbecue restaurant", "grill restaurant", "restaurant"],
    competitorQuery: "barbecue restaurant",
    complementaryQuery: {
      office: "bar",
      residential: "family entertainment",
      mall: "movie theater"
    },
    anchorQuery: {
      office: "office building",
      residential: "supermarket",
      mall: "shopping mall"
    }
  },
  casual_dining: {
    id: "casual_dining",
    label: "简餐 / 正餐",
    description: "追求综合平衡，适合广谱客群。",
    defaultPreferredAreaType: "office",
    weights: {
      footTraffic: 0.2,
      competition: 0.15,
      complementary: 0.18,
      accessibility: 0.16,
      maturity: 0.18,
      rentPressure: 0.13
    },
    initialSearchQueries: ["restaurant", "food", "casual dining"],
    competitorQuery: "restaurant",
    complementaryQuery: {
      office: "office building",
      residential: "community center",
      mall: "shopping mall"
    },
    anchorQuery: {
      office: "transit station",
      residential: "supermarket",
      mall: "shopping mall"
    }
  },
  convenience_store: {
    id: "convenience_store",
    label: "便利店 / 零售",
    description: "重通勤动线、社区密度和租金模型。",
    defaultPreferredAreaType: "residential",
    weights: {
      footTraffic: 0.18,
      competition: 0.17,
      complementary: 0.14,
      accessibility: 0.2,
      maturity: 0.11,
      rentPressure: 0.2
    },
    initialSearchQueries: ["convenience store", "grocery store", "mini market"],
    competitorQuery: "convenience store",
    complementaryQuery: {
      office: "office building",
      residential: "apartment building",
      mall: "shopping mall"
    },
    anchorQuery: {
      office: "transit station",
      residential: "supermarket",
      mall: "shopping mall"
    }
  }
};

export const storeTypeOptions = Object.values(storeTypeProfiles).map((profile) => ({
  value: profile.id,
  label: profile.label,
  description: profile.description
}));

export function normalizeStoreTypeId(value: string): StoreTypeId {
  if (value in storeTypeProfiles) {
    return value as StoreTypeId;
  }

  return "casual_dining";
}

export function getStoreTypeProfile(value: string) {
  return storeTypeProfiles[normalizeStoreTypeId(value)];
}

export function getStoreTypeLabel(value: string) {
  return getStoreTypeProfile(value).label;
}
