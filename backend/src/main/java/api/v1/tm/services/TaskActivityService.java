package api.v1.tm.services;

import api.v1.tm.activity.TaskActivityEvent;
import api.v1.tm.dtos.responses.ActivityLogResponse;
import api.v1.tm.dtos.responses.PagedResponse;
import api.v1.tm.entity.TaskActivityLog;

import java.util.List;

public interface TaskActivityService {

    /** Persist a single activity row (same TX as the caller when invoked via CDI observer). */
    TaskActivityLog record(TaskActivityEvent event);

    /** Synchronous historical feed for the task detail sidebar (newest first). */
    List<TaskActivityLog> listForTask(Long taskId);

    /**
     * Global audit trail for supervisors/admins — all users' actions, newest first.
     */
    PagedResponse<ActivityLogResponse> listAll(int page, int size, Long actorId, String actionType, Long taskId);
}
