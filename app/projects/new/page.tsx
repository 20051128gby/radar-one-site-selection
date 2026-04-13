import { ProjectForm } from "@/components/project-form";
import { SiteNav } from "@/components/site-nav";

export default function NewProjectPage() {
  return (
    <>
      <SiteNav />
      <main className="dashboard-shell">
        <div className="container dashboard-grid">
          <aside className="stack">
            <div className="soft-panel">
              <p className="eyebrow">Input Guide</p>
              <h2 style={{ marginTop: 14 }}>输入越完整，候选区域越稳定。</h2>
              <p className="section-copy">
                建议至少明确品类、预算、目标客单价和目标客群。系统会用这些信息调整各评分维度的匹配逻辑。
              </p>
            </div>
            <div className="soft-panel">
              <p className="eyebrow">Scoring Logic</p>
              <h2 style={{ marginTop: 14 }}>当前评分维度</h2>
              <p className="section-copy">
                人流代理、竞品可控度、互补业态、到达便利、商圈成熟度、租金压力。
              </p>
            </div>
          </aside>

          <ProjectForm />
        </div>
      </main>
    </>
  );
}
