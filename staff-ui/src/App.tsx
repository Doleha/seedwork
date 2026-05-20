import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import DecisionQueue from './pages/DecisionQueue';
import CohortDashboard from './pages/CohortDashboard';
import Reports from './pages/Reports';
import CorrectiveActions from './pages/CorrectiveActions';
import DataEntry from './pages/DataEntry';
import GrantsPipeline from './pages/GrantsPipeline';
import DonorDashboard from './pages/DonorDashboard';
import ComplianceDashboard from './pages/ComplianceDashboard';
import AlumniNetwork from './pages/AlumniNetwork';
import BoardManagement from './pages/BoardManagement';
import VolunteerManagement from './pages/VolunteerManagement';
import InvestorPipeline from './pages/InvestorPipeline';
import ApplicationPipeline from './pages/ApplicationPipeline';

// TODO: add authentication in v2

const ACTIVE_PHASE = parseInt(import.meta.env.VITE_ACTIVE_PHASE ?? '1');

type Tab = {
  id: string;
  label: string;
  phase: number;
  component: React.ComponentType;
};

const TABS: Tab[] = [
  { id: 'decisions', label: 'Decision Queue', phase: 1, component: DecisionQueue },
  { id: 'cohorts', label: 'Cohort Dashboard', phase: 1, component: CohortDashboard },
  { id: 'reports', label: 'Reports', phase: 1, component: Reports },
  { id: 'corrective', label: 'Corrective Actions', phase: 1, component: CorrectiveActions },
  { id: 'data-entry', label: 'Data Entry', phase: 1, component: DataEntry },
  { id: 'grants', label: 'Grants Pipeline', phase: 2, component: GrantsPipeline },
  { id: 'donors', label: 'Donors', phase: 2, component: DonorDashboard },
  { id: 'compliance', label: 'Compliance', phase: 2, component: ComplianceDashboard },
  { id: 'alumni', label: 'Alumni Network', phase: 2, component: AlumniNetwork },
  { id: 'board', label: 'Board', phase: 2, component: BoardManagement },
  { id: 'volunteers', label: 'Volunteers', phase: 2, component: VolunteerManagement },
  { id: 'investors', label: 'Investors', phase: 3, component: InvestorPipeline },
  { id: 'applications', label: 'Applications', phase: 3, component: ApplicationPipeline },
];

type BoardAlert = {
  id: string;
  agent_id: string;
  action_description: string;
  board_notification_summary: string | null;
  cycle_count: number;
  created_at: string;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('decisions');
  const [boardAlerts, setBoardAlerts] = useState<BoardAlert[]>([]);

  const visibleTabs = TABS.filter(t => t.phase <= ACTIVE_PHASE);
  const activeTabDef = visibleTabs.find(t => t.id === activeTab) ?? visibleTabs[0];
  const ActivePage = activeTabDef.component;

  useEffect(() => {
    loadBoardAlerts();

    const channel = supabase
      .channel('board-alerts')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'corrective_actions',
        filter: "escalation_level=eq.board",
      }, () => loadBoardAlerts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadBoardAlerts() {
    const { data } = await supabase
      .from('corrective_actions')
      .select('id, agent_id, action_description, board_notification_summary, cycle_count, created_at')
      .eq('escalation_level', 'board')
      .neq('status', 'resolved')
      .order('created_at', { ascending: false });
    setBoardAlerts(data ?? []);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {boardAlerts.length > 0 && (
        <div className="bg-red-600 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-start gap-3">
              <span className="text-xl font-bold shrink-0">⚠ Board Escalation Required</span>
              <div className="flex flex-col gap-1 min-w-0">
                {boardAlerts.map(alert => (
                  <div key={alert.id} className="text-sm">
                    <span className="font-semibold">{alert.agent_id}</span>
                    {' — '}
                    {alert.board_notification_summary ?? alert.action_description}
                    {' '}
                    <span className="opacity-75">(cycle {alert.cycle_count})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-4 py-3">
            <h1 className="text-lg font-bold text-gray-900 shrink-0">
              Seedwork
            </h1>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              Phase {ACTIVE_PHASE}
            </span>
          </div>

          <nav className="flex gap-1 overflow-x-auto pb-0" aria-label="Tabs">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <ActivePage />
      </main>
    </div>
  );
}
