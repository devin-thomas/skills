import AppKit
import Darwin
import QuartzCore

/// `--bench`: times 120 warm-up and 600 measured frames of the app's real hot path, writes bench.txt beside the
/// app bundle and quits.
@MainActor
final class Bench {
    private let warmUp: Int = 120
    private let measured: Int = 600
    private var stamps: [CFTimeInterval] = []

    /// Nil unless the arguments include `--bench`.
    init?(arguments: [String]) {
        guard arguments.contains("--bench") else { return nil }
        stamps.reserveCapacity(warmUp + measured + 1)
    }

    /// Records one frame callback; writes the report and quits after the last one.
    func record(now: CFTimeInterval) -> Void {
        guard stamps.count <= warmUp + measured else { return }
        stamps.append(now)
        if stamps.count == warmUp + measured + 1 { finish() }
    }

    private func finish() -> Void {
        let times: [CFTimeInterval] = Array(stamps.dropFirst(warmUp))
        let frames: [Double] = zip(times.dropFirst(), times).map { (next: Double, previous: Double) -> Double in
            next - previous
        }
        let report: String = BenchReport(frames: frames).text(target: FrameClock.fastestConnectedRate())
        let url: URL = Bundle.main.bundleURL.deletingLastPathComponent().appendingPathComponent("bench.txt")
        do {
            try report.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            FileHandle.standardError.write(Data("bench: could not write \(url.path): \(error)\n".utf8))
        }
        NSApplication.shared.terminate(nil)
    }
}

/// The numbers bench.txt reports, from measured frame times in seconds. It reads AppKit, so it runs on the main actor.
@MainActor
struct BenchReport {
    let frames: [Double]

    func text(target: Int) -> String {
        let sorted: [Double] = frames.sorted()
        let median: Double = sorted[sorted.count / 2]
        let slowest: ArraySlice<Double> = sorted.suffix(max(sorted.count / 100, 1))
        let average: Double = Double(frames.count) / frames.reduce(0, +)
        let low: Double = Double(slowest.count) / slowest.reduce(0, +)
        let hitches: Int = frames.filter { (frame: Double) -> Bool in frame > 1.5 * median }.count
        let screens: String = NSScreen.screens.map { (screen: NSScreen) -> String in
            "\(screen.localizedName) \(screen.maximumFramesPerSecond) Hz"
        }.joined(separator: ", ")
        let window: String =
            NSApplication.shared.windows.first?.screen.map { (screen: NSScreen) -> String in
                "\(screen.localizedName) \(screen.maximumFramesPerSecond) Hz"
            } ?? "unknown"
        let frontmost: String = NSWorkspace.shared.frontmostApplication?.localizedName ?? "unknown"
        return """
            app: \(Bundle.main.bundleURL.lastPathComponent)
            bundle size: \(bundleKilobytes()) KB
            screens: \(screens)
            window screen: \(window)
            target fps: \(target) (fastest connected screen)
            frames: \(frames.count)
            median frame time: \(String(format: "%.2f", median * 1000)) ms
            avg fps: \(String(format: "%.1f", average))
            1% low fps: \(String(format: "%.1f", low))
            worst frame fps: \(String(format: "%.1f", 1 / sorted[sorted.count - 1]))
            hitches (frame time > 1.5x median): \(hitches)
            peak memory: \(String(format: "%.1f", peakMegabytes())) MB
            frontmost app at finish: \(frontmost)

            """
    }

    private func peakMegabytes() -> Double {
        var usage: rusage = rusage()
        getrusage(RUSAGE_SELF, &usage)
        return Double(usage.ru_maxrss) / 1_048_576  // bytes on macOS
    }

    private func bundleKilobytes() -> Int {
        let files: FileManager.DirectoryEnumerator? = FileManager.default.enumerator(
            at: Bundle.main.bundleURL,
            includingPropertiesForKeys: [.fileSizeKey]
        )
        var bytes: Int = 0
        while let file = files?.nextObject() as? URL {
            bytes += (try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        }
        return bytes / 1024
    }
}
