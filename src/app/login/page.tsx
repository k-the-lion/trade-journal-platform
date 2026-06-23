import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { AuthHashHandler } from "@/components/AuthHashHandler";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <AuthHashHandler />
      <Suspense fallback={<div className="text-muted">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
