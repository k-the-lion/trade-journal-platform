import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={<div className="text-muted">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
