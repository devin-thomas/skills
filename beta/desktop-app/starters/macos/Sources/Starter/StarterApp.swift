import AppKit
import SwiftUI

@main
struct StarterApp: App {
    @NSApplicationDelegateAdaptor(StarterAppDelegate.self) private var appDelegate: StarterAppDelegate

    var body: some Scene {
        WindowGroup("Starter") {
            ContentView(items: Item.samples(count: 1_000), bench: appDelegate.bench)
                .frame(minWidth: 640, minHeight: 420)
        }
        .defaultSize(width: 860, height: 560)

        Settings {
            SettingsView()
        }
    }
}

/// Owns the launch-wide bench, which `--bench` turns on for this process only.
@MainActor
final class StarterAppDelegate: NSObject, NSApplicationDelegate {
    let bench: Bench? = Bench(arguments: CommandLine.arguments)

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
