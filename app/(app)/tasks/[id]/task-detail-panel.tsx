"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addReferenceLink, deleteReferenceLink, editTask } from "@/lib/tasks/actions";
import { formatFullDateKo, TASK_TYPE_LABEL } from "@/lib/tasks/format";
import type { Project, Task, TaskReferenceLink, TaskType } from "@/lib/tasks/types";

const NO_PROJECT_VALUE = "__none__";

function projectLabel(value: string, projects: Project[]): string {
  if (value === NO_PROJECT_VALUE) return "프로젝트 없음";
  return projects.find((p) => p.id === value)?.name ?? "프로젝트 선택";
}

export function TaskDetailPanel({
  task,
  projects,
  referenceLinks,
}: {
  task: Task;
  projects: Project[];
  referenceLinks: TaskReferenceLink[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [links, setLinks] = useState(referenceLinks);
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(task.title);
  const [taskType, setTaskType] = useState<TaskType>(task.taskType);
  const [projectId, setProjectId] = useState(task.projectId || NO_PROJECT_VALUE);
  const [dueDate, setDueDate] = useState(task.requestedDueDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [estimatedHours, setEstimatedHours] = useState(String(task.estimatedHours));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAddLink() {
    const label = newLinkLabel.trim();
    if (!label) {
      setLinkError("자료 이름을 입력해 주세요.");
      return;
    }
    const result = await addReferenceLink(task.id, label, label.startsWith("http") ? label : undefined);
    if (result.error) {
      setLinkError(result.error);
      return;
    }
    setLinks((prev) => [...prev, { id: crypto.randomUUID(), taskId: task.id, label, url: null, createdAt: new Date().toISOString() }]);
    setNewLinkLabel("");
    setLinkError(null);
    router.refresh();
  }

  async function handleDeleteLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    await deleteReferenceLink(id, task.id);
    router.refresh();
  }

  function handleSave() {
    setError(null);
    if (!title.trim()) {
      setError("업무명을 입력해 주세요.");
      return;
    }
    startTransition(async () => {
      const result = await editTask({
        taskId: task.id,
        title,
        taskType,
        projectId: projectId === NO_PROJECT_VALUE ? "" : projectId,
        requestedDueDate: dueDate,
        estimatedHours: Number(estimatedHours) || task.estimatedHours,
        reason,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      {!editing ? (
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => setEditing(true)}>
            수정
          </Button>
          <Button variant="outline" render={<Link href={`/tasks/${task.id}/history`} />} nativeButton={false}>
            히스토리
          </Button>
        </div>
      ) : null}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>참조 자료</CardTitle>
          <CardDescription>요청 메일이나 사내 시스템 주소를 필요할 때 더 붙입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col">
            {links.map((link) => (
              <li key={link.id} className="flex items-center gap-2.5 border-t py-2.5 first:border-t-0">
                {link.url ? (
                  <a href={link.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm text-primary hover:underline">
                    {link.label}
                  </a>
                ) : (
                  <span className="flex-1 truncate text-sm">{link.label}</span>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleDeleteLink(link.id)}>
                  삭제
                </Button>
              </li>
            ))}
            {links.length === 0 ? <li className="py-2.5 text-sm text-muted-foreground">아직 붙인 자료가 없습니다.</li> : null}
          </ul>
          <div className="mt-3 flex gap-2">
            <Input placeholder="자료 이름" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} />
            <Button type="button" variant="outline" size="sm" onClick={handleAddLink}>
              추가
            </Button>
          </div>
          {linkError ? <p className="mt-1.5 text-xs text-destructive">{linkError}</p> : null}
        </CardContent>
      </Card>

      {editing ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>업무 수정</CardTitle>
            <CardDescription>바꾼 내용은 히스토리에 이유와 함께 남습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="d-name">업무명</FieldLabel>
                <Input id="d-name" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>마감 요청일</FieldLabel>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal" />}>
                      {formatFullDateKo(dueDate)}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(`${dueDate}T00:00:00`)}
                        onSelect={(d) => {
                          if (!d) return;
                          setDueDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
                          setCalendarOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </Field>
                <Field>
                  <FieldLabel htmlFor="d-project">프로젝트</FieldLabel>
                  <Select value={projectId} onValueChange={(v) => setProjectId(v ?? NO_PROJECT_VALUE)}>
                    <SelectTrigger id="d-project" className="w-full">
                      <SelectValue>{(v: string) => projectLabel(v, projects)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT_VALUE}>프로젝트 없음</SelectItem>
                      {projects
                        .filter((p) => p.status === "active" || p.id === task.projectId)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>업무 유형</FieldLabel>
                  <div className="flex gap-2">
                    {(["dev", "review"] as const).map((type) => (
                      <Button
                        key={type}
                        type="button"
                        variant={taskType === type ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setTaskType(type)}
                      >
                        {TASK_TYPE_LABEL[type]}
                      </Button>
                    ))}
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="d-hours">예상 소요 시간</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      id="d-hours"
                      type="number"
                      step={0.5}
                      min={0}
                      value={estimatedHours}
                      onChange={(e) => setEstimatedHours(e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">시간</span>
                  </div>
                  <FieldDescription>진행률을 새로 적으면 이 값이 다시 계산됩니다.</FieldDescription>
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="d-reason">
                  바꾼 이유 <span className="font-normal text-muted-foreground">(선택)</span>
                </FieldLabel>
                <Textarea
                  id="d-reason"
                  placeholder="예: 시험 투입 일정이 밀려 마감을 다시 잡음"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isPending}>
                  저장
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  취소
                </Button>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
