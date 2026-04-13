import Link from "next/link";

import { dashboardStats } from "@/lib/constants";

const heroPins = [
  { name: "Midtown Commons", score: 88, left: "18%", top: "28%", note: "办公客流" },
  { name: "Harbor Market", score: 81, left: "58%", top: "22%", note: "游客 + 写字楼" },
  { name: "Sunset Quarter", score: 76, left: "26%", top: "62%", note: "家庭复购" }
];

const featureItems = [
  {
    title: "从项目条件出发，而不是只看热闹",
    copy:
      "系统会先理解你的品类、规模、预算、客单价与目标客群，再去判断哪些区域和你的店真正匹配。"
  },
  {
    title: "规则评分做排序，建议结果可解释",
    copy:
      "每个区域都会拆出人流、竞品、互补业态、交通便利、成熟度与租金压力等维度，不会只给一个黑箱结论。"
  },
  {
    title: "保留风险提示，避免只看高分区域",
    copy:
      "推荐和不推荐的原因都会同时展示，帮助你在实地考察前更快筛掉不合适的候选区域。"
  }
];

const workflowSteps = [
  {
    title: "1. 输入项目画像",
    copy:
      "填写火锅店、茶饮店、烘焙等项目类型，并补充预算、面积、客单价、目标客群与偏好区域。"
  },
  {
    title: "2. 设定目标地点",
    copy:
      "输入想开店的地址或目标片区，系统会以这个点为中心抓取周边候选商圈与可经营区域。"
  },
  {
    title: "3. 获得推荐榜单",
    copy:
      "输出 3 到 5 个优先区域，附带总分、分维度表现、为什么推荐、为什么不推荐和下一步建议。"
  },
  {
    title: "4. 保存并复盘",
    copy:
      "登录后可以持续保存每次分析，回到项目中心查看历史方案，对比不同地址与不同经营设定。"
  }
];

export function LandingPage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="pill">面向创业开店者的商圈选址工作台</div>
            <div>
              <h1 className="hero-title">找到更值得去谈的那条街。</h1>
              <p>
                Radar One 会把你的项目条件和目标地点一起带入分析，
                从 Google 地点数据与规则评分中筛出更适合落店的候选区域，
                让你先有一份可以解释、可以对比、可以继续实勘的开店地图。
              </p>
            </div>

            <div className="hero-actions">
              <Link className="primary-button" href="/projects/new">
                开始一次选址分析
              </Link>
              <Link className="ghost-button" href="/projects">
                查看项目中心
              </Link>
            </div>
          </div>

          <div className="hero-visual">
            <div className="radar-panel">
              <div className="radar-grid" />
              <div className="radar-ring radar-ring-1" />
              <div className="radar-ring radar-ring-2" />
              <div className="radar-ring radar-ring-3" />
              <div className="radar-origin" />
              {heroPins.map((pin) => (
                <div
                  className="candidate-pin"
                  key={pin.name}
                  style={{ left: pin.left, top: pin.top }}
                >
                  <div className="candidate-score">{pin.score}</div>
                  <div className="candidate-meta">
                    <strong>{pin.name}</strong>
                    <span>{pin.note}</span>
                  </div>
                </div>
              ))}

              <div className="stats-strip">
                {dashboardStats.map((stat) => (
                  <div className="stat-chip" key={stat.label}>
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container feature-layout">
          <div className="soft-panel">
            <p className="eyebrow">Why It Works</p>
            <h2 className="section-title">不是地图找点，而是经营条件匹配。</h2>
            <p className="section-copy">
              第一版聚焦在创业者真正要做的决策上:
              先把“适不适合开这类店”判断出来，再去看具体铺位。
            </p>
          </div>

          <div className="soft-panel list-grid">
            {featureItems.map((item) => (
              <div className="list-item" key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.copy}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container workflow-layout">
          <div className="soft-panel">
            <p className="eyebrow">Workflow</p>
            <h2 className="section-title">四步拿到能用的选址建议。</h2>
            <p className="section-copy">
              先跑出清晰榜单，再把线下实勘与租金谈判放到更小的范围内。
            </p>
          </div>

          <div className="soft-panel list-grid">
            {workflowSteps.map((step) => (
              <div className="list-item" key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.copy}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="footer-pad" />
    </main>
  );
}
