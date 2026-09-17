import { createClient } from "@/lib/supabase/server";
import { mapHistoryRow, mapProjectRow, mapReferenceLinkRow, mapTaskRow } from "./mappers";
import type { Project, Task, TaskHistoryEntry, TaskReferenceLink } from "./types";

export async function getActiveTasks(): Promise<Task[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .neq("status", "done")
    .order("requested_due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapTaskRow);
}

export async function getRecentCompletedTasks(limit = 10): Promise<Task[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "done")
    .order("completed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapTaskRow);
}

export async function getTasksCompletedInYear(year: number): Promise<Task[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "done")
    .gte("completed_at", `${year}-01-01T00:00:00Z`)
    .lt("completed_at", `${year + 1}-01-01T00:00:00Z`)
    .order("completed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTaskRow);
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
  if (error) throw error;
  return data ? mapTaskRow(data) : null;
}

export async function getProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select("*").order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapProjectRow);
}

/** 상태와 무관하게(완료 포함) 업무가 하나라도 걸려 있는 프로젝트 id 집합. 삭제 가능 여부 판단에 쓴다. */
export async function getProjectIdsWithAnyTasks(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("project_id");
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.project_id as string));
}

export async function getReferenceLinks(taskId: string): Promise<TaskReferenceLink[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_reference_links")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapReferenceLinkRow);
}

export async function getTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_history")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapHistoryRow);
}

/** 최근 기록 순 회의 시간 배열 (최근 10근무일치를 호출부에서 자른다). */
export async function getRecentMeetingHours(limit = 10): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_logs")
    .select("meeting_hours")
    .order("log_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => Number(row.meeting_hours));
}

/** 최근 기록 순 근무 시간 배열 (최근 10근무일치를 호출부에서 자른다). 야근 등 실제 근무시간을 반영한다. */
export async function getRecentWorkHours(limit = 10): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_logs")
    .select("work_hours")
    .order("log_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => Number(row.work_hours));
}

/** 완료된 업무의 실제 소요 시간(같은 업무 유형). 예상 시간 제안에 쓴다. */
export async function getCompletedActualHoursByType(taskType: Task["taskType"]): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("actual_hours")
    .eq("status", "done")
    .eq("task_type", taskType)
    .not("actual_hours", "is", null);
  if (error) throw error;
  return (data ?? []).map((row) => Number(row.actual_hours));
}

/** 퇴근 전 화면에서 오늘 이미 저장된 회의 시간과 근무 시간을 함께 가져온다. */
export async function getTodayDailyLog(dateIso: string): Promise<{ meetingHours: number; workHours: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_logs")
    .select("meeting_hours, work_hours")
    .eq("log_date", dateIso)
    .maybeSingle();
  if (error) throw error;
  return {
    meetingHours: data ? Number(data.meeting_hours) : 0,
    workHours: data ? Number(data.work_hours) : 8,
  };
}

/** 완료 업무가 한 건이라도 있는 연도 목록 (최신순). 완료 기록이 없는 연도는 실적 화면에서 숨긴다. */
export async function getYearsWithCompletedTasks(): Promise<number[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("completed_at").eq("status", "done").not("completed_at", "is", null);
  if (error) throw error;
  const years = new Set((data ?? []).map((row) => new Date(row.completed_at as string).getFullYear()));
  return [...years].sort((a, b) => b - a);
}

export async function getTaskDailyEntriesForDate(dateIso: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_daily_entries").select("task_id, hours").eq("entry_date", dateIso);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.task_id as string, Number(row.hours)]));
}

export async function getTaskDailyEntry(taskId: string, dateIso: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_daily_entries")
    .select("hours")
    .eq("task_id", taskId)
    .eq("entry_date", dateIso)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.hours) : 0;
}
