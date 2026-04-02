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

export type AddDeviationInput = {
  dateKey: Scalars['String']['input'];
  seconds: Scalars['Int']['input'];
  todoId: Scalars['ID']['input'];
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
  todoCount: Scalars['Int']['output'];
  todos: Array<TodoItem>;
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  addDeviation: DailyLog;
  addTask: Task;
  addTodo: DailyLog;
  completeTodo: DailyLog;
  createTaskCollection: TaskCollection;
  createUser: User;
  startTodo: DailyLog;
  upsertDailyLog: DailyLog;
};


export type MutationAddDeviationArgs = {
  input: AddDeviationInput;
};


export type MutationAddTaskArgs = {
  input: AddTaskInput;
};


export type MutationAddTodoArgs = {
  input: AddTodoInput;
};


export type MutationCompleteTodoArgs = {
  input: TodoActionInput;
};


export type MutationCreateTaskCollectionArgs = {
  input: CreateTaskCollectionInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationStartTodoArgs = {
  input: TodoActionInput;
};


export type MutationUpsertDailyLogArgs = {
  input: UpsertDailyLogInput;
};

export type Query = {
  __typename?: 'Query';
  _empty?: Maybe<Scalars['String']['output']>;
  dailyLog?: Maybe<DailyLog>;
  dailyLogsByMonth: Array<DailyLog>;
  me?: Maybe<User>;
  taskCollections: Array<TaskCollection>;
};


export type QueryDailyLogArgs = {
  dateKey: Scalars['String']['input'];
};


export type QueryDailyLogsByMonthArgs = {
  monthKey: Scalars['String']['input'];
};

export type Task = {
  __typename?: 'Task';
  collectionId: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isArchived: Scalars['Boolean']['output'];
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
  startedAt?: Maybe<Scalars['String']['output']>;
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


export type DailyLogsByMonthQuery = { __typename?: 'Query', dailyLogsByMonth: Array<{ __typename?: 'DailyLog', id: string, userId: string, dateKey: string, monthKey: string, memo?: string | null, todoCount: number, doneCount: number, previewTodos: Array<string>, createdAt: string, updatedAt: string, todos: Array<{ __typename?: 'TodoItem', id: string, content: string, done: boolean, order: number, createdAt: string, startedAt?: string | null, completedAt?: string | null, deviationSeconds: number, actualFocusSeconds?: number | null }> }> };

export type TaskCollectionsQueryVariables = Exact<{ [key: string]: never; }>;


export type TaskCollectionsQuery = { __typename?: 'Query', taskCollections: Array<{ __typename?: 'TaskCollection', id: string, name: string, order: number, createdAt: string, updatedAt: string, tasks: Array<{ __typename?: 'Task', id: string, userId: string, collectionId: string, title: string, isArchived: boolean, order: number, lastUsedAt?: string | null, createdAt?: string | null, updatedAt?: string | null }> }> };
