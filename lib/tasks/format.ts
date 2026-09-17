const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function toDate(dateIso: string): Date {
  return new Date(`${dateIso}T00:00:00Z`);
}

export function formatFullDateKo(dateIso: string): string {
  const d = toDate(dateIso);
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${WEEKDAYS_KO[d.getUTCDay()]}요일`;
}

export function formatShortDateKo(dateIso: string): string {
  const d = toDate(dateIso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} (${WEEKDAYS_KO[d.getUTCDay()]})`;
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export const TASK_TYPE_LABEL: Record<"dev" | "review", string> = {
  dev: "주요 개발",
  review: "검토 요청",
};

export const TASK_STATUS_LABEL: Record<"todo" | "in_progress" | "done", string> = {
  todo: "진행 전",
  in_progress: "진행 중",
  done: "완료",
};
