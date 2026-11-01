import AppKit
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let sourceRoot = root.appendingPathComponent("assets/pixelPet/sourceFrames/celestial_stag_lv1516")
let previewRoot = root.appendingPathComponent("tasks/previews")
let animationRoot = root.appendingPathComponent("assets/pixelPet/animations")
let cell = 320
let sourceSize = 224
let sourceOrigin = 48
let sourceBottom = 32

struct Group {
    let name: String
    let uniqueFrames: Int
}

let groups = [
    Group(name: "walk", uniqueFrames: 8),
    Group(name: "run", uniqueFrames: 8),
    Group(name: "flight", uniqueFrames: 16),
    Group(name: "sleep", uniqueFrames: 16),
]

func makeCanvas(background: NSColor = .clear) -> NSBitmapImageRep {
    let canvas = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: cell * 4,
        pixelsHigh: cell * 4,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    )!
    NSGraphicsContext.saveGraphicsState()
    let context = NSGraphicsContext(bitmapImageRep: canvas)!
    NSGraphicsContext.current = context
    background.setFill()
    NSRect(x: 0, y: 0, width: cell * 4, height: cell * 4).fill()
    NSGraphicsContext.restoreGraphicsState()
    return canvas
}

func draw(_ source: URL, into canvas: NSBitmapImageRep, slot: Int) throws {
    guard let image = NSImage(contentsOf: source) else {
        throw NSError(domain: "CelestialStagReview", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot read \(source.path)"])
    }
    let col = slot % 4
    let rowFromTop = slot / 4
    let scale = min(CGFloat(sourceSize) / image.size.width, CGFloat(sourceSize) / image.size.height)
    let drawWidth = image.size.width * scale
    let drawHeight = image.size.height * scale
    let rect = NSRect(
        x: CGFloat(col * cell + sourceOrigin) + (CGFloat(sourceSize) - drawWidth) / 2,
        y: CGFloat((3 - rowFromTop) * cell + sourceBottom) + CGFloat(sourceSize) - drawHeight,
        width: drawWidth,
        height: drawHeight
    )
    NSGraphicsContext.saveGraphicsState()
    let context = NSGraphicsContext(bitmapImageRep: canvas)!
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    image.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
}

func writePNG(_ image: NSBitmapImageRep, to url: URL) throws {
    guard let data = image.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "CelestialStagReview", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot encode PNG at \(url.path)"])
    }
    try data.write(to: url)
}

func writeGIF(_ frames: [URL], to url: URL, delays: [Double]) throws {
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.gif.identifier as CFString, frames.count, nil) else {
        throw NSError(domain: "CelestialStagReview", code: 3, userInfo: [NSLocalizedDescriptionKey: "Cannot create GIF at \(url.path)"])
    }
    CGImageDestinationSetProperties(destination, [
        kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0],
    ] as CFDictionary)
    for (index, frameURL) in frames.enumerated() {
        guard let source = CGImageSourceCreateWithURL(frameURL as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            throw NSError(domain: "CelestialStagReview", code: 4, userInfo: [NSLocalizedDescriptionKey: "Cannot read GIF frame \(frameURL.path)"])
        }
        let delay = delays[min(index, delays.count - 1)]
        CGImageDestinationAddImage(destination, image, [
            kCGImagePropertyGIFDictionary: [
                kCGImagePropertyGIFDelayTime: delay,
                kCGImagePropertyGIFUnclampedDelayTime: delay,
            ],
        ] as CFDictionary)
    }
    guard CGImageDestinationFinalize(destination) else {
        throw NSError(domain: "CelestialStagReview", code: 5, userInfo: [NSLocalizedDescriptionKey: "Cannot finalize GIF at \(url.path)"])
    }
}

func frameURL(group: Group, index: Int) -> URL {
    sourceRoot
        .appendingPathComponent(group.name)
        .appendingPathComponent(String(format: "frame-%02d-source.png", index + 1))
}

try FileManager.default.createDirectory(at: previewRoot, withIntermediateDirectories: true)
for group in groups {
    let groupDirectory = sourceRoot.appendingPathComponent(group.name)
    guard FileManager.default.fileExists(atPath: groupDirectory.path) else {
        print("\(group.name): skipped; no source frames yet")
        continue
    }
    let totalSlots = 16
    let uniqueURLs = (0..<group.uniqueFrames).map { frameURL(group: group, index: $0) }
    let complete = uniqueURLs.allSatisfy { FileManager.default.fileExists(atPath: $0.path) }
    let contact = makeCanvas(background: NSColor(calibratedRed: 0.965, green: 0.94, blue: 0.89, alpha: 1))
    var missing = 0
    for slot in 0..<totalSlots {
        let index = slot % group.uniqueFrames
        let source = frameURL(group: group, index: index)
        guard FileManager.default.fileExists(atPath: source.path) else {
            missing += 1
            continue
        }
        try draw(source, into: contact, slot: slot)
    }

    let prefix = "celestial-stag-lv1516-\(group.name)"
    let contactURL = previewRoot.appendingPathComponent("\(prefix)-contact.png")
    try writePNG(contact, to: contactURL)
    print("\(group.name): contact sheet at \(contactURL.path); missing atlas slots: \(missing)")

    guard complete else { continue }

    let atlas = makeCanvas()
    for slot in 0..<totalSlots {
        try draw(frameURL(group: group, index: slot % group.uniqueFrames), into: atlas, slot: slot)
    }
    let atlasURL = animationRoot.appendingPathComponent("celestial_stag_lv1516_\(group.name).png")
    try writePNG(atlas, to: atlasURL)

    if group.name == "walk" || group.name == "run" {
        let delay = group.name == "walk" ? 0.1 : 0.0625
        try writeGIF(uniqueURLs, to: previewRoot.appendingPathComponent("\(prefix).gif"), delays: Array(repeating: delay, count: group.uniqueFrames))
    } else if group.name == "flight" {
        let phases: [(String, Range<Int>, Double)] = [
            ("takeoff", 0..<4, 0.35),
            ("flap", 4..<8, 0.18),
            ("glide", 8..<12, 0.825),
            ("landing", 12..<16, 0.35),
        ]
        for (phase, indices, delay) in phases {
            let frames = indices.map { frameURL(group: group, index: $0) }
            try writeGIF(frames, to: previewRoot.appendingPathComponent("\(prefix)-\(phase).gif"), delays: Array(repeating: delay, count: frames.count))
        }
    } else {
        let settle = Array(uniqueURLs.prefix(12))
        try writeGIF(settle, to: previewRoot.appendingPathComponent("\(prefix)-settle.gif"), delays: Array(repeating: 0.2, count: settle.count))
        let breath = Array(uniqueURLs.suffix(4))
        try writeGIF(breath, to: previewRoot.appendingPathComponent("\(prefix)-breath.gif"), delays: Array(repeating: 0.5, count: breath.count))
    }

    print("\(group.name): atlas and GIF previews written")
}
