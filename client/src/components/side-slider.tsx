import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

const baseItems = [
  { href: '/home', icon: 'home', label: 'Home' },
  { href: '/chat', icon: 'chat', label: 'Ask Assistant' },
  { href: '/documents', icon: 'description', label: 'Documents' },
  { href: '/search', icon: 'search', label: 'Search' },
  { href: '/recommendations', icon: 'school', label: 'Recommendations' },
  { href: '/notifications', icon: 'notifications', label: 'Alerts' },
];

const SideSlider: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [location, setLocation] = useLocation();

  const open = expanded || pinned;

  // Fetch mandatory documents to compute pending count for Alerts badge
  interface MandatoryDocStatus { key: string; uploaded: boolean; }
  const { data: mandatoryData } = useQuery<{ mandatory: MandatoryDocStatus[] }>({
    queryKey: ['mandatory-docs'],
    queryFn: async () => {
      const r = await apiRequest('GET', '/api/mandatory-docs');
      return r.json();
    },
    staleTime: 20_000,
  });
  const pendingCount = (mandatoryData?.mandatory || []).filter(m => !m.uploaded).length;
  const items = baseItems.map(it => {
    if (it.href === '/notifications') {
      return { ...it, pendingCount };
    }
    return it;
  });

  return (
    <aside
      className={`side-slider flex flex-col h-full transition-[width,box-shadow] duration-300 ease-in-out ${open ? 'w-64' : 'w-20'}`}
      onMouseEnter={() => !pinned && setExpanded(true)}
      onMouseLeave={() => !pinned && setExpanded(false)}
      aria-hidden={false}
      style={{ background: 'hsl(var(--sidebar-background))', borderRight: '1px solid rgba(0,0,0,0.04)' }}
    >
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Show logo image in the AV tile (dev-aware path) */}
          <img
            src={import.meta.env.DEV ? 'http://localhost:3000/assets/logo.png' : '/assets/logo.png'}
            alt="AiVersity"
            className="w-8 h-8 rounded-md object-cover"
          />
          {open && <div className="text-sm font-semibold" style={{color: 'hsl(var(--sidebar-foreground))'}}>AiVersity</div>}
        </div>

        <button
          aria-label="pin menu"
          onClick={() => setPinned(p => !p)}
          className={`p-1 rounded hover:bg-[rgba(6, 6, 6, 0.04)] transition ${pinned ? 'text-[hsl(var(--primary))]' : 'text-neutral-600'}`}
          title={pinned ? 'Unpin' : 'Pin'}
        >
          <span className="material-icons">push_pin</span>
        </button>
      </div>

      <nav className="flex-1 mt-2">
        {items.map(it => (
          <a
            key={it.href}
            href={it.href}
            onClick={(e) => { e.preventDefault(); setLocation(it.href); }}
            className={`relative flex items-center gap-3 py-3 px-3 hover:bg-[rgba(0,0,0,0.04)] transition-colors ${open ? 'rounded-md mx-2' : 'justify-center'}`}
          >
            <span className="material-icons text-[20px]">{it.icon}</span>
            {open && (
              <span className="text-sm flex items-center" style={{color: 'hsl(var(--sidebar-foreground))'}}>
                {it.label}
                {typeof (it as any).pendingCount === 'number' && (it as any).pendingCount > 0 && (it.href === '/notifications') && (
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-semibold px-2 py-0.5 min-w-[20px]">
                    {(it as any).pendingCount}
                  </span>
                )}
              </span>
            )}
            {!open && (it.href === '/notifications') && (it as any).pendingCount > 0 && (
              <span className="absolute top-2 right-4 rounded-full bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5">
                {(it as any).pendingCount}
              </span>
            )}
          </a>
        ))}
      </nav>

      <div className="p-3">
        {/* small footer when expanded */}
        {open ? (
          <div className="text-sm muted">Student Assistant • v1</div>
        ) : (
          <div className="h-3" />
        )}
      </div>
    </aside>
  );
};

export default SideSlider;
