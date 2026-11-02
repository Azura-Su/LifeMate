import AppKit
import ImageIO
import UniformTypeIdentifiers

// Review assets only; does not write to the runtime animation directory.
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let previewDir = root.appendingPathComponent("tasks/previews")
let prefix = "celestial-stag-lv10-sleep-scene"

func readFrame(_ kind: String, _ index: Int) -> CGImage {
    let url = previewDir.appendingPathComponent("\(prefix)-\(kind)-atlas-candidate.png")
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let atlas = CGImageSourceCreateImageAtIndex(source, 0, nil),
          let image = atlas.cropping(to: CGRect(x: (index % 4) * 320, y: (index / 4) * 320, width: 320, height: 320)) else { fatalError("Missing \(url.path)") }
    // Opaque review background prevents GIF disposal artifacts in transparent areas.
    let context = CGContext(data: nil, width: 320, height: 320, bitsPerComponent: 8,
        bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
    context.setFillColor(CGColor(red: 245/255, green: 239/255, blue: 229/255, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: 320, height: 320))
    context.draw(image, in: CGRect(x: 0, y: 0, width: 320, height: 320))
    return context.makeImage()!
}

func makeGIF(_ name: String, _ frames: [(String, Int, Double)]) {
    let url = previewDir.appendingPathComponent("\(prefix)-\(name).gif")
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.gif.identifier as CFString, frames.count, nil) else { fatalError("Cannot create GIF") }
    CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
    for (kind, index, delay) in frames {
        CGImageDestinationAddImage(destination, readFrame(kind, index),
            [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: delay,
                kCGImagePropertyGIFUnclampedDelayTime: delay]] as CFDictionary)
    }
    guard CGImageDestinationFinalize(destination) else { fatalError("Cannot finish GIF") }
    print(url.path)
}

let growth = (0..<16).map { ("growth", $0, 3.8/16) }
let decay = (0..<16).map { ("decay", $0, 4.8/16) }
makeGIF("growth", growth)
makeGIF("decay", decay)
makeGIF("cycle", growth + [("growth", 15, 1.0)] + decay + [("decay", 15, 0.6)])

let strip = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 1680, pixelsHigh: 196,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: strip)!
NSColor(red: 245/255, green: 239/255, blue: 229/255, alpha: 1).setFill()
NSRect(x: 0, y: 0, width: 1680, height: 196).fill()
for (slot, level) in stride(from: 2, through: 20, by: 2).enumerated() {
    let filename = level == 2 ? "home_sleep_garden.png" : String(format: "home_sleep_garden_lv%02d.png", level)
    let url = level == 10 ? previewDir.appendingPathComponent("\(prefix)-growth-atlas-candidate.png") :
        root.appendingPathComponent("assets/pixelPet/animations/\(filename)")
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let atlas = CGImageSourceCreateImageAtIndex(source, 0, nil),
          let mature = atlas.cropping(to: CGRect(x: 960, y: 960, width: 320, height: 320)) else { fatalError("Missing tier \(level)") }
    NSImage(cgImage: mature, size: NSSize(width: 320, height: 320)).draw(in: NSRect(x: slot * 168, y: 28, width: 168, height: 168))
    ("Lv\(level)" as NSString).draw(at: NSPoint(x: slot * 168 + 65, y: 7),
        withAttributes: [.font: NSFont.systemFont(ofSize: 14), .foregroundColor: NSColor.darkGray])
}
NSGraphicsContext.restoreGraphicsState()
try strip.representation(using: .png, properties: [:])!.write(to: previewDir.appendingPathComponent("\(prefix)-tier-comparison.png"))
