import AppKit
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let frames = root.appendingPathComponent("assets/pixelPet/sourceFrames/sleep_garden_lv12/v2/packed320")
let previews = root.appendingPathComponent("tasks/previews")
for (prefix, label) in [("frame", "growth"), ("decay", "decay")] {
    let output = previews.appendingPathComponent("celestial-stag-lv12-sleep-scene-\(label)-v2.gif")
    guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.gif.identifier as CFString, 16, nil) else {
        fatalError("Cannot create GIF")
    }
    CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
    for index in 0..<16 {
        let url = frames.appendingPathComponent(String(format: "\(prefix)%02d.png", index))
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            fatalError("Cannot read \(url.path)")
        }
        guard let context = CGContext(data: nil, width: 320, height: 320, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
            fatalError("Cannot create preview canvas")
        }
        context.setFillColor(CGColor(red: 245 / 255, green: 239 / 255, blue: 229 / 255, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: 320, height: 320))
        context.draw(image, in: CGRect(x: 0, y: 0, width: 320, height: 320))
        guard let preview = context.makeImage() else { fatalError("Cannot flatten preview") }
        // GIF delays are centiseconds: 12×24 + 4×23 = 380; 16×30 = 480.
        let delay = prefix == "frame" ? (index % 4 == 0 ? 0.23 : 0.24) : 0.30
        CGImageDestinationAddImage(destination, preview, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: delay, kCGImagePropertyGIFUnclampedDelayTime: delay]] as CFDictionary)
    }
    guard CGImageDestinationFinalize(destination) else { fatalError("Cannot save GIF") }
    guard let saved = CGImageSourceCreateWithURL(output as CFURL, nil), CGImageSourceGetCount(saved) == 16 else {
        fatalError("GIF must contain 16 frames")
    }
    let duration = (0..<16).reduce(0.0) { total, index in
        let properties = CGImageSourceCopyPropertiesAtIndex(saved, index, nil) as? [CFString: Any]
        let gif = properties?[kCGImagePropertyGIFDictionary] as? [CFString: Any]
        return total + (gif?[kCGImagePropertyGIFUnclampedDelayTime] as? Double ?? gif?[kCGImagePropertyGIFDelayTime] as? Double ?? 0)
    }
    let expected = prefix == "frame" ? 3.8 : 4.8
    guard abs(duration - expected) < 0.001 else { fatalError("Unexpected GIF duration \(duration)") }
    print("\(output.path): 16 frames, \(duration)s")
}
