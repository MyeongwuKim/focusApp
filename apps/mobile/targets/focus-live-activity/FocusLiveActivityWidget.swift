import ActivityKit
import AppIntents
import Foundation
import SwiftUI
import WidgetKit

@available(iOS 16.1, *)
private enum FocusLiveActivityPalette {
  static let paper = Color(red: 0.973, green: 0.929, blue: 0.792)
  static let paperDeep = Color(red: 0.929, green: 0.847, blue: 0.655)
  static let ink = Color(red: 0.247, green: 0.231, blue: 0.196)
  static let rule = Color(red: 0.384, green: 0.518, blue: 0.565)
  static let green = Color(red: 0.408, green: 0.514, blue: 0.420)
  static let blue = Color(red: 0.337, green: 0.486, blue: 0.655)
  static let red = Color(red: 0.741, green: 0.396, blue: 0.337)
  static let orange = Color(red: 0.875, green: 0.663, blue: 0.176)
}

@available(iOS 16.1, *)
private func elapsedLabel(_ seconds: Int) -> String {
  let safeSeconds = max(seconds, 0)
  let hours = safeSeconds / 3600
  let minutes = (safeSeconds % 3600) / 60
  let remainingSeconds = safeSeconds % 60

  if hours > 0 {
    return String(format: "%d:%02d:%02d", hours, minutes, remainingSeconds)
  }
  return String(format: "%02d:%02d", minutes, remainingSeconds)
}

@available(iOS 16.1, *)
private func deepLinkURL(_ context: ActivityViewContext<FocusActivityAttributes>) -> URL {
  URL(string: context.state.deepLink) ?? URL(string: "mobile:///?focusPath=%2Fdate-tasks")!
}

@available(iOS 17.0, *)
private struct FocusLiveActivityControlButton: View {
  let context: ActivityViewContext<FocusActivityAttributes>
  var compact = false

  var body: some View {
    let accent = context.state.isPaused
      ? FocusLiveActivityPalette.green
      : FocusLiveActivityPalette.red

    Button(
      intent: ToggleFocusLiveActivityIntent(
        todoId: context.attributes.todoId,
        dateKey: context.attributes.dateKey,
        shouldResume: context.state.isPaused
      )
    ) {
      Image(systemName: context.state.isPaused ? "play.fill" : "pause.fill")
        .font(.system(size: compact ? 12 : 16, weight: .bold))
        .frame(width: compact ? 26 : 38, height: compact ? 26 : 38)
        .foregroundStyle(accent)
        .background(
          accent.opacity(0.17),
          in: Circle()
        )
        .overlay {
          Circle()
            .stroke(accent.opacity(0.42), lineWidth: 1)
        }
    }
    .buttonStyle(.plain)
    .transaction { transaction in
      transaction.animation = nil
    }
    .accessibilityLabel(context.state.isPaused ? "작업 재개" : "작업 일시정지")
  }
}

@available(iOS 17.0, *)
/**
 * 가로 StandBy 화면에서 웹의 스케치북 버튼과 비슷한 외곽선·밑색으로 일시정지와 재개를 제공한다.
 * 버튼을 누르면 원형 컨트롤과 동일한 AppIntent를 실행하며, 일시정지 상태에서는 파란색 재개 버튼으로 바뀐다.
 */
private struct FocusLiveActivityStandByControlButton: View {
  let context: ActivityViewContext<FocusActivityAttributes>

  var body: some View {
    let accent = context.state.isPaused
      ? FocusLiveActivityPalette.blue
      : FocusLiveActivityPalette.green

    Button(
      intent: ToggleFocusLiveActivityIntent(
        todoId: context.attributes.todoId,
        dateKey: context.attributes.dateKey,
        shouldResume: context.state.isPaused
      )
    ) {
      Label(
        context.state.isPaused ? "다시 시작" : "잠시 멈춤",
        systemImage: context.state.isPaused ? "play.fill" : "pause.fill"
      )
      .font(.system(size: 11, weight: .bold, design: .rounded))
      .foregroundStyle(FocusLiveActivityPalette.ink.opacity(0.88))
      .padding(.horizontal, 12)
      .padding(.vertical, 7)
      .background(
        accent.opacity(0.12),
        in: RoundedRectangle(cornerRadius: 9, style: .continuous)
      )
      .overlay {
        RoundedRectangle(cornerRadius: 9, style: .continuous)
          .stroke(accent.opacity(0.52), lineWidth: 1)
      }
      .rotationEffect(.degrees(-0.35))
    }
    .buttonStyle(.plain)
    .transaction { transaction in
      transaction.animation = nil
    }
    .accessibilityLabel(context.state.isPaused ? "작업 재개" : "작업 일시정지")
  }
}

@available(iOS 16.1, *)
private struct FocusLiveActivityMark: View {
  let size: CGFloat

  var body: some View {
    ZStack {
      Circle()
        .fill(FocusLiveActivityPalette.green.opacity(0.16))
      Circle()
        .stroke(FocusLiveActivityPalette.green.opacity(0.85), lineWidth: max(size * 0.08, 1.4))
      Image(systemName: "checkmark")
        .font(.system(size: size * 0.46, weight: .bold, design: .rounded))
        .foregroundStyle(FocusLiveActivityPalette.green)
        .rotationEffect(.degrees(-4))
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }
}

@available(iOS 16.1, *)
private struct FocusLiveActivityPaperBackground: View {
  var lineSpacing: CGFloat = 30
  var showsMarginLine = false

  var body: some View {
    GeometryReader { proxy in
      ZStack {
        FocusLiveActivityPalette.paper

        Path { path in
          var y = lineSpacing
          while y < proxy.size.height {
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: proxy.size.width, y: y))
            y += lineSpacing
          }
        }
        .stroke(FocusLiveActivityPalette.rule.opacity(0.13), lineWidth: 0.7)

        if showsMarginLine {
          Path { path in
            let x = max(proxy.size.width * 0.075, 28)
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x, y: proxy.size.height))
          }
          .stroke(FocusLiveActivityPalette.red.opacity(0.27), lineWidth: 1)
        }

        LinearGradient(
          colors: [Color.white.opacity(0.22), Color.clear, FocusLiveActivityPalette.paperDeep.opacity(0.13)],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
      }
    }
    .accessibilityHidden(true)
  }
}

@available(iOS 16.1, *)
private struct FocusLiveActivityStatusLabel: View {
  let isPaused: Bool

  var body: some View {
    HStack(spacing: 5) {
      Circle()
        .fill(isPaused ? FocusLiveActivityPalette.orange : FocusLiveActivityPalette.green)
        .frame(width: 6, height: 6)
      Text(isPaused ? "잠시 멈춤" : "집중 중")
    }
    .font(.caption.weight(.semibold))
    .foregroundStyle(FocusLiveActivityPalette.ink.opacity(0.7))
  }
}

@available(iOS 16.1, *)
private struct FocusLiveActivityTargetLabel: View {
  let minutes: Int

  var body: some View {
    Text("목표 \(minutes)분")
      .font(.caption.weight(.semibold))
      .foregroundStyle(FocusLiveActivityPalette.ink.opacity(0.82))
      .padding(.horizontal, 10)
      .padding(.vertical, 5)
      .background(
        FocusLiveActivityPalette.orange.opacity(0.24),
        in: RoundedRectangle(cornerRadius: 5, style: .continuous)
      )
  }
}

@available(iOS 16.1, *)
private struct FocusLiveActivityTimerValue: View {
  let context: ActivityViewContext<FocusActivityAttributes>
  let size: CGFloat

  var body: some View {
    Group {
      if context.state.isPaused {
        Text(elapsedLabel(context.state.pausedElapsedSeconds))
      } else {
        Text(context.state.timerStartedAt, style: .timer)
      }
    }
    .font(.system(size: size, weight: .bold, design: .rounded))
    .monospacedDigit()
    .contentTransition(.numericText())
    .lineLimit(1)
    .minimumScaleFactor(0.62)
    .accessibilityLabel(context.state.isPaused ? "집중 시간" : "집중 경과 시간")
  }
}

@available(iOS 16.1, *)
/**
 * 설정한 목표 집중시간 대비 경과 비율을 iOS의 시간 기반 진행 막대로 표시한다.
 * 집중 중에는 시스템이 timerStartedAt부터 목표 도달 시각까지의 진행률을 직접 갱신하고,
 * 일시정지하면 저장된 경과 시간 비율을 고정값으로 표시한다. 중앙 타이머와 중복되는
 * 시스템 진행 시간 라벨은 숨겨 StandBy의 제한된 높이 안에 막대만 배치한다.
 */
private struct FocusLiveActivityProgressView: View {
  let context: ActivityViewContext<FocusActivityAttributes>

  var body: some View {
    if let targetMinutes = context.state.targetFocusMinutes {
      let targetSeconds = max(TimeInterval(targetMinutes * 60), 1)
      let targetReachedAt = context.state.timerStartedAt.addingTimeInterval(targetSeconds)

      Group {
        if context.state.isPaused {
          ProgressView(
            value: min(Double(context.state.pausedElapsedSeconds) / targetSeconds, 1)
          )
        } else {
          ProgressView(
            timerInterval: context.state.timerStartedAt...targetReachedAt,
            countsDown: false
          )
        }
      }
      .tint(context.state.isPaused ? FocusLiveActivityPalette.orange : FocusLiveActivityPalette.green)
      .scaleEffect(x: 1, y: 1.5, anchor: .center)
      .labelsHidden()
      .accessibilityLabel("목표 집중 시간 진행률")
    }
  }
}

@available(iOS 16.1, *)
private struct FocusLiveActivityLockScreenView: View {
  let context: ActivityViewContext<FocusActivityAttributes>

  var body: some View {
    ZStack {
      FocusLiveActivityPaperBackground()

      VStack(alignment: .leading, spacing: 11) {
        HStack(alignment: .center, spacing: 10) {
          FocusLiveActivityMark(size: 29)

          VStack(alignment: .leading, spacing: 2) {
            FocusLiveActivityStatusLabel(isPaused: context.state.isPaused)
            Text(context.state.title)
              .font(.headline)
              .foregroundStyle(FocusLiveActivityPalette.ink)
              .lineLimit(1)
          }

          Spacer()

          if #available(iOS 17.0, *) {
            FocusLiveActivityControlButton(context: context)
          }
        }

        HStack(alignment: .firstTextBaseline, spacing: 8) {
          FocusLiveActivityTimerValue(context: context, size: 34)

          Text("경과")
            .font(.subheadline.weight(.medium))
            .foregroundStyle(FocusLiveActivityPalette.ink.opacity(0.55))

          Spacer()

          if let targetFocusMinutes = context.state.targetFocusMinutes {
            FocusLiveActivityTargetLabel(minutes: targetFocusMinutes)
          }
        }
        .foregroundStyle(FocusLiveActivityPalette.ink)
      }
      .padding(16)
    }
    .activityBackgroundTint(FocusLiveActivityPalette.paper)
    .activitySystemActionForegroundColor(FocusLiveActivityPalette.ink)
    .widgetURL(deepLinkURL(context))
  }
}

@available(iOS 16.1, *)
private struct FocusLiveActivityStandByView: View {
  let context: ActivityViewContext<FocusActivityAttributes>

  var body: some View {
    ZStack {
      FocusLiveActivityPaperBackground(lineSpacing: 22, showsMarginLine: true)

      VStack(spacing: 6) {
        HStack(spacing: 8) {
          FocusLiveActivityStatusLabel(isPaused: context.state.isPaused)

          Text(context.state.title)
            .font(.system(size: 16, weight: .bold, design: .rounded))
            .foregroundStyle(FocusLiveActivityPalette.ink)
            .lineLimit(1)
            .minimumScaleFactor(0.72)

          Spacer(minLength: 8)

          if let targetFocusMinutes = context.state.targetFocusMinutes {
            FocusLiveActivityTargetLabel(minutes: targetFocusMinutes)
          }
        }

        FocusLiveActivityTimerValue(context: context, size: 46)
          .foregroundStyle(FocusLiveActivityPalette.ink)
          .frame(maxWidth: .infinity)

        HStack(spacing: 12) {
          VStack(alignment: .leading, spacing: 4) {
            HStack {
              Text(context.state.isPaused ? "멈춘 시간" : "현재 집중")
              Spacer()
              Text(context.state.isPaused ? "일시정지됨" : "진행 중")
            }
            .font(.system(size: 9, weight: .medium, design: .rounded))
            .foregroundStyle(FocusLiveActivityPalette.ink.opacity(0.58))

            FocusLiveActivityProgressView(context: context)
              .frame(height: 8)
          }
          .frame(maxWidth: .infinity)

          if #available(iOS 17.0, *) {
            FocusLiveActivityStandByControlButton(context: context)
          }
        }
      }
      .padding(.leading, 34)
      .padding(.trailing, 14)
      .padding(.vertical, 10)
    }
    .foregroundStyle(FocusLiveActivityPalette.ink)
    .accessibilityElement(children: .contain)
  }
}

@available(iOS 16.1, *)
private struct FocusLiveActivityPresentationView: View {
  @Environment(\.isActivityFullscreen) private var isActivityFullscreen
  @Environment(\.showsWidgetContainerBackground) private var showsWidgetContainerBackground

  let context: ActivityViewContext<FocusActivityAttributes>

  /**
   * StandBy는 iOS 버전에 따라 전체 화면 여부를 직접 알리거나 잠금화면 뷰의 컨테이너 배경을 제거해 확대한다.
   * 두 환경값을 함께 확인해 어느 방식에서도 가로 전용 레이아웃을 선택한다.
   */
  private var usesStandByLayout: Bool {
    isActivityFullscreen || !showsWidgetContainerBackground
  }

  @ViewBuilder
  var body: some View {
    if usesStandByLayout {
      FocusLiveActivityStandByView(context: context)
        .transition(.opacity.combined(with: .scale(scale: 0.98)))
        .activityBackgroundTint(FocusLiveActivityPalette.paper)
        .activitySystemActionForegroundColor(FocusLiveActivityPalette.ink)
        .widgetURL(deepLinkURL(context))
    } else {
      FocusLiveActivityLockScreenView(context: context)
    }
  }
}

@available(iOS 16.1, *)
private struct FocusLiveActivityExpandedView: View {
  let context: ActivityViewContext<FocusActivityAttributes>

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 5) {
        Circle()
          .fill(context.state.isPaused ? FocusLiveActivityPalette.orange : FocusLiveActivityPalette.green)
          .frame(width: 5, height: 5)
        Text(context.state.isPaused ? "잠시 멈춤" : "집중 중")
          .font(.caption2.weight(.semibold))
          .foregroundStyle(Color.white.opacity(0.68))
      }

      HStack(spacing: 5) {
        FocusLiveActivityTimerValue(context: context, size: 20)
      }
      .foregroundStyle(Color.white)

      Text(context.state.title)
        .font(.caption.weight(.medium))
        .foregroundStyle(Color.white.opacity(0.82))
        .lineLimit(1)
    }
  }
}

/**
 * 집중 중인 할 일의 경과 시간과 목표를 잠금화면, 가로 StandBy, Dynamic Island에 표시한다.
 * StandBy에서는 작업명을 상단, 타이머를 중앙, 진행선과 조작 버튼을 하단에 배치하며,
 * 일시정지·재개와 작업 화면 이동은 모든 표시 영역에서 같은 Live Activity 상태를 사용한다.
 */
@main
@available(iOS 16.1, *)
struct FocusLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: FocusActivityAttributes.self) { context in
      FocusLiveActivityPresentationView(context: context)
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
                .foregroundStyle(
                  context.state.isPaused
                    ? FocusLiveActivityPalette.orange
                    : FocusLiveActivityPalette.green
                )
            }
          }
        }

        DynamicIslandExpandedRegion(.bottom) {
          Link(destination: url) {
            VStack(alignment: .leading, spacing: 7) {
              Rectangle()
                .fill(FocusLiveActivityPalette.rule.opacity(0.32))
                .frame(height: 1)

              HStack {
                Text("작업 화면으로 이동")
                  .font(.caption.weight(.medium))
                  .foregroundStyle(Color.white.opacity(0.82))
                Spacer()
                if let targetFocusMinutes = context.state.targetFocusMinutes {
                  Text("목표 \(targetFocusMinutes)분")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(FocusLiveActivityPalette.orange)
                }
              }
            }
          }
        }
      } compactLeading: {
        Link(destination: url) {
          FocusLiveActivityMark(size: 22)
        }
        .accessibilityLabel("데일로 열기")
      } compactTrailing: {
        if #available(iOS 17.0, *) {
          FocusLiveActivityControlButton(context: context, compact: true)
        } else {
          Link(destination: url) {
            Image(systemName: context.state.isPaused ? "play.fill" : "pause.fill")
              .foregroundStyle(
                context.state.isPaused
                  ? FocusLiveActivityPalette.green
                  : FocusLiveActivityPalette.red
              )
          }
        }
      } minimal: {
        if #available(iOS 17.0, *) {
          FocusLiveActivityControlButton(context: context, compact: true)
        } else {
          Link(destination: url) {
            Image(systemName: context.state.isPaused ? "play.fill" : "pause.fill")
              .foregroundStyle(
                context.state.isPaused
                  ? FocusLiveActivityPalette.green
                  : FocusLiveActivityPalette.red
              )
          }
        }
      }
    }
  }
}
