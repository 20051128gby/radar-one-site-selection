import { AnalysisCostEstimate } from "@/lib/types";

const USD_TO_CNY = 7.24;

const GOOGLE_PRICING = {
  geocoding: 0.005,
  textSearchPro: 0.032
} as const;

const GEOAPIFY_PRICING = {
  geocoding: 0.0008,
  places: 0.0012
} as const;

function toCny(usd: number) {
  return Number((usd * USD_TO_CNY).toFixed(2));
}

function roundUsd(value: number) {
  return Number(value.toFixed(4));
}

export function estimateAnalysisCost(
  providerName: string,
  fallbackToMock: boolean,
  candidateCount = 0
): AnalysisCostEstimate {
  if (fallbackToMock) {
    return {
      provider: "mock",
      estimatedUsd: 0,
      estimatedCny: 0,
      lineItems: [],
      note: "当前使用内置 mock 数据，本次分析没有产生外部 API 成本。"
    };
  }

  if (providerName === "geoapify") {
    const lineItems = [
      {
        sku: "Geoapify Geocoding",
        count: 1,
        unitPriceUsd: GEOAPIFY_PRICING.geocoding,
        subtotalUsd: GEOAPIFY_PRICING.geocoding
      },
      {
        sku: "Geoapify Places",
        count: 1,
        unitPriceUsd: GEOAPIFY_PRICING.places,
        subtotalUsd: GEOAPIFY_PRICING.places
      }
    ];
    const estimatedUsd = roundUsd(
      lineItems.reduce((sum, item) => sum + item.subtotalUsd, 0)
    );

    return {
      provider: "geoapify",
      estimatedUsd,
      estimatedCny: toCny(estimatedUsd),
      lineItems,
      note: "基于 Geoapify 地理编码 + Places 两次请求估算，实际账单以供应商结算为准。"
    };
  }

  const textSearchCount = Math.max(1, 1 + candidateCount * 4);
  const lineItems = [
    {
      sku: "Google Geocoding",
      count: 1,
      unitPriceUsd: GOOGLE_PRICING.geocoding,
      subtotalUsd: GOOGLE_PRICING.geocoding
    },
    {
      sku: "Google Places Text Search Pro",
      count: textSearchCount,
      unitPriceUsd: GOOGLE_PRICING.textSearchPro,
      subtotalUsd: GOOGLE_PRICING.textSearchPro * textSearchCount
    }
  ];
  const estimatedUsd = roundUsd(
    lineItems.reduce((sum, item) => sum + item.subtotalUsd, 0)
  );

  return {
    provider: "google-places",
    estimatedUsd,
    estimatedCny: toCny(estimatedUsd),
    lineItems,
    note: "基于当前实现的 Google Geocoding + 候选点二次 Text Search 估算。现在每个候选点会再抓一圈周边 POI，所以单次分析成本高于早期版本。"
  };
}
