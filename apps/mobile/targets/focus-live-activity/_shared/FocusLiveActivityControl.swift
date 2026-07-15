import ActivityKit
import AppIntents
import Foundation

struct FocusLiveActivityCredentialSnapshot {
  let token: String
  let apiOrigin: String
}

enum FocusLiveActivityCredentials {
  private static let widgetBundleSuffix = ".FocusLiveActivityWidget"
  private static let tokenKey = "focus-live-activity.session-token"
  private static let apiOriginKey = "focus-live-activity.api-origin"

  static func update(loggedIn: Bool, token: String, apiOrigin: String) {
    guard let defaults = sharedDefaults() else {
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
      let defaults = sharedDefaults(),
      let token = defaults.string(forKey: tokenKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
      let apiOrigin = defaults.string(forKey: apiOriginKey)?.trimmingCharacters(in: .whitespacesAndNewlines),
      !token.isEmpty,
      !apiOrigin.isEmpty
    else {
      return nil
    }

    return FocusLiveActivityCredentialSnapshot(token: token, apiOrigin: apiOrigin)
  }

  private static func sharedDefaults() -> UserDefaults? {
    guard var bundleIdentifier = Bundle.main.bundleIdentifier, !bundleIdentifier.isEmpty else {
      return nil
    }

    if bundleIdentifier.hasSuffix(widgetBundleSuffix) {
      bundleIdentifier.removeLast(widgetBundleSuffix.count)
    }

    return UserDefaults(suiteName: "group.\(bundleIdentifier).focus-live-activity")
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
    guard let credentials = FocusLiveActivityCredentials.read() else {
      throw FocusLiveActivityControlError.authenticationRequired
    }

    let todo = try await updateTodo(credentials: credentials)
    try await updateActivity(todo: todo)
    return .result()
  }

  private func updateTodo(
    credentials: FocusLiveActivityCredentialSnapshot
  ) async throws -> FocusLiveActivityTodoResponse {
    let action = shouldResume ? "resumeTodo" : "pauseTodo"
    let query = """
      mutation ToggleFocusTodo($input: TodoActionInput!) {
        updateTodo: \(action)(input: $input) {
          todos {
            id
            content
            done
            startedAt
            pausedAt
            deviationSeconds
            targetFocusMinutes
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
      let todo = result.data?.updateTodo.todos.first(where: { $0.id == todoId }),
      !todo.done,
      todo.startedAt != nil
    else {
      throw FocusLiveActivityControlError.todoUnavailable
    }

    return todo
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
    struct DailyLog: Decodable {
      let todos: [FocusLiveActivityTodoResponse]
    }

    let updateTodo: DailyLog
  }

  struct GraphQLError: Decodable {
    let message: String
  }

  let data: Payload?
  let errors: [GraphQLError]?
}

private struct FocusLiveActivityTodoResponse: Decodable {
  let id: String
  let content: String
  let done: Bool
  let startedAt: String?
  let pausedAt: String?
  let deviationSeconds: Int
  let targetFocusMinutes: Int?
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
