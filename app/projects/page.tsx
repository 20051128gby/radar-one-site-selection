import Link from "next/link";

import { ProjectList } from "@/components/project-list";
import { SiteNav } from "@/components/site-nav";

export default function ProjectsPage() {
  return (
    <>
      <SiteNav />
      <main className="dashboard-shell">
        <div className="container stack">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">Project Center</p>
              <h1>保存每一次商圈判断。</h1>
              <p>
                这里汇总所有分析项目。你可以快速回看历史选址、比较不同目标地点，
                也能把一次输入继续扩展成下一轮分析。
              </p>
            </div>
            <Link className="primary-button" href="/projects/new">
              新建分析
            </Link>
          </div>

          <ProjectList />
        </div>
      </main>
    </>
  );
}
