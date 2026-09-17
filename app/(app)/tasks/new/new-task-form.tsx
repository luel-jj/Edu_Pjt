"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProject, createTask } from "@/lib/tasks/actions";
import { formatFullDateKo, formatHours, TASK_TYPE_LABEL } from "@/lib/tasks/format";
import { cascadeSchedule, computeDailyLoad, isWorkday, type ScheduleInput } from "@/lib/tasks/scheduling";
import type { TaskType } from "@/lib/tasks/types";

const NEW_PROJECT_VALUE = "__new__";
const NO_PROJECT_VALUE = "__none__";

function projectLabel(value: string, projects: { id: string; name: string }[]): string {
  if (value === NO_PROJECT_VALUE) return "프로젝트 없음";
  if (value === NEW_PROJECT_VALUE) return "+ 새 프로젝트 만들기";
  return projects.find((p) => p.id === value)?.name ?? "프로젝트 선택";
}

interface Props {
  today: string;
  projects: { id: string; name: string }[];
  dailyAvailableHours: number;
  scheduleInputs: ScheduleInput[];
  suggestions: Record<TaskType, { median: number | null; count: number }>;
}

export function NewTaskForm({ today, projects: initialProjects, dailyAvailableHours, scheduleInputs, suggestions }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("review");
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? NO_PROJECT_VALUE);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>(today);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [estimatedHours, setEstimatedHours] = useState("2");
  const [referenceLinks, setReferenceLinks] = useState<{ label: string; url?: string }[]>([]);
  const [linkMode, setLinkMode] = useState<"link" | "note">("link");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dailyLoad = useMemo(() => computeDailyLoad(scheduleInputs, dailyAvailableHours, today, 60), [scheduleInputs, dailyAvailableHours, today]);
  const loadByDate = useMemo(() => new Map(dailyLoad.map((d) => [d.date, d])), [dailyLoad]);
  const selectedLoad = loadByDate.get(dueDate);

  const estimatedHoursNum = Number(estimatedHours) || 0;

  const impact = useMemo(() => {
    const before = cascadeSchedule(scheduleInputs, dailyAvailableHours, today);
    const beforeRiskCount = before.filter((s) => s.isDueRisk).length;
    const after = cascadeSchedule(
      [...scheduleInputs, { taskId: "__preview__", requestedDueDate: dueDate, remainingHours: estimatedHoursNum, createdAt: new Date().toISOString() }],
      dailyAvailableHours,
      today
    );
    const afterRiskCount = after.filter((s) => s.isDueRisk).length;
    const previewEntry = after.find((s) => s.taskId === "__preview__")!;
    return { beforeRiskCount, afterRiskCount, previewEntry };
  }, [scheduleInputs, dailyAvailableHours, today, dueDate, estimatedHoursNum]);

  const suggestion = suggestions[taskType];

  function applySuggestion() {
    if (suggestion.median !== null) setEstimatedHours(String(suggestion.median));
  }

  function handleAddReferenceLink() {
    const label = linkLabel.trim();
    if (!label) return;
    const url = linkMode === "link" ? linkUrl.trim() || undefined : undefined;
    setReferenceLinks((prev) => [...prev, { label, url }]);
    setLinkLabel("");
    setLinkUrl("");
  }

  function handleRemoveReferenceLink(index: number) {
    setReferenceLinks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAddProject() {
    const name = newProjectName.trim();
    if (!name) {
      setNewProjectError("프로젝트 이름을 입력해 주세요.");
      return;
    }
    const result = await createProject(name);
    if (result.error) {
      setNewProjectError(result.error);
      return;
    }
    setProjects((prev) => [...prev, result.data!]);
    setProjectId(result.data!.id);
    setNewProjectName("");
    setNewProjectError(null);
  }

  function handleSubmit() {
    setError(null);
    if (!title.trim()) {
      setError("업무명을 입력해 주세요.");
      return;
    }
    if (estimatedHoursNum <= 0) {
      setError("예상 소요 시간을 입력해 주세요.");
      return;
    }
    startTransition(async () => {
      const result = await createTask({
        title,
        taskType,
        projectId: projectId === NO_PROJECT_VALUE ? "" : projectId,
        requestedDueDate: dueDate,
        estimatedHours: estimatedHoursNum,
        referenceLinks,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(`/tasks/${result.data!.id}`);
    });
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">업무 등록</h1>
        <p className="text-sm text-muted-foreground">들어온 업무를 바로 남겨 둡니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>새 업무</CardTitle>
          <CardDescription>업무명과 마감 요청일만 있으면 등록됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="t-name">업무명</FieldLabel>
              <Input id="t-name" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>마감 요청일</FieldLabel>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger
                    render={
                      <Button variant="outline" className="w-full justify-between font-normal" nativeButton={true} />
                    }
                  >
                    <span>{formatFullDateKo(dueDate)}</span>
                    {selectedLoad ? (
                      <span className="text-xs text-muted-foreground">
                        {selectedLoad.isFull ? "꽉 참" : `${formatHours(selectedLoad.capacityHours - selectedLoad.usedHours)}시간 빔`}
                      </span>
                    ) : null}
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={new Date(`${dueDate}T00:00:00`)}
                      today={new Date(`${today}T00:00:00`)}
                      disabled={{ before: new Date(`${today}T00:00:00`) }}
                      onSelect={(d) => {
                        if (!d) return;
                        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                        setDueDate(iso);
                        setCalendarOpen(false);
                      }}
                      components={{
                        DayButton: (props) => {
                          const { day } = props;
                          const dateIso = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, "0")}-${String(day.date.getDate()).padStart(2, "0")}`;
                          const load = loadByDate.get(dateIso);
                          const workday = isWorkday(dateIso);
                          return (
                            <CalendarDayButton {...props}>
                              <span>{day.date.getDate()}</span>
                              {workday && load ? (
                                <span
                                  className={cn(
                                    "text-[10px] leading-none",
                                    load.isFull ? "font-semibold text-destructive" : "text-muted-foreground"
                                  )}
                                >
                                  {formatHours(load.usedHours)}
                                </span>
                              ) : null}
                            </CalendarDayButton>
                          );
                        },
                      }}
                    />
                    <p className="border-t p-2 text-xs text-muted-foreground">
                      날짜 아래 숫자는 지금 일정대로 갈 때 그날 이미 차 있는 시간입니다.
                    </p>
                  </PopoverContent>
                </Popover>
              </Field>

              <Field>
                <FieldLabel htmlFor="t-project">프로젝트</FieldLabel>
                <Select
                  value={projectId}
                  onValueChange={(v) => setProjectId(v ?? NO_PROJECT_VALUE)}
                >
                  <SelectTrigger id="t-project" className="w-full">
                    <SelectValue placeholder="프로젝트 선택">
                      {(value: string) => projectLabel(value, projects)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT_VALUE}>프로젝트 없음</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={NEW_PROJECT_VALUE}>+ 새 프로젝트 만들기</SelectItem>
                  </SelectContent>
                </Select>
                {projectId === NEW_PROJECT_VALUE ? (
                  <div className="mt-2 flex gap-2">
                    <Input
                      placeholder="새 프로젝트 이름"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={handleAddProject}>
                      추가
                    </Button>
                  </div>
                ) : null}
                {newProjectError ? <FieldDescription className="text-destructive">{newProjectError}</FieldDescription> : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="t-hours">예상 소요 시간</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    id="t-hours"
                    type="number"
                    step={0.5}
                    min={0}
                    inputMode="decimal"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">시간</span>
                </div>
              </Field>
            </div>

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
              {suggestion.median !== null ? (
                <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-dashed p-2.5 text-sm text-muted-foreground">
                  <span>
                    지난 <strong className="text-foreground">{TASK_TYPE_LABEL[taskType]}</strong> {suggestion.count}건의 실제 소요 시간
                    중앙값은 <strong className="text-foreground">{formatHours(suggestion.median)}시간</strong>입니다.
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={applySuggestion}>
                    예상 시간에 넣기
                  </Button>
                </div>
              ) : (
                <FieldDescription>
                  아직 완료한 {TASK_TYPE_LABEL[taskType]} 기록이 없어 제안할 값이 없습니다. 기록이 쌓이면 여기에 나옵니다.
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="t-link">
                참조 링크 <span className="font-normal text-muted-foreground">(선택)</span>
              </FieldLabel>
              {referenceLinks.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {referenceLinks.map((link, i) => (
                    <li key={i} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                      <span className="flex-1 truncate">
                        {link.label}
                        {link.url ? <span className="text-muted-foreground"> · {link.url}</span> : null}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveReferenceLink(i)}>
                        삭제
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={linkMode === "link" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLinkMode("link")}
                >
                  링크
                </Button>
                <Button
                  type="button"
                  variant={linkMode === "note" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLinkMode("note")}
                >
                  비고
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  id="t-link"
                  placeholder={linkMode === "link" ? "자료 이름" : "비고 내용"}
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  className="flex-1"
                />
                {linkMode === "link" ? (
                  <Input
                    type="url"
                    placeholder="URL (선택)"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="flex-1"
                  />
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={handleAddReferenceLink}>
                  추가
                </Button>
              </div>
              <FieldDescription>여러 개를 이어서 추가할 수 있습니다. 등록한 뒤 상세 화면에서도 더 붙일 수 있습니다.</FieldDescription>
            </Field>

            <div
              className={
                impact.afterRiskCount > impact.beforeRiskCount
                  ? "rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                  : "rounded-md border bg-muted p-3 text-sm"
              }
            >
              {impact.afterRiskCount > impact.beforeRiskCount ? (
                <>
                  이 업무를 넣으면 마감을 못 맞추는 업무가{" "}
                  <b className="text-destructive">
                    {impact.beforeRiskCount}건에서 {impact.afterRiskCount}건
                  </b>
                  이 됩니다.
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatFullDateKo(dueDate)}까지 {formatHours(impact.previewEntry.capacityAvailableByDueDate)}시간만 낼 수 있어{" "}
                    {formatHours(impact.previewEntry.shortfallHours)}시간 모자랍니다.
                  </div>
                </>
              ) : (
                <>지금 일정대로면 이 업무는 마감 안에 들어옵니다.</>
              )}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex gap-2">
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? "등록 중..." : "등록"}
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
