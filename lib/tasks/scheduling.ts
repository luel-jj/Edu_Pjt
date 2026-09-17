import type { Task } from "./types";

export const WORK_HOURS_PER_DAY = 8;
const RECENT_MEETING_SAMPLE_SIZE = 10;

/** yyyy-mm-dd, timezone-free date arithmetic. */
export function isWorkday(dateIso: string): boolean {
  const day = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 오늘부터 시작하는 앞으로의 근무일 목록을 count개 만든다. */
export function upcomingWorkdays(todayIso: string, count: number): string[] {
  const days: string[] = [];
  let cursor = todayIso;
  while (days.length < count) {
    if (isWorkday(cursor)) days.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return days;
}

function round(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * 하루 가용 시간 = 최근 기록된 하루 평균 근무 시간 − 최근 기록된 하루 평균 회의 시간.
 * 근무 시간 기록이 없으면 기본 근무 8시간을 기준으로 쓴다. 회의 기록이 없으면 회의 시간은 0으로 본다.
 * recentMeetingHours/recentWorkHours는 최근 기록 순으로 정렬된 배열(최근 10근무일 이내를 호출부에서 잘라 넘긴다).
 */
export function computeDailyAvailableHours(
  recentMeetingHours: number[],
  recentWorkHours: number[] = []
): {
  availableHours: number;
  averageMeetingHours: number;
  averageWorkHours: number;
  sampleSize: number;
} {
  const meetingSample = recentMeetingHours.slice(0, RECENT_MEETING_SAMPLE_SIZE);
  const workSample = recentWorkHours.slice(0, RECENT_MEETING_SAMPLE_SIZE);
  const averageMeetingHours =
    meetingSample.length === 0 ? 0 : round(meetingSample.reduce((sum, h) => sum + h, 0) / meetingSample.length, 0.1);
  const averageWorkHours =
    workSample.length === 0 ? WORK_HOURS_PER_DAY : round(workSample.reduce((sum, h) => sum + h, 0) / workSample.length, 0.1);
  return {
    availableHours: round(averageWorkHours - averageMeetingHours, 0.1),
    averageMeetingHours,
    averageWorkHours,
    sampleSize: meetingSample.length,
  };
}

/**
 * 진행 중인 업무의 총 규모와 남은 시간.
 * 진행률이 있으면 누적 투입 ÷ 진행률로 총 규모를 역산하고, 없으면 예상 소요 시간을 총 규모로 본다.
 */
export function computeTaskSize(task: Pick<Task, "estimatedHours" | "progressPercent" | "accumulatedHours">): {
  totalSize: number;
  remainingHours: number;
  isReestimated: boolean;
} {
  if (task.progressPercent && task.progressPercent > 0) {
    const totalSize = round(task.accumulatedHours / (task.progressPercent / 100), 0.5);
    const remainingHours = round(totalSize - task.accumulatedHours, 0.5);
    return { totalSize, remainingHours: Math.max(0, remainingHours), isReestimated: true };
  }
  const remainingHours = Math.max(0, round(task.estimatedHours - task.accumulatedHours, 0.5));
  return { totalSize: task.estimatedHours, remainingHours, isReestimated: false };
}

export interface ScheduledTask {
  taskId: string;
  requestedDueDate: string;
  remainingHours: number;
  startDate: string;
  completionDate: string;
  isDueRisk: boolean;
  shortfallHours: number;
  todayShareHours: number;
  /** 이 업무의 마감 요청일까지, 앞선 업무들을 뺀 뒤 이 업무 몫으로 낼 수 있는 시간. */
  capacityAvailableByDueDate: number;
}

export interface ScheduleInput {
  taskId: string;
  requestedDueDate: string;
  remainingHours: number;
  createdAt: string;
}

/**
 * 쌓아서 계산하는 가상 배치.
 * 미완료 업무를 마감 요청일이 이른 순(동률은 등록이 빠른 순)으로 정렬하고,
 * 하루 가용 시간의 누적 용량(capacity prefix)에 업무별 누적 필요 시간을 매핑해
 * 각 업무의 완료 예상일과 마감 위험, 오늘 몫을 구한다.
 */
export function cascadeSchedule(
  tasks: ScheduleInput[],
  dailyAvailableHours: number,
  todayIso: string
): ScheduledTask[] {
  const sorted = [...tasks].sort((a, b) => {
    if (a.requestedDueDate !== b.requestedDueDate) {
      return a.requestedDueDate < b.requestedDueDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });

  const totalNeeded = sorted.reduce((sum, t) => sum + t.remainingHours, 0);
  const daysNeeded = Math.max(1, Math.ceil(totalNeeded / Math.max(dailyAvailableHours, 0.1)) + 1);
  const workdays = upcomingWorkdays(todayIso, daysNeeded + 5);

  // capacityPrefix[i] = workdays[0..i] 까지의 누적 가용 시간
  const capacityPrefix: number[] = [];
  workdays.forEach((_, i) => {
    capacityPrefix.push((capacityPrefix[i - 1] ?? 0) + dailyAvailableHours);
  });

  function dayIndexForCumulative(cumulative: number): number {
    for (let i = 0; i < capacityPrefix.length; i++) {
      if (capacityPrefix[i] >= cumulative - 1e-9) return i;
    }
    return capacityPrefix.length - 1;
  }

  /** 근무일 기준 due date 당일까지의 누적 가용 시간(주말/과거 due date는 그 이전 마지막 근무일 기준). */
  function capacityThroughDate(dateIso: string): number {
    let cumulative = 0;
    for (let i = 0; i < workdays.length; i++) {
      if (workdays[i] > dateIso) break;
      cumulative = capacityPrefix[i];
    }
    return cumulative;
  }

  let priorCumulative = 0;
  const day0Window: [number, number] = [0, capacityPrefix[0] ?? dailyAvailableHours];

  const results: ScheduledTask[] = sorted.map((task) => {
    const startDayIndex = dayIndexForCumulative(Math.max(priorCumulative, 1e-9));
    const startDate = workdays[startDayIndex] ?? workdays[0];
    const cumulativeAfter = priorCumulative + task.remainingHours;
    const completionDayIndex = dayIndexForCumulative(cumulativeAfter);
    const completionDate = workdays[completionDayIndex] ?? workdays[workdays.length - 1];

    const dueCapacity = capacityThroughDate(task.requestedDueDate);
    const isDueRisk = cumulativeAfter - dueCapacity > 1e-9;
    const shortfallHours = isDueRisk ? round(cumulativeAfter - dueCapacity, 0.5) : 0;
    const capacityAvailableByDueDate = Math.max(0, round(dueCapacity - priorCumulative, 0.1));

    const overlapStart = Math.max(priorCumulative, day0Window[0]);
    const overlapEnd = Math.min(cumulativeAfter, day0Window[1]);
    const todayShareHours = Math.max(0, round(overlapEnd - overlapStart, 0.1));

    priorCumulative = cumulativeAfter;

    return {
      taskId: task.taskId,
      requestedDueDate: task.requestedDueDate,
      remainingHours: task.remainingHours,
      startDate,
      completionDate,
      isDueRisk,
      shortfallHours,
      todayShareHours,
      capacityAvailableByDueDate,
    };
  });

  // 목록 순서: 마감 위험 먼저, 그다음 마감 요청일이 이른 순 (정렬은 이미 마감 요청일 순이므로 위험만 앞으로 옮긴다).
  return [...results].sort((a, b) => {
    if (a.isDueRisk !== b.isDueRisk) return a.isDueRisk ? -1 : 1;
    return a.requestedDueDate < b.requestedDueDate ? -1 : a.requestedDueDate > b.requestedDueDate ? 1 : 0;
  });
}

export interface DailyLoad {
  date: string;
  usedHours: number;
  capacityHours: number;
  isFull: boolean;
}

/**
 * 등록 화면 달력에서 쓰는, 근무일별 이미 차 있는 시간.
 * 지금 등록된 업무들을 가상 배치했을 때 각 근무일에 얼마나 채워지는지 계산한다.
 */
export function computeDailyLoad(
  tasks: ScheduleInput[],
  dailyAvailableHours: number,
  todayIso: string,
  daysToShow: number
): DailyLoad[] {
  const sorted = [...tasks].sort((a, b) => {
    if (a.requestedDueDate !== b.requestedDueDate) {
      return a.requestedDueDate < b.requestedDueDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });

  const workdays = upcomingWorkdays(todayIso, daysToShow);
  const capacityPrefix: number[] = [];
  workdays.forEach((_, i) => {
    capacityPrefix.push((capacityPrefix[i - 1] ?? 0) + dailyAvailableHours);
  });

  let priorCumulative = 0;
  const cumulativeEnds = sorted.map((task) => {
    const end = priorCumulative + task.remainingHours;
    priorCumulative = end;
    return end;
  });
  const cumulativeStarts = cumulativeEnds.map((end, i) => (i === 0 ? 0 : cumulativeEnds[i - 1]));

  return workdays.map((date, i) => {
    const windowStart = capacityPrefix[i - 1] ?? 0;
    const windowEnd = capacityPrefix[i];
    let used = 0;
    cumulativeEnds.forEach((end, k) => {
      const start = cumulativeStarts[k];
      const overlap = Math.min(end, windowEnd) - Math.max(start, windowStart);
      if (overlap > 0) used += overlap;
    });
    const usedHours = round(Math.min(used, dailyAvailableHours), 0.1);
    return {
      date,
      usedHours,
      capacityHours: dailyAvailableHours,
      isFull: usedHours >= dailyAvailableHours - 1e-9,
    };
  });
}

/** 완료 기록의 실제 소요 시간 중앙값. 기록이 없으면 null. */
export function medianActualHours(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? round((sorted[mid - 1] + sorted[mid]) / 2, 0.5) : sorted[mid];
}
