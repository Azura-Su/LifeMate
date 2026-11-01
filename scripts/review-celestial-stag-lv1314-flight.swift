import AppKit
import ImageIO
import UniformTypeIdentifiers

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let sourceDir = root.appendingPathComponent("assets/pixelPet/sourceFrames/celestial_stag_lv1314/flight")
let outputDir = root.appendingPathComponent("tasks/previews")
try FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)
let cell = 320
let canvas = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: cell * 4, pixelsHigh: cell * 4, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
let context = NSGraphicsContext(bitmapImageRep: canvas)!
NSGraphicsContext.current = context
context.imageInterpolation = .high
NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: cell * 4, height: cell * 4).fill()
for i in 0..<16 {
    let frame = NSImage(contentsOf: sourceDir.appendingPathComponent(String(format: "frame-%02d.png", i + 1)))!
    let col = i % 4
    let rowFromTop = i / 4
    // Keep the complete square source canvas so every pose shares one transform.
    // Its 224px image area gives the character the specified standing scale and
    // leaves room around antlers, tail, and hoof flames inside each 320px cell.
    let rect = NSRect(x: col * cell + 48, y: (3 - rowFromTop) * cell + 32, width: 224, height: 224)
    frame.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1)
}
NSGraphicsContext.restoreGraphicsState()
let contactURL = outputDir.appendingPathComponent("celestial-stag-lv1314-flight-contact.png")
try canvas.representation(using: .png, properties: [:])!.write(to: contactURL)

let atlas = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: cell * 4, pixelsHigh: cell * 4, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
let atlasContext = NSGraphicsContext(bitmapImageRep: atlas)!
NSGraphicsContext.current = atlasContext
atlasContext.imageInterpolation = .high
NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: cell * 4, height: cell * 4).fill()
for i in 0..<16 {
    let frame = NSImage(contentsOf: sourceDir.appendingPathComponent(String(format: "frame-%02d.png", i + 1)))!
    let col = i % 4
    let rowFromTop = i / 4
    let rect = NSRect(x: col * cell + 48, y: (3 - rowFromTop) * cell + 32, width: 224, height: 224)
    frame.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1)
}
NSGraphicsContext.restoreGraphicsState()
let atlasURL = root.appendingPathComponent("assets/pixelPet/animations/celestial_stag_lv1314_flight.png")
try atlas.representation(using: .png, properties: [:])!.write(to: atlasURL)

let gifURL = outputDir.appendingPathComponent("celestial-stag-lv1314-flight.gif")
guard let destination = CGImageDestinationCreateWithURL(gifURL as CFURL, UTType.gif.identifier as CFString, 16, nil) else { fatalError("Cannot create GIF") }
CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
for i in 1...16 {
    let url = sourceDir.appendingPathComponent(String(format: "frame-%02d.png", i))
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(src, 0, nil) else { fatalError("Cannot read \(url.path)") }
    CGImageDestinationAddImage(destination, image, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: i <= 4 || i >= 13 ? 0.35 : (i <= 8 ? 0.18 : 0.825), kCGImagePropertyGIFUnclampedDelayTime: i <= 4 || i >= 13 ? 0.35 : (i <= 8 ? 0.18 : 0.825)]] as CFDictionary)
}
guard CGImageDestinationFinalize(destination) else { fatalError("GIF write failed") }
print(contactURL.path)
print(gifURL.path)
print(atlasURL.path)
