"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveDailyClose } from "@/lib/tasks/actions";
import { computeTaskSize, WORK_HOURS_PER_DAY } from "@/lib/tasks/scheduling";
import { formatHours } from "@/lib/tasks/format";
import type { Task, TaskStatus } from "@/lib/tasks/types";

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "진행 전", in_progress: "진행 중", done: "완료" };

interface Row {
  task: Task;
  todayHours: number;
  size: ReturnType<typeof computeTaskSize>;
}

function deriveStatus(currentStatus: TaskStatus, hoursToday: number, progressPercent: number | null): TaskStatus {
  if (progressPercent === 100) return "done";
  if (currentStatus === "todo" && (hoursToday > 0 || (progressPercent ?? 0) > 0)) return "in_progress";
  return currentStatus;
}

export function CloseDayForm({
  today,
  initialMeetingHours,
  rows,
}: {
  today: string;
  initialMeetingHours: number;
  rows: Row[];
}) {
  const router = useRouter();
  const [meetingHours, setMeetingHours] = useState(String(initialMeetingHours || ""));
  const [entries, setEntries] = useState(
    () =>
      new Map(
        rows.map((r) => [
          r.task.id,
          { hoursToday: r.todayHours || 0, progressPercent: r.task.progressPercent, statusOverride: null as TaskStatus | null },
        ])
      )
  );
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ completedTasks: { title: string; actualHours: number }[]; totalHoursLogged: number; meetingHours: number } | null>(
    null
  );

  const meetingHoursNum = Number(meetingHours) || 0;
  const totalTaskHours = [...entries.values()].reduce((sum, e) => sum + e.hoursToday, 0);
  const totalToday = totalTaskHours + meetingHoursNum;

  function updateEntry(taskId: string, patch: Partial<{ hoursToday: number; progressPercent: number | null; statusOverride: TaskStatus | null }>) {
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(taskId, { ...next.get(taskId)!, ...patch });
      return next;
    });
  }

  function handleSave() {
    startTransition(async () => {
      const payload = rows.map((r) => {
        const e = entries.get(r.task.id)!;
        const status = e.statusOverride ?? deriveStatus(r.task.status, e.hoursToday, e.progressPercent);
        return { taskId: r.task.id, hoursToday: e.hoursToday, progressPercent: e.progressPercent, status };
      });
      const res = await saveDailyClose(today, meetingHoursNum, payload);
      if (res.data) {
        setResult(res.data);
        router.refresh();
      }
    });
  }

  return (
    <div>
      {result ? (
        <div className="mb-5 rounded-md border border-primary/30 bg-primary/5 p-4">
          <p className="font-semibold">오늘 기록을 저장했습니다.</p>
          {result.completedTasks.length > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {result.completedTasks.map((t) => `${t.title}(실제 ${formatHours(t.actualHours)}시간)`).join(", ")}이 완료로 넘어갔습니다.
              실제 소요 시간이 앞으로의 추정에 쓰입니다.
            </p>
          ) : null}
        </div>
      ) : null}

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex-1">
            <p className="font-medium">오늘 회의에 쓴 시간</p>
            <p className="text-xs text-muted-foreground">근무 8시간에서 이 시간을 빼서 앞으로의 하루 가용 시간을 잡습니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step={0.5}
              min={0}
              className="w-20"
              value={meetingHours}
              onChange={(e) => setMeetingHours(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">시간</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>오늘의 업무</CardTitle>
          <CardDescription>시간을 적으면 진행 전이던 업무는 진행 중으로 바뀝니다. 진행률을 적으면 남은 시간이 다시 계산됩니다.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>업무</TableHead>
                <TableHead className="text-right">오늘 쓴 시간</TableHead>
                <TableHead className="text-right">진행률</TableHead>
                <TableHead>다시 잡은 규모</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const e = entries.get(r.task.id)!;
                const baseAccumulated = r.task.accumulatedHours - r.todayHours;
                const previewSize = computeTaskSize({
                  estimatedHours: r.task.estimatedHours,
                  progressPercent: e.progressPercent,
                  accumulatedHours: baseAccumulated + e.hoursToday,
                });
                const status = e.statusOverride ?? deriveStatus(r.task.status, e.hoursToday, e.progressPercent);
                return (
                  <TableRow key={r.task.id}>
                    <TableCell className="font-medium">{r.task.title}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step={0.5}
                        min={0}
                        className="ml-auto w-20 text-right"
                        value={e.hoursToday || ""}
                        placeholder="0"
                        onChange={(ev) => updateEntry(r.task.id, { hoursToday: Number(ev.target.value) || 0 })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step={5}
                        min={0}
                        max={100}
                        className="ml-auto w-20 text-right"
                        value={e.progressPercent ?? ""}
                        placeholder="—"
                        onChange={(ev) => {
                          const v = ev.target.value === "" ? null : Number(ev.target.value);
                          updateEntry(r.task.id, { progressPercent: v });
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.progressPercent ? `${formatHours(previewSize.totalSize)}시간 · 남은 ${formatHours(previewSize.remainingHours)}시간` : "—"}
                    </TableCell>
                    <TableCell>
                      <Select value={status} onValueChange={(v) => updateEntry(r.task.id, { statusOverride: v as TaskStatus })}>
                        <SelectTrigger className="w-28">
                          <SelectValue>{STATUS_LABEL[status]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(["todo", "in_progress", "done"] as const).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    진행 중인 업무가 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-t px-4 py-3.5 sm:px-6">
            <span className="font-semibold">오늘 남긴 시간 {formatHours(totalToday)}시간</span>
            <span className="text-sm text-muted-foreground">
              업무 {formatHours(totalTaskHours)}시간 + 회의 {formatHours(meetingHoursNum)}시간. 근무 {WORK_HOURS_PER_DAY}시간
              {totalToday > WORK_HOURS_PER_DAY
                ? `을 ${formatHours(totalToday - WORK_HOURS_PER_DAY)}시간 넘겼습니다.`
                : ` 중 ${formatHours(totalToday)}시간을 남겼습니다.`}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "저장 중..." : "오늘 기록 저장"}
        </Button>
      </div>
    </div>
  );
}
