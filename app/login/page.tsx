import { LoginForm } from "@/components/login-form";
import { SiteNav } from "@/components/site-nav";

export default function LoginPage() {
  return (
    <>
      <SiteNav />
      <main className="dashboard-shell">
        <div className="container" style={{ maxWidth: 760 }}>
          <LoginForm />
        </div>
      </main>
    </>
  );
}
