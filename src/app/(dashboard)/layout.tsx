import { redirect } from "next/navigation";
import { getProfile, getUser } from "@/lib/supabase/server";
import { DashboardNav } from "@/components/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();
  if (!profile) {
    // Authenticated but no profile — avoid /login ↔ /dashboard redirect loop
    redirect("/login?error=profile_setup");
  }

  return (
    <>
      <DashboardNav email={profile.email} />
      <main className="max-w-[90rem] mx-auto px-4 py-8">{children}</main>
    </>
  );
}
