import { describe, expect, it } from "vitest";
import {
  cascadeSchedule,
  computeDailyAvailableHours,
  computeDailyLoad,
  computeTaskSize,
  isWorkday,
  medianActualHours,
  upcomingWorkdays,
} from "./scheduling";

describe("isWorkday / upcomingWorkdays", () => {
  it("주말을 근무일에서 뺀다", () => {
    // 2026-09-19 는 토요일, 2026-09-20 은 일요일
    expect(isWorkday("2026-09-19")).toBe(false);
    expect(isWorkday("2026-09-20")).toBe(false);
    expect(isWorkday("2026-09-21")).toBe(true); // 월요일
  });

  it("오늘부터 근무일만 count개 골라낸다", () => {
    const days = upcomingWorkdays("2026-09-18", 5); // 금요일부터 시작
    expect(days).toEqual([
      "2026-09-18",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
    ]);
  });
});

describe("computeDailyAvailableHours", () => {
  it("회의 기록이 없으면 8시간 그대로", () => {
    expect(computeDailyAvailableHours([]).availableHours).toBe(8);
  });

  it("평균 회의 3.0시간이면 가용 시간 5.0시간", () => {
    const result = computeDailyAvailableHours([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    expect(result.availableHours).toBe(5);
    expect(result.averageMeetingHours).toBe(3);
  });

  it("최근 10건만 반영한다", () => {
    const result = computeDailyAvailableHours([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 9, 9]);
    expect(result.sampleSize).toBe(10);
    expect(result.averageMeetingHours).toBe(1);
  });

  it("근무 시간 기록이 없으면 기본 8시간을 기준으로 쓴다", () => {
    const result = computeDailyAvailableHours([2, 2], []);
    expect(result.averageWorkHours).toBe(8);
    expect(result.availableHours).toBe(6);
  });

  it("야근으로 평균 근무 10시간이면 가용 시간이 그만큼 늘어난다", () => {
    const result = computeDailyAvailableHours([2, 2], [10, 10]);
    expect(result.averageWorkHours).toBe(10);
    expect(result.availableHours).toBe(8);
  });
});

describe("computeTaskSize", () => {
  it("5시간 쓰고 20%면 총 25시간, 남은 20시간", () => {
    const result = computeTaskSize({ estimatedHours: 10, progressPercent: 20, accumulatedHours: 5 });
    expect(result.totalSize).toBe(25);
    expect(result.remainingHours).toBe(20);
  });

  it("진행률이 없으면 예상 소요 시간에서 누적 투입을 뺀다", () => {
    const result = computeTaskSize({ estimatedHours: 10, progressPercent: null, accumulatedHours: 4 });
    expect(result.totalSize).toBe(10);
    expect(result.remainingHours).toBe(6);
  });
});

describe("cascadeSchedule", () => {
  it("근무일 5일 25시간에 셋이 합쳐 26시간을 요구하면 마지막 업무가 마감 위험", () => {
    const today = "2026-09-21"; // 월요일
    const dueDate = "2026-09-25"; // 그 주 금요일 (근무일 5일째)
    const scheduled = cascadeSchedule(
      [
        { taskId: "a", requestedDueDate: dueDate, remainingHours: 9, createdAt: "2026-09-01T00:00:00Z" },
        { taskId: "b", requestedDueDate: dueDate, remainingHours: 9, createdAt: "2026-09-02T00:00:00Z" },
        { taskId: "c", requestedDueDate: dueDate, remainingHours: 8, createdAt: "2026-09-03T00:00:00Z" },
      ],
      5,
      today
    );
    const byId = Object.fromEntries(scheduled.map((s) => [s.taskId, s]));
    expect(byId.a.isDueRisk).toBe(false);
    expect(byId.b.isDueRisk).toBe(false);
    expect(byId.c.isDueRisk).toBe(true);
    expect(byId.c.shortfallHours).toBe(1);
  });

  it("업무를 따로 계산하면 안 보이는 겹침도 쌓아서 계산하면 드러난다", () => {
    // 업무 하나만 보면 각자 마감 안에 들어오지만, 합치면 가용 시간을 넘는다.
    const today = "2026-09-21";
    const scheduled = cascadeSchedule(
      [
        { taskId: "early", requestedDueDate: "2026-09-22", remainingHours: 8, createdAt: "2026-09-01T00:00:00Z" },
        { taskId: "late", requestedDueDate: "2026-09-23", remainingHours: 8, createdAt: "2026-09-02T00:00:00Z" },
      ],
      5,
      today
    );
    const byId = Object.fromEntries(scheduled.map((s) => [s.taskId, s]));
    // early: 5시간(월)+3시간(화) = 8시간 -> 화요일 완료, 마감(화)과 같아 위험 아님
    expect(byId.early.isDueRisk).toBe(false);
    // late: 화요일 남은 2시간 + 수요일 5시간 + 목요일 1시간 = 목요일 완료, 마감(수)을 넘겨 위험
    expect(byId.late.isDueRisk).toBe(true);
  });

  it("마감 위험 업무를 목록 맨 앞으로 정렬한다", () => {
    const today = "2026-09-21";
    const scheduled = cascadeSchedule(
      [
        { taskId: "far-safe", requestedDueDate: "2026-10-01", remainingHours: 2, createdAt: "2026-09-01T00:00:00Z" },
        { taskId: "near-risky", requestedDueDate: "2026-09-21", remainingHours: 40, createdAt: "2026-09-02T00:00:00Z" },
      ],
      5,
      today
    );
    expect(scheduled[0].taskId).toBe("near-risky");
    expect(scheduled[0].isDueRisk).toBe(true);
  });

  it("오늘 몫은 오늘 배치된 시간만 담는다", () => {
    const today = "2026-09-21";
    const scheduled = cascadeSchedule(
      [
        { taskId: "a", requestedDueDate: "2026-09-25", remainingHours: 3, createdAt: "2026-09-01T00:00:00Z" },
        { taskId: "b", requestedDueDate: "2026-09-26", remainingHours: 4, createdAt: "2026-09-02T00:00:00Z" },
        { taskId: "c", requestedDueDate: "2026-09-27", remainingHours: 10, createdAt: "2026-09-03T00:00:00Z" },
      ],
      5,
      today
    );
    const byId = Object.fromEntries(scheduled.map((s) => [s.taskId, s]));
    expect(byId.a.todayShareHours).toBe(3);
    expect(byId.b.todayShareHours).toBe(2); // 오늘 남은 2시간만
    expect(byId.c.todayShareHours).toBe(0); // 오늘 배치되지 않음
  });
});

describe("computeDailyLoad", () => {
  it("가용 시간을 채운 날은 isFull이 true", () => {
    const today = "2026-09-21";
    const load = computeDailyLoad(
      [{ taskId: "a", requestedDueDate: "2026-09-25", remainingHours: 5, createdAt: "2026-09-01T00:00:00Z" }],
      5,
      today,
      3
    );
    expect(load[0].usedHours).toBe(5);
    expect(load[0].isFull).toBe(true);
    expect(load[1].usedHours).toBe(0);
    expect(load[1].isFull).toBe(false);
  });
});

describe("medianActualHours", () => {
  it("기록이 없으면 null", () => {
    expect(medianActualHours([])).toBeNull();
  });

  it("홀수 개면 가운데 값", () => {
    expect(medianActualHours([3, 5, 4])).toBe(4);
  });

  it("짝수 개면 가운데 둘의 평균을 0.5시간 단위로 반올림", () => {
    expect(medianActualHours([2, 4, 6, 8])).toBe(5);
  });
});
