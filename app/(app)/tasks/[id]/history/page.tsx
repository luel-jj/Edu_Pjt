import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getTaskById, getTaskHistory } from "@/lib/tasks/queries";
import { formatHours } from "@/lib/tasks/format";
import type { TaskHistoryEntry } from "@/lib/tasks/types";

const EVENT_LABEL: Record<TaskHistoryEntry["eventType"], string> = {
  created: "등록",
  due_date_changed: "마감",
  estimate_changed: "예상 시간",
  progress_changed: "진행률",
  time_logged: "시간 기록",
  status_changed: "상태",
  reference_added: "자료",
  edited: "수정",
};

const STATUS_LABEL: Record<string, string> = { todo: "진행 전", in_progress: "진행 중", done: "완료" };

function describeHistory(entry: TaskHistoryEntry): string {
  const d = entry.detail;
  switch (entry.eventType) {
    case "created":
      return `등록 · 마감 ${d.requestedDueDate} · 예상 ${formatHours(Number(d.estimatedHours))}시간`;
    case "due_date_changed":
      return `마감 요청일을 ${d.from}에서 ${d.to}로 변경`;
    case "estimate_changed":
      return `예상 소요 시간을 ${formatHours(Number(d.from))}시간에서 ${formatHours(Number(d.to))}시간으로 변경`;
    case "progress_changed":
      return `진행률을 ${d.from ?? 0}%에서 ${d.to}%로 변경`;
    case "time_logged":
      return `${formatHours(Number(d.hours))}시간 기록`;
    case "status_changed":
      return `${STATUS_LABEL[String(d.from)] ?? d.from}에서 ${STATUS_LABEL[String(d.to)] ?? d.to}로 변경`;
    case "reference_added":
      return `참조 자료 추가 · ${d.label}`;
    case "edited":
      return `업무 내용 수정${d.title ? ` · ${d.title}` : ""}`;
    default:
      return "";
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default async function TaskHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await getTaskById(id);
  if (!task) notFound();
  const history = await getTaskHistory(id);

  return (
    <div>
      <Link href={`/tasks/${id}`} className="mb-2.5 inline-block text-[13px] text-muted-foreground hover:text-foreground">
        ← 업무 상세
      </Link>

      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">히스토리</h1>
        <p className="text-sm text-muted-foreground">
          {task.title} · {history.length}건
        </p>
      </div>

      <Card>
        <CardContent>
          <ul className="flex flex-col">
            {history.map((entry) => (
              <li key={entry.id} className="flex gap-4 border-t py-3 first:border-t-0">
                <span className="w-20 flex-none text-sm text-muted-foreground">{formatWhen(entry.createdAt)}</span>
                <span className="w-20 flex-none">
                  <Badge variant="secondary">{EVENT_LABEL[entry.eventType]}</Badge>
                </span>
                <div className="min-w-0 flex-1">
                  <p>{describeHistory(entry)}</p>
                  {entry.reason ? <p className="text-sm text-muted-foreground">{entry.reason}</p> : null}
                </div>
              </li>
            ))}
            {history.length === 0 ? <li className="py-3 text-sm text-muted-foreground">기록이 없습니다.</li> : null}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
