import QuartzCore
import SwiftUI

struct ContentView: View {
    let items: [Item]
    let bench: Bench?

    @State private var selection: Item.ID? = 0
    @State private var query: String = ""
    @State private var pulse: Pulse = Pulse()
    @AppStorage("showsSymbols") private var showsSymbols: Bool = true

    private var visibleItems: [Item] {
        guard !query.isEmpty else { return items }
        return items.filter { (item: Item) -> Bool in item.title.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationSplitView {
            List(visibleItems, selection: $selection) { (item: Item) in
                if showsSymbols {
                    Label(item.title, systemImage: item.symbol)
                } else {
                    Text(item.title)
                }
            }
            .navigationSplitViewColumnWidth(min: 200, ideal: 240)
            .searchable(text: $query, placement: .sidebar)
        } detail: {
            ItemDetail(item: items.first { (item: Item) -> Bool in item.id == selection }, angle: pulse.angle)
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(pulse.isRunning ? "Pause" : "Animate", systemImage: pulse.isRunning ? "pause.fill" : "play.fill")
                {
                    pulse.toggle()
                }
                .keyboardShortcut(.space, modifiers: [])
            }
        }
        .background {
            FrameClockView(isRunning: pulse.isRunning || bench != nil) { (time: CFTimeInterval) -> Void in
                step(at: time)
            }
        }
        .onAppear {
            if bench != nil, !pulse.isRunning { pulse.toggle() }
        }
    }

    /// One frame: advance motion, and under `--bench` also move the selection like a user arrowing down the list.
    private func step(at time: CFTimeInterval) -> Void {
        pulse.advance(to: time)
        guard let bench else { return }
        selection = ((selection ?? 0) + 1) % items.count
        bench.record(now: CACurrentMediaTime())
    }
}

struct ItemDetail: View {
    let item: Item?
    let angle: Double

    var body: some View {
        if let item {
            VStack(spacing: 20) {
                ZStack {
                    Circle()
                        .stroke(.quaternary, lineWidth: 10)
                    Circle()
                        .trim(from: 0, to: 0.25)
                        .stroke(.tint, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                        .rotationEffect(.degrees(angle))
                    Image(systemName: item.symbol)
                        .font(.system(size: 44))
                        .foregroundStyle(.tint)
                }
                .frame(width: 140, height: 140)
                Text(item.title)
                    .font(.title)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ContentUnavailableView(
                "No Selection", systemImage: "sidebar.left", description: Text("Pick an item from the sidebar."))
        }
    }
}

struct SettingsView: View {
    @AppStorage("showsSymbols") private var showsSymbols: Bool = true

    var body: some View {
        Form {
            Toggle("Show symbols in the sidebar", isOn: $showsSymbols)
        }
        .formStyle(.grouped)
        .frame(width: 360)
    }
}
