import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@/lib/translations';
import { useNotifications } from '@/hooks/use-notifications';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { Notification } from '@shared/schema';

const NotificationItem: React.FC<{ notification: Notification; onMarkAsRead: () => void }> = ({ notification, onMarkAsRead }) => {
  const { t } = useTranslation();
  
  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'deadline':
        return <span className="material-icons text-error">notification_important</span>;
      case 'event':
        return <span className="material-icons text-info">event_note</span>;
      case 'document':
        return <span className="material-icons text-success">check_circle</span>;
      case 'info':
      default:
        return <span className="material-icons text-warning">info</span>;
    }
  };
  
  const getNotificationColor = () => {
    switch (notification.type) {
      case 'deadline':
        return 'error';
      case 'event':
        return 'info';
      case 'document':
        return 'success';
      case 'info':
      default:
        return 'warning';
    }
  };

  const color = getNotificationColor();

  return (
    <Card className={`border-l-4 border-l-${color}`}>
      <CardContent className="pt-6">
        <div className="flex items-start">
          <div className={`bg-${color}/10 rounded-full p-2 mr-3`}>
            {getNotificationIcon()}
          </div>
          <div className="flex-1">
            <h4 className="font-medium">{notification.title}</h4>
            <p className="text-sm text-neutral-600 mb-2">{notification.description}</p>
            
            {!notification.read && (
              <div className="flex space-x-2">
                {notification.relatedItemType === 'document' && (
                  <Button className="text-sm bg-primary text-white px-3 py-1 rounded-lg">
                    Upload Documents
                  </Button>
                )}
                
                {notification.relatedItemType === 'event' && (
                  <Button className="text-sm bg-primary text-white px-3 py-1 rounded-lg">
                    {t('addToCalendar')}
                  </Button>
                )}
                
                <Button 
                  variant="outline"
                  className="text-sm bg-neutral-100 text-neutral-700 px-3 py-1 rounded-lg"
                  onClick={onMarkAsRead}
                >
                  {t('dismiss')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const Notifications: React.FC = () => {
  const { t } = useTranslation();
  const { groupedNotifications, isLoading, markAsRead, markAllAsRead, isUpdating } = useNotifications();

  // Persistent mandatory documents alert: stays until ALL mandatory docs uploaded
  interface MandatoryDocStatus { key: string; title: string; description: string; uploaded: boolean; documentId: number | null; filename: string | null; expiryDate: string | null; status: string | null; }
  const { data: mandatoryData } = useQuery<{ mandatory: MandatoryDocStatus[] }>({
    queryKey: ['mandatory-docs'],
    queryFn: async () => {
      const r = await fetch('/api/mandatory-docs');
      if (!r.ok) throw new Error('Failed to load mandatory docs');
      return r.json();
    },
    staleTime: 15_000,
  });
  const incompleteMandatory = (mandatoryData?.mandatory || []).filter(m => !m.uploaded);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const { today, earlier } = groupedNotifications;
  const hasUnread = today.some(n => !n.read) || earlier.some(n => !n.read);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">{t('notifications')}</h2>
        {hasUnread && (
          <Button 
            variant="outline"
            size="sm"
            onClick={markAllAsRead}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Mark all as read'
            )}
          </Button>
        )}
      </div>

      {/* Mandatory documents persistent alert */}
      {incompleteMandatory.length > 0 && (
        <Card className="mb-5 border-l-4 border-l-error"> 
          <CardContent className="pt-5">
            <div className="flex items-start">
              <div className="bg-error/10 rounded-full p-2 mr-3">
                <span className="material-icons text-error">priority_high</span>
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">Mandatory documents pending</h4>
                <p className="text-sm text-neutral-600 mb-2">You still need to upload the following required documents before this alert will disappear:</p>
                <ul className="list-disc ml-5 text-xs text-neutral-700 space-y-1">
                  {incompleteMandatory.map(m => (
                    <li key={m.key}>{m.title}</li>
                  ))}
                </ul>
                <div className="mt-3">
                  <Button size="sm" className="bg-primary text-white" onClick={() => { window.location.href = '/documents'; }}>Go to Documents</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="space-y-3">
        {today.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-neutral-500 mb-2">{t('today')}</h3>
            {today.map(notification => (
              <NotificationItem 
                key={notification.id} 
                notification={notification} 
                onMarkAsRead={() => markAsRead(notification.id)}
              />
            ))}
          </>
        )}
        
        {earlier.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-neutral-500 mb-2 mt-4">{t('earlier')}</h3>
            {earlier.map(notification => (
              <NotificationItem 
                key={notification.id} 
                notification={notification}
                onMarkAsRead={() => markAsRead(notification.id)}
              />
            ))}
          </>
        )}
        
        {today.length === 0 && earlier.length === 0 && (
          <div className="flex justify-center items-center py-12">
            <p className="text-neutral-500">{t('noItems')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
