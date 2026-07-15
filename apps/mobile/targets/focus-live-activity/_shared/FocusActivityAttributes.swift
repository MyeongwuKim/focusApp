import ActivityKit
import Foundation

@available(iOS 16.1, *)
struct FocusActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var title: String
    var startedAt: Date
    var timerStartedAt: Date
    var isPaused: Bool
    var pausedElapsedSeconds: Int
    var targetFocusMinutes: Int?
    var deepLink: String
  }

  var todoId: String
  var dateKey: String
}
