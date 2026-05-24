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

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { user, isLoading: userLoading, logout } = useApp();
  const { getDocumentCounts } = useDocuments();
  const [_, setLocation] = useLocation();
  // subtle theme-matching gradient using CSS theme variables (hsl)
  const subtleGradient: React.CSSProperties = {
    background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--primary) / 0.03))',
  };

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

  // Greeting helpers
  const firstName = (user?.fullName || 'Student').split(' ')[0];

  if (userLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <p className="text-lg">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 lg:p-10 grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10">
      {/* Hero welcome card (full width, interactive) */}
      <div className="md:col-span-12">
        <Card>
          <CardContent className="p-6 md:p-8 lg:p-10" style={subtleGradient}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight">
                  Welcome {firstName}
                </h1>
                <p className="mt-2 text-sm md:text-base text-gray-700 dark:text-white">
                  How can I help you today?
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={() => setLocation('/chat')} className="px-5 py-3">
                  Ask Assistant
                </Button>
                <Button variant="outline" onClick={() => setLocation('/documents')} className="px-5 py-3">
                  Manage Documents
                </Button>
                <Button variant="ghost" onClick={() => setLocation('/notifications')} className="px-5 py-3">
                  View Alerts
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Left column: Overview */}
      <div className="md:col-span-4 lg:col-span-3 space-y-6">
        <Card className="min-h-[140px]">
          <CardContent className="p-6 md:p-8" style={subtleGradient}>
            <h3 className="font-medium mb-2">Upcoming Expiries</h3>
            {upcomingExpiries.length === 0 ? (
              <p className="text-sm text-neutral-500">No upcoming expiries</p>
            ) : (
              <ul className="space-y-2">
                {upcomingExpiries.map((u, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between p-2 rounded-md bg-neutral-100 dark:bg-white/5 text-neutral-800 dark:text-neutral-100"
                  >
                    <span className="text-sm font-medium">{u.title}</span>
                    <span
                      className={`text-xs md:text-sm font-semibold px-2.5 py-1 rounded-full ${
                        u.daysLeft <= 7 ? 'text-error' : 'text-warning'
                      } bg-neutral-200 dark:bg-white/10`}
                    >
                      {u.daysLeft}d
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Button variant="ghost" className="w-full py-3" onClick={() => setLocation('/documents')}>View all</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[140px]">
          <CardContent className="p-6 md:p-8" style={subtleGradient}>
            <h3 className="font-medium mb-2 text-gray-900 dark:text-white">Quick Links</h3>
            <div className="flex flex-col space-y-3">
              <Button variant="link" className="text-left p-0 text-gray-900 dark:text-white hover:opacity-90" onClick={() => setLocation('/chat')}>Ask Assistant</Button>
              <Button variant="link" className="text-left p-0 text-gray-900 dark:text-white hover:opacity-90" onClick={() => setLocation('/notifications')}>Notifications</Button>
              <Button variant="link" className="text-left p-0 text-gray-900 dark:text-white hover:opacity-90" onClick={() => setLocation('/search')}>Search Policies</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main column */}
      <div className="md:col-span-8 lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Dashboard</h2>
        </div>

        <Card className="min-h-[220px]">
          <CardContent className="p-6 md:p-10" style={subtleGradient}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-base text-gray-700 dark:text-neutral-200">Required Documents</div>
                <div className="font-semibold text-lg md:text-xl mt-1 text-gray-900 dark:text-white">{uploadedMand}/{totalMand} uploaded</div>
              </div>
              <div className="w-40 md:w-64">
                <StatusChart counts={docCounts} />
              </div>
            </div>
            <div className="w-full bg-neutral-200 rounded-full h-4">
              <div className="bg-primary h-4 rounded-full" style={{ width: `${totalMand>0?Math.round((uploadedMand/totalMand)*100):0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[180px]">
          <CardContent className="p-6 md:p-8" style={subtleGradient}>
            <h3 className="font-medium mb-3">Recent Activity</h3>
            {eventsLoading ? (
              <p className="text-sm text-neutral-500">Loading...</p>
            ) : events && events.length > 0 ? (
              <div className="space-y-4">
                {events.slice(0,5).map(ev => (
                  <div key={ev.id} className="flex items-start space-x-4">
                    <div className="w-12 h-12 rounded-md bg-accent flex items-center justify-center text-white">E</div>
                    <div>
                      <div className="text-sm font-medium">{ev.title}</div>
                      <div className="text-sm text-neutral-500">{format(new Date(ev.datetime), 'MMM d, HH:mm')} — {ev.location}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right column: Course Progress (wider) */}
      <div className="md:col-span-12 lg:col-span-5 space-y-4">
        <Card>
          <CardContent className="p-6 md:p-8" style={subtleGradient}>
            <h3 className="font-medium mb-3">Course Progress</h3>
            <div className="mt-4">
              <StudentProfile program={user?.program || 'AI MSc'} />
            </div>
          </CardContent>
        </Card>
      </div>
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

export default Home;
