import AppKit
import QuartzCore
import SwiftUI

/// Runs per-frame work at the fastest connected display's refresh rate. macOS caps a display link at the
/// refresh rate of the screen its window is on, so a window on a slower screen gets that screen's maximum.
@MainActor
final class FrameClock: NSObject {
    private(set) var targetRate: Int = 0
    var tick: (CFTimeInterval) -> Void
    private var link: CADisplayLink?
    private var screensObserver: NSObjectProtocol?

    init(tick: @escaping (CFTimeInterval) -> Void) {
        self.tick = tick
    }

    /// The highest refresh rate among all connected screens: 144 beats 120.
    static func fastestConnectedRate() -> Int {
        let rates: [Int] = NSScreen.screens.map { (screen: NSScreen) -> Int in screen.maximumFramesPerSecond }
        return rates.max() ?? 60
    }

    /// Starts ticking for `view`'s window; does nothing if already ticking. The display link retains this
    /// clock until `stop()`, so the owner must call it when the motion ends or the view goes away.
    func start(in view: NSView) -> Void {
        guard link == nil else { return }
        targetRate = FrameClock.fastestConnectedRate()
        let rate: Float = Float(targetRate)
        let link: CADisplayLink = view.displayLink(target: self, selector: #selector(step(_:)))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: rate, maximum: rate, preferred: rate)
        link.add(to: .main, forMode: .common)
        self.link = link
        // A display was plugged in, removed or changed mode: re-read the fastest rate.
        screensObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didChangeScreenParametersNotification,
            object: nil,
            queue: .main
        ) { [weak self, weak view] (_: Notification) -> Void in
            MainActor.assumeIsolated {
                guard let self, let view else { return }
                self.stop()
                self.start(in: view)
            }
        }
    }

    func stop() -> Void {
        link?.invalidate()
        link = nil
        if let screensObserver {
            NotificationCenter.default.removeObserver(screensObserver)
        }
        screensObserver = nil
    }

    @objc private func step(_ link: CADisplayLink) -> Void {
        tick(link.targetTimestamp)
    }
}

/// The AppKit view a FrameClock ticks for. It starts the clock once it is in a window and running.
final class FrameClockHostView: NSView {
    var clock: FrameClock?
    var isRunning: Bool = false {
        didSet { sync() }
    }

    override func viewDidMoveToWindow() -> Void {
        super.viewDidMoveToWindow()
        sync()
    }

    private func sync() -> Void {
        guard let clock else { return }
        if isRunning, window != nil {
            clock.start(in: self)
        } else {
            clock.stop()
        }
    }
}

/// Puts a FrameClock behind a SwiftUI view. The clock runs only while `isRunning` is true.
struct FrameClockView: NSViewRepresentable {
    var isRunning: Bool
    var tick: (CFTimeInterval) -> Void

    func makeCoordinator() -> FrameClock {
        FrameClock(tick: tick)
    }

    func makeNSView(context: Context) -> FrameClockHostView {
        let view: FrameClockHostView = FrameClockHostView()
        view.clock = context.coordinator
        return view
    }

    func updateNSView(_ view: FrameClockHostView, context: Context) -> Void {
        context.coordinator.tick = tick
        view.isRunning = isRunning
    }

    static func dismantleNSView(_ view: FrameClockHostView, coordinator: FrameClock) -> Void {
        coordinator.stop()
    }
}
