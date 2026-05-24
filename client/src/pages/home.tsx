import React, { useMemo } from 'react';
import { useTranslation } from '@/lib/translations';
import { useApp } from '@/context/app-context';
import { useLocation } from 'wouter';
import { useDocuments } from '@/hooks/use-documents';
import { useQuery } from '@tanstack/react-query';
import { Event } from '@shared/schema';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import StudentProfile from '@/components/student-profile';
import { Menu, X, LogOut, ChevronRight } from 'lucide-react';

const cardMotion = "transition-transform duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(0,0,0,0.35)]";

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { user, isLoading: userLoading, logout } = useApp();
  const { getDocumentCounts } = useDocuments();
  const [_, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Events
  const { data: events, isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  // Mandatory docs / expiries
  interface MandatoryDocStatus { key: string; title: string; uploaded: boolean; expiryDate: string | null }
  const { data: mandatoryData } = useQuery<{ mandatory: MandatoryDocStatus[] }>({
    queryKey: ['mandatory-docs'],
    queryFn: async () => {
      const r = await fetch('/api/mandatory-docs');
      if (!r.ok) throw new Error('Failed to load mandatory docs');
      return r.json();
    },
    staleTime: 15_000,
  });

  const mand = mandatoryData?.mandatory || [];
  const totalMand = mand.length || 4;
  const uploadedMand = mand.filter(m => m.uploaded).length;

  const upcomingExpiries = useMemo(() => {
    const now = new Date();
    const oneDay = 1000 * 60 * 60 * 24;
    return mand
      .filter(m => m.expiryDate)
      .map(m => {
        const d = new Date(m.expiryDate as string);
        const daysLeft = Math.ceil((d.getTime() - now.getTime()) / oneDay);
        return { title: m.title, daysLeft };
      })
      .filter(x => x.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 5);
  }, [mand]);

  const docCounts = getDocumentCounts();
  const firstName = (user?.fullName || 'Student').split(' ')[0];

  if (userLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-neutral-950">
        <p className="text-lg text-white">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="w-screen min-h-screen bg-neutral-950 text-neutral-100 overflow-x-hidden">
      {/* NAVIGATION */}
      <nav className="sticky top-0 z-50 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 w-full">
        <div className="w-full px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">A</div>
            <span className="text-xl font-bold text-white hidden sm:inline">AiVersity</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => setLocation('/chat')} className="text-neutral-300 hover:text-white transition">Chat</button>
            <button onClick={() => setLocation('/documents')} className="text-neutral-300 hover:text-white transition">Documents</button>
            <button onClick={() => setLocation('/recommendations')} className="text-neutral-300 hover:text-white transition">Recommendations</button>
            <button onClick={() => setLocation('/notifications')} className="text-neutral-300 hover:text-white transition">Notifications</button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 pl-4 border-l border-neutral-700">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white">{firstName}</p>
                <p className="text-xs text-neutral-400">Student</p>
              </div>
              <img 
                src={`https://ui-avatars.com/api/?name=${firstName}&bg=3b82f6&color=fff&bold=true`}
                alt={firstName}
                className="w-9 h-9 rounded-full border border-blue-500/30"
              />
            </div>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-neutral-400 hover:text-white">
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-800 bg-neutral-900 p-4 space-y-3">
            <button onClick={() => { setLocation('/chat'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 text-neutral-300 hover:text-white">Chat</button>
            <button onClick={() => { setLocation('/documents'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 text-neutral-300 hover:text-white">Documents</button>
            <button onClick={() => { setLocation('/recommendations'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 text-neutral-300 hover:text-white">Recommendations</button>
            <button onClick={() => { setLocation('/notifications'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 text-neutral-300 hover:text-white">Notifications</button>
          </div>
        )}
      </nav>

      {/* MAIN CONTENT - FULL WIDTH */}
      <main className="w-full">
        {/* HERO SECTION */}
        <section className="w-full bg-gradient-to-b from-neutral-900 to-neutral-950 border-b border-neutral-800 py-12 md:py-20 px-6 lg:px-8">
          <div className="w-full">
            <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                  Welcome back, <span className="text-blue-400">{firstName}</span>! 👋
                </h1>
                <p className="text-lg text-neutral-400 mb-8">
                  Track your academic progress, manage documents, and get AI-powered insights all in one place.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button onClick={() => setLocation('/chat')} className="bg-blue-500 hover:bg-blue-600 px-8 py-3">
                    Ask AI Assistant
                  </Button>
                  <Button onClick={() => setLocation('/documents')} variant="outline" className="px-8 py-3 border-neutral-700 text-white hover:bg-neutral-800">
                    Manage Documents
                  </Button>
                </div>
              </div>
              <div className="hidden md:block text-center">
                <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center text-6xl border border-blue-500/30">
                  📊
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATUS METRICS - FULL WIDTH */}
        <section className="w-full px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatusCard 
                title="Documents Uploaded"
                value={uploadedMand}
                total={totalMand}
                icon="📄"
                color="blue"
                onClick={() => setLocation('/documents')}
              />
              <StatusCard 
                title="Upcoming Events"
                value={events?.length || 0}
                total={10}
                icon="📅"
                color="purple"
                onClick={() => setLocation('/chat')}
              />
              <StatusCard 
                title="Days to Review"
                value={upcomingExpiries.length > 0 ? upcomingExpiries[0].daysLeft : 0}
                total={30}
                icon="⏰"
                color="orange"
                onClick={() => setLocation('/documents')}
              />
              <StatusCard 
                title="Your Progress"
                value={Math.round((uploadedMand / (totalMand || 1)) * 100)}
                total={100}
                icon="✨"
                color="green"
                suffix="%"
                onClick={() => setLocation('/mandatory-docs')}
              />
            </div>
          </div>
        </section>

        {/* QUICK ACTIONS - FULL WIDTH */}
        <section className="w-full px-6 lg:px-8 py-12 md:py-16 bg-neutral-900/50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-8">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <QuickActionCard 
                title="Ask AI Assistant"
                description="Get instant answers about your academics"
                icon="🤖"
                onClick={() => setLocation('/chat')}
              />
              <QuickActionCard 
                title="Course Recommendations"
                description="Get personalized course suggestions"
                icon="🎓"
                onClick={() => setLocation('/recommendations')}
              />
              <QuickActionCard 
                title="Upload Documents"
                description="Upload or manage your files"
                icon="📁"
                onClick={() => setLocation('/documents')}
              />
              <QuickActionCard 
                title="View Notifications"
                description="Check latest updates and alerts"
                icon="🔔"
                onClick={() => setLocation('/notifications')}
              />
            </div>
          </div>
        </section>

        {/* CONTENT GRID - FULL WIDTH */}
        <section className="w-full px-6 lg:px-8 py-12 md:py-16">
          <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-8">
            {/* MAIN CONTENT - 2/3 WIDTH */}
            <div className="lg:col-span-2 space-y-8">
              {/* RECENT EVENTS */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Recent Events</h2>
                  {events && events.length > 0 && (
                    <button onClick={() => setLocation('/chat')} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      View all <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <Card className={`bg-neutral-800/50 border-neutral-700 ${cardMotion}`}>
                  <CardContent className="p-6">
                    {eventsLoading ? (
                      <p className="text-neutral-400 text-center py-12">Loading events...</p>
                    ) : events && events.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-neutral-700">
                              <th className="text-left py-3 px-4 font-semibold text-neutral-300">Event</th>
                              <th className="text-left py-3 px-4 font-semibold text-neutral-300">Date</th>
                              <th className="text-left py-3 px-4 font-semibold text-neutral-300">Location</th>
                            </tr>
                          </thead>
                          <tbody className="text-neutral-300">
                            {events.slice(0, 5).map(ev => (
                              <tr key={ev.id} className="border-b border-neutral-700 hover:bg-neutral-700/30 transition">
                                <td className="py-4 px-4 font-medium">{ev.title}</td>
                                <td className="py-4 px-4 text-neutral-400">{format(new Date(ev.datetime), 'MMM dd, HH:mm')}</td>
                                <td className="py-4 px-4 text-neutral-400">{ev.location}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-neutral-400 text-center py-12">No upcoming events</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ACTION REQUIRED */}
              {upcomingExpiries.length > 0 && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Action Required</h2>
                  <Card className={`bg-orange-500/10 border-orange-500/30 border-l-4 border-l-orange-500 ${cardMotion}`}>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {upcomingExpiries.map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition">
                            <div>
                              <p className="font-semibold text-white">{item.title}</p>
                              <p className="text-sm text-neutral-400">Expires in {item.daysLeft} days</p>
                            </div>
                            <div className={`text-sm font-bold px-4 py-2 rounded-full ${
                              item.daysLeft <= 7 
                                ? 'bg-red-500/20 text-red-300' 
                                : item.daysLeft <= 15
                                ? 'bg-orange-500/20 text-orange-300'
                                : 'bg-yellow-500/20 text-yellow-300'
                            }`}>
                              {item.daysLeft}d
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button 
                        className="w-full mt-6 bg-blue-500 hover:bg-blue-600"
                        onClick={() => setLocation('/documents')}
                      >
                        Manage Documents
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* SIDEBAR - 1/3 WIDTH */}
            <div className="space-y-8">
              {/* DOCUMENT PROGRESS */}
              <Card className={`bg-neutral-800/50 border-neutral-700 ${cardMotion}`}>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-white mb-6 text-lg">Document Progress</h3>
                  <div className="flex justify-center mb-6">
                    <ProgressDonut 
                      uploaded={uploadedMand} 
                      total={totalMand || 1}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{uploadedMand}/{totalMand}</p>
                    <p className="text-sm text-neutral-400 mt-2">Documents Uploaded</p>
                  </div>
                </CardContent>
              </Card>

              {/* ACADEMIC STATUS */}
              {user?.program && (
                <Card className={`bg-neutral-800/50 border-neutral-700 ${cardMotion}`}>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-white mb-4 text-lg">Academic Status</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-neutral-300">{user.program}</span>
                          <span className="text-sm font-bold text-blue-400">{Math.round((uploadedMand / (totalMand || 1)) * 100)}%</span>
                        </div>
                        <div className="w-full h-3 bg-neutral-700 rounded-full overflow-hidden">
                          <div 
                            className="h-3 bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                            style={{ width: `${Math.round((uploadedMand / (totalMand || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* QUICK STATS */}
              <Card className={`bg-neutral-800/50 border-neutral-700 ${cardMotion}`}>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-white mb-5 text-lg">Summary</h3>
                  <div className="space-y-4">
                    <StatRow label="Total Events" value={events?.length || 0} />
                    <StatRow label="Upcoming Expiries" value={upcomingExpiries.length} color="orange" />
                    <StatRow label="Compliance" value={`${Math.round((uploadedMand / (totalMand || 1)) * 100)}%`} color="blue" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* COURSE PROGRESS SECTION */}
        <section className="w-full px-6 lg:px-8 py-12 md:py-16 bg-neutral-900/50 border-t border-neutral-800">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-8">Course Progress</h2>
            <Card className={`bg-neutral-800/50 border-neutral-700 ${cardMotion}`}>
              <CardContent className="p-8">
                <StudentProfile program={user?.program || 'AI MSc'} />
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
};

const StatusChart: React.FC<{ counts: { total: number; completed: number; pending: number; required: number } }> = ({ counts }) => {
  const { total, completed, pending } = counts;
  const compPct = total ? Math.round((completed / total) * 100) : 0;
  const pendPct = total ? Math.round((pending / total) * 100) : 0;
  const otherPct = Math.max(0, 100 - compPct - pendPct);
  return (
    <div className="w-full">
      <div className="flex items-center space-x-2 text-xs mb-2">
        <div className="flex items-center"><span className="w-2 h-2 bg-green-600 inline-block mr-1 rounded-full"/> Completed</div>
        <div className="flex items-center"><span className="w-2 h-2 bg-amber-600 inline-block mr-1 rounded-full"/> Pending</div>
      </div>
      <div className="w-full h-3 rounded-full bg-neutral-200 overflow-hidden">
        <div style={{ width: `${compPct}%` }} className="h-3 bg-green-600 inline-block" />
        <div style={{ width: `${pendPct}%` }} className="h-3 bg-amber-600 inline-block" />
        <div style={{ width: `${otherPct}%` }} className="h-3 bg-neutral-300 inline-block" />
      </div>
    </div>
  );
};

// Sidebar Navigation Link Component
interface SidebarNavLinkProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const SidebarNavLink: React.FC<SidebarNavLinkProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition ${
      active
        ? 'bg-blue-500/20 text-blue-400 border-l-2 border-l-blue-500'
        : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
    }`}
  >
    {icon}
    <span className="text-sm font-medium">{label}</span>
  </button>
);

// Status Card Component
interface StatusCardProps {
  title: string;
  value: number;
  total?: number;
  icon: string;
  color: 'blue' | 'purple' | 'orange' | 'green';
  suffix?: string;
  onClick?: () => void;
}

const StatusCard: React.FC<StatusCardProps> = ({ title, value, total, icon, color, suffix, onClick }) => {
  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/30',
    purple: 'bg-purple-500/10 border-purple-500/30',
    orange: 'bg-orange-500/10 border-orange-500/30',
    green: 'bg-green-500/10 border-green-500/30',
  };

  const iconBgClasses = {
    blue: 'bg-blue-500/20 text-blue-300',
    purple: 'bg-purple-500/20 text-purple-300',
    orange: 'bg-orange-500/20 text-orange-300',
    green: 'bg-green-500/20 text-green-300',
  };

  return (
    <Card className={`bg-neutral-800/50 border-neutral-700 cursor-pointer hover:border-neutral-600 ${cardMotion} ${colorClasses[color]}`} onClick={onClick}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-400 mb-2">{title}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-white">{value}</p>
              {suffix && <span className="text-neutral-400 text-lg">{suffix}</span>}
            </div>
            {total && (
              <p className="text-xs text-neutral-400 mt-2">of {total}</p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl ${iconBgClasses[color]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Quick Action Card Component
interface QuickActionCardProps {
  title: string;
  description: string;
  icon: string;
  onClick?: () => void;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({ title, description, icon, onClick }) => (
  <Card className={`bg-neutral-800/50 border-neutral-700 cursor-pointer hover:border-blue-500/50 hover:bg-neutral-800 ${cardMotion}`} onClick={onClick}>
    <CardContent className="p-6">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="font-semibold text-white mb-2 text-base">{title}</h3>
      <p className="text-sm text-neutral-400">{description}</p>
    </CardContent>
  </Card>
);

// Progress Donut Component
interface ProgressDonutProps {
  uploaded: number;
  total: number;
}

const ProgressDonut: React.FC<ProgressDonutProps> = ({ uploaded, total }) => {
  const percentage = total > 0 ? (uploaded / total) * 100 : 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgb(64, 64, 64)" strokeWidth="8" />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="rgb(59, 130, 246)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
};

// Stat Row Component
interface StatRowProps {
  label: string;
  value: string | number;
  color?: 'default' | 'orange' | 'blue';
}

const StatRow: React.FC<StatRowProps> = ({ label, value, color = 'default' }) => {
  const colorClass = {
    default: 'text-neutral-300',
    orange: 'text-orange-400',
    blue: 'text-blue-400',
  }[color];

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-neutral-400">{label}</span>
      <span className={`font-semibold text-sm ${colorClass}`}>{value}</span>
    </div>
  );
};

export default Home;
