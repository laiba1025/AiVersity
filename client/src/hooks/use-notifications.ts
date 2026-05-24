import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Notification } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

export const useNotifications = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch notifications
  const {
    data: notifications,
    isLoading,
    error,
  } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiRequest('PATCH', `/api/notifications/${notificationId}/read`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread/count'] });
    },
    onError: (error) => {
      console.error('Failed to mark notification as read:', error);
      toast({
        title: 'Error',
        description: 'Failed to update notification',
        variant: 'destructive',
      });
    },
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/notifications/read/all', {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread/count'] });
      toast({
        title: 'Success',
        description: 'All notifications marked as read',
      });
    },
    onError: (error) => {
      console.error('Failed to mark all notifications as read:', error);
      toast({
        title: 'Error',
        description: 'Failed to update notifications',
        variant: 'destructive',
      });
    },
  });

  // Get notifications grouped by date
  const getGroupedNotifications = () => {
    if (!notifications) return { today: [], earlier: [] };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayNotifications = notifications.filter(
      notification => new Date(notification.date) >= today
    );
    
    const earlierNotifications = notifications.filter(
      notification => new Date(notification.date) < today
    );

    return {
      today: todayNotifications,
      earlier: earlierNotifications,
    };
  };

  // Mark a notification as read
  const markAsRead = async (notificationId: number) => {
    await markAsReadMutation.mutateAsync(notificationId);
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    await markAllAsReadMutation.mutateAsync();
  };

  // Get unread notifications count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread/count'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const unreadCount = (unreadData as { count: number } | undefined)?.count ?? 0;

  return {
    notifications: notifications || [],
    groupedNotifications: getGroupedNotifications(),
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    unreadCount,
    isUpdating: markAsReadMutation.isPending || markAllAsReadMutation.isPending,
  };
};
