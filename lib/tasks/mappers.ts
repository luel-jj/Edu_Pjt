import type { Project, Task, TaskHistoryEntry, TaskReferenceLink } from "./types";

// Supabase(snake_case) 행을 앱 타입(camelCase)으로 변환한다.

export function mapTaskRow(row: Record<string, unknown>): Task {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    taskType: row.task_type as Task["taskType"],
    requestedDueDate: row.requested_due_date as string,
    originalDueDate: row.original_due_date as string,
    estimatedHours: Number(row.estimated_hours),
    progressPercent: row.progress_percent === null ? null : Number(row.progress_percent),
    accumulatedHours: Number(row.accumulated_hours),
    status: row.status as Task["status"],
    actualHours: row.actual_hours === null ? null : Number(row.actual_hours),
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string) ?? null,
  };
}

export function mapProjectRow(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as Project["status"],
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string) ?? null,
  };
}

export function mapReferenceLinkRow(row: Record<string, unknown>): TaskReferenceLink {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    label: row.label as string,
    url: (row.url as string) ?? null,
    createdAt: row.created_at as string,
  };
}

export function mapHistoryRow(row: Record<string, unknown>): TaskHistoryEntry {
  return {
    id: row.id as string,
    taskId: row.task_id as string,
    eventType: row.event_type as TaskHistoryEntry["eventType"],
    detail: (row.detail as Record<string, unknown>) ?? {},
    reason: (row.reason as string) ?? null,
    createdAt: row.created_at as string,
  };
}
