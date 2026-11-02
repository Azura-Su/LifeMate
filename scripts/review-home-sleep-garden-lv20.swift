import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Run from any directory: swift /path/to/scripts/review-home-sleep-garden-lv20.swift
let script = URL(fileURLWithPath: CommandLine.arguments[0])
let root = script.deletingLastPathComponent().deletingLastPathComponent()
let cell = 320
let previewDirectory = root.appendingPathComponent("tasks/previews")

for (suffix, label, seconds) in [("", "growth", 3.8), ("_decay", "decay", 4.8)] {
    let atlasURL = root.appendingPathComponent("assets/pixelPet/animations/home_sleep_garden_lv20\(suffix).png")
    let outputURL = previewDirectory.appendingPathComponent("home_sleep_garden_lv20-\(label).gif")
    guard let source = CGImageSourceCreateWithURL(atlasURL as CFURL, nil),
          let atlas = CGImageSourceCreateImageAtIndex(source, 0, nil),
          atlas.width == cell * 4, atlas.height == cell * 4,
          let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.gif.identifier as CFString, 16, nil)
    else { fatalError("Cannot open atlas or create GIF for \(label)") }
    CGImageDestinationSetProperties(destination, [
        kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]
    ] as CFDictionary)
    for index in 0..<16 {
        let rect = CGRect(x: (index % 4) * cell, y: (index / 4) * cell, width: cell, height: cell)
        guard let frame = atlas.cropping(to: rect),
              let context = CGContext(data: nil, width: cell, height: cell,
                                      bitsPerComponent: 8, bytesPerRow: cell * 4,
                                      space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { fatalError("Cannot render \(label) frame \(index)") }
        context.setFillColor(CGColor(red: 245/255, green: 240/255, blue: 232/255, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: cell, height: cell))
        context.draw(frame, in: CGRect(x: 0, y: 0, width: cell, height: cell))
        guard let image = context.makeImage() else { fatalError("Cannot flatten GIF frame") }
        // GIF rounds to centiseconds; distribute them to retain the full duration.
        let start = (Double(index) * seconds * 100 / 16).rounded()
        let end = (Double(index + 1) * seconds * 100 / 16).rounded()
        let delay = (end - start) / 100
        CGImageDestinationAddImage(destination, image, [
            kCGImagePropertyGIFDictionary: [
                kCGImagePropertyGIFDelayTime: delay,
                kCGImagePropertyGIFUnclampedDelayTime: delay
            ]
        ] as CFDictionary)
    }
    guard CGImageDestinationFinalize(destination) else { fatalError("Cannot finalize \(label) GIF") }
    print("\(outputURL.lastPathComponent): 16 frames, \(seconds)s")
}
