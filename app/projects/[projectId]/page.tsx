import { ProjectDetail } from "@/components/project-detail";
import { SiteNav } from "@/components/site-nav";

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <>
      <SiteNav />
      <main className="dashboard-shell">
        <div className="container">
          <ProjectDetail projectId={projectId} />
        </div>
      </main>
    </>
  );
}
