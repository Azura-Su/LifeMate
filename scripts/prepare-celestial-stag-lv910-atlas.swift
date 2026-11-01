import Foundation
import ImageIO
import UniformTypeIdentifiers
import CoreGraphics

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let sourceDir = root.appendingPathComponent("assets/pixelPet/sourceFrames/celestial_stag_lv910")
let previewDir = root.appendingPathComponent("tasks/previews")
try FileManager.default.createDirectory(at: previewDir, withIntermediateDirectories: true)
let group = CommandLine.arguments.dropFirst().first ?? "walk"
guard ["walk", "run", "flight", "sleep"].contains(group) else { fatalError("Unknown group: \(group)") }
let cell = 320
let canvas = 1280
let groundY: CGFloat = 288
let frameCount = ["walk", "run"].contains(group) ? 8 : 16

func load(_ url: URL) -> CGImage {
  guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fatalError("Cannot load \(url.path)")
  }
  return image
}

func rgba(_ image: CGImage) -> (CGContext, [UInt8]) {
  let data = UnsafeMutablePointer<UInt8>.allocate(capacity: image.width * image.height * 4)
  data.initialize(repeating: 0, count: image.width * image.height * 4)
  let context = CGContext(data: data, width: image.width, height: image.height, bitsPerComponent: 8,
    bytesPerRow: image.width * 4, space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
  return (context, Array(UnsafeBufferPointer(start: data, count: image.width * image.height * 4)))
}

func frame(_ index: Int) -> CGImage {
  let override = group == "flight" && [7, 15, 16].contains(index)
    ? sourceDir.appendingPathComponent(String(format: "flight_%02d_candidate_v2.png", index))
    : sourceDir.appendingPathComponent(String(format: "\(group)_%02d_candidate.png", index))
  let url = override
  let input = load(url)
  let (_, pixels) = rgba(input)
  var minX = input.width, minY = input.height, maxX = -1, maxY = -1
  for y in 0..<input.height { for x in 0..<input.width {
    if pixels[(y * input.width + x) * 4 + 3] > 8 {
      minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
    }
  }}
  guard maxX >= minX, maxY >= minY else { fatalError("Frame is transparent: \(url.path)") }
  let crop = group == "flight"
    ? CGRect(x: 0, y: 0, width: input.width, height: input.height)
    : CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
  // Flight art keeps a fixed canvas transform. Bbox scaling would shrink the
  // torso every time the wings spread farther, while hoof alignment would make
  // airborne poses bob. Home controls the flight arc independently.
  let scale = group == "flight" ? 0.178 : min(224 / crop.height, 268 / crop.width)
  let w = crop.width * scale, h = crop.height * scale
  let out = CGContext(data: nil, width: cell, height: cell, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  out.interpolationQuality = .high
  guard let cropped = input.cropping(to: crop) else { fatalError("Crop failed: \(url.path)") }
  let y = group == "flight" ? (CGFloat(cell) - h) / 2 : CGFloat(cell) - groundY
  out.draw(cropped, in: CGRect(x: (CGFloat(cell) - w) / 2, y: y, width: w, height: h))
  return out.makeImage()!
}

func writePNG(_ image: CGImage, to url: URL) {
  guard let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else { fatalError("Cannot write \(url.path)") }
  CGImageDestinationAddImage(dest, image, nil)
  guard CGImageDestinationFinalize(dest) else { fatalError("PNG write failed") }
}

let frames = (1...frameCount).map(frame)
let atlas = CGContext(data: nil, width: canvas, height: canvas, bitsPerComponent: 8, bytesPerRow: 0,
  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
let sheet = CGContext(data: nil, width: canvas, height: canvas, bitsPerComponent: 8, bytesPerRow: 0,
  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
let preview = CGContext(data: nil, width: canvas, height: canvas, bitsPerComponent: 8, bytesPerRow: 0,
  space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
preview.setFillColor(CGColor(red: 0.98, green: 0.95, blue: 0.87, alpha: 1)); preview.fill(CGRect(x: 0, y: 0, width: canvas, height: canvas))
for i in 0..<16 {
  let img = frames[i % frameCount]
  let col = i % 4, row = i / 4
  let rect = CGRect(x: col * cell, y: (3 - row) * cell, width: cell, height: cell)
  atlas.draw(img, in: rect); sheet.draw(img, in: rect); preview.draw(img, in: rect)
}
let atlasURL = previewDir.appendingPathComponent("celestial-stag-lv910-\(group)-atlas-candidate.png")
let contactURL = previewDir.appendingPathComponent("celestial-stag-lv910-\(group)-contact.png")
writePNG(atlas.makeImage()!, to: atlasURL); writePNG(preview.makeImage()!, to: contactURL)
let gifURL = previewDir.appendingPathComponent("celestial-stag-lv910-\(group).gif")
let destination = CGImageDestinationCreateWithURL(gifURL as CFURL, UTType.gif.identifier as CFString, frameCount, nil)!
CGImageDestinationSetProperties(destination, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0]] as CFDictionary)
for (index, img) in frames.enumerated() {
  let delay: Double
  if group == "run" { delay = 0.0625 }
  else if group == "flight" { delay = index < 4 || index >= 12 ? 0.35 : (index < 8 ? 0.18 : 0.825) }
  else if group == "sleep" { delay = index < 12 ? 0.2 : 0.5 }
  else { delay = 0.1 }
  CGImageDestinationAddImage(destination, img, [kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: delay, kCGImagePropertyGIFUnclampedDelayTime: delay]] as CFDictionary)
}
guard CGImageDestinationFinalize(destination) else { fatalError("GIF write failed") }
print(contactURL.path); print(gifURL.path); print(atlasURL.path)
