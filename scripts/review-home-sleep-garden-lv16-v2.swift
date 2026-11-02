import AppKit
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let frames = root.appendingPathComponent("assets/pixelPet/sourceFrames/sleep_garden_lv16/v2/packed320")
let previews = root.appendingPathComponent("tasks/previews")

// Encode the packed frames at Home's 3.8s/4.8s timings, including its final fade.
for (kind, duration) in [("growth", 3.8), ("decay", 4.8)] {
    let url = previews.appendingPathComponent("home_sleep_garden_lv16-\(kind)-v2.gif")
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.gif.identifier as CFString, 16, nil) else {
        fatalError("Cannot create GIF: \(url.path)")
    }
    CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
    for index in 0..<16 {
        let image = NSImage(contentsOf: frames.appendingPathComponent(String(format: "%@%02d.png", kind, index)))!
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 320, pixelsHigh: 320, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)!
        NSColor(calibratedRed: 245.0 / 255, green: 239.0 / 255, blue: 229.0 / 255, alpha: 1).setFill()
        let rect = NSRect(x: 0, y: 0, width: 320, height: 320)
        rect.fill()
        let opacity = kind == "decay" ? min(1, (1 - Double(index) / 15) / 0.2) : 1
        image.draw(in: rect, from: .zero, operation: .sourceOver, fraction: opacity)
        NSGraphicsContext.restoreGraphicsState()
        CGImageDestinationAddImage(destination, bitmap.cgImage!, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: duration / 16, kCGImagePropertyGIFUnclampedDelayTime: duration / 16]] as CFDictionary)
    }
    guard CGImageDestinationFinalize(destination) else { fatalError("GIF write failed") }
    print(url.path)
}
