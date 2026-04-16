import AsyncStorage from "@react-native-async-storage/async-storage";

export type NativeTodoSession = {
  dateKey: string;
  todoId: string;
  startedAt: string;
  sessionId: string;
  syncedAtMs: number;
  backgroundEnteredAtMs: number | null;
};

const TODO_SESSION_STORAGE_KEY = "native-todo-session-v1";

export async function readNativeTodoSession() {
  try {
    const raw = await AsyncStorage.getItem(TODO_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<NativeTodoSession>;
    if (
      typeof parsed.dateKey !== "string" ||
      typeof parsed.todoId !== "string" ||
      typeof parsed.startedAt !== "string" ||
      typeof parsed.sessionId !== "string" ||
      typeof parsed.syncedAtMs !== "number"
    ) {
      return null;
    }

    return {
      dateKey: parsed.dateKey,
      todoId: parsed.todoId,
      startedAt: parsed.startedAt,
      sessionId: parsed.sessionId,
      syncedAtMs: parsed.syncedAtMs,
      backgroundEnteredAtMs:
        typeof parsed.backgroundEnteredAtMs === "number" ? parsed.backgroundEnteredAtMs : null,
    } satisfies NativeTodoSession;
  } catch (error) {
    console.log("Failed to read native todo session:", error);
    return null;
  }
}

export async function writeNativeTodoSession(session: NativeTodoSession | null) {
  try {
    if (!session) {
      await AsyncStorage.removeItem(TODO_SESSION_STORAGE_KEY);
      return;
    }

    await AsyncStorage.setItem(TODO_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.log("Failed to write native todo session:", error);
  }
}
