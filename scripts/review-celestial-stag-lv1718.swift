import AppKit
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let sourceRoot = root.appendingPathComponent("assets/pixelPet/sourceFrames/celestial_stag_lv1718")
let previewRoot = root.appendingPathComponent("tasks/previews")
let animationRoot = root.appendingPathComponent("assets/pixelPet/animations")
let cell = 320
let maxSpriteSize = 224
let hoofInset = 32
var commonSpriteScale: CGFloat = 1

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

func canvas() -> NSBitmapImageRep {
    NSBitmapImageRep(
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
}

func alphaBounds(_ source: URL) throws -> CGRect {
    guard let image = NSImage(contentsOf: source),
          let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        throw NSError(domain: "CelestialStagReview", code: 9, userInfo: [NSLocalizedDescriptionKey: "Cannot inspect \(source.path)"])
    }
    let rep = NSBitmapImageRep(cgImage: cgImage)
    guard let pixels = rep.bitmapData else {
        throw NSError(domain: "CelestialStagReview", code: 10, userInfo: [NSLocalizedDescriptionKey: "Cannot read pixels in \(source.path)"])
    }
    let width = rep.pixelsWide
    let height = rep.pixelsHigh
    let samples = rep.samplesPerPixel
    let bytesPerPixel = max(1, rep.bitsPerPixel / 8)
    var minX = width
    var minY = height
    var maxX = -1
    var maxY = -1
    for y in 0..<height {
        for x in 0..<width {
            if pixels[y * rep.bytesPerRow + x * bytesPerPixel + (samples - 1)] > 8 {
                minX = min(minX, x)
                minY = min(minY, y)
                maxX = max(maxX, x)
                maxY = max(maxY, y)
            }
        }
    }
    guard maxX >= minX, maxY >= minY else {
        throw NSError(domain: "CelestialStagReview", code: 11, userInfo: [NSLocalizedDescriptionKey: "No visible character in \(source.path)"])
    }
    return CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
}

func sourceURL(group: Group, index: Int) -> URL {
    sourceRoot
        .appendingPathComponent(group.name)
        .appendingPathComponent(String(format: "%@-%02d-source.png", group.name, index + 1))
}

func draw(_ source: URL, into bitmap: NSBitmapImageRep, slot: Int) throws {
    guard let image = NSImage(contentsOf: source) else {
        throw NSError(domain: "CelestialStagReview", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cannot read \(source.path)"])
    }
    guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        throw NSError(domain: "CelestialStagReview", code: 6, userInfo: [NSLocalizedDescriptionKey: "Cannot inspect alpha in \(source.path)"])
    }
    let rep = NSBitmapImageRep(cgImage: cgImage)
    guard let pixels = rep.bitmapData else {
        throw NSError(domain: "CelestialStagReview", code: 6, userInfo: [NSLocalizedDescriptionKey: "Cannot inspect alpha in \(source.path)"])
    }
    let width = rep.pixelsWide
    let height = rep.pixelsHigh
    let samples = rep.samplesPerPixel
    let bytesPerPixel = max(1, rep.bitsPerPixel / 8)
    let bytesPerRow = rep.bytesPerRow
    var minX = width
    var minY = height
    var maxX = -1
    var maxY = -1
    for y in 0..<height {
        for x in 0..<width {
            let alpha = pixels[y * bytesPerRow + x * bytesPerPixel + (samples - 1)]
            if alpha > 8 {
                minX = min(minX, x)
                minY = min(minY, y)
                maxX = max(maxX, x)
                maxY = max(maxY, y)
            }
        }
    }
    guard maxX >= minX, maxY >= minY else {
        throw NSError(domain: "CelestialStagReview", code: 7, userInfo: [NSLocalizedDescriptionKey: "No visible character in \(source.path)"])
    }
    let bounds = CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
    guard let cropped = cgImage.cropping(to: bounds) else {
        throw NSError(domain: "CelestialStagReview", code: 8, userInfo: [NSLocalizedDescriptionKey: "Cannot crop character in \(source.path)"])
    }
    let drawWidth = Int((CGFloat(cropped.width) * commonSpriteScale).rounded())
    let drawHeight = Int((CGFloat(cropped.height) * commonSpriteScale).rounded())
    let column = slot % 4
    let rowFromTop = slot / 4
    let rect = NSRect(
        x: column * cell + (cell - drawWidth) / 2,
        y: (3 - rowFromTop) * cell + hoofInset,
        width: drawWidth,
        height: drawHeight
    )
    NSGraphicsContext.saveGraphicsState()
    let context = NSGraphicsContext(bitmapImageRep: bitmap)!
    NSGraphicsContext.current = context
    context.imageInterpolation = .high
    NSImage(cgImage: cropped, size: NSSize(width: cropped.width, height: cropped.height))
        .draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1)
    NSGraphicsContext.restoreGraphicsState()
}

func writePNG(_ bitmap: NSBitmapImageRep, to url: URL) throws {
    guard let data = bitmap.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "CelestialStagReview", code: 2, userInfo: [NSLocalizedDescriptionKey: "Cannot encode PNG at \(url.path)"])
    }
    try data.write(to: url)
}

func writeGIF(atlas: NSBitmapImageRep, slots: [Int], to url: URL, delay: Double) throws {
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.gif.identifier as CFString, slots.count, nil),
          let cgImage = atlas.cgImage else {
        throw NSError(domain: "CelestialStagReview", code: 3, userInfo: [NSLocalizedDescriptionKey: "Cannot create GIF at \(url.path)"])
    }
    let atlasImage = NSImage(cgImage: cgImage, size: NSSize(width: cell * 4, height: cell * 4))
    CGImageDestinationSetProperties(destination, [
        kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0],
    ] as CFDictionary)
    for slot in slots {
        let column = slot % 4
        let rowFromTop = slot / 4
        let frame = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: cell,
            pixelsHigh: cell,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        )!
        NSGraphicsContext.saveGraphicsState()
        let context = NSGraphicsContext(bitmapImageRep: frame)!
        NSGraphicsContext.current = context
        context.imageInterpolation = .high
        atlasImage.draw(
            in: NSRect(x: 0, y: 0, width: cell, height: cell),
            from: NSRect(x: column * cell, y: (3 - rowFromTop) * cell, width: cell, height: cell),
            operation: .sourceOver,
            fraction: 1
        )
        NSGraphicsContext.restoreGraphicsState()
        guard let image = frame.cgImage else {
            throw NSError(domain: "CelestialStagReview", code: 4, userInfo: [NSLocalizedDescriptionKey: "Cannot crop atlas cell \(slot)"])
        }
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

try FileManager.default.createDirectory(at: previewRoot, withIntermediateDirectories: true)
for group in groups {
    let frames = (0..<group.uniqueFrames).map { sourceURL(group: group, index: $0) }
    let missing = frames.filter { !FileManager.default.fileExists(atPath: $0.path) }
    guard missing.isEmpty else {
        print("\(group.name): incomplete; missing \(missing.count) of \(group.uniqueFrames) source frames")
        continue
    }

    let bounds = try frames.map(alphaBounds)
    let largestDimension = bounds.map { max($0.width, $0.height) }.max() ?? CGFloat(maxSpriteSize)
    commonSpriteScale = CGFloat(maxSpriteSize) / largestDimension

    let prefix = "celestial-stag-lv1718-\(group.name)"
    let totalSlots = 16
    let sheet = canvas()
    for slot in 0..<totalSlots {
        try draw(frames[slot % group.uniqueFrames], into: sheet, slot: slot)
    }
    try writePNG(sheet, to: previewRoot.appendingPathComponent("\(prefix)-contact.png"))

    let atlas = canvas()
    for slot in 0..<totalSlots {
        try draw(frames[slot % group.uniqueFrames], into: atlas, slot: slot)
    }
    try writePNG(atlas, to: animationRoot.appendingPathComponent("celestial_stag_lv1718_\(group.name).png"))

    if group.name == "walk" || group.name == "run" {
        let delay = group.name == "walk" ? 0.1 : 0.0625
        try writeGIF(atlas: atlas, slots: Array(0..<group.uniqueFrames), to: previewRoot.appendingPathComponent("\(prefix).gif"), delay: delay)
    } else if group.name == "flight" {
        let phases: [(String, Range<Int>, Double)] = [
            ("takeoff", 0..<4, 0.35),
            ("flap", 4..<8, 0.18),
            ("glide", 8..<12, 0.825),
            ("landing", 12..<16, 0.35),
        ]
        for (phase, indices, delay) in phases {
            try writeGIF(atlas: atlas, slots: Array(indices), to: previewRoot.appendingPathComponent("\(prefix)-\(phase).gif"), delay: delay)
        }
    } else {
        try writeGIF(atlas: atlas, slots: Array(0..<12), to: previewRoot.appendingPathComponent("\(prefix)-settle.gif"), delay: 0.2)
        try writeGIF(atlas: atlas, slots: Array(12..<16), to: previewRoot.appendingPathComponent("\(prefix)-breath.gif"), delay: 0.5)
    }
    print("\(group.name): complete contact sheet, atlas, and GIF previews written")
}
