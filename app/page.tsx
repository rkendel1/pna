import { DecisionInbox } from "@/components/decision-inbox";
import { getServerDb } from "@/lib/feltdb";

export default async function Home() {
  await getServerDb();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <DecisionInbox />
      </div>
    </main>
  );
}
