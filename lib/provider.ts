import { getMockCandidates } from "@/lib/sample-data";
import { getStoreTypeProfile } from "@/lib/store-config";
import { GooglePlaceCandidate, PlaceDataProvider, ProviderSearchContext } from "@/lib/types";

const googleCache = new Map<string, GooglePlaceCandidate[]>();

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function buildCacheKey(context: ProviderSearchContext) {
  return JSON.stringify({
    address: context.address,
    businessType: context.businessType,
    cuisineFocus: context.cuisineFocus,
    preferredAreaType: context.preferredAreaType,
    radiusMeters: context.radiusMeters
  });
}

async function mockDelay() {
  await new Promise((resolve) => setTimeout(resolve, 450));
}

type GeoapifyFeature = {
  properties?: {
    name?: string;
    formatted?: string;
    lat?: number;
    lon?: number;
    distance?: number;
    categories?: string[];
  };
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  types?: string[];
};

function buildGoogleSearchQueries(context: ProviderSearchContext) {
  const profile = getStoreTypeProfile(context.businessType);
  const areaHint =
    context.preferredAreaType === "office"
      ? "business district"
      : context.preferredAreaType === "mall"
        ? "shopping mall"
        : "neighborhood center";

  return Array.from(
    new Set([
      ...profile.initialSearchQueries.map((hint) => `${hint} near ${context.address}`),
      `${areaHint} near ${context.address}`
    ])
  );
}

function getGeoapifyCategorySet(preferredAreaType: ProviderSearchContext["preferredAreaType"]) {
  if (preferredAreaType === "office") {
    return "commercial,catering,public_transport";
  }

  if (preferredAreaType === "mall") {
    return "commercial,catering,public_transport";
  }

  return "commercial,catering,education";
}

function distanceInMeters(
  originLat: number,
  originLng: number,
  pointLat: number,
  pointLng: number
) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRadians(pointLat - originLat);
  const deltaLng = toRadians(pointLng - originLng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(originLat)) *
      Math.cos(toRadians(pointLat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function vibeFromCounts(anchor: number, transit: number, complementary: number) {
  if (anchor >= 5 || complementary >= 16 || transit >= 4) {
    return "prime" as const;
  }

  if (anchor >= 3 || complementary >= 10 || transit >= 2) {
    return "steady" as const;
  }

  return "emerging" as const;
}

function normalizeGeoapifyCandidates(
  features: GeoapifyFeature[],
  preferredAreaType: ProviderSearchContext["preferredAreaType"]
) {
  const validFeatures = features.filter(
    (feature) =>
      typeof feature.properties?.lat === "number" &&
      typeof feature.properties?.lon === "number"
  );

  const hubFeatures = validFeatures
    .filter((feature) => {
      const categories = feature.properties?.categories ?? [];
      if (preferredAreaType === "residential") {
        return categories.some(
          (item) => item.startsWith("commercial") || item.startsWith("education")
        );
      }

      return categories.some(
        (item) => item.startsWith("commercial") || item.startsWith("public_transport")
      );
    })
    .slice(0, 5);

  const seedFeatures = hubFeatures.length > 0 ? hubFeatures : validFeatures.slice(0, 5);

  return seedFeatures.map((feature, index) => {
    const lat = feature.properties?.lat as number;
    const lng = feature.properties?.lon as number;
    const nearby = validFeatures.filter((candidate) => {
      const pointLat = candidate.properties?.lat;
      const pointLng = candidate.properties?.lon;

      if (typeof pointLat !== "number" || typeof pointLng !== "number") {
        return false;
      }

      return distanceInMeters(lat, lng, pointLat, pointLng) <= 700;
    });

    const competitor = nearby.filter((candidate) =>
      (candidate.properties?.categories ?? []).some((item) => item.startsWith("catering"))
    ).length;
    const transit = nearby.filter((candidate) =>
      (candidate.properties?.categories ?? []).some((item) =>
        item.startsWith("public_transport")
      )
    ).length;
    const anchor = nearby.filter((candidate) =>
      (candidate.properties?.categories ?? []).some((item) => item.startsWith("commercial"))
    ).length;
    const complementary = nearby.filter(
      (candidate) =>
        !(candidate.properties?.categories ?? []).some((item) => item.startsWith("catering"))
    ).length;

    const footTrafficIndex = clamp(anchor * 10 + complementary * 4 + transit * 8 + 28);
    const rentIndex = clamp(
      42 +
        anchor * 6 +
        transit * 5 +
        (preferredAreaType === "mall" ? 12 : 0) +
        index * 2
    );

    return {
      id: `geoapify-${index}-${Math.round(lat * 1000)}-${Math.round(lng * 1000)}`,
      name:
        feature.properties?.name ??
        feature.properties?.formatted ??
        `Candidate ${index + 1}`,
      lat,
      lng,
      travelModeHint:
        transit >= 3 ? "交通节点密集，可达性较好" : "周边步行可达业态较集中",
      counts: {
        competitor,
        complementary,
        transit,
        anchor
      },
      vibe: vibeFromCounts(anchor, transit, complementary),
      footTrafficIndex,
      rentIndex,
      nearbyLandmarks: nearby
        .map((candidate) => candidate.properties?.name)
        .filter((value): value is string => Boolean(value))
        .slice(0, 3)
    };
  });
}

async function googleSearchText(
  apiKey: string,
  textQuery: string,
  latitude: number,
  longitude: number,
  radius: number,
  maxResultCount = 6
) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.types"
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount,
      locationBias: {
        circle: {
          center: {
            latitude,
            longitude
          },
          radius
        }
      }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Google Places 请求失败: ${textQuery}`);
  }

  const json = (await response.json()) as { places?: GooglePlace[] };
  return json.places ?? [];
}

function uniquePlaces(...groups: GooglePlace[][]) {
  const seen = new Set<string>();
  const merged: GooglePlace[] = [];

  for (const group of groups) {
    for (const place of group) {
      const key =
        place.id ??
        `${place.displayName?.text ?? "unknown"}:${place.location?.latitude ?? 0}:${place.location?.longitude ?? 0}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      merged.push(place);
    }
  }

  return merged;
}

async function enrichGoogleCandidate(
  apiKey: string,
  candidate: GooglePlace,
  context: ProviderSearchContext,
  index: number
): Promise<GooglePlaceCandidate> {
  const profile = getStoreTypeProfile(context.businessType);
  const lat = candidate.location?.latitude;
  const lng = candidate.location?.longitude;

  if (typeof lat !== "number" || typeof lng !== "number") {
    throw new Error("Google 候选区域缺少经纬度。");
  }

  const searchRadius = Math.min(Math.max(Math.round(context.radiusMeters / 2), 500), 900);
  const [competitors, complementary, transit, anchors] = await Promise.all([
    googleSearchText(apiKey, profile.competitorQuery, lat, lng, searchRadius, 8),
    googleSearchText(
      apiKey,
      profile.complementaryQuery[context.preferredAreaType],
      lat,
      lng,
      searchRadius,
      8
    ),
    googleSearchText(apiKey, "transit station", lat, lng, searchRadius, 8),
    googleSearchText(
      apiKey,
      profile.anchorQuery[context.preferredAreaType],
      lat,
      lng,
      searchRadius,
      8
    )
  ]);

  const mergedNearby = uniquePlaces(anchors, complementary, transit);
  const anchorCount = anchors.length;
  const complementaryCount = complementary.length;
  const transitCount = transit.length;
  const competitorCount = competitors.length;

  const footTrafficIndex = clamp(
    30 +
      anchorCount * 9 +
      complementaryCount * 5 +
      transitCount * 8 -
      competitorCount * 1.5 +
      (context.preferredAreaType === "mall" ? 10 : 0)
  );
  const rentIndex = clamp(
    40 +
      anchorCount * 7 +
      transitCount * 5 +
      complementaryCount * 2 +
      (context.preferredAreaType === "mall" ? 12 : 0) +
      index * 2
  );

  return {
    id: candidate.id ?? `google-place-${index}`,
    name: candidate.displayName?.text ?? `Candidate ${index + 1}`,
    lat,
    lng,
    travelModeHint:
      transitCount >= 4 ? "周边交通节点密集，跨区导流能力较强" : "步行与片区消费半径较集中",
    counts: {
      competitor: competitorCount,
      complementary: complementaryCount,
      transit: transitCount,
      anchor: anchorCount
    },
    vibe: vibeFromCounts(anchorCount, transitCount, complementaryCount),
    footTrafficIndex,
    rentIndex,
    nearbyLandmarks: mergedNearby
      .map((place) => place.displayName?.text)
      .filter((value): value is string => Boolean(value))
      .slice(0, 4)
  };
}

export class GeoapifyProvider implements PlaceDataProvider {
  providerName = "geoapify";

  async getCandidateAreas(
    context: ProviderSearchContext
  ): Promise<GooglePlaceCandidate[]> {
    const cacheKey = `geoapify:${buildCacheKey(context)}`;
    const cached = googleCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
    if (!apiKey) {
      await mockDelay();
      throw new Error("Geoapify API key 未配置，无法执行真实分析。");
    }

    try {
      const geocodeResponse = await fetch(
        `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(context.address)}&format=json&limit=1&apiKey=${apiKey}`,
        { cache: "no-store" }
      );

      if (!geocodeResponse.ok) {
        throw new Error("Geoapify Geocoding 请求失败");
      }

      const geocodeJson = (await geocodeResponse.json()) as {
        results?: Array<{ lat?: number; lon?: number }>;
      };
      const origin = geocodeJson.results?.[0];

      if (typeof origin?.lat !== "number" || typeof origin.lon !== "number") {
        throw new Error("无法解析目标地点，请尝试更完整的地址");
      }

      const placesResponse = await fetch(
        `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(
          getGeoapifyCategorySet(context.preferredAreaType)
        )}&filter=circle:${origin.lon},${origin.lat},${context.radiusMeters}&bias=proximity:${origin.lon},${origin.lat}&limit=24&apiKey=${apiKey}`,
        { cache: "no-store" }
      );

      if (!placesResponse.ok) {
        throw new Error("Geoapify Places 请求失败");
      }

      const placesJson = (await placesResponse.json()) as {
        features?: GeoapifyFeature[];
      };

      const normalized = normalizeGeoapifyCandidates(
        placesJson.features ?? [],
        context.preferredAreaType
      );
      if (normalized.length > 0) {
        googleCache.set(cacheKey, normalized);
        return normalized;
      }

      throw new Error("Geoapify 未找到可用于评分的候选区域，请调整地址或分析半径。");
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Geoapify 数据抓取失败，请稍后重试。");
    }
  }
}

export class GooglePlacesProvider implements PlaceDataProvider {
  providerName = "google-places";

  async getCandidateAreas(
    context: ProviderSearchContext
  ): Promise<GooglePlaceCandidate[]> {
    const cacheKey = buildCacheKey(context);
    const cached = googleCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
      await mockDelay();
      throw new Error("Google Maps API key 未配置，无法执行真实分析。");
    }

    try {
      const geocodeResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(context.address)}&key=${apiKey}`,
        { cache: "no-store" }
      );

      if (!geocodeResponse.ok) {
        throw new Error("Google Geocoding 请求失败");
      }

      const geocodeJson = (await geocodeResponse.json()) as {
        results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
      };
      const location = geocodeJson.results?.[0]?.geometry?.location;

      if (!location?.lat || !location.lng) {
        throw new Error("无法解析目标地点，请尝试更完整的地址");
      }

      const originLat = location.lat;
      const originLng = location.lng;
      const queries = buildGoogleSearchQueries(context);
      let foundPlaces: GooglePlace[] | undefined;

      for (const textQuery of queries) {
        const places = await googleSearchText(
          apiKey,
          textQuery,
          originLat,
          originLng,
          context.radiusMeters,
          5
        );

        if (places.length > 0) {
          foundPlaces = places;
          break;
        }
      }

      if (!foundPlaces || foundPlaces.length === 0) {
        throw new Error("Google Places 未找到可用于评分的候选区域，请调整地址、品类或分析半径。");
      }

      const normalized = await Promise.all(
        foundPlaces.slice(0, 5).map((place, index) =>
          enrichGoogleCandidate(apiKey, place, context, index)
        )
      );

      googleCache.set(cacheKey, normalized);
      return normalized;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Google Places 数据抓取失败，请稍后重试。");
    }
  }
}

export function createProvider() {
  if (process.env.GEOAPIFY_API_KEY) {
    return new GeoapifyProvider();
  }

  if (process.env.GOOGLE_MAPS_API_KEY) {
    return new GooglePlacesProvider();
  }

  return {
    providerName: "mock",
    async getCandidateAreas(context: ProviderSearchContext) {
      await mockDelay();
      return getMockCandidates(context.preferredAreaType);
    }
  } satisfies PlaceDataProvider;
}

export function getProviderMode() {
  if (process.env.GEOAPIFY_API_KEY) {
    return {
      provider: "geoapify",
      fallbackToMock: false
    } as const;
  }

  if (process.env.GOOGLE_MAPS_API_KEY) {
    return {
      provider: "google-places",
      fallbackToMock: false
    } as const;
  }

  return {
    provider: "mock",
    fallbackToMock: true
  } as const;
}
