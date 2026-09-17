import { describe, expect, it } from "vitest";
import { summarizePerformance } from "./performance";
import type { Project, Task } from "./types";

function task(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? "t1",
    projectId: overrides.projectId ?? "p1",
    title: "업무",
    taskType: "dev",
    requestedDueDate: "2026-01-10",
    originalDueDate: "2026-01-10",
    estimatedHours: 10,
    progressPercent: null,
    accumulatedHours: 0,
    status: "done",
    actualHours: 12,
    createdAt: "2026-01-01T00:00:00Z",
    completedAt: "2026-01-05T00:00:00Z",
    ...overrides,
  };
}

const projects: Project[] = [{ id: "p1", name: "ADAS 2026", status: "active", createdAt: "", completedAt: null }];

describe("summarizePerformance", () => {
  it("완료 업무의 실제 시간과 예상 대비 비율을 집계한다", () => {
    const summary = summarizePerformance(
      [task({ id: "a", actualHours: 12, estimatedHours: 10 }), task({ id: "b", actualHours: 8, estimatedHours: 10, taskType: "review" })],
      projects
    );
    expect(summary.totalCount).toBe(2);
    expect(summary.totalHours).toBe(20);
    expect(summary.totalEstimatedHours).toBe(20);
    expect(summary.varianceFromEstimatePercent).toBe(0);
    expect(summary.devCount).toBe(1);
    expect(summary.devHours).toBe(12);
  });

  it("월별로 묶고 시간이 가장 큰 프로젝트를 대표로 고른다", () => {
    const summary = summarizePerformance(
      [task({ id: "a", completedAt: "2026-03-05T00:00:00Z", actualHours: 5, projectId: "p1" })],
      projects
    );
    expect(summary.byMonth).toEqual([{ month: 3, count: 1, hours: 5, topProject: "ADAS 2026" }]);
  });
});
