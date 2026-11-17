/// One row of the sample list.
struct Item: Identifiable {
    let id: Int
    let title: String
    let symbol: String

    static func samples(count: Int) -> [Item] {
        let symbols: [String] = ["sparkles", "leaf", "bolt", "cloud", "flame", "drop", "moon", "star"]
        return (0..<count).map { (index: Int) -> Item in
            Item(id: index, title: "Item \(index + 1)", symbol: symbols[index % symbols.count])
        }
    }
}
