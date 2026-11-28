import { DashboardNav } from '@/components/dashboard-nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="font-mono text-3xl font-bold text-cyber-cyan">Espace personnel</h1>
      <DashboardNav />
      {children}
    </div>
  );
}
