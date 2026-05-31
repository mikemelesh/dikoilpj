import { apiClient } from "./axios";

export interface Notification {
  id: number;
  order_id: string | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  unread_count: number;
}

export const getNotifications = async (): Promise<NotificationListResponse> => {
  const response = await apiClient.get<NotificationListResponse>("/notifications");
  return response.data;
};

export const getUnreadCount = async (): Promise<number> => {
  const response = await apiClient.get<{ unread_count: number }>("/notifications/unread-count");
  return response.data.unread_count;
};

export const markNotificationRead = async (id: number): Promise<Notification> => {
  const response = await apiClient.patch<Notification>(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await apiClient.patch("/notifications/read-all");
};
