import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let frames = root.appendingPathComponent("assets/pixelPet/sourceFrames/sleep_garden_lv14/review320")
let previews = root.appendingPathComponent("tasks/previews")
for (prefix, name) in [("frame", "growth"), ("decay", "decay")] {
    let output = previews.appendingPathComponent("celestial-stag-lv14-\(name)-review.gif")
    guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.gif.identifier as CFString, 16, nil) else {
        fatalError("Cannot create GIF")
    }
    CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
    var duration = 0.0
    for index in 0..<16 {
        let input = frames.appendingPathComponent(String(format: "%@%02d.png", prefix, index))
        guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
              let context = CGContext(data: nil, width: 320, height: 320, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
            fatalError("Cannot read \(input.path)")
        }
        context.setFillColor(CGColor(red: 245.0 / 255, green: 239.0 / 255, blue: 229.0 / 255, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: 320, height: 320))
        context.draw(image, in: CGRect(x: 0, y: 0, width: 320, height: 320))
        let delay = prefix == "decay" ? 0.3 : (index % 4 == 3 ? 0.23 : 0.24)
        duration += delay
        CGImageDestinationAddImage(destination, context.makeImage()!, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: delay, kCGImagePropertyGIFUnclampedDelayTime: delay]] as CFDictionary)
    }
    guard CGImageDestinationFinalize(destination),
          let saved = CGImageSourceCreateWithURL(output as CFURL, nil),
          CGImageSourceGetCount(saved) == 16 else { fatalError("Invalid GIF") }
    var savedDuration = 0.0
    for index in 0..<16 {
        let properties = CGImageSourceCopyPropertiesAtIndex(saved, index, nil) as? [CFString: Any]
        let gif = properties?[kCGImagePropertyGIFDictionary] as? [CFString: Any]
        guard let delay = gif?[kCGImagePropertyGIFUnclampedDelayTime] as? Double
                ?? gif?[kCGImagePropertyGIFDelayTime] as? Double else { fatalError("Missing GIF delay") }
        savedDuration += delay
    }
    guard abs(savedDuration - duration) < 0.001 else { fatalError("Incorrect saved GIF duration") }
    print("\(output.lastPathComponent): 16 frames, \(String(format: "%.2f", savedDuration)) seconds")
}
