import ActivityKit
import Foundation
import React

private struct FocusLiveActivityInput {
  let todoId: String
  let dateKey: String
  let title: String
  let startedAt: Date
  let timerStartedAt: Date
  let isPaused: Bool
  let pausedElapsedSeconds: Int
  let targetFocusMinutes: Int?
  let deepLink: String

  init(payload: NSDictionary) throws {
    let todoId = Self.readString(payload["todoId"])
    let dateKey = Self.readString(payload["dateKey"])
    let title = Self.readString(payload["title"])
    let startedAtMs = Self.readDouble(payload["startedAtMs"])
    let deviationSeconds = max(Int(Self.readDouble(payload["deviationSeconds"] ?? 0)), 0)
    let pausedAtMs = Self.readOptionalDouble(payload["pausedAtMs"])
    let targetFocusMinutes = Self.readOptionalInt(payload["targetFocusMinutes"])
    let deepLink = Self.resolveDeepLink(
      explicitDeepLink: Self.readString(payload["deepLink"]),
      path: Self.readString(payload["deepLinkPath"]),
      dateKey: dateKey,
      todoId: todoId
    )

    guard !todoId.isEmpty, !dateKey.isEmpty, startedAtMs > 0 else {
      throw NSError(
        domain: "FocusLiveActivity",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "todoId, dateKey, startedAtMs are required."]
      )
    }

    let startedAt = Date(timeIntervalSince1970: startedAtMs / 1000)
    let pausedAt = pausedAtMs.map { Date(timeIntervalSince1970: $0 / 1000) }
    let elapsedReference = pausedAt ?? Date()
    let elapsedSeconds = max(Int(elapsedReference.timeIntervalSince(startedAt)) - deviationSeconds, 0)

    self.todoId = todoId
    self.dateKey = dateKey
    self.title = title.isEmpty ? "진행 중인 작업" : title
    self.startedAt = startedAt
    self.timerStartedAt = startedAt.addingTimeInterval(TimeInterval(deviationSeconds))
    self.isPaused = Self.readBool(payload["isPaused"]) || pausedAt != nil
    self.pausedElapsedSeconds = elapsedSeconds
    self.targetFocusMinutes = targetFocusMinutes
    self.deepLink = deepLink
  }

  @available(iOS 16.1, *)
  var attributes: FocusActivityAttributes {
    FocusActivityAttributes(todoId: todoId, dateKey: dateKey)
  }

  @available(iOS 16.1, *)
  var state: FocusActivityAttributes.ContentState {
    FocusActivityAttributes.ContentState(
      title: title,
      startedAt: startedAt,
      timerStartedAt: timerStartedAt,
      isPaused: isPaused,
      pausedElapsedSeconds: pausedElapsedSeconds,
      targetFocusMinutes: targetFocusMinutes,
      deepLink: deepLink
    )
  }

  private static func readString(_ value: Any?) -> String {
    (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  }

  private static func readDouble(_ value: Any?) -> Double {
    if let number = value as? NSNumber {
      return number.doubleValue
    }
    if let string = value as? String, let double = Double(string) {
      return double
    }
    return 0
  }

  private static func readOptionalDouble(_ value: Any?) -> Double? {
    let double = readDouble(value)
    return double > 0 ? double : nil
  }

  private static func readOptionalInt(_ value: Any?) -> Int? {
    if value is NSNull {
      return nil
    }
    let intValue = Int(readDouble(value))
    return intValue > 0 ? intValue : nil
  }

  private static func readBool(_ value: Any?) -> Bool {
    if let bool = value as? Bool {
      return bool
    }
    if let number = value as? NSNumber {
      return number.boolValue
    }
    return false
  }

  private static func resolveDeepLink(
    explicitDeepLink: String,
    path: String,
    dateKey: String,
    todoId: String
  ) -> String {
    if explicitDeepLink.contains("://") {
      return explicitDeepLink
    }

    let fallbackPath = "/date-tasks?date=\(dateKey)&todoId=\(todoId)"
    let targetPath = path.hasPrefix("/") ? path : fallbackPath
    let allowedCharacters = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-._~"))
    let encodedTargetPath = targetPath.addingPercentEncoding(withAllowedCharacters: allowedCharacters) ?? "%2Fdate-tasks"
    return "\(resolvePrimaryAppScheme()):///?focusPath=\(encodedTargetPath)"
  }

  private static func resolvePrimaryAppScheme() -> String {
    guard
      let urlTypes = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]]
    else {
      return "mobile"
    }

    for urlType in urlTypes {
      guard let schemes = urlType["CFBundleURLSchemes"] as? [String] else {
        continue
      }

      if let scheme = schemes.first(where: { $0.hasPrefix("mobile") }) {
        return scheme
      }
    }

    return "mobile"
  }
}

@objc(FocusLiveActivityModule)
class FocusLiveActivityModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc
  func isSupported(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(["supported": false, "enabled": false, "reason": "UNSUPPORTED_IOS_VERSION"])
      return
    }

    resolve([
      "supported": true,
      "enabled": ActivityAuthorizationInfo().areActivitiesEnabled,
    ])
  }

  @objc
  func configure(
    _ payload: NSDictionary,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    let loggedIn = (payload["loggedIn"] as? NSNumber)?.boolValue ?? false
    let token = FocusLiveActivityModule.readString(payload["token"])
    let apiOrigin = FocusLiveActivityModule.readString(payload["apiOrigin"])

    FocusLiveActivityCredentials.update(
      loggedIn: loggedIn,
      token: token,
      apiOrigin: apiOrigin
    )
    resolve(["configured": true])
  }

  @objc
  func start(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(["supported": false, "started": false, "reason": "UNSUPPORTED_IOS_VERSION"])
      return
    }

    guard ActivityAuthorizationInfo().areActivitiesEnabled else {
      resolve(["supported": true, "started": false, "reason": "LIVE_ACTIVITIES_DISABLED"])
      return
    }

    do {
      let input = try FocusLiveActivityInput(payload: payload)
      Task {
        do {
          let activity = try await Self.startOrUpdateActivity(input)
          resolve(["supported": true, "started": true, "activityId": activity.id])
        } catch {
          reject("FOCUS_LIVE_ACTIVITY_START_FAILED", error.localizedDescription, error)
        }
      }
    } catch {
      reject("FOCUS_LIVE_ACTIVITY_INVALID_PAYLOAD", error.localizedDescription, error)
    }
  }

  @objc
  func update(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(["supported": false, "updated": false, "reason": "UNSUPPORTED_IOS_VERSION"])
      return
    }

    do {
      let input = try FocusLiveActivityInput(payload: payload)
      Task {
        if input.isPaused {
          await Self.endActivities(todoId: "", dateKey: "")
          resolve(["supported": true, "updated": false, "ended": true])
          return
        }
        await Self.updateActivity(input)
        resolve(["supported": true, "updated": true])
      }
    } catch {
      reject("FOCUS_LIVE_ACTIVITY_INVALID_PAYLOAD", error.localizedDescription, error)
    }
  }

  @objc
  func end(
    _ payload: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(["supported": false, "ended": false, "reason": "UNSUPPORTED_IOS_VERSION"])
      return
    }

    let todoId = FocusLiveActivityModule.readString(payload["todoId"])
    let dateKey = FocusLiveActivityModule.readString(payload["dateKey"])
    Task {
      await Self.endActivities(todoId: todoId, dateKey: dateKey)
      resolve(["supported": true, "ended": true])
    }
  }

  @objc
  func consumePendingControlEvent(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(FocusLiveActivityControlEvents.consumePendingEvent() ?? NSNull())
  }

  @objc
  func currentActivitySnapshot(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.1, *) else {
      resolve(NSNull())
      return
    }

    guard let activity = Activity<FocusActivityAttributes>.activities.first else {
      resolve(NSNull())
      return
    }

    let state = activity.contentState
    var snapshot: [String: Any] = [
      "activityId": activity.id,
      "todoId": activity.attributes.todoId,
      "dateKey": activity.attributes.dateKey,
      "title": state.title,
      "startedAtMs": Int(state.startedAt.timeIntervalSince1970 * 1000),
      "timerStartedAtMs": Int(state.timerStartedAt.timeIntervalSince1970 * 1000),
      "isPaused": state.isPaused,
      "pausedElapsedSeconds": state.pausedElapsedSeconds,
      "deepLink": state.deepLink,
    ]

    if let targetFocusMinutes = state.targetFocusMinutes {
      snapshot["targetFocusMinutes"] = targetFocusMinutes
    } else {
      snapshot["targetFocusMinutes"] = NSNull()
    }

    resolve(snapshot)
  }

  @available(iOS 16.1, *)
  private static func startOrUpdateActivity(
    _ input: FocusLiveActivityInput
  ) async throws -> Activity<FocusActivityAttributes> {
    let matchingActivity = Activity<FocusActivityAttributes>.activities.first {
      $0.attributes.todoId == input.todoId && $0.attributes.dateKey == input.dateKey
    }

    for activity in Activity<FocusActivityAttributes>.activities where activity.id != matchingActivity?.id {
      await endActivity(activity, state: input.state)
    }

    if let matchingActivity {
      await updateActivity(matchingActivity, state: input.state)
      return matchingActivity
    }

    if #available(iOS 16.2, *) {
      return try Activity<FocusActivityAttributes>.request(
        attributes: input.attributes,
        content: ActivityContent(state: input.state, staleDate: nil),
        pushType: nil
      )
    }

    return try Activity<FocusActivityAttributes>.request(
      attributes: input.attributes,
      contentState: input.state,
      pushType: nil
    )
  }

  @available(iOS 16.1, *)
  private static func updateActivity(_ input: FocusLiveActivityInput) async {
    guard let activity = Activity<FocusActivityAttributes>.activities.first(where: {
      $0.attributes.todoId == input.todoId && $0.attributes.dateKey == input.dateKey
    }) else {
      return
    }

    await updateActivity(activity, state: input.state)
  }

  @available(iOS 16.1, *)
  private static func updateActivity(
    _ activity: Activity<FocusActivityAttributes>,
    state: FocusActivityAttributes.ContentState
  ) async {
    if #available(iOS 16.2, *) {
      await activity.update(ActivityContent(state: state, staleDate: nil))
      return
    }

    await activity.update(using: state)
  }

  @available(iOS 16.1, *)
  private static func endActivities(todoId: String, dateKey: String) async {
    let activities = Activity<FocusActivityAttributes>.activities.filter { activity in
      if !todoId.isEmpty && activity.attributes.todoId != todoId {
        return false
      }
      if !dateKey.isEmpty && activity.attributes.dateKey != dateKey {
        return false
      }
      return true
    }

    for activity in activities {
      await endActivity(activity, state: activity.contentState)
    }
  }

  @available(iOS 16.1, *)
  private static func endActivity(
    _ activity: Activity<FocusActivityAttributes>,
    state: FocusActivityAttributes.ContentState
  ) async {
    if #available(iOS 16.2, *) {
      await activity.end(ActivityContent(state: state, staleDate: nil), dismissalPolicy: .immediate)
      return
    }

    await activity.end(using: state, dismissalPolicy: .immediate)
  }

  private static func readString(_ value: Any?) -> String {
    (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  }
}
