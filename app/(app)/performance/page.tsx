import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getProjects, getTasksCompletedInYear } from "@/lib/tasks/queries";
import { summarizePerformance } from "@/lib/tasks/performance";
import { formatHours, formatShortDateKo, TASK_TYPE_LABEL } from "@/lib/tasks/format";
import { todayIsoInSeoul } from "@/lib/tasks/today";

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const currentYear = Number(todayIsoInSeoul().slice(0, 4));
  const year = Number(params.year) || currentYear;
  const currentMonth = Number(todayIsoInSeoul().slice(5, 7));
  const month = Number(params.month) || currentMonth;

  const [tasks, projects] = await Promise.all([getTasksCompletedInYear(year), getProjects()]);
  const summary = summarizePerformance(tasks, projects);
  const monthTasks = tasks
    .filter((t) => t.completedAt && new Date(t.completedAt).getMonth() + 1 === month)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));

  const yearOptions = [currentYear, currentYear - 1];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{year}년 실적</h1>
          <p className="text-sm text-muted-foreground">
            완료한 업무를 월과 프로젝트로 묶어 봅니다. KPI를 쓰거나 업무 재분배를 협의할 때 그대로 꺼내 씁니다.
          </p>
        </div>
        <div className="flex gap-1.5">
          {yearOptions.map((y) => (
            <Link
              key={y}
              href={`/performance?year=${y}`}
              className={`rounded-md border px-3 py-1.5 text-sm ${y === year ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {y}년
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">완료한 업무</p>
            <p className="text-2xl font-semibold tracking-tight">{summary.totalCount}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">들인 시간</p>
            <p className="text-2xl font-semibold tracking-tight">{formatHours(summary.totalHours)}시간</p>
            <p className="text-xs text-muted-foreground">회의 시간은 따로 집계</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">주요 모델 개발</p>
            <p className="text-2xl font-semibold tracking-tight">{summary.devCount}건</p>
            <p className="text-xs text-muted-foreground">
              {formatHours(summary.devHours)}시간 · 전체의 {summary.devSharePercent}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">예상 대비 실제</p>
            <p className="text-2xl font-semibold tracking-tight">
              {summary.varianceFromEstimatePercent > 0 ? "+" : ""}
              {summary.varianceFromEstimatePercent}%
            </p>
            <p className="text-xs text-muted-foreground">
              예상 {formatHours(summary.totalEstimatedHours)}시간 · 실제 {formatHours(summary.totalHours)}시간
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>월별</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>월</TableHead>
                  <TableHead className="text-right">건수</TableHead>
                  <TableHead className="text-right">시간</TableHead>
                  <TableHead>주요 프로젝트</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.byMonth.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>
                      <Link href={`/performance?year=${year}&month=${m.month}`} className={m.month === month ? "font-semibold text-primary" : "hover:underline"}>
                        {m.month}월
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatHours(m.hours)}</TableCell>
                    <TableCell className="text-muted-foreground">{m.topProject}</TableCell>
                  </TableRow>
                ))}
                {summary.byMonth.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      완료한 업무가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>프로젝트별</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>프로젝트</TableHead>
                  <TableHead className="text-right">건수</TableHead>
                  <TableHead className="text-right">시간</TableHead>
                  <TableHead className="text-right">비중</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.byProject.map((p) => (
                  <TableRow key={p.projectId ?? "none"}>
                    <TableCell>
                      {p.name} {p.status === "completed" ? <Badge variant="secondary">완료</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatHours(p.hours)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.sharePercent}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{month}월에 끝낸 업무</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>업무</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>프로젝트</TableHead>
                <TableHead className="text-right">마감</TableHead>
                <TableHead className="text-right">예상</TableHead>
                <TableHead className="text-right">실제</TableHead>
                <TableHead className="text-right">차이</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthTasks.map((t) => {
                const diff = (t.actualHours ?? 0) - t.estimatedHours;
                const projectName = projects.find((p) => p.id === t.projectId)?.name ?? "프로젝트 없음";
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
                    <TableCell className="text-muted-foreground">{projectName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatShortDateKo(t.requestedDueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatHours(t.estimatedHours)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatHours(t.actualHours ?? 0)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${diff > 0 ? "text-destructive" : ""}`}>
                      {diff > 0 ? "+" : ""}
                      {formatHours(diff)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {monthTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    이 달에 끝낸 업무가 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
