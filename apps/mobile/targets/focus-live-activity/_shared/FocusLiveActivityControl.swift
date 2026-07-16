import ActivityKit
import AppIntents
import Foundation

struct FocusLiveActivityCredentialSnapshot {
  let token: String
  let apiOrigin: String
}

private enum FocusLiveActivitySharedDefaults {
  private static let widgetBundleSuffix = ".FocusLiveActivityWidget"

  static func read() -> UserDefaults? {
    guard var bundleIdentifier = Bundle.main.bundleIdentifier, !bundleIdentifier.isEmpty else {
      return nil
    }

    if bundleIdentifier.hasSuffix(widgetBundleSuffix) {
      bundleIdentifier.removeLast(widgetBundleSuffix.count)
    }

    return UserDefaults(suiteName: "group.\(bundleIdentifier).focus-live-activity")
  }
}

enum FocusLiveActivityCredentials {
  private static let tokenKey = "focus-live-activity.session-token"
  private static let apiOriginKey = "focus-live-activity.api-origin"

  static func update(loggedIn: Bool, token: String, apiOrigin: String) {
    guard let defaults = FocusLiveActivitySharedDefaults.read() else {
      return
    }

    guard loggedIn, !token.isEmpty, !apiOrigin.isEmpty else {
      defaults.removeObject(forKey: tokenKey)
      defaults.removeObject(forKey: apiOriginKey)
      return
    }

    defaults.set(token, forKey: tokenKey)
    defaults.set(apiOrigin.trimmingCharacters(in: CharacterSet(charactersIn: "/")), forKey: apiOriginKey)
  }

  static func read() -> FocusLiveActivityCredentialSnapshot? {
    guard
      let defaults = FocusLiveActivitySharedDefaults.read(),
      let token = defaults.string(forKey: tokenKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
      let apiOrigin = defaults.string(forKey: apiOriginKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
      !token.isEmpty,
      !apiOrigin.isEmpty
    else {
      return nil
    }

    return FocusLiveActivityCredentialSnapshot(token: token, apiOrigin: apiOrigin)
  }
}

struct FocusLiveActivityControlEvent: Codable {
  let id: String
  let action: String
  let todoId: String
  let dateKey: String
  let occurredAt: String
  let dailyLog: FocusLiveActivityDailyLogResponse
}

enum FocusLiveActivityControlEvents {
  private static let eventKey = "focus-live-activity.pending-control-event"

  static func record(action: String, todoId: String, dateKey: String, dailyLog: FocusLiveActivityDailyLogResponse) {
    guard let defaults = FocusLiveActivitySharedDefaults.read() else {
      return
    }

    let event = FocusLiveActivityControlEvent(
      id: UUID().uuidString,
      action: action,
      todoId: todoId,
      dateKey: dateKey,
      occurredAt: isoString(from: Date()),
      dailyLog: dailyLog
    )

    guard let data = try? JSONEncoder().encode(event) else {
      return
    }

    defaults.set(data, forKey: eventKey)
    defaults.synchronize()
  }

  static func consumePendingEvent() -> NSDictionary? {
    guard
      let defaults = FocusLiveActivitySharedDefaults.read(),
      let data = defaults.data(forKey: eventKey)
    else {
      return nil
    }

    defaults.removeObject(forKey: eventKey)
    guard
      let object = try? JSONSerialization.jsonObject(with: data),
      let dictionary = object as? [String: Any]
    else {
      return nil
    }

    return dictionary as NSDictionary
  }

  private static func isoString(from date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
  }
}

enum FocusLiveActivityControlLocks {
  private static let keyPrefix = "focus-live-activity.control-lock"
  private static let lockTTL: TimeInterval = 8

  static func acquire(todoId: String, dateKey: String) -> TimeInterval? {
    guard let defaults = FocusLiveActivitySharedDefaults.read() else {
      return Date().timeIntervalSince1970
    }

    let key = lockKey(todoId: todoId, dateKey: dateKey)
    let now = Date().timeIntervalSince1970
    let previous = defaults.double(forKey: key)
    if previous > 0 && now - previous < lockTTL {
      return nil
    }

    defaults.set(now, forKey: key)
    defaults.synchronize()
    return now
  }

  static func release(todoId: String, dateKey: String, token: TimeInterval) {
    guard let defaults = FocusLiveActivitySharedDefaults.read() else {
      return
    }

    let key = lockKey(todoId: todoId, dateKey: dateKey)
    let current = defaults.double(forKey: key)
    if abs(current - token) < 0.000001 {
      defaults.removeObject(forKey: key)
      defaults.synchronize()
    }
  }

  private static func lockKey(todoId: String, dateKey: String) -> String {
    "\(keyPrefix).\(dateKey).\(todoId)"
  }
}

@available(iOS 17.0, *)
struct ToggleFocusLiveActivityIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "집중 타이머 일시정지 또는 재개"
  static var openAppWhenRun = false

  @Parameter(title: "할 일 ID")
  var todoId: String

  @Parameter(title: "날짜")
  var dateKey: String

  @Parameter(title: "재개")
  var shouldResume: Bool

  init() {}

  init(todoId: String, dateKey: String, shouldResume: Bool) {
    self.todoId = todoId
    self.dateKey = dateKey
    self.shouldResume = shouldResume
  }

  func perform() async throws -> some IntentResult {
    guard let lockToken = FocusLiveActivityControlLocks.acquire(todoId: todoId, dateKey: dateKey) else {
      return .result()
    }
    defer {
      FocusLiveActivityControlLocks.release(todoId: todoId, dateKey: dateKey, token: lockToken)
    }

    guard let credentials = FocusLiveActivityCredentials.read() else {
      throw FocusLiveActivityControlError.authenticationRequired
    }

    let previousState = try await updateActivityOptimistically()

    do {
      let result = try await updateTodo(credentials: credentials)
      try await updateActivity(todo: result.todo)
      FocusLiveActivityControlEvents.record(
        action: shouldResume ? "resume" : "pause",
        todoId: todoId,
        dateKey: dateKey,
        dailyLog: result.dailyLog
      )
    } catch {
      await restoreActivity(state: previousState)
      throw error
    }

    return .result()
  }

  private func updateTodo(
    credentials: FocusLiveActivityCredentialSnapshot
  ) async throws -> FocusLiveActivityToggleResult {
    let action = shouldResume ? "resumeTodo" : "pauseTodo"
    let query = """
      mutation ToggleFocusTodo($input: TodoActionInput!) {
        updateTodo: \(action)(input: $input) {
          dateKey
          memo
          restAccumulatedSeconds
          restStartedAt
          todos {
            id
            taskId
            titleSnapshot
            content
            done
            order
            startedAt
            scheduledStartAt
            pausedAt
            completedAt
            deviationSeconds
            resumeCount
            actualFocusSeconds
            targetFocusMinutes
            muteReminderDateKey
          }
        }
      }
      """
    let body = FocusLiveActivityGraphQLRequest(
      query: query,
      variables: .init(input: .init(dateKey: dateKey, todoId: todoId))
    )

    guard let url = URL(string: "\(credentials.apiOrigin)/graphql") else {
      throw FocusLiveActivityControlError.invalidApiOrigin
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(credentials.token)", forHTTPHeaderField: "Authorization")
    request.httpBody = try JSONEncoder().encode(body)

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse, 200..<300 ~= httpResponse.statusCode else {
      throw FocusLiveActivityControlError.requestFailed
    }

    let result = try JSONDecoder().decode(FocusLiveActivityGraphQLResponse.self, from: data)
    if let message = result.errors?.first?.message {
      throw FocusLiveActivityControlError.graphQLError(message)
    }

    guard
      let dailyLog = result.data?.updateTodo,
      let todo = dailyLog.todos.first(where: { $0.id == todoId }),
      !todo.done,
      todo.startedAt != nil
    else {
      throw FocusLiveActivityControlError.todoUnavailable
    }

    return FocusLiveActivityToggleResult(todo: todo, dailyLog: dailyLog)
  }

  private func updateActivityOptimistically() async throws -> FocusActivityAttributes.ContentState {
    guard
      let activity = Activity<FocusActivityAttributes>.activities.first(where: {
        $0.attributes.todoId == todoId && $0.attributes.dateKey == dateKey
      })
    else {
      throw FocusLiveActivityControlError.activityUnavailable
    }

    let previousState = activity.content.state
    let now = Date()
    let nextState: FocusActivityAttributes.ContentState
    if shouldResume {
      nextState = FocusActivityAttributes.ContentState(
        title: previousState.title,
        startedAt: previousState.startedAt,
        timerStartedAt: now.addingTimeInterval(-TimeInterval(previousState.pausedElapsedSeconds)),
        isPaused: false,
        pausedElapsedSeconds: previousState.pausedElapsedSeconds,
        targetFocusMinutes: previousState.targetFocusMinutes,
        deepLink: previousState.deepLink
      )
    } else {
      let elapsedSeconds = max(Int(now.timeIntervalSince(previousState.timerStartedAt)), 0)
      nextState = FocusActivityAttributes.ContentState(
        title: previousState.title,
        startedAt: previousState.startedAt,
        timerStartedAt: previousState.timerStartedAt,
        isPaused: true,
        pausedElapsedSeconds: elapsedSeconds,
        targetFocusMinutes: previousState.targetFocusMinutes,
        deepLink: previousState.deepLink
      )
    }

    await updateActivity(activity, state: nextState)
    return previousState
  }

  private func updateActivity(todo: FocusLiveActivityTodoResponse) async throws {
    guard
      let activity = Activity<FocusActivityAttributes>.activities.first(where: {
        $0.attributes.todoId == todoId && $0.attributes.dateKey == dateKey
      }),
      let startedAt = parseDate(todo.startedAt)
    else {
      throw FocusLiveActivityControlError.activityUnavailable
    }

    let pausedAt = parseDate(todo.pausedAt)
    let deviationSeconds = max(todo.deviationSeconds, 0)
    let elapsedReference = pausedAt ?? Date()
    let elapsedSeconds = max(Int(elapsedReference.timeIntervalSince(startedAt)) - deviationSeconds, 0)
    let previousState = activity.content.state
    let state = FocusActivityAttributes.ContentState(
      title: todo.content,
      startedAt: startedAt,
      timerStartedAt: startedAt.addingTimeInterval(TimeInterval(deviationSeconds)),
      isPaused: pausedAt != nil,
      pausedElapsedSeconds: elapsedSeconds,
      targetFocusMinutes: todo.targetFocusMinutes,
      deepLink: previousState.deepLink
    )

    await updateActivity(activity, state: state)
  }

  private func restoreActivity(state: FocusActivityAttributes.ContentState) async {
    guard
      let activity = Activity<FocusActivityAttributes>.activities.first(where: {
        $0.attributes.todoId == todoId && $0.attributes.dateKey == dateKey
      })
    else {
      return
    }

    await updateActivity(activity, state: state)
  }

  private func updateActivity(
    _ activity: Activity<FocusActivityAttributes>,
    state: FocusActivityAttributes.ContentState
  ) async {
    await activity.update(ActivityContent(state: state, staleDate: nil))
  }

  private func parseDate(_ value: String?) -> Date? {
    guard let value, !value.isEmpty else {
      return nil
    }

    let fractionalFormatter = ISO8601DateFormatter()
    fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = fractionalFormatter.date(from: value) {
      return date
    }

    return ISO8601DateFormatter().date(from: value)
  }
}

private struct FocusLiveActivityGraphQLRequest: Encodable {
  struct Variables: Encodable {
    struct Input: Encodable {
      let dateKey: String
      let todoId: String
    }

    let input: Input
  }

  let query: String
  let variables: Variables
}

private struct FocusLiveActivityGraphQLResponse: Decodable {
  struct Payload: Decodable {
    let updateTodo: FocusLiveActivityDailyLogResponse
  }

  struct GraphQLError: Decodable {
    let message: String
  }

  let data: Payload?
  let errors: [GraphQLError]?
}

struct FocusLiveActivityDailyLogResponse: Codable {
  let dateKey: String
  let memo: String?
  let restAccumulatedSeconds: Int
  let restStartedAt: String?
  let todos: [FocusLiveActivityTodoResponse]
}

private struct FocusLiveActivityToggleResult {
  let todo: FocusLiveActivityTodoResponse
  let dailyLog: FocusLiveActivityDailyLogResponse
}

struct FocusLiveActivityTodoResponse: Codable {
  let id: String
  let taskId: String?
  let titleSnapshot: String?
  let content: String
  let done: Bool
  let order: Int
  let startedAt: String?
  let scheduledStartAt: String?
  let pausedAt: String?
  let completedAt: String?
  let deviationSeconds: Int
  let resumeCount: Int
  let actualFocusSeconds: Int?
  let targetFocusMinutes: Int?
  let muteReminderDateKey: String?
}

private enum FocusLiveActivityControlError: LocalizedError {
  case authenticationRequired
  case invalidApiOrigin
  case requestFailed
  case graphQLError(String)
  case todoUnavailable
  case activityUnavailable

  var errorDescription: String? {
    switch self {
    case .authenticationRequired:
      return "앱을 열어 로그인 상태를 확인해 주세요."
    case .invalidApiOrigin, .requestFailed:
      return "서버에 연결하지 못했어요."
    case .graphQLError(let message):
      return message
    case .todoUnavailable, .activityUnavailable:
      return "진행 중인 작업을 찾지 못했어요."
    }
  }
}
