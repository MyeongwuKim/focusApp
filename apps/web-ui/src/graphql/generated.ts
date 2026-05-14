export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type AddTaskInput = {
  collectionId: Scalars['ID']['input'];
  order?: InputMaybe<Scalars['Int']['input']>;
  title: Scalars['String']['input'];
};

export type AddTodoInput = {
  content: Scalars['String']['input'];
  dateKey: Scalars['String']['input'];
  order?: InputMaybe<Scalars['Int']['input']>;
  taskId?: InputMaybe<Scalars['ID']['input']>;
};

export type AddTodoItemInput = {
  content: Scalars['String']['input'];
  scheduledStartAt?: InputMaybe<Scalars['String']['input']>;
  taskId?: InputMaybe<Scalars['ID']['input']>;
};

export type AddTodosInput = {
  dateKey: Scalars['String']['input'];
  items: Array<AddTodoItemInput>;
};

export type CreateRoutineTemplateInput = {
  items: Array<RoutineTemplateItemInput>;
  name: Scalars['String']['input'];
};

export type CreateTaskCollectionInput = {
  name: Scalars['String']['input'];
  order?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateUserInput = {
  email: Scalars['String']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
};

export type DailyLog = {
  __typename?: 'DailyLog';
  createdAt: Scalars['String']['output'];
  dateKey: Scalars['String']['output'];
  doneCount: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  memo?: Maybe<Scalars['String']['output']>;
  monthKey: Scalars['String']['output'];
  previewTodos: Array<Scalars['String']['output']>;
  restAccumulatedSeconds: Scalars['Int']['output'];
  restStartedAt?: Maybe<Scalars['String']['output']>;
  todoCount: Scalars['Int']['output'];
  todos: Array<TodoItem>;
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type DeactivatePushDeviceTokenInput = {
  pushToken: Scalars['String']['input'];
};

export type DeleteRoutineTemplateInput = {
  routineTemplateId: Scalars['ID']['input'];
};

export type DeleteTaskCollectionInput = {
  collectionId: Scalars['ID']['input'];
};

export type DeleteTaskInput = {
  taskId: Scalars['ID']['input'];
};

export type MoveTaskToCollectionInput = {
  collectionId: Scalars['ID']['input'];
  taskId: Scalars['ID']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  addTask: Task;
  addTodo: DailyLog;
  addTodos: DailyLog;
  completeTodo: DailyLog;
  createRoutineTemplate: RoutineTemplate;
  createTaskCollection: TaskCollection;
  createUser: User;
  deactivatePushDeviceToken: Scalars['Boolean']['output'];
  deleteRoutineTemplate: Scalars['Boolean']['output'];
  deleteTask: Scalars['Boolean']['output'];
  deleteTaskCollection: Scalars['Boolean']['output'];
  deleteTodo: DailyLog;
  moveTaskToCollection: Task;
  pauseTodo: DailyLog;
  registerPushDeviceToken: PushDeviceToken;
  renameTask: Task;
  renameTaskCollection: TaskCollection;
  reorderTaskCollections: Scalars['Boolean']['output'];
  reorderTasks: Scalars['Boolean']['output'];
  reorderTodos: DailyLog;
  resetTodo: DailyLog;
  resumeTodo: DailyLog;
  setTaskFavorite: Task;
  startRestSession: DailyLog;
  startTodo: DailyLog;
  stopRestSession: DailyLog;
  updateNotificationSettings: NotificationSettings;
  updateRoutineTemplate: RoutineTemplate;
  updateTodoActualFocus: DailyLog;
  updateTodoSchedule: DailyLog;
  updateTodoTargetFocus: DailyLog;
  upsertDailyLog: DailyLog;
};


export type MutationAddTaskArgs = {
  input: AddTaskInput;
};


export type MutationAddTodoArgs = {
  input: AddTodoInput;
};


export type MutationAddTodosArgs = {
  input: AddTodosInput;
};


export type MutationCompleteTodoArgs = {
  input: TodoActionInput;
};


export type MutationCreateRoutineTemplateArgs = {
  input: CreateRoutineTemplateInput;
};


export type MutationCreateTaskCollectionArgs = {
  input: CreateTaskCollectionInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationDeactivatePushDeviceTokenArgs = {
  input: DeactivatePushDeviceTokenInput;
};


export type MutationDeleteRoutineTemplateArgs = {
  input: DeleteRoutineTemplateInput;
};


export type MutationDeleteTaskArgs = {
  input: DeleteTaskInput;
};


export type MutationDeleteTaskCollectionArgs = {
  input: DeleteTaskCollectionInput;
};


export type MutationDeleteTodoArgs = {
  input: TodoActionInput;
};


export type MutationMoveTaskToCollectionArgs = {
  input: MoveTaskToCollectionInput;
};


export type MutationPauseTodoArgs = {
  input: TodoActionInput;
};


export type MutationRegisterPushDeviceTokenArgs = {
  input: RegisterPushDeviceTokenInput;
};


export type MutationRenameTaskArgs = {
  input: RenameTaskInput;
};


export type MutationRenameTaskCollectionArgs = {
  input: RenameTaskCollectionInput;
};


export type MutationReorderTaskCollectionsArgs = {
  input: ReorderTaskCollectionsInput;
};


export type MutationReorderTasksArgs = {
  input: ReorderTasksInput;
};


export type MutationReorderTodosArgs = {
  input: ReorderTodosInput;
};


export type MutationResetTodoArgs = {
  input: TodoActionInput;
};


export type MutationResumeTodoArgs = {
  input: TodoActionInput;
};


export type MutationSetTaskFavoriteArgs = {
  input: SetTaskFavoriteInput;
};


export type MutationStartRestSessionArgs = {
  input: RestSessionInput;
};


export type MutationStartTodoArgs = {
  input: TodoActionInput;
};


export type MutationStopRestSessionArgs = {
  input: RestSessionInput;
};


export type MutationUpdateNotificationSettingsArgs = {
  input: UpdateNotificationSettingsInput;
};


export type MutationUpdateRoutineTemplateArgs = {
  input: UpdateRoutineTemplateInput;
};


export type MutationUpdateTodoActualFocusArgs = {
  input: UpdateTodoActualFocusInput;
};


export type MutationUpdateTodoScheduleArgs = {
  input: UpdateTodoScheduleInput;
};


export type MutationUpdateTodoTargetFocusArgs = {
  input: UpdateTodoTargetFocusInput;
};


export type MutationUpsertDailyLogArgs = {
  input: UpsertDailyLogInput;
};

export type NotificationSettings = {
  __typename?: 'NotificationSettings';
  activeEndTime: Scalars['String']['output'];
  activeStartTime: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  dayMode: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  intervalMinutes: Scalars['Int']['output'];
  lastEmptyTodoReminderDate?: Maybe<Scalars['String']['output']>;
  nextReminderAt?: Maybe<Scalars['String']['output']>;
  pushEnabled: Scalars['Boolean']['output'];
  systemPermission?: Maybe<Scalars['String']['output']>;
  tone: Scalars['String']['output'];
  typeFocusStart: Scalars['Boolean']['output'];
  typeIncomplete: Scalars['Boolean']['output'];
  typeRestEnd: Scalars['Boolean']['output'];
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type PushDeviceToken = {
  __typename?: 'PushDeviceToken';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  lastSeenAt: Scalars['String']['output'];
  platform: Scalars['String']['output'];
  pushToken: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  dailyLog?: Maybe<DailyLog>;
  dailyLogsByMonth: Array<DailyLog>;
  me?: Maybe<User>;
  notificationSettings: NotificationSettings;
  routineTemplates: Array<RoutineTemplate>;
  taskCollections: Array<TaskCollection>;
};


export type QueryDailyLogArgs = {
  dateKey: Scalars['String']['input'];
};


export type QueryDailyLogsByMonthArgs = {
  monthKey: Scalars['String']['input'];
};

export type RegisterPushDeviceTokenInput = {
  platform: Scalars['String']['input'];
  pushToken: Scalars['String']['input'];
};

export type RenameTaskCollectionInput = {
  collectionId: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};

export type RenameTaskInput = {
  taskId: Scalars['ID']['input'];
  title: Scalars['String']['input'];
};

export type ReorderTaskCollectionsInput = {
  collectionIds: Array<Scalars['ID']['input']>;
};

export type ReorderTasksInput = {
  taskIds: Array<Scalars['ID']['input']>;
};

export type ReorderTodosInput = {
  dateKey: Scalars['String']['input'];
  todoIds: Array<Scalars['ID']['input']>;
};

export type RestSessionInput = {
  dateKey: Scalars['String']['input'];
};

export type RoutineTemplate = {
  __typename?: 'RoutineTemplate';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  items: Array<RoutineTemplateItem>;
  name: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type RoutineTemplateItem = {
  __typename?: 'RoutineTemplateItem';
  content: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  order: Scalars['Int']['output'];
  scheduledTimeHHmm?: Maybe<Scalars['String']['output']>;
  taskId?: Maybe<Scalars['ID']['output']>;
  titleSnapshot?: Maybe<Scalars['String']['output']>;
};

export type RoutineTemplateItemInput = {
  content: Scalars['String']['input'];
  id?: InputMaybe<Scalars['ID']['input']>;
  order?: InputMaybe<Scalars['Int']['input']>;
  scheduledTimeHHmm?: InputMaybe<Scalars['String']['input']>;
  taskId?: InputMaybe<Scalars['ID']['input']>;
  titleSnapshot?: InputMaybe<Scalars['String']['input']>;
};

export type SetTaskFavoriteInput = {
  isFavorite: Scalars['Boolean']['input'];
  taskId: Scalars['ID']['input'];
};

export type Task = {
  __typename?: 'Task';
  collectionId: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isArchived: Scalars['Boolean']['output'];
  isFavorite: Scalars['Boolean']['output'];
  lastUsedAt?: Maybe<Scalars['String']['output']>;
  order: Scalars['Int']['output'];
  title: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['String']['output']>;
  userId: Scalars['String']['output'];
};

export type TaskCollection = {
  __typename?: 'TaskCollection';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  order: Scalars['Int']['output'];
  tasks: Array<Task>;
  updatedAt: Scalars['String']['output'];
  userId: Scalars['String']['output'];
};

export type TodoActionInput = {
  dateKey: Scalars['String']['input'];
  todoId: Scalars['ID']['input'];
};

export type TodoItem = {
  __typename?: 'TodoItem';
  actualFocusSeconds?: Maybe<Scalars['Int']['output']>;
  completedAt?: Maybe<Scalars['String']['output']>;
  content: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  deviationSeconds: Scalars['Int']['output'];
  done: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  order: Scalars['Int']['output'];
  pausedAt?: Maybe<Scalars['String']['output']>;
  resumeCount: Scalars['Int']['output'];
  scheduledStartAt?: Maybe<Scalars['String']['output']>;
  startedAt?: Maybe<Scalars['String']['output']>;
  targetFocusMinutes?: Maybe<Scalars['Int']['output']>;
  taskId?: Maybe<Scalars['ID']['output']>;
  titleSnapshot?: Maybe<Scalars['String']['output']>;
};

export type UpdateNotificationSettingsInput = {
  activeEndTime?: InputMaybe<Scalars['String']['input']>;
  activeStartTime?: InputMaybe<Scalars['String']['input']>;
  dayMode?: InputMaybe<Scalars['String']['input']>;
  intervalMinutes?: InputMaybe<Scalars['Int']['input']>;
  lastEmptyTodoReminderDate?: InputMaybe<Scalars['String']['input']>;
  pushEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  systemPermission?: InputMaybe<Scalars['String']['input']>;
  tone?: InputMaybe<Scalars['String']['input']>;
  typeFocusStart?: InputMaybe<Scalars['Boolean']['input']>;
  typeIncomplete?: InputMaybe<Scalars['Boolean']['input']>;
  typeRestEnd?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateRoutineTemplateInput = {
  items?: InputMaybe<Array<RoutineTemplateItemInput>>;
  name?: InputMaybe<Scalars['String']['input']>;
  routineTemplateId: Scalars['ID']['input'];
};

export type UpdateTodoActualFocusInput = {
  actualFocusSeconds: Scalars['Int']['input'];
  dateKey: Scalars['String']['input'];
  todoId: Scalars['ID']['input'];
};

export type UpdateTodoScheduleInput = {
  dateKey: Scalars['String']['input'];
  scheduledStartAt?: InputMaybe<Scalars['String']['input']>;
  todoId: Scalars['ID']['input'];
};

export type UpdateTodoTargetFocusInput = {
  dateKey: Scalars['String']['input'];
  targetFocusMinutes?: InputMaybe<Scalars['Int']['input']>;
  todoId: Scalars['ID']['input'];
};

export type UpsertDailyLogInput = {
  dateKey: Scalars['String']['input'];
  memo?: InputMaybe<Scalars['String']['input']>;
};

export type User = {
  __typename?: 'User';
  createdAt: Scalars['String']['output'];
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['String']['output'];
};

export type DailyLogsByMonthQueryVariables = Exact<{
  monthKey: Scalars['String']['input'];
}>;


export type DailyLogsByMonthQuery = { __typename?: 'Query', dailyLogsByMonth: Array<{ __typename?: 'DailyLog', id: string, userId: string, dateKey: string, monthKey: string, memo?: string | null, todoCount: number, doneCount: number, previewTodos: Array<string>, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number }> }> };

export type DailyLogQueryVariables = Exact<{
  dateKey: Scalars['String']['input'];
}>;


export type DailyLogQuery = { __typename?: 'Query', dailyLog?: { __typename?: 'DailyLog', dateKey: string, memo?: string | null } | null };

export type UpsertDailyLogMutationVariables = Exact<{
  input: UpsertDailyLogInput;
}>;


export type UpsertDailyLogMutation = { __typename?: 'Mutation', upsertDailyLog: { __typename?: 'DailyLog', dateKey: string, memo?: string | null } };

export type DailyLogByDateQueryVariables = Exact<{
  dateKey: Scalars['String']['input'];
}>;


export type DailyLogByDateQuery = { __typename?: 'Query', dailyLog?: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } | null };

export type AddTodosMutationVariables = Exact<{
  input: AddTodosInput;
}>;


export type AddTodosMutation = { __typename?: 'Mutation', addTodos: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type DeleteTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type DeleteTodoMutation = { __typename?: 'Mutation', deleteTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type StartTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type StartTodoMutation = { __typename?: 'Mutation', startTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type PauseTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type PauseTodoMutation = { __typename?: 'Mutation', pauseTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type ResumeTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type ResumeTodoMutation = { __typename?: 'Mutation', resumeTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type CompleteTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type CompleteTodoMutation = { __typename?: 'Mutation', completeTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type ResetTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type ResetTodoMutation = { __typename?: 'Mutation', resetTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type ReorderTodosMutationVariables = Exact<{
  input: ReorderTodosInput;
}>;


export type ReorderTodosMutation = { __typename?: 'Mutation', reorderTodos: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type UpdateTodoActualFocusMutationVariables = Exact<{
  input: UpdateTodoActualFocusInput;
}>;


export type UpdateTodoActualFocusMutation = { __typename?: 'Mutation', updateTodoActualFocus: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type UpdateTodoScheduleMutationVariables = Exact<{
  input: UpdateTodoScheduleInput;
}>;


export type UpdateTodoScheduleMutation = { __typename?: 'Mutation', updateTodoSchedule: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type UpdateTodoTargetFocusMutationVariables = Exact<{
  input: UpdateTodoTargetFocusInput;
}>;


export type UpdateTodoTargetFocusMutation = { __typename?: 'Mutation', updateTodoTargetFocus: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type StartRestSessionMutationVariables = Exact<{
  input: RestSessionInput;
}>;


export type StartRestSessionMutation = { __typename?: 'Mutation', startRestSession: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type StopRestSessionMutationVariables = Exact<{
  input: RestSessionInput;
}>;


export type StopRestSessionMutation = { __typename?: 'Mutation', stopRestSession: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null }> } };

export type NotificationSettingsQueryVariables = Exact<{ [key: string]: never; }>;


export type NotificationSettingsQuery = { __typename?: 'Query', notificationSettings: { __typename?: 'NotificationSettings', id: string, userId: string, pushEnabled: boolean, intervalMinutes: number, activeStartTime: string, activeEndTime: string, dayMode: string, typeRestEnd: boolean, typeIncomplete: boolean, typeFocusStart: boolean, tone: string, systemPermission?: string | null, lastEmptyTodoReminderDate?: string | null, createdAt: string, updatedAt: string } };

export type UpdateNotificationSettingsMutationVariables = Exact<{
  input: UpdateNotificationSettingsInput;
}>;


export type UpdateNotificationSettingsMutation = { __typename?: 'Mutation', updateNotificationSettings: { __typename?: 'NotificationSettings', id: string, userId: string, pushEnabled: boolean, intervalMinutes: number, activeStartTime: string, activeEndTime: string, dayMode: string, typeRestEnd: boolean, typeIncomplete: boolean, typeFocusStart: boolean, tone: string, systemPermission?: string | null, lastEmptyTodoReminderDate?: string | null, createdAt: string, updatedAt: string } };

export type RegisterPushDeviceTokenMutationVariables = Exact<{
  input: RegisterPushDeviceTokenInput;
}>;


export type RegisterPushDeviceTokenMutation = { __typename?: 'Mutation', registerPushDeviceToken: { __typename?: 'PushDeviceToken', id: string, pushToken: string, platform: string, isActive: boolean, updatedAt: string } };

export type RoutineTemplatesQueryVariables = Exact<{ [key: string]: never; }>;


export type RoutineTemplatesQuery = { __typename?: 'Query', routineTemplates: Array<{ __typename?: 'RoutineTemplate', id: string, userId: string, name: string, createdAt: string, updatedAt: string, items: Array<{ __typename?: 'RoutineTemplateItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, order: number, scheduledTimeHHmm?: string | null }> }> };

export type CreateRoutineTemplateMutationVariables = Exact<{
  input: CreateRoutineTemplateInput;
}>;


export type CreateRoutineTemplateMutation = { __typename?: 'Mutation', createRoutineTemplate: { __typename?: 'RoutineTemplate', id: string, userId: string, name: string, createdAt: string, updatedAt: string, items: Array<{ __typename?: 'RoutineTemplateItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, order: number, scheduledTimeHHmm?: string | null }> } };

export type UpdateRoutineTemplateMutationVariables = Exact<{
  input: UpdateRoutineTemplateInput;
}>;


export type UpdateRoutineTemplateMutation = { __typename?: 'Mutation', updateRoutineTemplate: { __typename?: 'RoutineTemplate', id: string, userId: string, name: string, createdAt: string, updatedAt: string, items: Array<{ __typename?: 'RoutineTemplateItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, order: number, scheduledTimeHHmm?: string | null }> } };

export type DeleteRoutineTemplateMutationVariables = Exact<{
  input: DeleteRoutineTemplateInput;
}>;


export type DeleteRoutineTemplateMutation = { __typename?: 'Mutation', deleteRoutineTemplate: boolean };

export type TaskCollectionsQueryVariables = Exact<{ [key: string]: never; }>;


export type TaskCollectionsQuery = { __typename?: 'Query', taskCollections: Array<{ __typename?: 'TaskCollection', id: string, name: string, order: number, createdAt: string, updatedAt: string, tasks: Array<{ __typename?: 'Task', id: string, userId: string, collectionId: string, title: string, isFavorite: boolean, isArchived: boolean, order: number, lastUsedAt?: string | null, createdAt?: string | null, updatedAt?: string | null }> }> };

export type AddTaskMutationVariables = Exact<{
  input: AddTaskInput;
}>;


export type AddTaskMutation = { __typename?: 'Mutation', addTask: { __typename?: 'Task', id: string, collectionId: string, title: string, order: number, lastUsedAt?: string | null } };

export type CreateTaskCollectionMutationVariables = Exact<{
  input: CreateTaskCollectionInput;
}>;


export type CreateTaskCollectionMutation = { __typename?: 'Mutation', createTaskCollection: { __typename?: 'TaskCollection', id: string, name: string, order: number } };

export type DeleteTaskMutationVariables = Exact<{
  input: DeleteTaskInput;
}>;


export type DeleteTaskMutation = { __typename?: 'Mutation', deleteTask: boolean };

export type MoveTaskToCollectionMutationVariables = Exact<{
  input: MoveTaskToCollectionInput;
}>;


export type MoveTaskToCollectionMutation = { __typename?: 'Mutation', moveTaskToCollection: { __typename?: 'Task', id: string, collectionId: string, title: string, order: number, lastUsedAt?: string | null } };

export type ReorderTaskCollectionsMutationVariables = Exact<{
  input: ReorderTaskCollectionsInput;
}>;


export type ReorderTaskCollectionsMutation = { __typename?: 'Mutation', reorderTaskCollections: boolean };

export type ReorderTasksMutationVariables = Exact<{
  input: ReorderTasksInput;
}>;


export type ReorderTasksMutation = { __typename?: 'Mutation', reorderTasks: boolean };

export type RenameTaskMutationVariables = Exact<{
  input: RenameTaskInput;
}>;


export type RenameTaskMutation = { __typename?: 'Mutation', renameTask: { __typename?: 'Task', id: string, collectionId: string, title: string, order: number, lastUsedAt?: string | null } };

export type SetTaskFavoriteMutationVariables = Exact<{
  input: SetTaskFavoriteInput;
}>;


export type SetTaskFavoriteMutation = { __typename?: 'Mutation', setTaskFavorite: { __typename?: 'Task', id: string, collectionId: string, title: string, isFavorite: boolean, order: number, lastUsedAt?: string | null } };

export type RenameTaskCollectionMutationVariables = Exact<{
  input: RenameTaskCollectionInput;
}>;


export type RenameTaskCollectionMutation = { __typename?: 'Mutation', renameTaskCollection: { __typename?: 'TaskCollection', id: string, name: string, order: number } };

export type DeleteTaskCollectionMutationVariables = Exact<{
  input: DeleteTaskCollectionInput;
}>;


export type DeleteTaskCollectionMutation = { __typename?: 'Mutation', deleteTaskCollection: boolean };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me?: { __typename?: 'User', id: string, email: string } | null };
