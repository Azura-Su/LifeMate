import AppKit
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let frames = root.appendingPathComponent("assets/pixelPet/sourceFrames/sleep_garden_lv08/review320")
let previews = root.appendingPathComponent("tasks/previews")
try FileManager.default.createDirectory(at: previews, withIntermediateDirectories: true)

for (prefix, name, centiseconds) in [("frame", "growth", 380), ("decay", "decay", 480)] {
    let urls = (0..<16).map { frames.appendingPathComponent(String(format: "\(prefix)%02d.png", $0)) }
    guard urls.allSatisfy({ FileManager.default.fileExists(atPath: $0.path) }) else {
        print("Skipping incomplete \(name) sequence")
        continue
    }
    let output = previews.appendingPathComponent("celestial-stag-lv08-\(name)-review.gif")
    guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.gif.identifier as CFString, 16, nil) else {
        fatalError("Cannot create \(output.path)")
    }
    CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
    for (index, url) in urls.enumerated() {
        guard let image = NSImage(contentsOf: url) else { fatalError("Cannot read \(url.path)") }
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 320, pixelsHigh: 320, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        NSColor(calibratedRed: 243 / 255, green: 239 / 255, blue: 229 / 255, alpha: 1).setFill()
        NSRect(x: 0, y: 0, width: 320, height: 320).fill()
        image.draw(in: NSRect(x: 0, y: 0, width: 320, height: 320), from: .zero, operation: .sourceOver, fraction: 1)
        NSGraphicsContext.restoreGraphicsState()
        let delay = Double((index + 1) * centiseconds / 16 - index * centiseconds / 16) / 100
        CGImageDestinationAddImage(destination, bitmap.cgImage!, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: delay, kCGImagePropertyGIFUnclampedDelayTime: delay]] as CFDictionary)
    }
    guard CGImageDestinationFinalize(destination) else { fatalError("GIF write failed") }
    let encoded = CGImageSourceCreateWithURL(output as CFURL, nil)!
    precondition(CGImageSourceGetCount(encoded) == 16, "GIF frame count changed")
    let duration = (0..<16).reduce(0.0) { total, index in
        let properties = CGImageSourceCopyPropertiesAtIndex(encoded, index, nil)! as NSDictionary
        let gif = properties[kCGImagePropertyGIFDictionary] as! NSDictionary
        return total + (gif[kCGImagePropertyGIFUnclampedDelayTime] as! NSNumber).doubleValue
    }
    precondition(abs(duration - Double(centiseconds) / 100) < 0.001, "GIF timing changed")
    print("\(output.path): 16 frames, \(Double(centiseconds) / 100)s")
}
