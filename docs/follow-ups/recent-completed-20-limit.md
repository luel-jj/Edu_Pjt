`loadTasksListData`(lib/tasks/aggregate.ts:87)가 "최근 완료" 2주 필터를 적용하기 전에 `getRecentCompletedTasks(20)`으로 먼저 20건을 잘라온다. 2주 안에 완료한 업무가 20건을 넘으면 뒤쪽 항목이 조용히 누락된다. 날짜 기준으로 직접 쿼리하거나 한도를 넉넉히 올려야 한다.
