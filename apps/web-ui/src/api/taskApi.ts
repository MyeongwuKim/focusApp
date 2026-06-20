import {
  AddTaskDocument,
  CreateTaskCollectionDocument,
  DeleteTaskCollectionDocument,
  DeleteTaskDocument,
  MoveTaskToCollectionDocument,
  RenameTaskCollectionDocument,
  RenameTaskDocument,
  ReorderTaskCollectionsDocument,
  ReorderTasksDocument,
  SetTaskFavoriteDocument,
  TaskCollectionsDocument,
  type AddTaskInput,
  type CreateTaskCollectionInput,
  type DeleteTaskCollectionInput,
  type DeleteTaskInput,
  type MoveTaskToCollectionInput,
  type RenameTaskCollectionInput,
  type RenameTaskInput,
  type ReorderTaskCollectionsInput,
  type ReorderTasksInput,
  type SetTaskFavoriteInput,
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
