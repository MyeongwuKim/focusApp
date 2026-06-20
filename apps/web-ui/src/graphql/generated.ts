import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
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

export type AchievementEvent = {
  __typename?: 'AchievementEvent';
  achievedAt: Scalars['String']['output'];
  badgeId: Scalars['String']['output'];
  category: Scalars['String']['output'];
  currentValue: Scalars['Int']['output'];
  cycleIndex: Scalars['Int']['output'];
  description: Scalars['String']['output'];
  goal: Scalars['Int']['output'];
  icon: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  scope: Scalars['String']['output'];
  tier: Scalars['String']['output'];
  title: Scalars['String']['output'];
  weekKey?: Maybe<Scalars['String']['output']>;
  weeklyStreak?: Maybe<Scalars['Int']['output']>;
};

export type AchievementProgress = {
  __typename?: 'AchievementProgress';
  achievedCount: Scalars['Int']['output'];
  badgeId: Scalars['String']['output'];
  bestWeeklyStreak: Scalars['Int']['output'];
  category: Scalars['String']['output'];
  currentValue: Scalars['Int']['output'];
  description: Scalars['String']['output'];
  goal: Scalars['Int']['output'];
  icon: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isAchieved: Scalars['Boolean']['output'];
  lastAchievedAt?: Maybe<Scalars['String']['output']>;
  lastAchievedWeekKey?: Maybe<Scalars['String']['output']>;
  scope: Scalars['String']['output'];
  tier: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  weeklyStreak: Scalars['Int']['output'];
};

export type AchievementSyncPayload = {
  __typename?: 'AchievementSyncPayload';
  newEventCount: Scalars['Int']['output'];
  progressCount: Scalars['Int']['output'];
  syncedAt: Scalars['String']['output'];
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

export type DailyLogMemoConnection = {
  __typename?: 'DailyLogMemoConnection';
  hasNextPage: Scalars['Boolean']['output'];
  items: Array<DailyLog>;
  nextCursorDateKey?: Maybe<Scalars['String']['output']>;
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
  muteTodoReminderToday: DailyLog;
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
  syncAchievements: AchievementSyncPayload;
  unmuteTodoReminder: DailyLog;
  updateNotificationSettings: NotificationSettings;
  updateRoutineTemplate: RoutineTemplate;
  updateRoutineTemplateWeekdayAssignments: Array<RoutineTemplateWeekdayAssignment>;
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


export type MutationMuteTodoReminderTodayArgs = {
  input: TodoActionInput;
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


export type MutationUnmuteTodoReminderArgs = {
  input: TodoActionInput;
};


export type MutationUpdateNotificationSettingsArgs = {
  input: UpdateNotificationSettingsInput;
};


export type MutationUpdateRoutineTemplateArgs = {
  input: UpdateRoutineTemplateInput;
};


export type MutationUpdateRoutineTemplateWeekdayAssignmentsArgs = {
  input: UpdateRoutineTemplateWeekdayAssignmentsInput;
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
  pendingIntervalMinutes?: Maybe<Scalars['Int']['output']>;
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
  achievementHistory: Array<AchievementEvent>;
  achievementProgressList: Array<AchievementProgress>;
  dailyLog?: Maybe<DailyLog>;
  dailyLogsByMonth: Array<DailyLog>;
  dailyLogsWithMemo: DailyLogMemoConnection;
  me?: Maybe<User>;
  notificationSettings: NotificationSettings;
  routineTemplateWeekdayAssignments: Array<RoutineTemplateWeekdayAssignment>;
  routineTemplates: Array<RoutineTemplate>;
  taskCollections: Array<TaskCollection>;
};


export type QueryAchievementHistoryArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryDailyLogArgs = {
  dateKey: Scalars['String']['input'];
};


export type QueryDailyLogsByMonthArgs = {
  monthKey: Scalars['String']['input'];
};


export type QueryDailyLogsWithMemoArgs = {
  cursorDateKey?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  monthKey?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['String']['input']>;
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

export type RoutineTemplateWeekdayAssignment = {
  __typename?: 'RoutineTemplateWeekdayAssignment';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  routineTemplate?: Maybe<RoutineTemplate>;
  routineTemplateId?: Maybe<Scalars['ID']['output']>;
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
  weekday: Scalars['Int']['output'];
};

export type RoutineTemplateWeekdayAssignmentInput = {
  routineTemplateId?: InputMaybe<Scalars['ID']['input']>;
  weekday: Scalars['Int']['input'];
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
  muteReminderDateKey?: Maybe<Scalars['String']['output']>;
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

export type UpdateRoutineTemplateWeekdayAssignmentsInput = {
  assignments: Array<RoutineTemplateWeekdayAssignmentInput>;
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

export type AchievementProgressListQueryVariables = Exact<{ [key: string]: never; }>;


export type AchievementProgressListQuery = { __typename?: 'Query', achievementProgressList: Array<{ __typename?: 'AchievementProgress', id: string, badgeId: string, title: string, description: string, icon: string, category: string, scope: string, tier: string, goal: number, currentValue: number, isAchieved: boolean, achievedCount: number, lastAchievedAt?: string | null, lastAchievedWeekKey?: string | null, weeklyStreak: number, bestWeeklyStreak: number, updatedAt: string }> };

export type AchievementHistoryQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type AchievementHistoryQuery = { __typename?: 'Query', achievementHistory: Array<{ __typename?: 'AchievementEvent', id: string, badgeId: string, title: string, description: string, icon: string, category: string, scope: string, tier: string, goal: number, currentValue: number, cycleIndex: number, weekKey?: string | null, weeklyStreak?: number | null, achievedAt: string }> };

export type SyncAchievementsMutationVariables = Exact<{ [key: string]: never; }>;


export type SyncAchievementsMutation = { __typename?: 'Mutation', syncAchievements: { __typename?: 'AchievementSyncPayload', progressCount: number, newEventCount: number, syncedAt: string } };

export type DailyLogTodoFieldsFragment = { __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null };

export type DailyLogDetailFieldsFragment = { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> };

export type DailyLogsByMonthQueryVariables = Exact<{
  monthKey: Scalars['String']['input'];
}>;


export type DailyLogsByMonthQuery = { __typename?: 'Query', dailyLogsByMonth: Array<{ __typename?: 'DailyLog', id: string, userId: string, dateKey: string, monthKey: string, memo?: string | null, todoCount: number, doneCount: number, previewTodos: Array<string>, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number }> }> };

export type DailyLogsWithMemoQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']['input']>;
  cursorDateKey?: InputMaybe<Scalars['String']['input']>;
  monthKey?: InputMaybe<Scalars['String']['input']>;
  search?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['String']['input']>;
}>;


export type DailyLogsWithMemoQuery = { __typename?: 'Query', dailyLogsWithMemo: { __typename?: 'DailyLogMemoConnection', nextCursorDateKey?: string | null, hasNextPage: boolean, items: Array<{ __typename?: 'DailyLog', id: string, dateKey: string, monthKey: string, memo?: string | null, todoCount: number, doneCount: number, previewTodos: Array<string> }> } };

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


export type DailyLogByDateQuery = { __typename?: 'Query', dailyLog?: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } | null };

export type AddTodosMutationVariables = Exact<{
  input: AddTodosInput;
}>;


export type AddTodosMutation = { __typename?: 'Mutation', addTodos: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type DeleteTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type DeleteTodoMutation = { __typename?: 'Mutation', deleteTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type StartTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type StartTodoMutation = { __typename?: 'Mutation', startTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type PauseTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type PauseTodoMutation = { __typename?: 'Mutation', pauseTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type ResumeTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type ResumeTodoMutation = { __typename?: 'Mutation', resumeTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type CompleteTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type CompleteTodoMutation = { __typename?: 'Mutation', completeTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type ResetTodoMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type ResetTodoMutation = { __typename?: 'Mutation', resetTodo: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type ReorderTodosMutationVariables = Exact<{
  input: ReorderTodosInput;
}>;


export type ReorderTodosMutation = { __typename?: 'Mutation', reorderTodos: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type UpdateTodoActualFocusMutationVariables = Exact<{
  input: UpdateTodoActualFocusInput;
}>;


export type UpdateTodoActualFocusMutation = { __typename?: 'Mutation', updateTodoActualFocus: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type UpdateTodoScheduleMutationVariables = Exact<{
  input: UpdateTodoScheduleInput;
}>;


export type UpdateTodoScheduleMutation = { __typename?: 'Mutation', updateTodoSchedule: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type UpdateTodoTargetFocusMutationVariables = Exact<{
  input: UpdateTodoTargetFocusInput;
}>;


export type UpdateTodoTargetFocusMutation = { __typename?: 'Mutation', updateTodoTargetFocus: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type MuteTodoReminderTodayMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type MuteTodoReminderTodayMutation = { __typename?: 'Mutation', muteTodoReminderToday: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type UnmuteTodoReminderMutationVariables = Exact<{
  input: TodoActionInput;
}>;


export type UnmuteTodoReminderMutation = { __typename?: 'Mutation', unmuteTodoReminder: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type StartRestSessionMutationVariables = Exact<{
  input: RestSessionInput;
}>;


export type StartRestSessionMutation = { __typename?: 'Mutation', startRestSession: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type StopRestSessionMutationVariables = Exact<{
  input: RestSessionInput;
}>;


export type StopRestSessionMutation = { __typename?: 'Mutation', stopRestSession: { __typename?: 'DailyLog', dateKey: string, memo?: string | null, restAccumulatedSeconds: number, restStartedAt?: string | null, todos: Array<{ __typename?: 'TodoItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, done: boolean, order: number, startedAt?: string | null, scheduledStartAt?: string | null, targetFocusMinutes?: number | null, pausedAt?: string | null, completedAt?: string | null, deviationSeconds: number, resumeCount: number, actualFocusSeconds?: number | null, muteReminderDateKey?: string | null }> } };

export type NotificationSettingsFieldsFragment = { __typename?: 'NotificationSettings', id: string, userId: string, pushEnabled: boolean, intervalMinutes: number, activeStartTime: string, activeEndTime: string, dayMode: string, typeRestEnd: boolean, typeIncomplete: boolean, typeFocusStart: boolean, tone: string, systemPermission?: string | null, lastEmptyTodoReminderDate?: string | null, createdAt: string, updatedAt: string };

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

export type RoutineTemplateFieldsFragment = { __typename?: 'RoutineTemplate', id: string, userId: string, name: string, createdAt: string, updatedAt: string, items: Array<{ __typename?: 'RoutineTemplateItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, order: number, scheduledTimeHHmm?: string | null }> };

export type RoutineTemplateWeekdayAssignmentFieldsFragment = { __typename?: 'RoutineTemplateWeekdayAssignment', id: string, userId: string, weekday: number, routineTemplateId?: string | null, createdAt: string, updatedAt: string, routineTemplate?: { __typename?: 'RoutineTemplate', id: string, userId: string, name: string, createdAt: string, updatedAt: string, items: Array<{ __typename?: 'RoutineTemplateItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, order: number, scheduledTimeHHmm?: string | null }> } | null };

export type RoutineTemplatesQueryVariables = Exact<{ [key: string]: never; }>;


export type RoutineTemplatesQuery = { __typename?: 'Query', routineTemplates: Array<{ __typename?: 'RoutineTemplate', id: string, userId: string, name: string, createdAt: string, updatedAt: string, items: Array<{ __typename?: 'RoutineTemplateItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, order: number, scheduledTimeHHmm?: string | null }> }> };

export type RoutineTemplateWeekdayAssignmentsQueryVariables = Exact<{ [key: string]: never; }>;


export type RoutineTemplateWeekdayAssignmentsQuery = { __typename?: 'Query', routineTemplateWeekdayAssignments: Array<{ __typename?: 'RoutineTemplateWeekdayAssignment', id: string, userId: string, weekday: number, routineTemplateId?: string | null, createdAt: string, updatedAt: string, routineTemplate?: { __typename?: 'RoutineTemplate', id: string, userId: string, name: string, createdAt: string, updatedAt: string, items: Array<{ __typename?: 'RoutineTemplateItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, order: number, scheduledTimeHHmm?: string | null }> } | null }> };

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

export type UpdateRoutineTemplateWeekdayAssignmentsMutationVariables = Exact<{
  input: UpdateRoutineTemplateWeekdayAssignmentsInput;
}>;


export type UpdateRoutineTemplateWeekdayAssignmentsMutation = { __typename?: 'Mutation', updateRoutineTemplateWeekdayAssignments: Array<{ __typename?: 'RoutineTemplateWeekdayAssignment', id: string, userId: string, weekday: number, routineTemplateId?: string | null, createdAt: string, updatedAt: string, routineTemplate?: { __typename?: 'RoutineTemplate', id: string, userId: string, name: string, createdAt: string, updatedAt: string, items: Array<{ __typename?: 'RoutineTemplateItem', id: string, taskId?: string | null, titleSnapshot?: string | null, content: string, order: number, scheduledTimeHHmm?: string | null }> } | null }> };

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

export type RenameTaskCollectionMutationVariables = Exact<{
  input: RenameTaskCollectionInput;
}>;


export type RenameTaskCollectionMutation = { __typename?: 'Mutation', renameTaskCollection: { __typename?: 'TaskCollection', id: string, name: string, order: number } };

export type DeleteTaskCollectionMutationVariables = Exact<{
  input: DeleteTaskCollectionInput;
}>;


export type DeleteTaskCollectionMutation = { __typename?: 'Mutation', deleteTaskCollection: boolean };

export type SetTaskFavoriteMutationVariables = Exact<{
  input: SetTaskFavoriteInput;
}>;


export type SetTaskFavoriteMutation = { __typename?: 'Mutation', setTaskFavorite: { __typename?: 'Task', id: string, collectionId: string, title: string, isFavorite: boolean, order: number, lastUsedAt?: string | null } };

export type MeQueryVariables = Exact<{ [key: string]: never; }>;


export type MeQuery = { __typename?: 'Query', me?: { __typename?: 'User', id: string, email: string } | null };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}
export const DailyLogTodoFieldsFragmentDoc = new TypedDocumentString(`
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
    `, {"fragmentName":"DailyLogTodoFields"}) as unknown as TypedDocumentString<DailyLogTodoFieldsFragment, unknown>;
export const DailyLogDetailFieldsFragmentDoc = new TypedDocumentString(`
    fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}`, {"fragmentName":"DailyLogDetailFields"}) as unknown as TypedDocumentString<DailyLogDetailFieldsFragment, unknown>;
export const NotificationSettingsFieldsFragmentDoc = new TypedDocumentString(`
    fragment NotificationSettingsFields on NotificationSettings {
  id
  userId
  pushEnabled
  intervalMinutes
  activeStartTime
  activeEndTime
  dayMode
  typeRestEnd
  typeIncomplete
  typeFocusStart
  tone
  systemPermission
  lastEmptyTodoReminderDate
  createdAt
  updatedAt
}
    `, {"fragmentName":"NotificationSettingsFields"}) as unknown as TypedDocumentString<NotificationSettingsFieldsFragment, unknown>;
export const RoutineTemplateFieldsFragmentDoc = new TypedDocumentString(`
    fragment RoutineTemplateFields on RoutineTemplate {
  id
  userId
  name
  items {
    id
    taskId
    titleSnapshot
    content
    order
    scheduledTimeHHmm
  }
  createdAt
  updatedAt
}
    `, {"fragmentName":"RoutineTemplateFields"}) as unknown as TypedDocumentString<RoutineTemplateFieldsFragment, unknown>;
export const RoutineTemplateWeekdayAssignmentFieldsFragmentDoc = new TypedDocumentString(`
    fragment RoutineTemplateWeekdayAssignmentFields on RoutineTemplateWeekdayAssignment {
  id
  userId
  weekday
  routineTemplateId
  routineTemplate {
    ...RoutineTemplateFields
  }
  createdAt
  updatedAt
}
    fragment RoutineTemplateFields on RoutineTemplate {
  id
  userId
  name
  items {
    id
    taskId
    titleSnapshot
    content
    order
    scheduledTimeHHmm
  }
  createdAt
  updatedAt
}`, {"fragmentName":"RoutineTemplateWeekdayAssignmentFields"}) as unknown as TypedDocumentString<RoutineTemplateWeekdayAssignmentFieldsFragment, unknown>;
export const AchievementProgressListDocument = new TypedDocumentString(`
    query AchievementProgressList {
  achievementProgressList {
    id
    badgeId
    title
    description
    icon
    category
    scope
    tier
    goal
    currentValue
    isAchieved
    achievedCount
    lastAchievedAt
    lastAchievedWeekKey
    weeklyStreak
    bestWeeklyStreak
    updatedAt
  }
}
    `) as unknown as TypedDocumentString<AchievementProgressListQuery, AchievementProgressListQueryVariables>;
export const AchievementHistoryDocument = new TypedDocumentString(`
    query AchievementHistory($limit: Int, $offset: Int) {
  achievementHistory(limit: $limit, offset: $offset) {
    id
    badgeId
    title
    description
    icon
    category
    scope
    tier
    goal
    currentValue
    cycleIndex
    weekKey
    weeklyStreak
    achievedAt
  }
}
    `) as unknown as TypedDocumentString<AchievementHistoryQuery, AchievementHistoryQueryVariables>;
export const SyncAchievementsDocument = new TypedDocumentString(`
    mutation SyncAchievements {
  syncAchievements {
    progressCount
    newEventCount
    syncedAt
  }
}
    `) as unknown as TypedDocumentString<SyncAchievementsMutation, SyncAchievementsMutationVariables>;
export const DailyLogsByMonthDocument = new TypedDocumentString(`
    query DailyLogsByMonth($monthKey: String!) {
  dailyLogsByMonth(monthKey: $monthKey) {
    id
    userId
    dateKey
    monthKey
    memo
    todoCount
    doneCount
    previewTodos
    todos {
      id
      taskId
      titleSnapshot
      content
      done
      order
    }
  }
}
    `) as unknown as TypedDocumentString<DailyLogsByMonthQuery, DailyLogsByMonthQueryVariables>;
export const DailyLogsWithMemoDocument = new TypedDocumentString(`
    query DailyLogsWithMemo($limit: Int, $cursorDateKey: String, $monthKey: String, $search: String, $sortOrder: String) {
  dailyLogsWithMemo(
    limit: $limit
    cursorDateKey: $cursorDateKey
    monthKey: $monthKey
    search: $search
    sortOrder: $sortOrder
  ) {
    items {
      id
      dateKey
      monthKey
      memo
      todoCount
      doneCount
      previewTodos
    }
    nextCursorDateKey
    hasNextPage
  }
}
    `) as unknown as TypedDocumentString<DailyLogsWithMemoQuery, DailyLogsWithMemoQueryVariables>;
export const DailyLogDocument = new TypedDocumentString(`
    query DailyLog($dateKey: String!) {
  dailyLog(dateKey: $dateKey) {
    dateKey
    memo
  }
}
    `) as unknown as TypedDocumentString<DailyLogQuery, DailyLogQueryVariables>;
export const UpsertDailyLogDocument = new TypedDocumentString(`
    mutation UpsertDailyLog($input: UpsertDailyLogInput!) {
  upsertDailyLog(input: $input) {
    dateKey
    memo
  }
}
    `) as unknown as TypedDocumentString<UpsertDailyLogMutation, UpsertDailyLogMutationVariables>;
export const DailyLogByDateDocument = new TypedDocumentString(`
    query DailyLogByDate($dateKey: String!) {
  dailyLog(dateKey: $dateKey) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<DailyLogByDateQuery, DailyLogByDateQueryVariables>;
export const AddTodosDocument = new TypedDocumentString(`
    mutation AddTodos($input: AddTodosInput!) {
  addTodos(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<AddTodosMutation, AddTodosMutationVariables>;
export const DeleteTodoDocument = new TypedDocumentString(`
    mutation DeleteTodo($input: TodoActionInput!) {
  deleteTodo(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<DeleteTodoMutation, DeleteTodoMutationVariables>;
export const StartTodoDocument = new TypedDocumentString(`
    mutation StartTodo($input: TodoActionInput!) {
  startTodo(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<StartTodoMutation, StartTodoMutationVariables>;
export const PauseTodoDocument = new TypedDocumentString(`
    mutation PauseTodo($input: TodoActionInput!) {
  pauseTodo(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<PauseTodoMutation, PauseTodoMutationVariables>;
export const ResumeTodoDocument = new TypedDocumentString(`
    mutation ResumeTodo($input: TodoActionInput!) {
  resumeTodo(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<ResumeTodoMutation, ResumeTodoMutationVariables>;
export const CompleteTodoDocument = new TypedDocumentString(`
    mutation CompleteTodo($input: TodoActionInput!) {
  completeTodo(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<CompleteTodoMutation, CompleteTodoMutationVariables>;
export const ResetTodoDocument = new TypedDocumentString(`
    mutation ResetTodo($input: TodoActionInput!) {
  resetTodo(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<ResetTodoMutation, ResetTodoMutationVariables>;
export const ReorderTodosDocument = new TypedDocumentString(`
    mutation ReorderTodos($input: ReorderTodosInput!) {
  reorderTodos(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<ReorderTodosMutation, ReorderTodosMutationVariables>;
export const UpdateTodoActualFocusDocument = new TypedDocumentString(`
    mutation UpdateTodoActualFocus($input: UpdateTodoActualFocusInput!) {
  updateTodoActualFocus(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<UpdateTodoActualFocusMutation, UpdateTodoActualFocusMutationVariables>;
export const UpdateTodoScheduleDocument = new TypedDocumentString(`
    mutation UpdateTodoSchedule($input: UpdateTodoScheduleInput!) {
  updateTodoSchedule(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<UpdateTodoScheduleMutation, UpdateTodoScheduleMutationVariables>;
export const UpdateTodoTargetFocusDocument = new TypedDocumentString(`
    mutation UpdateTodoTargetFocus($input: UpdateTodoTargetFocusInput!) {
  updateTodoTargetFocus(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<UpdateTodoTargetFocusMutation, UpdateTodoTargetFocusMutationVariables>;
export const MuteTodoReminderTodayDocument = new TypedDocumentString(`
    mutation MuteTodoReminderToday($input: TodoActionInput!) {
  muteTodoReminderToday(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<MuteTodoReminderTodayMutation, MuteTodoReminderTodayMutationVariables>;
export const UnmuteTodoReminderDocument = new TypedDocumentString(`
    mutation UnmuteTodoReminder($input: TodoActionInput!) {
  unmuteTodoReminder(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<UnmuteTodoReminderMutation, UnmuteTodoReminderMutationVariables>;
export const StartRestSessionDocument = new TypedDocumentString(`
    mutation StartRestSession($input: RestSessionInput!) {
  startRestSession(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<StartRestSessionMutation, StartRestSessionMutationVariables>;
export const StopRestSessionDocument = new TypedDocumentString(`
    mutation StopRestSession($input: RestSessionInput!) {
  stopRestSession(input: $input) {
    ...DailyLogDetailFields
  }
}
    fragment DailyLogTodoFields on TodoItem {
  id
  taskId
  titleSnapshot
  content
  done
  order
  startedAt
  scheduledStartAt
  targetFocusMinutes
  pausedAt
  completedAt
  deviationSeconds
  resumeCount
  actualFocusSeconds
  muteReminderDateKey
}
fragment DailyLogDetailFields on DailyLog {
  dateKey
  memo
  restAccumulatedSeconds
  restStartedAt
  todos {
    ...DailyLogTodoFields
  }
}`) as unknown as TypedDocumentString<StopRestSessionMutation, StopRestSessionMutationVariables>;
export const NotificationSettingsDocument = new TypedDocumentString(`
    query NotificationSettings {
  notificationSettings {
    ...NotificationSettingsFields
  }
}
    fragment NotificationSettingsFields on NotificationSettings {
  id
  userId
  pushEnabled
  intervalMinutes
  activeStartTime
  activeEndTime
  dayMode
  typeRestEnd
  typeIncomplete
  typeFocusStart
  tone
  systemPermission
  lastEmptyTodoReminderDate
  createdAt
  updatedAt
}`) as unknown as TypedDocumentString<NotificationSettingsQuery, NotificationSettingsQueryVariables>;
export const UpdateNotificationSettingsDocument = new TypedDocumentString(`
    mutation UpdateNotificationSettings($input: UpdateNotificationSettingsInput!) {
  updateNotificationSettings(input: $input) {
    ...NotificationSettingsFields
  }
}
    fragment NotificationSettingsFields on NotificationSettings {
  id
  userId
  pushEnabled
  intervalMinutes
  activeStartTime
  activeEndTime
  dayMode
  typeRestEnd
  typeIncomplete
  typeFocusStart
  tone
  systemPermission
  lastEmptyTodoReminderDate
  createdAt
  updatedAt
}`) as unknown as TypedDocumentString<UpdateNotificationSettingsMutation, UpdateNotificationSettingsMutationVariables>;
export const RegisterPushDeviceTokenDocument = new TypedDocumentString(`
    mutation RegisterPushDeviceToken($input: RegisterPushDeviceTokenInput!) {
  registerPushDeviceToken(input: $input) {
    id
    pushToken
    platform
    isActive
    updatedAt
  }
}
    `) as unknown as TypedDocumentString<RegisterPushDeviceTokenMutation, RegisterPushDeviceTokenMutationVariables>;
export const RoutineTemplatesDocument = new TypedDocumentString(`
    query RoutineTemplates {
  routineTemplates {
    ...RoutineTemplateFields
  }
}
    fragment RoutineTemplateFields on RoutineTemplate {
  id
  userId
  name
  items {
    id
    taskId
    titleSnapshot
    content
    order
    scheduledTimeHHmm
  }
  createdAt
  updatedAt
}`) as unknown as TypedDocumentString<RoutineTemplatesQuery, RoutineTemplatesQueryVariables>;
export const RoutineTemplateWeekdayAssignmentsDocument = new TypedDocumentString(`
    query RoutineTemplateWeekdayAssignments {
  routineTemplateWeekdayAssignments {
    ...RoutineTemplateWeekdayAssignmentFields
  }
}
    fragment RoutineTemplateFields on RoutineTemplate {
  id
  userId
  name
  items {
    id
    taskId
    titleSnapshot
    content
    order
    scheduledTimeHHmm
  }
  createdAt
  updatedAt
}
fragment RoutineTemplateWeekdayAssignmentFields on RoutineTemplateWeekdayAssignment {
  id
  userId
  weekday
  routineTemplateId
  routineTemplate {
    ...RoutineTemplateFields
  }
  createdAt
  updatedAt
}`) as unknown as TypedDocumentString<RoutineTemplateWeekdayAssignmentsQuery, RoutineTemplateWeekdayAssignmentsQueryVariables>;
export const CreateRoutineTemplateDocument = new TypedDocumentString(`
    mutation CreateRoutineTemplate($input: CreateRoutineTemplateInput!) {
  createRoutineTemplate(input: $input) {
    ...RoutineTemplateFields
  }
}
    fragment RoutineTemplateFields on RoutineTemplate {
  id
  userId
  name
  items {
    id
    taskId
    titleSnapshot
    content
    order
    scheduledTimeHHmm
  }
  createdAt
  updatedAt
}`) as unknown as TypedDocumentString<CreateRoutineTemplateMutation, CreateRoutineTemplateMutationVariables>;
export const UpdateRoutineTemplateDocument = new TypedDocumentString(`
    mutation UpdateRoutineTemplate($input: UpdateRoutineTemplateInput!) {
  updateRoutineTemplate(input: $input) {
    ...RoutineTemplateFields
  }
}
    fragment RoutineTemplateFields on RoutineTemplate {
  id
  userId
  name
  items {
    id
    taskId
    titleSnapshot
    content
    order
    scheduledTimeHHmm
  }
  createdAt
  updatedAt
}`) as unknown as TypedDocumentString<UpdateRoutineTemplateMutation, UpdateRoutineTemplateMutationVariables>;
export const DeleteRoutineTemplateDocument = new TypedDocumentString(`
    mutation DeleteRoutineTemplate($input: DeleteRoutineTemplateInput!) {
  deleteRoutineTemplate(input: $input)
}
    `) as unknown as TypedDocumentString<DeleteRoutineTemplateMutation, DeleteRoutineTemplateMutationVariables>;
export const UpdateRoutineTemplateWeekdayAssignmentsDocument = new TypedDocumentString(`
    mutation UpdateRoutineTemplateWeekdayAssignments($input: UpdateRoutineTemplateWeekdayAssignmentsInput!) {
  updateRoutineTemplateWeekdayAssignments(input: $input) {
    ...RoutineTemplateWeekdayAssignmentFields
  }
}
    fragment RoutineTemplateFields on RoutineTemplate {
  id
  userId
  name
  items {
    id
    taskId
    titleSnapshot
    content
    order
    scheduledTimeHHmm
  }
  createdAt
  updatedAt
}
fragment RoutineTemplateWeekdayAssignmentFields on RoutineTemplateWeekdayAssignment {
  id
  userId
  weekday
  routineTemplateId
  routineTemplate {
    ...RoutineTemplateFields
  }
  createdAt
  updatedAt
}`) as unknown as TypedDocumentString<UpdateRoutineTemplateWeekdayAssignmentsMutation, UpdateRoutineTemplateWeekdayAssignmentsMutationVariables>;
export const TaskCollectionsDocument = new TypedDocumentString(`
    query TaskCollections {
  taskCollections {
    id
    name
    order
    createdAt
    updatedAt
    tasks {
      id
      userId
      collectionId
      title
      isFavorite
      isArchived
      order
      lastUsedAt
      createdAt
      updatedAt
    }
  }
}
    `) as unknown as TypedDocumentString<TaskCollectionsQuery, TaskCollectionsQueryVariables>;
export const AddTaskDocument = new TypedDocumentString(`
    mutation AddTask($input: AddTaskInput!) {
  addTask(input: $input) {
    id
    collectionId
    title
    order
    lastUsedAt
  }
}
    `) as unknown as TypedDocumentString<AddTaskMutation, AddTaskMutationVariables>;
export const CreateTaskCollectionDocument = new TypedDocumentString(`
    mutation CreateTaskCollection($input: CreateTaskCollectionInput!) {
  createTaskCollection(input: $input) {
    id
    name
    order
  }
}
    `) as unknown as TypedDocumentString<CreateTaskCollectionMutation, CreateTaskCollectionMutationVariables>;
export const DeleteTaskDocument = new TypedDocumentString(`
    mutation DeleteTask($input: DeleteTaskInput!) {
  deleteTask(input: $input)
}
    `) as unknown as TypedDocumentString<DeleteTaskMutation, DeleteTaskMutationVariables>;
export const MoveTaskToCollectionDocument = new TypedDocumentString(`
    mutation MoveTaskToCollection($input: MoveTaskToCollectionInput!) {
  moveTaskToCollection(input: $input) {
    id
    collectionId
    title
    order
    lastUsedAt
  }
}
    `) as unknown as TypedDocumentString<MoveTaskToCollectionMutation, MoveTaskToCollectionMutationVariables>;
export const ReorderTaskCollectionsDocument = new TypedDocumentString(`
    mutation ReorderTaskCollections($input: ReorderTaskCollectionsInput!) {
  reorderTaskCollections(input: $input)
}
    `) as unknown as TypedDocumentString<ReorderTaskCollectionsMutation, ReorderTaskCollectionsMutationVariables>;
export const ReorderTasksDocument = new TypedDocumentString(`
    mutation ReorderTasks($input: ReorderTasksInput!) {
  reorderTasks(input: $input)
}
    `) as unknown as TypedDocumentString<ReorderTasksMutation, ReorderTasksMutationVariables>;
export const RenameTaskDocument = new TypedDocumentString(`
    mutation RenameTask($input: RenameTaskInput!) {
  renameTask(input: $input) {
    id
    collectionId
    title
    order
    lastUsedAt
  }
}
    `) as unknown as TypedDocumentString<RenameTaskMutation, RenameTaskMutationVariables>;
export const RenameTaskCollectionDocument = new TypedDocumentString(`
    mutation RenameTaskCollection($input: RenameTaskCollectionInput!) {
  renameTaskCollection(input: $input) {
    id
    name
    order
  }
}
    `) as unknown as TypedDocumentString<RenameTaskCollectionMutation, RenameTaskCollectionMutationVariables>;
export const DeleteTaskCollectionDocument = new TypedDocumentString(`
    mutation DeleteTaskCollection($input: DeleteTaskCollectionInput!) {
  deleteTaskCollection(input: $input)
}
    `) as unknown as TypedDocumentString<DeleteTaskCollectionMutation, DeleteTaskCollectionMutationVariables>;
export const SetTaskFavoriteDocument = new TypedDocumentString(`
    mutation SetTaskFavorite($input: SetTaskFavoriteInput!) {
  setTaskFavorite(input: $input) {
    id
    collectionId
    title
    isFavorite
    order
    lastUsedAt
  }
}
    `) as unknown as TypedDocumentString<SetTaskFavoriteMutation, SetTaskFavoriteMutationVariables>;
export const MeDocument = new TypedDocumentString(`
    query Me {
  me {
    id
    email
  }
}
    `) as unknown as TypedDocumentString<MeQuery, MeQueryVariables>;