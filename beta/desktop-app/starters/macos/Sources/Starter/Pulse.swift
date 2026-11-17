import Foundation
import Observation

/// Time-based motion for the detail ring. It advances by elapsed seconds, so it moves at the same speed at any
/// refresh rate.
@Observable
@MainActor
final class Pulse {
    private(set) var angle: Double = 0
    private(set) var isRunning: Bool = false
    private var lastTime: Double?

    /// One full turn every two seconds.
    private let degreesPerSecond: Double = 180

    func toggle() -> Void {
        isRunning.toggle()
        lastTime = nil
    }

    func advance(to time: Double) -> Void {
        defer { lastTime = time }
        guard let lastTime else { return }
        angle = (angle + (time - lastTime) * degreesPerSecond).truncatingRemainder(dividingBy: 360)
    }
}
