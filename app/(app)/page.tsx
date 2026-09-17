import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { loadMorningData } from "@/lib/tasks/aggregate";
import { formatFullDateKo, formatHours, formatShortDateKo, TASK_STATUS_LABEL, TASK_TYPE_LABEL } from "@/lib/tasks/format";

export default async function MorningPage() {
  const { today, availableHours, averageMeetingHours, averageWorkHours, sampleSize, tasks, dueRiskTasks } = await loadMorningData();

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">{formatFullDateKo(today)}</h1>
        <p className="text-sm text-muted-foreground">오늘 할 일 순서와 앞으로의 병목을 확인합니다.</p>
      </div>

      <div className="mb-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5 rounded-lg border bg-muted p-4">
        <span className="text-xl font-semibold tracking-tight">오늘 {formatHours(availableHours)}시간</span>
        <span className="text-sm text-muted-foreground">
          {sampleSize > 0
            ? `최근 ${sampleSize}근무일 평균 근무 ${formatHours(averageWorkHours)}시간에서 평균 회의 ${formatHours(averageMeetingHours)}시간을 뺐습니다.`
            : "근무·회의 기록이 없어 근무 8시간을 그대로 씁니다."}
        </span>
      </div>

      {dueRiskTasks.length > 0 ? (
        <Alert variant="destructive" className="mb-5">
          <AlertTriangle />
          <AlertTitle>이대로 가면 마감을 못 맞추는 업무가 {dueRiskTasks.length}건 있습니다</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 flex flex-col gap-2">
              {dueRiskTasks.map((t) => (
                <li key={t.id} className="flex flex-col gap-1 border-t border-destructive/20 pt-2 first:border-t-0 first:pt-0">
                  <span className="font-medium text-foreground">{t.title}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="flex min-w-32 items-center gap-1.5">
                      {t.progressPercent && t.progressPercent > 0 ? `진행률 ${t.progressPercent}%` : "아직 시작 전"}
                      <Progress value={t.progressPercent ?? 0} className="h-1.5 w-16" />
                    </span>
                    <span>{formatShortDateKo(t.requestedDueDate)} 마감</span>
                    <span className="font-medium">{formatHours(t.schedule!.shortfallHours)}시간 모자람</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">지금이면 협조를 요청하거나 요청자에게 일정을 다시 제안할 수 있습니다.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {tasks.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertTriangle />
                </EmptyMedia>
                <EmptyTitle>아직 등록된 업무가 없습니다</EmptyTitle>
                <EmptyDescription>업무를 등록하면 내일 아침부터 순서와 경고가 여기에 나옵니다.</EmptyDescription>
              </EmptyHeader>
              <Button render={<Link href="/tasks/new" />} nativeButton={false}>
                업무 등록하러 가기
              </Button>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>오늘 할 일</CardTitle>
            <CardDescription>마감을 못 맞출 업무를 먼저, 그다음은 마감이 이른 순입니다.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>업무</TableHead>
                  <TableHead>구분</TableHead>
                  <TableHead>진행률</TableHead>
                  <TableHead className="text-right">마감</TableHead>
                  <TableHead className="text-right">남은</TableHead>
                  <TableHead className="text-right">오늘 몫</TableHead>
                  <TableHead className="text-right">상황</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((t, i) => (
                  <TableRow key={t.id} className={t.schedule?.isDueRisk ? "bg-destructive/5" : undefined}>
                    <TableCell className={t.schedule?.isDueRisk ? "text-center font-semibold text-destructive" : "text-center text-muted-foreground"}>
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/tasks/${t.id}`} className="hover:underline">
                        {t.title}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={t.taskType === "dev" ? "default" : "outline"}>{TASK_TYPE_LABEL[t.taskType]}</Badge>{" "}
                      <Badge variant="secondary">{TASK_STATUS_LABEL[t.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      {t.status === "todo" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className="w-9 text-right tabular-nums">{t.progressPercent ?? 0}%</span>
                          <Progress value={t.progressPercent ?? 0} className="h-1.5 flex-1" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatShortDateKo(t.requestedDueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatHours(t.remainingHours)}시간</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {t.schedule && t.schedule.todayShareHours > 0 ? `${formatHours(t.schedule.todayShareHours)}시간` : (
                        <span className="text-muted-foreground">—</span>
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
