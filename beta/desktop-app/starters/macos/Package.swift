// swift-tools-version: 6.2
import PackageDescription

let package: Package = Package(
    name: "Starter",
    platforms: [.macOS("26.0")],
    targets: [
        .executableTarget(name: "Starter", path: "Sources/Starter")
    ]
)
