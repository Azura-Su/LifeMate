import AVFoundation
import Foundation

@main struct AudioEngineSmoke {
  @MainActor static func main() async throws {
    let root = URL(fileURLWithPath: CommandLine.arguments[1])
    let folder = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("lifemate-smoke-" + UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: folder) }
    for file in ["video.mp4", "silent.mp4", "tone-a.wav", "tone-b.mp3"] {
      try FileManager.default.copyItem(at: root.appendingPathComponent(file), to: folder.appendingPathComponent(file))
    }
    let engine = AudioEngine()
    func uri(_ name: String) -> String { folder.appendingPathComponent(name).absoluteString }
    let video = try await AudioEngine.inspect(uri("video.mp4"))
    precondition(video["hasVideo"] as? Bool == true && video["hasAudio"] as? Bool == true)
    let extraction = try await engine.export([AudioClip(uri: uri("video.mp4"), startMs: 0, endMs: 4000)])
    let trim = try await engine.export([AudioClip(uri: uri("tone-a.wav"), startMs: 1000, endMs: 3000)])
    let merge = try await engine.export([AudioClip(uri: uri("tone-b.mp3"), startMs: 0, endMs: 1000), AudioClip(uri: uri("tone-a.wav"), startMs: 500, endMs: 2500)])
    defer { for file in [extraction, trim, merge] { if let url = URL(string: file) { try? FileManager.default.removeItem(at: url) } } }
    for (file, expected) in [(extraction, 4000.0), (trim, 2000.0), (merge, 3000.0)] {
      let info = try await AudioEngine.inspect(file)
      precondition(info["hasVideo"] as? Bool == false && info["hasAudio"] as? Bool == true)
      precondition(abs((info["durationMs"] as! Double) - expected) < 150)
    }
    let audio = try AVAudioFile(forReading: URL(string: merge)!)
    let buffer = AVAudioPCMBuffer(pcmFormat: audio.processingFormat, frameCapacity: AVAudioFrameCount(audio.length))!
    try audio.read(into: buffer)
    let samples = buffer.floatChannelData![0]
    func frequency(_ seconds: Double) -> Double {
      let first = Int(seconds * audio.processingFormat.sampleRate)
      let count = Int(0.3 * audio.processingFormat.sampleRate)
      var crossings = 0
      for i in first..<(first + count - 1) { if samples[i] <= 0 && samples[i + 1] > 0 { crossings += 1 } }
      return Double(crossings) / 0.3
    }
    precondition(abs(frequency(0.3) - 880) < 15 && abs(frequency(1.5) - 440) < 15, "Merge order must match the selected inputs")
    do { _ = try await engine.export([AudioClip(uri: uri("silent.mp4"), startMs: 0, endMs: 1000)]); fatalError("Silent video accepted") }
    catch { print("PASS: silent input rejected") }
    do { _ = try await engine.export([AudioClip(uri: uri("tone-a.wav"), startMs: 3000, endMs: 1000)]); fatalError("Reversed trim accepted") }
    catch { print("PASS: invalid trim rejected") }
    print("PASS: AVFoundation extraction, 2s trim, mixed-format 3s merge, audio-only outputs and 880Hz → 440Hz order")
  }
}
