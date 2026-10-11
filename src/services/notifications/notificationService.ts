import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  updateDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../config/firebase';
import { AppNotification, NotificationChannel } from '../../types';
import { emailProvider, smsProvider, whatsAppProvider } from './providers';

export interface CreateNotificationParams {
  gymId: string;
  recipientId: string;
  recipientRole: 'OWNER' | 'STAFF' | 'MEMBER';
  channel?: NotificationChannel;
  type: string;
  title: string;
  message: string;
  notificationKey?: string;
  recipientContact?: {
    email?: string;
    phone?: string;
  };
}

class NotificationService {
  /**
   * Dispatches a notification while strictly enforcing idempotency via notificationKey
   */
  async sendNotification(params: CreateNotificationParams): Promise<{ sent: boolean; isDuplicate: boolean; notification?: AppNotification }> {
    const { gymId, recipientId, recipientRole, type, title, message, notificationKey, recipientContact } = params;

    // 1. Idempotency check if key provided
    if (notificationKey) {
      try {
        const notifQuery = query(
          collection(db, 'notifications'),
          where('gymId', '==', gymId),
          where('notificationKey', '==', notificationKey),
          limit(1)
        );
        const existingDocs = await getDocs(notifQuery);
        if (!existingDocs.empty) {
          console.warn(`[NotificationService] Duplicate suppressed for key: ${notificationKey}`);
          return { sent: false, isDuplicate: true };
        }
      } catch (error) {
        console.warn('Idempotency query issue, proceeding to send:', error);
      }
    }

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const notification: AppNotification = {
      notificationId,
      gymId,
      recipientId,
      recipientRole: recipientRole || 'MEMBER',
      channel: params.channel || 'IN_APP',
      type,
      title,
      message,
      read: false,
      notificationKey: notificationKey || '',
      deliveryStatus: 'DELIVERED',
      failedDeliveries: [],
      createdAt: new Date().toISOString(),
    };

    // 2. Persist to Firestore
    try {
      await setDoc(doc(db, 'notifications', notificationId), notification);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `notifications/${notificationId}`);
    }

    // 3. Dispatch external providers in parallel if contact info available, tracking failures
    const failedDeliveries: Array<{ channel: string; error: string; timestamp: string }> = [];

    const handleExternalSend = async (channel: string, sendPromise: Promise<any>) => {
      try {
        await sendPromise;
      } catch (err: any) {
        console.warn(`[NotificationService] ${channel} delivery failure:`, err);
        failedDeliveries.push({
          channel,
          error: err?.message || String(err),
          timestamp: new Date().toISOString(),
        });
      }
    };

    const deliveryPromises: Promise<any>[] = [];

    if (recipientContact?.email) {
      deliveryPromises.push(
        handleExternalSend('EMAIL', emailProvider.send({
          recipientId,
          recipientContact: recipientContact.email,
          title,
          message,
        }))
      );
    }
    if (recipientContact?.phone) {
      deliveryPromises.push(
        handleExternalSend('SMS', smsProvider.send({
          recipientId,
          recipientContact: recipientContact.phone,
          title,
          message,
        }))
      );
      deliveryPromises.push(
        handleExternalSend('WHATSAPP', whatsAppProvider.send({
          recipientId,
          recipientContact: recipientContact.phone,
          title,
          message,
        }))
      );
    }

    if (deliveryPromises.length > 0) {
      Promise.all(deliveryPromises).then(async () => {
        if (failedDeliveries.length > 0) {
          notification.deliveryStatus = failedDeliveries.length === deliveryPromises.length ? 'FAILED' : 'PARTIAL';
          notification.failedDeliveries = failedDeliveries;
          try {
            await updateDoc(doc(db, 'notifications', notificationId), {
              deliveryStatus: notification.deliveryStatus,
              failedDeliveries: notification.failedDeliveries,
            });
          } catch {
            // Ignore background update error
          }
        }
      });
    }

    return { sent: true, isDuplicate: false, notification };
  }

  /**
   * Fetch unread notifications for a user/member/staff
   */
  async getNotifications(recipientId: string, limitCount: number = 50, gymId: string = 'gym-01'): Promise<AppNotification[]> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('gymId', '==', gymId),
        where('recipientId', '==', recipientId),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => d.data() as AppNotification);
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.warn('Could not fetch notifications from Firestore, returning local empty list', error);
      return [];
    }
  }

  /**
   * Fetch all notifications for gym administration
   */
  async getGymNotifications(gymId: string, limitCount: number = 100): Promise<AppNotification[]> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('gymId', '==', gymId),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(d => d.data() as AppNotification);
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.warn('Could not fetch gym notifications from Firestore, returning local empty list', error);
      return [];
    }
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const ref = doc(db, 'notifications', notificationId);
      await updateDoc(ref, { read: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
    }
  }

  /**
   * Mark all unread notifications for a recipient as read
   */
  async markAllAsRead(recipientId: string): Promise<void> {
    const list = await this.getNotifications(recipientId);
    const unread = list.filter(n => !n.read);
    await Promise.all(
      unread.map(n =>
        updateDoc(doc(db, 'notifications', n.notificationId), { read: true }).catch(() => {})
      )
    );
  }
}

export const notificationService = new NotificationService();
