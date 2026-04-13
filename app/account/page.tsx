import { AccountDashboard } from "@/components/account-dashboard";
import { SiteNav } from "@/components/site-nav";

export default function AccountPage() {
  return (
    <>
      <SiteNav />
      <main className="dashboard-shell">
        <div className="container">
          <AccountDashboard />
        </div>
      </main>
    </>
  );
}
