import Foundation
import ImageIO
import UniformTypeIdentifiers

let group = CommandLine.arguments[1]
guard ["walk", "run", "flight", "sleep"].contains(group) else { fatalError("Unknown group") }
let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let atlasURL = root.appendingPathComponent("assets/pixelPet/animations/celestial_stag_lv34_\(group).png")
let outputURL = root.appendingPathComponent("tasks/previews/celestial-stag-lv34-\(group).gif")
let cell = 320
let count = 16
guard let source = CGImageSourceCreateWithURL(atlasURL as CFURL, nil), let atlas = CGImageSourceCreateImageAtIndex(source, 0, nil), let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.gif.identifier as CFString, count, nil) else { fatalError("Could not open atlas") }
CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
for index in 0..<count {
  let rect = CGRect(x: (index % 4) * cell, y: (index / 4) * cell, width: cell, height: cell)
  guard let frame = atlas.cropping(to: rect) else { fatalError("Frame crop failed") }
  let delay: Double
  switch group {
  case "walk": delay = 0.1
  case "run": delay = 0.0625
  case "flight": delay = index < 4 || index >= 12 ? 0.35 : (index < 8 ? 0.18 : 0.5)
  default: delay = index < 12 ? 0.2 : 0.5
  }
  CGImageDestinationAddImage(destination, frame, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: delay, kCGImagePropertyGIFUnclampedDelayTime: delay]] as CFDictionary)
}
guard CGImageDestinationFinalize(destination) else { fatalError("GIF write failed") }
print(outputURL.path)
