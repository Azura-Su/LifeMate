import AppKit
import ImageIO
import UniformTypeIdentifiers

// Encode review GIFs from the authored, aligned frames; never writes app assets.
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let frames = root.appendingPathComponent("assets/pixelPet/sourceFrames/sleep_garden_lv06/review320")
let previews = root.appendingPathComponent("tasks/previews")
let missingURL = frames.appendingPathComponent("missing.json")
let missing = try JSONSerialization.jsonObject(with: Data(contentsOf: missingURL)) as! [[String: Any]]

for kind in ["growth", "decay"] {
    if missing.contains(where: { $0["kind"] as? String == kind }) {
        print("Skipping incomplete \(kind) sequence")
        continue
    }
    let target = previews.appendingPathComponent("celestial-stag-lv06-\(kind)-review.gif")
    guard let destination = CGImageDestinationCreateWithURL(target as CFURL, UTType.gif.identifier as CFString, 16, nil) else {
        fatalError("Cannot create GIF")
    }
    CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
    for index in 0..<16 {
        let name = String(format: "%@%02d.png", kind == "growth" ? "frame" : "decay", index)
        guard let image = NSImage(contentsOf: frames.appendingPathComponent(name)) else { fatalError("Missing \(name)") }
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 320, pixelsHigh: 320, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        NSColor(red: 245 / 255, green: 239 / 255, blue: 229 / 255, alpha: 1).setFill()
        NSRect(x: 0, y: 0, width: 320, height: 320).fill()
        image.draw(in: NSRect(x: 0, y: 0, width: 320, height: 320))
        NSGraphicsContext.restoreGraphicsState()
        let duration = kind == "growth" ? (index < 12 ? 0.24 : 0.23) : 0.30
        CGImageDestinationAddImage(destination, bitmap.cgImage!, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: duration, kCGImagePropertyGIFUnclampedDelayTime: duration]] as CFDictionary)
    }
    guard CGImageDestinationFinalize(destination) else { fatalError("Cannot write \(target.path)") }
    let encoded = CGImageSourceCreateWithURL(target as CFURL, nil)!
    precondition(CGImageSourceGetCount(encoded) == 16)
    var total = 0.0
    for index in 0..<16 {
        let properties = CGImageSourceCopyPropertiesAtIndex(encoded, index, nil)! as NSDictionary
        let gif = properties[kCGImagePropertyGIFDictionary] as! NSDictionary
        total += gif[kCGImagePropertyGIFUnclampedDelayTime] as! Double
    }
    precondition(abs(total - (kind == "growth" ? 3.8 : 4.8)) < 0.001)
    print("\(target.path): 16 frames, \(total)s")
}
