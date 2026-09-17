import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveTasks, getProjects, getRecentMeetingHours, getReferenceLinks, getTaskById } from "@/lib/tasks/queries";
import { cascadeSchedule, computeDailyAvailableHours, computeTaskSize } from "@/lib/tasks/scheduling";
import { todayIsoInSeoul } from "@/lib/tasks/today";
import { formatFullDateKo, formatHours, TASK_STATUS_LABEL, TASK_TYPE_LABEL } from "@/lib/tasks/format";
import { TaskDetailPanel } from "./task-detail-panel";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTaskById(id);
  if (!task) notFound();

  const [projects, recentMeetingHours, activeTasks, referenceLinks] = await Promise.all([
    getProjects(),
    getRecentMeetingHours(),
    getActiveTasks(),
    getReferenceLinks(id),
  ]);
  const project = projects.find((p) => p.id === task.projectId);
  const size = computeTaskSize(task);

  let schedule = null;
  if (task.status !== "done") {
    const { availableHours } = computeDailyAvailableHours(recentMeetingHours);
    const today = todayIsoInSeoul();
    const sizes = new Map(activeTasks.map((t) => [t.id, computeTaskSize(t)]));
    const scheduled = cascadeSchedule(
      activeTasks.map((t) => ({
        taskId: t.id,
        requestedDueDate: t.requestedDueDate,
        remainingHours: sizes.get(t.id)!.remainingHours,
        createdAt: t.createdAt,
      })),
      availableHours,
      today
    );
    schedule = scheduled.find((s) => s.taskId === task.id) ?? null;
  }

  return (
    <div>
      <Link href="/tasks" className="mb-2.5 inline-block text-[13px] text-muted-foreground hover:text-foreground">
        ← 업무 목록
      </Link>

      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-56 flex-1 text-xl font-semibold tracking-tight">{task.title}</h1>
      </div>
      <p className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={task.taskType === "dev" ? "default" : "outline"}>{TASK_TYPE_LABEL[task.taskType]}</Badge>
        <Badge variant="secondary">{TASK_STATUS_LABEL[task.status]}</Badge>
        <span>{project?.name ?? "프로젝트 없음"}</span>
      </p>

      {schedule?.isDueRisk ? (
        <Alert variant="destructive" className="mb-5">
          <AlertTriangle />
          <AlertTitle>마감을 {formatHours(schedule.shortfallHours)}시간 넘길 것 같습니다</AlertTitle>
          <AlertDescription>
            {formatFullDateKo(task.requestedDueDate)}까지 쓸 수 있는 {formatHours(schedule.capacityAvailableByDueDate)}시간에{" "}
            {formatHours(schedule.remainingHours)}시간이 필요합니다. 지금이면 일정을 다시 제안할 수 있습니다.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>지금 상태</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">마감 요청일</p>
              <p className="font-medium">
                {formatFullDateKo(task.requestedDueDate)}
                {task.originalDueDate !== task.requestedDueDate ? (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    처음에는 {formatFullDateKo(task.originalDueDate)}
                  </span>
                ) : null}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">진행률</p>
              <div className="flex items-center gap-2 font-medium">
                {task.progressPercent ?? 0}%
                <Progress value={task.progressPercent ?? 0} className="h-1.5 w-20" />
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">지금까지 쓴 시간</p>
              <p className="font-medium">{formatHours(task.accumulatedHours)}시간</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">지금 보는 총 규모</p>
              <p className="font-medium">
                {formatHours(size.totalSize)}시간{" "}
                {size.isReestimated ? <span className="text-xs font-normal text-muted-foreground">진행률로 다시 잡은 값</span> : null}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">처음 예상</p>
              <p className="font-medium">{formatHours(task.estimatedHours)}시간</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {task.status === "done" ? "실제 소요 시간" : "남은 시간"}
              </p>
              <p className="font-medium">
                {task.status === "done" ? formatHours(task.actualHours ?? task.accumulatedHours) : formatHours(size.remainingHours)}시간
              </p>
            </div>
          </div>
          {size.isReestimated ? (
            <p className="mt-3.5 border-t pt-3.5 text-sm text-muted-foreground">
              {formatHours(task.accumulatedHours)}시간을 써서 {task.progressPercent}%가 끝났으니 전체를 {formatHours(size.totalSize)}
              시간짜리로 봅니다. 남은 {formatHours(size.remainingHours)}시간이 여기서 나옵니다.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <TaskDetailPanel task={task} projects={projects} referenceLinks={referenceLinks} />
    </div>
  );
}
