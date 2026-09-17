import { getActiveTasks, getTaskDailyEntriesForDate, getTodayDailyLog } from "@/lib/tasks/queries";
import { computeTaskSize } from "@/lib/tasks/scheduling";
import { todayIsoInSeoul } from "@/lib/tasks/today";
import { formatFullDateKo } from "@/lib/tasks/format";
import { CloseDayForm } from "./close-day-form";

export default async function CloseDayPage() {
  const today = todayIsoInSeoul();
  const [tasks, dailyLog, todayEntries] = await Promise.all([
    getActiveTasks(),
    getTodayDailyLog(today),
    getTaskDailyEntriesForDate(today),
  ]);

  const rows = tasks.map((t) => ({
    task: t,
    todayHours: todayEntries.get(t.id) ?? 0,
    size: computeTaskSize(t),
  }));

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">{formatFullDateKo(today)} 마감</h1>
        <p className="text-sm text-muted-foreground">오늘 쓴 시간과 어디까지 왔는지만 적으면 됩니다.</p>
      </div>
      <CloseDayForm today={today} initialMeetingHours={dailyLog.meetingHours} initialWorkHours={dailyLog.workHours} rows={rows} />
    </div>
  );
}
