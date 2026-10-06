import {
  AcceptTaskSuggestionDocument,
  AddTaskDocument,
  CreateTaskCollectionDocument,
  DismissTaskSuggestionDocument,
  DeleteTaskCollectionDocument,
  DeleteTaskDocument,
  MoveTaskToCollectionDocument,
  RenameTaskCollectionDocument,
  RenameTaskDocument,
  ReorderTaskCollectionsDocument,
  ReorderTasksDocument,
  RecordTaskSuggestionUsageDocument,
  SetTaskFavoriteDocument,
  TaskCollectionsDocument,
  type AddTaskInput,
  type RecordTaskSuggestionUsageInput,
  type CreateTaskCollectionInput,
  type DeleteTaskCollectionInput,
  type DeleteTaskInput,
  type MoveTaskToCollectionInput,
  type RenameTaskCollectionInput,
  type RenameTaskInput,
  type ReorderTaskCollectionsInput,
  type ReorderTasksInput,
  type SetTaskFavoriteInput,
  type TaskSuggestionInput,
} from "../graphql/generated";
import { requestGraphql } from "./graphqlClient";

export async function fetchTaskCollections() {
  const data = await requestGraphql(TaskCollectionsDocument);
  return data.taskCollections;
}

export async function addTaskCollection(input: CreateTaskCollectionInput) {
  const data = await requestGraphql(CreateTaskCollectionDocument, { input });
  return data.createTaskCollection;
}

export async function addTask(input: AddTaskInput) {
  const data = await requestGraphql(AddTaskDocument, { input });
  return data.addTask;
}

export async function deleteTask(input: DeleteTaskInput) {
  const data = await requestGraphql(DeleteTaskDocument, { input });
  return data.deleteTask;
}

export async function moveTaskToCollection(input: MoveTaskToCollectionInput) {
  const data = await requestGraphql(MoveTaskToCollectionDocument, { input });
  return data.moveTaskToCollection;
}

export async function reorderTaskCollections(input: ReorderTaskCollectionsInput) {
  const data = await requestGraphql(ReorderTaskCollectionsDocument, { input });
  return data.reorderTaskCollections;
}

export async function reorderTasks(input: ReorderTasksInput) {
  const data = await requestGraphql(ReorderTasksDocument, { input });
  return data.reorderTasks;
}

export async function renameTask(input: RenameTaskInput) {
  const data = await requestGraphql(RenameTaskDocument, { input });
  return data.renameTask;
}

export async function renameTaskCollection(input: RenameTaskCollectionInput) {
  const data = await requestGraphql(RenameTaskCollectionDocument, { input });
  return data.renameTaskCollection;
}

export async function deleteTaskCollection(input: DeleteTaskCollectionInput) {
  const data = await requestGraphql(DeleteTaskCollectionDocument, { input });
  return data.deleteTaskCollection;
}

export async function setTaskFavorite(input: SetTaskFavoriteInput) {
  const data = await requestGraphql(SetTaskFavoriteDocument, { input });
  return data.setTaskFavorite;
}

/** 일회성 문구의 사용 날짜를 집계하고 관리 할 일 저장 제안 여부를 반환한다. */
export async function recordTaskSuggestionUsage(input: RecordTaskSuggestionUsageInput) {
  const data = await requestGraphql(RecordTaskSuggestionUsageDocument, { input });
  return data.recordTaskSuggestionUsage;
}

/** 저장 제안 후보의 횟수를 초기화하고 서버가 계산한 14일 숨김 기간을 적용한다. */
export async function dismissTaskSuggestion(input: TaskSuggestionInput) {
  const data = await requestGraphql(DismissTaskSuggestionDocument, { input });
  return data.dismissTaskSuggestion;
}

/** 반복 문구를 미분류 관리 할 일로 저장하고 해당 제안 후보를 제거한다. */
export async function acceptTaskSuggestion(input: TaskSuggestionInput) {
  const data = await requestGraphql(AcceptTaskSuggestionDocument, { input });
  return data.acceptTaskSuggestion;
}
