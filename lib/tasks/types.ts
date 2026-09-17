export type TaskType = "dev" | "review";
export type TaskStatus = "todo" | "in_progress" | "done";
export type ProjectStatus = "active" | "completed";

export interface Task {
  id: string;
  projectId: string;
  title: string;
  taskType: TaskType;
  requestedDueDate: string; // ISO date (yyyy-mm-dd)
  originalDueDate: string; // ISO date
  estimatedHours: number;
  progressPercent: number | null;
  accumulatedHours: number;
  status: TaskStatus;
  actualHours: number | null;
  createdAt: string; // ISO datetime
  completedAt: string | null;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface TaskReferenceLink {
  id: string;
  taskId: string;
  label: string;
  url: string | null;
  createdAt: string;
}

export type TaskHistoryEventType =
  | "created"
  | "due_date_changed"
  | "estimate_changed"
  | "progress_changed"
  | "time_logged"
  | "status_changed"
  | "reference_added"
  | "edited";

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  eventType: TaskHistoryEventType;
  detail: Record<string, unknown>;
  reason: string | null;
  createdAt: string;
}
