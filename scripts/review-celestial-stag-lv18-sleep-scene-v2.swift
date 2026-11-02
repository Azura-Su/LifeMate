import AppKit
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let source = root.appendingPathComponent("assets/pixelPet/sourceFrames/sleep_garden_lv18/v2")
let previews = root.appendingPathComponent("tasks/previews")
let cell = 320

for kind in ["growth", "decay"] {
    let atlasURL = source.appendingPathComponent("\(kind)-atlas.png")
    guard let input = CGImageSourceCreateWithURL(atlasURL as CFURL, nil),
          let atlas = CGImageSourceCreateImageAtIndex(input, 0, nil) else {
        fatalError("Cannot open candidate atlas: \(atlasURL.path)")
    }
    let output = previews.appendingPathComponent("celestial-stag-lv18-\(kind)-v2.gif")
    guard let gif = CGImageDestinationCreateWithURL(output as CFURL, UTType.gif.identifier as CFString, 16, nil) else {
        fatalError("Cannot create GIF")
    }
    CGImageDestinationSetProperties(gif, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
    for index in 0..<16 {
        let rect = CGRect(x: index % 4 * cell, y: index / 4 * cell, width: cell, height: cell)
        guard let frame = atlas.cropping(to: rect),
              let context = CGContext(data: nil, width: cell, height: cell, bitsPerComponent: 8,
                bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
            fatalError("Cannot render frame \(index)")
        }
        // Opaque preview backdrop prevents GIF disposal from leaving old leaves.
        context.setFillColor(CGColor(red: 244 / 255, green: 241 / 255, blue: 235 / 255, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: cell, height: cell))
        context.draw(frame, in: CGRect(x: 0, y: 0, width: cell, height: cell))
        // GIF delays are centiseconds: 12×0.24 + 4×0.23 = exactly 3.8 seconds.
        let delay = kind == "growth" ? (index < 12 ? 0.24 : 0.23) : 0.3
        CGImageDestinationAddImage(gif, context.makeImage()!, [kCGImagePropertyGIFDictionary: [
            kCGImagePropertyGIFDelayTime: delay,
            kCGImagePropertyGIFUnclampedDelayTime: delay,
        ]] as CFDictionary)
    }
    guard CGImageDestinationFinalize(gif) else { fatalError("GIF write failed") }
    guard let check = CGImageSourceCreateWithURL(output as CFURL, nil), CGImageSourceGetCount(check) == 16 else {
        fatalError("GIF frame count differs")
    }
    var duration = 0.0
    for index in 0..<16 {
        let properties = CGImageSourceCopyPropertiesAtIndex(check, index, nil)! as NSDictionary
        let propertiesGIF = properties[kCGImagePropertyGIFDictionary] as! NSDictionary
        duration += (propertiesGIF[kCGImagePropertyGIFUnclampedDelayTime] as? Double)
            ?? (propertiesGIF[kCGImagePropertyGIFDelayTime] as! Double)
    }
    precondition(abs(duration - (kind == "growth" ? 3.8 : 4.8)) < 0.001)
    print("\(output.lastPathComponent): 16 frames, \(duration) seconds")
}
