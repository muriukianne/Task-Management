package api.v1.tm.services;

import api.v1.tm.dtos.responses.NotificationResponse;
import api.v1.tm.dtos.responses.PagedResponse;

public interface NotificationService {

    /** Persist a notification; no-op when recipient is null or equals actor. */
    void notify(Long recipientId, Long actorId, Long taskId, String type, String title, String body);

    /**
     * Same as {@link #notify} but skips if an identical (recipient, task, type) alert
     * was already created today — used by the due-date scheduler.
     */
    void notifyOncePerDay(Long recipientId, Long actorId, Long taskId, String type, String title, String body);

    PagedResponse<NotificationResponse> listMine(int page, int size, boolean unreadOnly);

    long unreadCount();

    NotificationResponse markRead(Long notificationId);

    int markAllRead();
}
