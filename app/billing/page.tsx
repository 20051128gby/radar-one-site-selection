import { BillingPage } from "@/components/billing-page";
import { SiteNav } from "@/components/site-nav";

export default function BillingRoutePage() {
  return (
    <>
      <SiteNav />
      <main className="dashboard-shell">
        <div className="container">
          <BillingPage />
        </div>
      </main>
    </>
  );
}
