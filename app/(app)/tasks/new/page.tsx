import { NewTaskForm } from "./new-task-form";
import { getActiveTasks, getCompletedActualHoursByType, getProjects, getRecentMeetingHours } from "@/lib/tasks/queries";
import { computeDailyAvailableHours, computeTaskSize, medianActualHours } from "@/lib/tasks/scheduling";
import { todayIsoInSeoul } from "@/lib/tasks/today";

export default async function NewTaskPage() {
  const [projects, activeTasks, recentMeetingHours, devActuals, reviewActuals] = await Promise.all([
    getProjects(),
    getActiveTasks(),
    getRecentMeetingHours(),
    getCompletedActualHoursByType("dev"),
    getCompletedActualHoursByType("review"),
  ]);

  const { availableHours } = computeDailyAvailableHours(recentMeetingHours);
  const scheduleInputs = activeTasks.map((t) => ({
    taskId: t.id,
    requestedDueDate: t.requestedDueDate,
    remainingHours: computeTaskSize(t).remainingHours,
    createdAt: t.createdAt,
  }));

  return (
    <NewTaskForm
      today={todayIsoInSeoul()}
      projects={projects.filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name }))}
      dailyAvailableHours={availableHours}
      scheduleInputs={scheduleInputs}
      suggestions={{
        dev: { median: medianActualHours(devActuals), count: devActuals.length },
        review: { median: medianActualHours(reviewActuals), count: reviewActuals.length },
      }}
    />
  );
}
