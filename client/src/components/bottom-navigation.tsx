import { useLocation, Link } from 'wouter';
import { useTranslation } from '@/lib/translations';
import { useQuery } from '@tanstack/react-query';

const BottomNavigation = () => {
  const [location] = useLocation();
  const { t } = useTranslation();

  // Get unread notifications count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread/count'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = (unreadData as { count: number } | undefined)?.count ?? 0;

  return (
    <nav className="bg-white border-t border-neutral-200 fixed bottom-0 w-full max-w-md flex justify-around items-center shadow-md">
      <Link href="/home">
        <a className={`flex flex-col items-center justify-center py-3 px-5 ${location === '/home' ? 'text-primary' : 'text-neutral-500'}`}>
          <span className="material-icons">home</span>
          <span className="text-xs mt-1">{t('home')}</span>
        </a>
      </Link>
      
      <Link href="/chat">
        <a className={`flex flex-col items-center justify-center py-3 px-5 ${location === '/chat' ? 'text-primary' : 'text-neutral-500'}`}>
          <span className="material-icons">chat</span>
          <span className="text-xs mt-1">{t('chat')}</span>
        </a>
      </Link>
      
      <Link href="/documents">
        <a className={`flex flex-col items-center justify-center py-3 px-5 ${location === '/documents' ? 'text-primary' : 'text-neutral-500'}`}>
          <span className="material-icons">description</span>
          <span className="text-xs mt-1">{t('documents')}</span>
        </a>
      </Link>
      
      {/* Map page removed - link intentionally omitted */}

      <Link href="/search">
        <a className={`flex flex-col items-center justify-center py-3 px-5 ${location === '/search' ? 'text-primary' : 'text-neutral-500'}`}>
          <span className="material-icons">search</span>
          <span className="text-xs mt-1">Search</span>
        </a>
      </Link>

      <Link href="/recommendations">
        <a className={`flex flex-col items-center justify-center py-3 px-5 ${location === '/recommendations' ? 'text-primary' : 'text-neutral-500'}`}>
          <span className="material-icons">school</span>
          <span className="text-xs mt-1">Courses</span>
        </a>
      </Link>
      
      <Link href="/notifications">
        <a className={`flex flex-col items-center justify-center py-3 px-5 relative ${location === '/notifications' ? 'text-primary' : 'text-neutral-500'}`}>
          <span className="material-icons">notifications</span>
          <span className="text-xs mt-1">{t('notifications')}</span>
          {unreadCount > 0 && (
            <span className="absolute top-2 right-3 bg-error text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </a>
      </Link>
    </nav>
  );
};

export default BottomNavigation;
