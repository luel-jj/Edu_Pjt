import type { Project, Task } from "./types";

export interface MonthSummary {
  month: number; // 1-12
  count: number;
  hours: number;
  topProject: string | null;
}

export interface ProjectSummary {
  projectId: string | null;
  name: string;
  status: "active" | "completed";
  count: number;
  hours: number;
  sharePercent: number;
}

export interface PerformanceSummary {
  totalCount: number;
  totalHours: number;
  devCount: number;
  devHours: number;
  devSharePercent: number;
  totalEstimatedHours: number;
  varianceFromEstimatePercent: number;
  byMonth: MonthSummary[];
  byProject: ProjectSummary[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function summarizePerformance(tasks: Task[], projects: Project[]): PerformanceSummary {
  const totalHours = tasks.reduce((sum, t) => sum + (t.actualHours ?? 0), 0);
  const totalEstimatedHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
  const devTasks = tasks.filter((t) => t.taskType === "dev");
  const devHours = devTasks.reduce((sum, t) => sum + (t.actualHours ?? 0), 0);

  const byMonthMap = new Map<number, { count: number; hours: number; byProject: Map<string, number> }>();
  for (const t of tasks) {
    if (!t.completedAt) continue;
    const month = new Date(t.completedAt).getMonth() + 1;
    if (!byMonthMap.has(month)) byMonthMap.set(month, { count: 0, hours: 0, byProject: new Map() });
    const bucket = byMonthMap.get(month)!;
    bucket.count += 1;
    bucket.hours += t.actualHours ?? 0;
    const projectName = projects.find((p) => p.id === t.projectId)?.name ?? "프로젝트 없음";
    bucket.byProject.set(projectName, (bucket.byProject.get(projectName) ?? 0) + (t.actualHours ?? 0));
  }
  const byMonth: MonthSummary[] = [...byMonthMap.entries()]
    .map(([month, v]) => ({
      month,
      count: v.count,
      hours: round1(v.hours),
      topProject: [...v.byProject.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.month - a.month);

  const byProjectMap = new Map<string, { count: number; hours: number }>();
  for (const t of tasks) {
    const key = t.projectId || "__none__";
    if (!byProjectMap.has(key)) byProjectMap.set(key, { count: 0, hours: 0 });
    const bucket = byProjectMap.get(key)!;
    bucket.count += 1;
    bucket.hours += t.actualHours ?? 0;
  }
  const byProject: ProjectSummary[] = [...byProjectMap.entries()]
    .map(([key, v]) => {
      const project = projects.find((p) => p.id === key);
      return {
        projectId: key === "__none__" ? null : key,
        name: project?.name ?? "프로젝트 없음",
        status: (project?.status ?? "active") as "active" | "completed",
        count: v.count,
        hours: round1(v.hours),
        sharePercent: totalHours > 0 ? Math.round((v.hours / totalHours) * 100) : 0,
      };
    })
    .sort((a, b) => b.hours - a.hours);

  return {
    totalCount: tasks.length,
    totalHours: round1(totalHours),
    devCount: devTasks.length,
    devHours: round1(devHours),
    devSharePercent: totalHours > 0 ? Math.round((devHours / totalHours) * 100) : 0,
    totalEstimatedHours: round1(totalEstimatedHours),
    varianceFromEstimatePercent:
      totalEstimatedHours > 0 ? Math.round(((totalHours - totalEstimatedHours) / totalEstimatedHours) * 100) : 0,
    byMonth,
    byProject,
  };
}
