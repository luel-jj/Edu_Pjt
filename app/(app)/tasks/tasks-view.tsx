"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteProject, setProjectStatus } from "@/lib/tasks/actions";
import { formatHours, formatShortDateKo, TASK_TYPE_LABEL } from "@/lib/tasks/format";
import { upcomingWorkdays } from "@/lib/tasks/scheduling";
import type { TasksListData } from "@/lib/tasks/aggregate";

const GANTT_DAYS = 15;

export function TasksView({ data }: { data: TasksListData }) {
  const { tasks, projects, recentCompleted, today, projectIdsWithAnyTasks } = data;

  const allSorted = useMemo(
    () => [...tasks].sort((a, b) => (a.requestedDueDate < b.requestedDueDate ? -1 : a.requestedDueDate > b.requestedDueDate ? 1 : 0)),
    [tasks]
  );

  const totalRemainingHours = tasks.reduce((sum, t) => sum + t.remainingHours, 0);
  const recentCompletedSum = recentCompleted.reduce((sum, t) => sum + (t.actualHours ?? 0), 0);

  const byProject = useMemo(() => {
    const groups = new Map<string, { projectId: string | null; name: string; status: string; tasks: typeof tasks }>();
    for (const project of projects) {
      groups.set(project.id, { projectId: project.id, name: project.name, status: project.status, tasks: [] });
    }
    if (!groups.has("__none__")) groups.set("__none__", { projectId: null, name: "프로젝트 없음", status: "active", tasks: [] });
    for (const t of allSorted) {
      const key = t.projectId || "__none__";
      if (!groups.has(key)) groups.set(key, { projectId: t.projectId, name: t.projectName, status: "active", tasks: [] });
      groups.get(key)!.tasks.push(t);
    }
    // "프로젝트 없음" 그룹은 업무가 있을 때만 보여준다. 실제 프로젝트는 업무가 0건이어도 항상 보여야
    // 완료 처리·삭제(0건일 때만) 같은 관리 동작에 계속 접근할 수 있다.
    return [...groups.values()].filter((g) => g.projectId !== null || g.tasks.length > 0);
  }, [projects, allSorted]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">업무</h1>
          <p className="text-sm text-muted-foreground">
            아직 끝나지 않은 업무 {tasks.length}건 · 남은 시간 합계 {formatHours(totalRemainingHours)}시간 · 완료한 업무는 실적에서
            봅니다
          </p>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="project">프로젝트별</TabsTrigger>
          <TabsTrigger value="timeline">일정</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>전체</CardTitle>
              <CardDescription>마감이 이른 순입니다.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <AllTable tasks={allSorted} />
            </CardContent>
          </Card>
          <RecentCompleted recentCompleted={recentCompleted} sum={recentCompletedSum} />
        </TabsContent>

        <TabsContent value="project" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>프로젝트별</CardTitle>
              <CardDescription>끝난 프로젝트는 완료 처리하면 등록할 때 고르는 목록에서 빠집니다.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {byProject.map((group) => (
                <ProjectGroup
                  key={group.projectId ?? "__none__"}
                  group={group}
                  hasAnyTasks={group.projectId !== null && projectIdsWithAnyTasks.has(group.projectId)}
                />
              ))}
            </CardContent>
          </Card>
          <RecentCompleted recentCompleted={recentCompleted} sum={recentCompletedSum} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>일정</CardTitle>
              <CardDescription>지금 일정대로 갈 때 각 업무가 언제부터 언제까지 물려 있는지 보여줍니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <Gantt tasks={allSorted} today={today} />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-3.5 rounded-sm bg-primary" />
                  마감 안에 하는 몫
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-3.5 rounded-sm bg-destructive" />
                  마감을 넘기는 몫
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-0.5 bg-foreground" />
                  마감 요청일
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AllTable({ tasks }: { tasks: TasksListData["tasks"] }) {
  if (tasks.length === 0) {
    return <p className="px-6 py-10 text-center text-sm text-muted-foreground">아직 등록된 업무가 없습니다.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>업무</TableHead>
          <TableHead>구분</TableHead>
          <TableHead>프로젝트</TableHead>
          <TableHead className="text-right">마감</TableHead>
          <TableHead className="text-right">남은</TableHead>
          <TableHead>진행률</TableHead>
          <TableHead className="text-right">상황</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-medium">
              <Link href={`/tasks/${t.id}`} className="hover:underline">
                {t.title}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={t.taskType === "dev" ? "default" : "outline"}>{TASK_TYPE_LABEL[t.taskType]}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">{t.projectName}</TableCell>
            <TableCell className="text-right tabular-nums">{formatShortDateKo(t.requestedDueDate)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatHours(t.remainingHours)}시간</TableCell>
            <TableCell>
              {t.status === "todo" ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="w-9 text-right tabular-nums text-xs">{t.progressPercent ?? 0}%</span>
                  <Progress value={t.progressPercent ?? 0} className="h-1.5 w-16" />
                </span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {t.schedule?.isDueRisk ? (
                <span className="font-medium text-destructive">{formatHours(t.schedule.shortfallHours)}시간 모자람</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProjectGroup({
  group,
  hasAnyTasks,
}: {
  group: { projectId: string | null; name: string; status: string; tasks: TasksListData["tasks"] };
  hasAnyTasks: boolean;
}) {
  const remainingHours = group.tasks.reduce((sum, t) => sum + t.remainingHours, 0);
  const dueRiskCount = group.tasks.filter((t) => t.schedule?.isDueRisk).length;

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="font-medium">{group.name}</span>
          {group.status === "completed" ? <Badge variant="secondary">완료</Badge> : null}
          <span className="text-xs text-muted-foreground">
            남은 업무 {group.tasks.length}건 · {formatHours(remainingHours)}시간
            {dueRiskCount > 0 ? ` · 마감 위험 ${dueRiskCount}건` : ""}
          </span>
        </div>
        {group.projectId ? (
          <div className="flex items-center gap-2">
            <ProjectStatusButton projectId={group.projectId} status={group.status} remainingCount={group.tasks.length} />
            {group.tasks.length === 0 && !hasAnyTasks ? (
              <ProjectDeleteButton projectId={group.projectId} projectName={group.name} />
            ) : null}
          </div>
        ) : null}
      </div>
      {group.tasks.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">남은 업무가 없습니다.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>업무</TableHead>
              <TableHead>구분</TableHead>
              <TableHead className="text-right">마감</TableHead>
              <TableHead className="text-right">남은</TableHead>
              <TableHead>진행률</TableHead>
              <TableHead className="text-right">상황</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.tasks.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <Link href={`/tasks/${t.id}`} className="hover:underline">
                    {t.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={t.taskType === "dev" ? "default" : "outline"}>{TASK_TYPE_LABEL[t.taskType]}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatShortDateKo(t.requestedDueDate)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatHours(t.remainingHours)}시간</TableCell>
                <TableCell>
                  {t.status === "todo" ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="w-9 text-right tabular-nums text-xs">{t.progressPercent ?? 0}%</span>
                      <Progress value={t.progressPercent ?? 0} className="h-1.5 w-16" />
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {t.schedule?.isDueRisk ? (
                    <span className="font-medium text-destructive">{formatHours(t.schedule.shortfallHours)}시간 모자람</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ProjectStatusButton({
  projectId,
  status,
  remainingCount,
}: {
  projectId: string;
  status: string;
  remainingCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const blockedByRemaining = status !== "completed" && remainingCount > 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={isPending || blockedByRemaining}
        title={blockedByRemaining ? "남은 업무가 있어 완료 처리할 수 없습니다." : undefined}
        onClick={() =>
          startTransition(async () => {
            const result = await setProjectStatus(projectId, status === "completed" ? "active" : "completed");
            if (result.error) {
              setError(result.error);
              return;
            }
            setError(null);
            router.refresh();
          })
        }
      >
        {status === "completed" ? "다시 열기" : "완료 처리"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

function ProjectDeleteButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>삭제</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{projectName} 프로젝트를 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            되돌릴 수 없습니다. 업무가 남아 있으면 삭제되지 않습니다.
            {error ? <span className="mt-1 block text-destructive">{error}</span> : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setError(null)}>취소</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await deleteProject(projectId);
                if (result.error) {
                  setError(result.error);
                  return;
                }
                setOpen(false);
                router.refresh();
              });
            }}
          >
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RecentCompleted({ recentCompleted, sum }: { recentCompleted: TasksListData["recentCompleted"]; sum: number }) {
  return (
    <details className="mt-4 rounded-md border">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2.5 px-4 py-3 text-[15px] font-semibold">
        <span className="text-muted-foreground">▶</span>
        최근 완료
        <span className="text-sm font-normal text-muted-foreground">
          2주 안에 끝낸 업무 {recentCompleted.length}건 · {formatHours(sum)}시간
        </span>
      </summary>
      <div className="border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>업무</TableHead>
              <TableHead>구분</TableHead>
              <TableHead>프로젝트</TableHead>
              <TableHead className="text-right">완료</TableHead>
              <TableHead className="text-right">예상</TableHead>
              <TableHead className="text-right">실제</TableHead>
              <TableHead className="text-right">차이</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentCompleted.map((t) => {
              const diff = (t.actualHours ?? 0) - t.estimatedHours;
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    <Link href={`/tasks/${t.id}`} className="hover:underline">
                      {t.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.taskType === "dev" ? "default" : "outline"}>{TASK_TYPE_LABEL[t.taskType]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.projectName}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.completedAt ? formatShortDateKo(t.completedAt.slice(0, 10)) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatHours(t.estimatedHours)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatHours(t.actualHours ?? 0)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${diff > 0 ? "text-destructive" : ""}`}>
                    {diff > 0 ? "+" : ""}
                    {formatHours(diff)}
                  </TableCell>
                </TableRow>
              );
            })}
            {recentCompleted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  최근 2주 안에 완료한 업무가 없습니다.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <p className="px-4 py-3 text-sm text-muted-foreground">
          더 예전에 끝낸 업무는{" "}
          <Link href="/performance" className="text-primary hover:underline">
            실적
          </Link>
          에서 월과 프로젝트로 묶어 봅니다.
        </p>
      </div>
    </details>
  );
}

function Gantt({ tasks, today }: { tasks: TasksListData["tasks"]; today: string }) {
  const days = useMemo(() => upcomingWorkdays(today, GANTT_DAYS), [today]);
  const dayIndex = new Map(days.map((d, i) => [d, i]));

  function indexFor(dateIso: string): number {
    if (dayIndex.has(dateIso)) return dayIndex.get(dateIso)!;
    return dateIso < days[0] ? 0 : days.length;
  }

  const grouped = useMemo(() => {
    const groups = new Map<string, TasksListData["tasks"]>();
    for (const t of tasks) {
      const key = t.projectName;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return [...groups.entries()];
  }, [tasks]);

  if (tasks.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">아직 등록된 업무가 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${210 + days.length * 42}px` }}>
        <div className="flex border-b">
          <div className="w-[210px] flex-none" />
          <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, 42px)` }}>
            {days.map((d) => (
              <div
                key={d}
                className={`flex flex-col items-center justify-center border-l py-1.5 text-[11px] text-muted-foreground ${d === today ? "font-semibold text-foreground" : ""}`}
              >
                <span>{formatShortDateKo(d)}</span>
              </div>
            ))}
          </div>
        </div>
        {grouped.map(([projectName, group]) => (
          <div key={projectName}>
            <div className="flex items-stretch border-t bg-muted/40">
              <div className="w-[210px] flex-none px-3.5 py-2 text-xs font-semibold">{projectName}</div>
              <div className="flex-1" />
            </div>
            {group.map((t) => {
              if (!t.schedule) return null;
              const startIdx = indexFor(t.schedule.startDate);
              const endIdx = Math.max(startIdx + 1, indexFor(t.schedule.completionDate) + 1);
              const dueIdx = indexFor(t.requestedDueDate);
              const overIdx = Math.min(endIdx, Math.max(startIdx, dueIdx + 1));
              return (
                <div key={t.id} className="flex items-stretch border-t">
                  <div className="w-[210px] flex-none px-3.5 py-2">
                    <Link href={`/tasks/${t.id}`} className="block truncate text-[13px] font-medium hover:underline">
                      {t.title}
                    </Link>
                  </div>
                  <div className="relative grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, 42px)`, minHeight: 34 }}>
                    {days.map((d) => (
                      <div key={d} className={`border-l ${d === today ? "bg-primary/5" : ""}`} style={{ gridRow: 1 }} />
                    ))}
                    <div
                      className="absolute top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded"
                      style={{ left: `${startIdx * 42 + 2}px`, width: `${(endIdx - startIdx) * 42 - 4}px` }}
                    >
                      <div className="flex h-full w-full">
                        <div className="h-full bg-primary" style={{ width: `${((overIdx - startIdx) / (endIdx - startIdx)) * 100}%` }} />
                        {overIdx < endIdx ? (
                          <div className="h-full bg-destructive" style={{ width: `${((endIdx - overIdx) / (endIdx - startIdx)) * 100}%` }} />
                        ) : null}
                      </div>
                    </div>
                    {dueIdx >= 0 && dueIdx < days.length ? (
                      <div className="absolute top-1/2 z-10 h-7 w-0.5 -translate-y-1/2 bg-foreground" style={{ left: `${(dueIdx + 1) * 42}px` }} />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
