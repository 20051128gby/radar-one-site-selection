import { GooglePlaceCandidate, PreferredAreaType } from "@/lib/types";

const candidateSets: Record<PreferredAreaType, GooglePlaceCandidate[]> = {
  office: [
    {
      id: "midtown-commons",
      name: "Midtown Commons",
      lat: 37.7876,
      lng: -122.4014,
      travelModeHint: "近写字楼群与通勤枢纽",
      counts: { competitor: 7, complementary: 16, transit: 5, anchor: 6 },
      vibe: "prime",
      footTrafficIndex: 86,
      rentIndex: 82,
      nearbyLandmarks: ["金融街办公区", "地铁换乘站", "精品超市"]
    },
    {
      id: "harbor-market",
      name: "Harbor Market",
      lat: 37.7932,
      lng: -122.3932,
      travelModeHint: "午晚高峰明显，游客与办公客混合",
      counts: { competitor: 5, complementary: 12, transit: 4, anchor: 5 },
      vibe: "steady",
      footTrafficIndex: 78,
      rentIndex: 70,
      nearbyLandmarks: ["滨水步行带", "共享办公中心", "精品酒店"]
    },
    {
      id: "mission-yard",
      name: "Mission Yard",
      lat: 37.7824,
      lng: -122.4058,
      travelModeHint: "夜间餐饮聚集，年轻客群偏多",
      counts: { competitor: 11, complementary: 10, transit: 4, anchor: 4 },
      vibe: "prime",
      footTrafficIndex: 88,
      rentIndex: 90,
      nearbyLandmarks: ["联合办公园区", "影院街区", "创意市集"]
    },
    {
      id: "north-ridge",
      name: "North Ridge",
      lat: 37.7987,
      lng: -122.4081,
      travelModeHint: "成熟办公社区，通勤稳定",
      counts: { competitor: 4, complementary: 9, transit: 3, anchor: 4 },
      vibe: "steady",
      footTrafficIndex: 68,
      rentIndex: 64,
      nearbyLandmarks: ["区域图书馆", "居民综合体", "企业园"]
    }
  ],
  residential: [
    {
      id: "sunset-quarter",
      name: "Sunset Quarter",
      lat: 37.7606,
      lng: -122.4871,
      travelModeHint: "家庭客群稳定，周末消费强",
      counts: { competitor: 4, complementary: 11, transit: 3, anchor: 5 },
      vibe: "steady",
      footTrafficIndex: 70,
      rentIndex: 48,
      nearbyLandmarks: ["社区超市", "小学", "运动公园"]
    },
    {
      id: "brooklane-hub",
      name: "Brooklane Hub",
      lat: 37.7528,
      lng: -122.4496,
      travelModeHint: "住宅与轻商业混合，夜宵需求可挖",
      counts: { competitor: 3, complementary: 8, transit: 2, anchor: 3 },
      vibe: "emerging",
      footTrafficIndex: 62,
      rentIndex: 40,
      nearbyLandmarks: ["社区商业街", "健身中心", "公寓群"]
    },
    {
      id: "oak-village",
      name: "Oak Village",
      lat: 37.7429,
      lng: -122.4314,
      travelModeHint: "本地居民复购高，外来客较少",
      counts: { competitor: 2, complementary: 7, transit: 2, anchor: 2 },
      vibe: "steady",
      footTrafficIndex: 54,
      rentIndex: 36,
      nearbyLandmarks: ["社区医院", "学校", "街角咖啡馆"]
    },
    {
      id: "elm-crossing",
      name: "Elm Crossing",
      lat: 37.7733,
      lng: -122.4614,
      travelModeHint: "临近主干道，停车便利",
      counts: { competitor: 5, complementary: 10, transit: 3, anchor: 4 },
      vibe: "steady",
      footTrafficIndex: 66,
      rentIndex: 52,
      nearbyLandmarks: ["生活广场", "社区影院", "大卖场"]
    }
  ],
  mall: [
    {
      id: "grand-arcade",
      name: "Grand Arcade",
      lat: 37.7842,
      lng: -122.4076,
      travelModeHint: "大型购物中心内外联动，全天候客流",
      counts: { competitor: 9, complementary: 18, transit: 5, anchor: 8 },
      vibe: "prime",
      footTrafficIndex: 90,
      rentIndex: 94,
      nearbyLandmarks: ["旗舰百货", "影院", "地铁站"]
    },
    {
      id: "canopy-galleria",
      name: "Canopy Galleria",
      lat: 37.7818,
      lng: -122.413,
      travelModeHint: "中高客单价消费场景，周末爆发",
      counts: { competitor: 6, complementary: 15, transit: 4, anchor: 7 },
      vibe: "prime",
      footTrafficIndex: 84,
      rentIndex: 86,
      nearbyLandmarks: ["购物中心", "精品影院", "停车楼"]
    },
    {
      id: "station-plaza",
      name: "Station Plaza",
      lat: 37.7892,
      lng: -122.3959,
      travelModeHint: "交通导入强，快进快出消费明显",
      counts: { competitor: 8, complementary: 13, transit: 5, anchor: 5 },
      vibe: "steady",
      footTrafficIndex: 81,
      rentIndex: 78,
      nearbyLandmarks: ["铁路总站", "连锁零售", "商务酒店"]
    },
    {
      id: "copper-square",
      name: "Copper Square",
      lat: 37.7704,
      lng: -122.4241,
      travelModeHint: "新兴购物街区，客流成长中",
      counts: { competitor: 4, complementary: 11, transit: 3, anchor: 4 },
      vibe: "emerging",
      footTrafficIndex: 67,
      rentIndex: 58,
      nearbyLandmarks: ["生活方式商街", "潮流买手店", "停车场"]
    }
  ]
};

export function getMockCandidates(preferredAreaType: PreferredAreaType) {
  return candidateSets[preferredAreaType];
}
