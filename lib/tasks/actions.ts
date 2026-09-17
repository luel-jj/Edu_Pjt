"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Task, TaskType } from "./types";

async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) throw new Error("로그인이 필요합니다.");
  return claims.sub as string;
}

export async function createProject(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "프로젝트 이름을 입력해 주세요." };
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: userId, name: trimmed })
    .select("id, name")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/tasks/new");
  revalidatePath("/tasks");
  return { data };
}

export async function setProjectStatus(projectId: string, status: "active" | "completed") {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", projectId);
  if (error) return { error: error.message };
  revalidatePath("/tasks");
  return { data: true };
}

export interface CreateTaskInput {
  title: string;
  taskType: TaskType;
  projectId: string;
  requestedDueDate: string;
  estimatedHours: number;
  referenceLinks: { label: string; url?: string }[];
}

export async function createTask(input: CreateTaskInput) {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      project_id: input.projectId,
      title: input.title.trim(),
      task_type: input.taskType,
      requested_due_date: input.requestedDueDate,
      original_due_date: input.requestedDueDate,
      estimated_hours: input.estimatedHours,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const links = input.referenceLinks.filter((l) => l.label.trim().length > 0);
  if (links.length > 0) {
    await supabase.from("task_reference_links").insert(
      links.map((l) => ({ task_id: task.id, user_id: userId, label: l.label.trim(), url: l.url?.trim() || null }))
    );
  }

  await supabase.from("task_history").insert({
    task_id: task.id,
    user_id: userId,
    event_type: "created",
    detail: {
      title: input.title.trim(),
      taskType: input.taskType,
      requestedDueDate: input.requestedDueDate,
      estimatedHours: input.estimatedHours,
    },
  });

  revalidatePath("/");
  revalidatePath("/tasks");
  return { data: task };
}

export interface EditTaskInput {
  taskId: string;
  title: string;
  taskType: TaskType;
  projectId: string;
  requestedDueDate: string;
  estimatedHours: number;
  reason?: string;
}

export async function editTask(input: EditTaskInput) {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", input.taskId)
    .single();
  if (fetchError || !existing) return { error: fetchError?.message ?? "업무를 찾을 수 없습니다." };

  const { error } = await supabase
    .from("tasks")
    .update({
      title: input.title.trim(),
      task_type: input.taskType,
      project_id: input.projectId,
      requested_due_date: input.requestedDueDate,
      estimated_hours: input.estimatedHours,
    })
    .eq("id", input.taskId);
  if (error) return { error: error.message };

  const events: { event_type: string; detail: Record<string, unknown> }[] = [];
  if (existing.requested_due_date !== input.requestedDueDate) {
    events.push({
      event_type: "due_date_changed",
      detail: { from: existing.requested_due_date, to: input.requestedDueDate },
    });
  }
  if (Number(existing.estimated_hours) !== input.estimatedHours) {
    events.push({
      event_type: "estimate_changed",
      detail: { from: Number(existing.estimated_hours), to: input.estimatedHours },
    });
  }
  if (
    existing.title !== input.title.trim() ||
    existing.task_type !== input.taskType ||
    existing.project_id !== input.projectId
  ) {
    events.push({ event_type: "edited", detail: { title: input.title.trim() } });
  }
  if (events.length > 0) {
    await supabase.from("task_history").insert(
      events.map((e) => ({
        task_id: input.taskId,
        user_id: userId,
        event_type: e.event_type,
        detail: e.detail,
        reason: input.reason?.trim() || null,
      }))
    );
  }

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${input.taskId}`);
  return { data: true };
}

export async function addReferenceLink(taskId: string, label: string, url?: string) {
  const trimmed = label.trim();
  if (!trimmed) return { error: "이름을 입력해 주세요." };
  const userId = await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_reference_links")
    .insert({ task_id: taskId, user_id: userId, label: trimmed, url: url?.trim() || null });
  if (error) return { error: error.message };
  await supabase.from("task_history").insert({
    task_id: taskId,
    user_id: userId,
    event_type: "reference_added",
    detail: { label: trimmed },
  });
  revalidatePath(`/tasks/${taskId}`);
  return { data: true };
}

export async function deleteReferenceLink(id: string, taskId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("task_reference_links").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { data: true };
}

export interface DailyTaskEntry {
  taskId: string;
  hoursToday: number;
  progressPercent: number | null;
  status: Task["status"];
}

export async function saveDailyClose(dateIso: string, meetingHours: number, entries: DailyTaskEntry[]) {
  const userId = await requireUserId();
  const supabase = await createClient();

  await supabase
    .from("daily_logs")
    .upsert({ user_id: userId, log_date: dateIso, meeting_hours: meetingHours }, { onConflict: "user_id,log_date" });

  const completedTasks: { title: string; actualHours: number }[] = [];
  let totalHoursLogged = 0;

  for (const entry of entries) {
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", entry.taskId)
      .single();
    if (taskError || !task) continue;

    const { data: existingEntry } = await supabase
      .from("task_daily_entries")
      .select("hours")
      .eq("task_id", entry.taskId)
      .eq("entry_date", dateIso)
      .maybeSingle();
    const previousHoursToday = existingEntry ? Number(existingEntry.hours) : 0;
    const delta = entry.hoursToday - previousHoursToday;

    if (delta !== 0) {
      await supabase
        .from("task_daily_entries")
        .upsert(
          { task_id: entry.taskId, user_id: userId, entry_date: dateIso, hours: entry.hoursToday },
          { onConflict: "task_id,entry_date" }
        );
    }

    const newAccumulated = Number(task.accumulated_hours) + delta;
    let newStatus = task.status as Task["status"];
    if (task.status === "todo" && (entry.hoursToday > 0 || (entry.progressPercent ?? 0) > 0)) {
      newStatus = "in_progress";
    }
    if (entry.progressPercent === 100) {
      newStatus = "done";
    }
    if (entry.status && entry.status !== task.status) {
      newStatus = entry.status;
    }

    const updatePayload: Record<string, unknown> = {
      accumulated_hours: newAccumulated,
      progress_percent: entry.progressPercent,
      status: newStatus,
    };
    if (newStatus === "done" && task.status !== "done") {
      updatePayload.completed_at = new Date().toISOString();
      updatePayload.actual_hours = newAccumulated;
    }

    await supabase.from("tasks").update(updatePayload).eq("id", entry.taskId);

    totalHoursLogged += entry.hoursToday;
    if (newStatus === "done" && task.status !== "done") {
      completedTasks.push({ title: task.title as string, actualHours: newAccumulated });
    }

    const historyEvents: { event_type: string; detail: Record<string, unknown> }[] = [];
    if (delta !== 0) {
      historyEvents.push({ event_type: "time_logged", detail: { date: dateIso, hours: entry.hoursToday } });
    }
    if (entry.progressPercent !== null && entry.progressPercent !== (task.progress_percent ?? null)) {
      historyEvents.push({
        event_type: "progress_changed",
        detail: { from: task.progress_percent, to: entry.progressPercent },
      });
    }
    if (newStatus !== task.status) {
      historyEvents.push({ event_type: "status_changed", detail: { from: task.status, to: newStatus } });
    }
    if (historyEvents.length > 0) {
      await supabase.from("task_history").insert(
        historyEvents.map((e) => ({
          task_id: entry.taskId,
          user_id: userId,
          event_type: e.event_type,
          detail: e.detail,
        }))
      );
    }
  }

  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/close-day");
  return { data: { completedTasks, totalHoursLogged, meetingHours } };
}
