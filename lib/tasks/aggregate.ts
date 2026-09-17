import { getActiveTasks, getProjects, getRecentCompletedTasks, getRecentMeetingHours } from "./queries";
import { cascadeSchedule, computeDailyAvailableHours, computeTaskSize, type ScheduledTask } from "./scheduling";
import { todayIsoInSeoul } from "./today";
import type { Project, Task } from "./types";

export interface EnrichedTask extends Task {
  remainingHours: number;
  totalSize: number;
  isReestimated: boolean;
  schedule: ScheduledTask | null;
  projectName: string;
}

export interface MorningData {
  today: string;
  availableHours: number;
  averageMeetingHours: number;
  sampleSize: number;
  tasks: EnrichedTask[]; // 마감 위험 먼저, 그다음 마감 요청일 순
  dueRiskTasks: EnrichedTask[];
}

export async function loadMorningData(): Promise<MorningData> {
  const today = todayIsoInSeoul();
  const [tasks, projects, recentMeetingHours] = await Promise.all([
    getActiveTasks(),
    getProjects(),
    getRecentMeetingHours(),
  ]);
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
  const { availableHours, averageMeetingHours, sampleSize } = computeDailyAvailableHours(recentMeetingHours);

  const sizes = new Map(tasks.map((t) => [t.id, computeTaskSize(t)]));
  const scheduled = cascadeSchedule(
    tasks.map((t) => ({
      taskId: t.id,
      requestedDueDate: t.requestedDueDate,
      remainingHours: sizes.get(t.id)!.remainingHours,
      createdAt: t.createdAt,
    })),
    availableHours,
    today
  );
  const scheduleByTaskId = new Map(scheduled.map((s) => [s.taskId, s]));

  const enriched: EnrichedTask[] = scheduled.map((s) => {
    const task = tasks.find((t) => t.id === s.taskId)!;
    const size = sizes.get(task.id)!;
    return {
      ...task,
      remainingHours: size.remainingHours,
      totalSize: size.totalSize,
      isReestimated: size.isReestimated,
      schedule: scheduleByTaskId.get(task.id) ?? null,
      projectName: projectNameById.get(task.projectId) ?? "프로젝트 없음",
    };
  });

  return {
    today,
    availableHours,
    averageMeetingHours,
    sampleSize,
    tasks: enriched,
    dueRiskTasks: enriched.filter((t) => t.schedule?.isDueRisk),
  };
}

export function projectNameMap(projects: Project[]): Map<string, string> {
  return new Map(projects.map((p) => [p.id, p.name]));
}

export interface TasksListData {
  today: string;
  dailyAvailableHours: number;
  tasks: EnrichedTask[]; // 마감 위험 먼저, 그다음 마감 요청일 순
  projects: Project[];
  recentCompleted: (Task & { projectName: string })[];
}

export async function loadTasksListData(): Promise<TasksListData> {
  const today = todayIsoInSeoul();
  const [tasks, projects, recentMeetingHours, recentCompleted] = await Promise.all([
    getActiveTasks(),
    getProjects(),
    getRecentMeetingHours(),
    getRecentCompletedTasks(20),
  ]);
  const projectNameById = projectNameMap(projects);
  const { availableHours } = computeDailyAvailableHours(recentMeetingHours);

  const sizes = new Map(tasks.map((t) => [t.id, computeTaskSize(t)]));
  const scheduled = cascadeSchedule(
    tasks.map((t) => ({
      taskId: t.id,
      requestedDueDate: t.requestedDueDate,
      remainingHours: sizes.get(t.id)!.remainingHours,
      createdAt: t.createdAt,
    })),
    availableHours,
    today
  );
  const scheduleByTaskId = new Map(scheduled.map((s) => [s.taskId, s]));

  const enriched: EnrichedTask[] = scheduled.map((s) => {
    const task = tasks.find((t) => t.id === s.taskId)!;
    const size = sizes.get(task.id)!;
    return {
      ...task,
      remainingHours: size.remainingHours,
      totalSize: size.totalSize,
      isReestimated: size.isReestimated,
      schedule: scheduleByTaskId.get(task.id) ?? null,
      projectName: projectNameById.get(task.projectId) ?? "프로젝트 없음",
    };
  });

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const recentDone = recentCompleted
    .filter((t) => t.completedAt && new Date(t.completedAt) >= twoWeeksAgo)
    .map((t) => ({ ...t, projectName: projectNameById.get(t.projectId) ?? "프로젝트 없음" }));

  return { today, dailyAvailableHours: availableHours, tasks: enriched, projects, recentCompleted: recentDone };
}
