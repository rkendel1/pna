import { cookies } from "next/headers";
import { DecisionInbox } from "@/components/decision-inbox";
import { demoSessionCookie } from "@/lib/demo-auth";
import { getServerDb } from "@/lib/feltdb";

export default async function Home() {
  await getServerDb();
  const cookieStore = await cookies();
  const operatorEnabled = cookieStore.get(demoSessionCookie.name)?.value === demoSessionCookie.value;

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <DecisionInbox initialOperatorEnabled={operatorEnabled} />
      </div>
    </main>
  );
}
