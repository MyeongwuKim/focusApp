import type {
  ManagedCollection,
  ManagedTaskItem,
} from "../components/TaskManagementBody";

export type TaskManagementDataState = {
  tasks: ManagedTaskItem[];
  collections: ManagedCollection[];
  selectedCollectionId: "all" | string;
  selectedTaskId: string | null;
};

type TaskManagementDataAction =
  | {
      type: "HYDRATE_FROM_QUERY";
      payload: {
        tasks: ManagedTaskItem[];
        collections: ManagedCollection[];
      };
    }
  | { type: "SELECT_COLLECTION"; payload: "all" | string }
  | { type: "SELECT_TASK"; payload: string | null }
  | {
      type: "APPEND_COLLECTION";
      payload: ManagedCollection;
    }
  | {
      type: "RENAME_TASK";
      payload: {
        taskId: string;
        label: string;
      };
    }
  | {
      type: "RENAME_COLLECTION";
      payload: {
        collectionId: string;
        name: string;
      };
    }
  | {
      type: "MOVE_TASK_TO_COLLECTION";
      payload: {
        taskId: string;
        collectionId: string;
      };
    }
  | {
      type: "REPLACE_TASKS";
      payload: ManagedTaskItem[];
    }
  | {
      type: "REPLACE_COLLECTIONS";
      payload: ManagedCollection[];
    }
  | {
      type: "CLEAR_SELECTED_TASK_IF_MISSING";
    };

export function createInitialTaskManagementDataState(
  defaultCollectionId: string
): TaskManagementDataState {
  return {
    tasks: [],
    collections: [{ id: defaultCollectionId, name: "기본" }],
    selectedCollectionId: "all",
    selectedTaskId: null,
  };
}

export function moveInArray<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [target] = next.splice(from, 1);
  next.splice(to, 0, target);
  return next;
}

export function reorderById<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string
) {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0) {
    return null;
  }
  return moveInArray(items, from, to);
}

export function taskManagementDataReducer(
  state: TaskManagementDataState,
  action: TaskManagementDataAction
): TaskManagementDataState {
  switch (action.type) {
    case "HYDRATE_FROM_QUERY":
      return {
        ...state,
        tasks: action.payload.tasks,
        collections: action.payload.collections,
      };
    case "SELECT_COLLECTION":
      return {
        ...state,
        selectedCollectionId: action.payload,
      };
    case "SELECT_TASK":
      return {
        ...state,
        selectedTaskId: action.payload,
      };
    case "APPEND_COLLECTION":
      return {
        ...state,
        collections: [...state.collections, action.payload],
      };
    case "RENAME_TASK":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.taskId
            ? { ...task, label: action.payload.label }
            : task
        ),
      };
    case "RENAME_COLLECTION":
      return {
        ...state,
        collections: state.collections.map((collection) =>
          collection.id === action.payload.collectionId
            ? { ...collection, name: action.payload.name }
            : collection
        ),
      };
    case "MOVE_TASK_TO_COLLECTION":
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === action.payload.taskId
            ? { ...task, collectionId: action.payload.collectionId }
            : task
        ),
      };
    case "REPLACE_TASKS":
      return {
        ...state,
        tasks: action.payload,
      };
    case "REPLACE_COLLECTIONS":
      return {
        ...state,
        collections: action.payload,
      };
    case "CLEAR_SELECTED_TASK_IF_MISSING":
      return state.selectedTaskId &&
        !state.tasks.some((task) => task.id === state.selectedTaskId)
        ? { ...state, selectedTaskId: null }
        : state;
    default:
      return state;
  }
}
