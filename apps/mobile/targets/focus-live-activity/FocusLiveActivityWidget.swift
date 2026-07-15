import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

@available(iOS 16.1, *)
private func elapsedLabel(_ seconds: Int) -> String {
  let safeSeconds = max(seconds, 0)
  let hours = safeSeconds / 3600
  let minutes = (safeSeconds % 3600) / 60

  if hours > 0 {
    return "\(hours)시간 \(minutes)분"
  }
  return "\(minutes)분"
}

@available(iOS 16.1, *)
private func deepLinkURL(_ context: ActivityViewContext<FocusActivityAttributes>) -> URL {
  URL(string: context.state.deepLink) ?? URL(string: "mobile://date-tasks")!
}

@available(iOS 17.0, *)
private struct FocusLiveActivityControlButton: View {
  let context: ActivityViewContext<FocusActivityAttributes>
  var compact = false

  var body: some View {
    Button(
      intent: ToggleFocusLiveActivityIntent(
        todoId: context.attributes.todoId,
        dateKey: context.attributes.dateKey,
        shouldResume: context.state.isPaused
      )
    ) {
      Image(systemName: context.state.isPaused ? "play.fill" : "pause.fill")
        .font(.system(size: compact ? 13 : 16, weight: .bold))
        .frame(width: compact ? 30 : 38, height: compact ? 30 : 38)
        .foregroundStyle(context.state.isPaused ? Color.cyan : Color.white)
        .background(
          context.state.isPaused ? Color.cyan.opacity(0.18) : Color.white.opacity(0.14),
          in: Circle()
        )
    }
    .buttonStyle(.plain)
    .accessibilityLabel(context.state.isPaused ? "집중 재개" : "집중 일시정지")
  }
}

@available(iOS 16.1, *)
private struct FocusLiveActivityLockScreenView: View {
  let context: ActivityViewContext<FocusActivityAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .center, spacing: 10) {
        Image(systemName: context.state.isPaused ? "pause.circle.fill" : "timer")
          .font(.system(size: 22, weight: .semibold))
          .foregroundStyle(context.state.isPaused ? Color.orange : Color.cyan)

        VStack(alignment: .leading, spacing: 2) {
          Text(context.state.isPaused ? "일시정지" : "집중 중")
            .font(.caption)
            .foregroundStyle(.secondary)
          Text(context.state.title)
            .font(.headline)
            .lineLimit(1)
        }

        Spacer()

        if #available(iOS 17.0, *) {
          FocusLiveActivityControlButton(context: context)
        }
      }

      HStack(alignment: .firstTextBaseline, spacing: 8) {
        if context.state.isPaused {
          Text(elapsedLabel(context.state.pausedElapsedSeconds))
            .font(.system(size: 34, weight: .bold, design: .rounded))
            .monospacedDigit()
        } else {
          Text(context.state.timerStartedAt, style: .timer)
            .font(.system(size: 34, weight: .bold, design: .rounded))
            .monospacedDigit()
        }

        Text("경과")
          .font(.subheadline)
          .foregroundStyle(.secondary)

        Spacer()

        if let targetFocusMinutes = context.state.targetFocusMinutes {
          Text("목표 \(targetFocusMinutes)분")
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(Color.cyan.opacity(0.16), in: Capsule())
        }
      }
    }
    .padding(16)
    .activityBackgroundTint(Color(red: 0.04, green: 0.07, blue: 0.13))
    .activitySystemActionForegroundColor(.white)
    .widgetURL(deepLinkURL(context))
  }
}

@available(iOS 16.1, *)
private struct FocusLiveActivityExpandedView: View {
  let context: ActivityViewContext<FocusActivityAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(context.state.title)
        .font(.caption.weight(.semibold))
        .lineLimit(1)

      HStack(spacing: 5) {
        Image(systemName: context.state.isPaused ? "pause.fill" : "timer")
        if context.state.isPaused {
          Text(elapsedLabel(context.state.pausedElapsedSeconds))
            .monospacedDigit()
        } else {
          Text(context.state.timerStartedAt, style: .timer)
            .monospacedDigit()
        }
      }
      .font(.title3.weight(.bold))
    }
  }
}

@main
@available(iOS 16.1, *)
struct FocusLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: FocusActivityAttributes.self) { context in
      FocusLiveActivityLockScreenView(context: context)
    } dynamicIsland: { context in
      let url = deepLinkURL(context)

      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Link(destination: url) {
            FocusLiveActivityExpandedView(context: context)
              .foregroundStyle(.primary)
          }
        }

        DynamicIslandExpandedRegion(.trailing) {
          if #available(iOS 17.0, *) {
            FocusLiveActivityControlButton(context: context, compact: true)
          } else {
            Link(destination: url) {
              Image(systemName: context.state.isPaused ? "pause.circle.fill" : "timer.circle.fill")
                .font(.title2)
                .foregroundStyle(context.state.isPaused ? Color.orange : Color.cyan)
            }
          }
        }

        DynamicIslandExpandedRegion(.bottom) {
          Link(destination: url) {
            HStack {
              Text(context.state.isPaused ? "잠시 멈춤" : "작업 화면으로 이동")
                .font(.caption)
              Spacer()
              if let targetFocusMinutes = context.state.targetFocusMinutes {
                Text("목표 \(targetFocusMinutes)분")
                  .font(.caption2)
                  .foregroundStyle(.secondary)
              }
            }
          }
        }
      } compactLeading: {
        Link(destination: url) {
          Image(systemName: context.state.isPaused ? "pause.fill" : "timer")
            .foregroundStyle(context.state.isPaused ? Color.orange : Color.cyan)
        }
      } compactTrailing: {
        Link(destination: url) {
          if context.state.isPaused {
            Text(elapsedLabel(context.state.pausedElapsedSeconds))
              .font(.caption2.weight(.semibold))
              .monospacedDigit()
          } else {
            Text(context.state.timerStartedAt, style: .timer)
              .font(.caption2.weight(.semibold))
              .monospacedDigit()
          }
        }
      } minimal: {
        Link(destination: url) {
          Image(systemName: context.state.isPaused ? "pause.fill" : "timer")
            .foregroundStyle(context.state.isPaused ? Color.orange : Color.cyan)
        }
      }
    }
  }
}
