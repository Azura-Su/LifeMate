import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let frames = root.appendingPathComponent("assets/pixelPet/sourceFrames/sleep_garden_lv04/review320")
let previews = root.appendingPathComponent("tasks/previews")
for (prefix, name) in [("frame", "growth"), ("decay", "decay")] {
    let output = previews.appendingPathComponent("home_sleep_garden_lv04-authored-\(name).gif")
    guard let destination = CGImageDestinationCreateWithURL(output as CFURL, UTType.gif.identifier as CFString, 16, nil) else {
        fatalError("Cannot create GIF at \(output.path)")
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
        // An opaque review background prevents GIF disposal from leaving ghosts.
        context.setFillColor(CGColor(red: 238.0 / 255, green: 233.0 / 255, blue: 226.0 / 255, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: 320, height: 320))
        context.draw(image, in: CGRect(x: 0, y: 0, width: 320, height: 320))
        let delay = prefix == "decay" ? 0.3 : (index % 4 == 3 ? 0.23 : 0.24)
        duration += delay
        CGImageDestinationAddImage(destination, context.makeImage()!, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: delay, kCGImagePropertyGIFUnclampedDelayTime: delay]] as CFDictionary)
    }
    guard CGImageDestinationFinalize(destination),
          let saved = CGImageSourceCreateWithURL(output as CFURL, nil),
          CGImageSourceGetCount(saved) == 16 else { fatalError("Invalid GIF: \(output.path)") }
    if CommandLine.arguments.contains("--install") {
        let installed = previews.appendingPathComponent("home_sleep_garden_lv04-\(name).gif")
        if FileManager.default.fileExists(atPath: installed.path) {
            try FileManager.default.removeItem(at: installed)
        }
        try FileManager.default.copyItem(at: output, to: installed)
    }
    print("\(output.lastPathComponent): 16 frames, \(String(format: "%.2f", duration)) seconds")
}
