import Foundation
import ImageIO
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 2 else { fatalError("Usage: swift create-celestial-stag-lv12-gif.swift <walk|run|hop|sleep>") }
let group = args[1]
guard ["walk", "run", "hop", "sleep"].contains(group) else { fatalError("Unknown motion group: \(group)") }

let root = URL(fileURLWithPath: "/Users/su.azura99/Desktop/React Native/LifeMate")
let atlasURL = root.appendingPathComponent("assets/pixelPet/sourceFrames/celestial_stag_lv12/\(group)-atlas-candidate.png")
let outputURL = root.appendingPathComponent("tasks/previews/celestial-stag-lv12-\(group).gif")
let count = (group == "walk" || group == "run") ? 8 : 16
let cell = 320

guard let source = CGImageSourceCreateWithURL(atlasURL as CFURL, nil),
      let atlas = CGImageSourceCreateImageAtIndex(source, 0, nil),
      let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.gif.identifier as CFString, count, nil) else {
    fatalError("Could not open atlas or create GIF")
}

CGImageDestinationSetProperties(destination, [
    kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]
] as CFDictionary)

for index in 0..<count {
    let column = index % 4
    let row = index / 4
    let rect = CGRect(x: column * cell, y: row * cell, width: cell, height: cell)
    guard let frame = atlas.cropping(to: rect) else { fatalError("Could not crop frame \(index)") }
    let delay: Double
    switch group {
    case "walk": delay = 0.1
    case "run": delay = 0.0625
    case "hop": delay = 0.1
    default: delay = index < 12 ? 0.2 : 0.5
    }
    let properties: [CFString: Any] = [
        kCGImagePropertyGIFDictionary: [
            kCGImagePropertyGIFDelayTime: delay,
            kCGImagePropertyGIFUnclampedDelayTime: delay
        ]
    ]
    CGImageDestinationAddImage(destination, frame, properties as CFDictionary)
}

guard CGImageDestinationFinalize(destination) else { fatalError("Could not finalize GIF") }
print("Wrote \(outputURL.path) with \(count) frames")
