import SwiftUI
import WidgetKit

struct QuickLogEntry: TimelineEntry { let date: Date }

struct QuickLogProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickLogEntry { QuickLogEntry(date: Date()) }
    func getSnapshot(in context: Context, completion: @escaping (QuickLogEntry) -> Void) {
        completion(QuickLogEntry(date: Date()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickLogEntry>) -> Void) {
        completion(Timeline(entries: [QuickLogEntry(date: Date())], policy: .never))
    }
}

struct QuickLogView: View {
    @Environment(\.colorScheme) var colorScheme
    private var green: Color { colorScheme == .dark ? Color(red: 0.78, green: 0.88, blue: 0.68) : Color(red: 0.19, green: 0.36, blue: 0.26) }
    private var background: Color { colorScheme == .dark ? Color(red: 0.12, green: 0.20, blue: 0.16) : Color(red: 0.96, green: 0.97, blue: 0.92) }

    private func shortcut(_ title: String, symbol: String, action: String) -> some View {
        Link(destination: URL(string: "bellywise://quick-log/\(action)")!) {
            VStack(spacing: 8) {
                Image(systemName: symbol).font(.system(size: 23, weight: .medium))
                Text(title).font(.system(size: 12, weight: .semibold)).multilineTextAlignment(.center).lineLimit(2)
            }
            .frame(maxWidth: .infinity, minHeight: 65)
            .foregroundStyle(green)
            .padding(.vertical, 4)
            .background(green.opacity(0.09), in: RoundedRectangle(cornerRadius: 14))
        }
        .accessibilityLabel(title)
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("bellywise", systemImage: "leaf").font(.system(size: 21, weight: .medium, design: .serif)).foregroundStyle(green)
            HStack(spacing: 8) {
                shortcut("Food or drink", symbol: "fork.knife", action: "food")
                shortcut("Log a feeling", symbol: "face.smiling", action: "feeling")
                shortcut("Review day", symbol: "checkmark.circle", action: "review")
            }
        }
    }

    var body: some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(background, for: .widget)
        } else {
            content.padding(16).background(background)
        }
    }
}

@main
struct BellywiseQuickLog: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "BellywiseQuickLog", provider: QuickLogProvider()) { _ in QuickLogView() }
            .configurationDisplayName("Bellywise quick log")
            .description("Log food or drinks, record how you feel, or review your day.")
            .supportedFamilies([.systemMedium])
    }
}
