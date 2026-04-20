# Radar One

商圈选址助手 MVP，面向创业开店者。用户输入项目画像与目标地点后，系统生成周边候选区域排行榜、分维度评分、推荐理由、风险提示与下一步建议。

## Included in this MVP

- Next.js App Router 项目骨架
- 首页、登录页、项目中心、新建分析、分析详情 5 个主页面
- `GooglePlacesProvider` 数据源抽象，支持：
  - 优先使用 `Geoapify` 作为更便宜的商用地点/地理编码方案
  - 若未配置 Geoapify，则回退到 Google Maps Platform
  - 配置 `GOOGLE_MAPS_API_KEY` 时请求 Google Geocoding 与 Places API
  - 配置 `GEOAPIFY_API_KEY` 时请求 Geoapify Geocoding 与 Places API
  - 未配置时回退到内置 mock 数据，便于本地演示
- 规则评分引擎：
  - 人流代理
  - 竞品可控度
  - 互补业态
  - 到达便利
  - 商圈成熟度
  - 租金压力
- 本地浏览器持久化：
  - 演示登录
  - 项目保存
  - 分析结果回看

## Run locally

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## Environment

可选环境变量：

```bash
GEOAPIFY_API_KEY=your_geoapify_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

优先级：

1. `GEOAPIFY_API_KEY`
2. `GOOGLE_MAPS_API_KEY`
3. 内置 mock 数据




