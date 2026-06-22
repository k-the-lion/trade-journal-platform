import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-2xl text-center space-y-6">
        <p className="text-primary text-sm font-medium tracking-wide uppercase">Trading Journal Platform</p>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
          Log trades. Get AI coaching. Track your edge.
        </h1>
        <p className="text-muted text-lg">
          Multi-user journal for traders and coaches. Students log trades, AI analyzes performance
          using coach-defined rules, and reporting dashboards show the numbers.
        </p>
        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <Link href="/signup" className="btn btn-primary">Get started</Link>
          <Link href="/login" className="btn btn-secondary">Sign in</Link>
        </div>
        <p className="text-xs text-muted pt-4">
          Educational tool only — not financial advice.
        </p>
      </div>
    </main>
  );
}
