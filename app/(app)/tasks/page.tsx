import { loadTasksListData } from "@/lib/tasks/aggregate";
import { TasksView } from "./tasks-view";

export default async function TasksPage() {
  const data = await loadTasksListData();
  return <TasksView data={data} />;
}
