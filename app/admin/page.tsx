import { AdminGuard } from "@/components/admin-guard";
import { AdminDashboard } from "@/components/admin-dashboard";
import { SiteNav } from "@/components/site-nav";

export default function AdminPage() {
  return (
    <>
      <SiteNav />
      <main className="dashboard-shell">
        <div className="container">
          <AdminGuard>
            <AdminDashboard />
          </AdminGuard>
        </div>
      </main>
    </>
  );
}
