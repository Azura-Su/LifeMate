import AVFoundation
import Foundation

struct AudioClip {
  let uri: String
  let startMs: Double
  let endMs: Double
}

enum AudioEngineError: LocalizedError {
  case invalid(String)
  var errorDescription: String? {
    switch self { case .invalid(let message): return message }
  }
}

// Only local, app-owned files cross the native boundary. The system picker copies
// selected documents into the cache; this module never opens remote URLs.
func localAudioURL(_ uri: String) throws -> URL {
  guard let url = URL(string: uri), url.isFileURL else {
    throw AudioEngineError.invalid("File cần được tải về máy trước khi xử lý.")
  }
  let resolved = url.resolvingSymlinksInPath().standardizedFileURL
  let root = URL(fileURLWithPath: NSHomeDirectory()).resolvingSymlinksInPath().path + "/"
  guard resolved.path.hasPrefix(root), FileManager.default.fileExists(atPath: resolved.path) else {
    throw AudioEngineError.invalid("Không tìm thấy file âm thanh trong ứng dụng.")
  }
  return resolved
}

@MainActor
final class AudioEngine {
  private var activeSession: AVAssetExportSession?
  private var busy = false
  private var cancelled = false

  nonisolated static func inspect(_ uri: String) async throws -> [String: Any] {
    let asset = AVURLAsset(url: try localAudioURL(uri))
    let duration = try await asset.load(.duration).seconds * 1000
    let audio = try await asset.loadTracks(withMediaType: .audio)
    let video = try await asset.loadTracks(withMediaType: .video)
    guard duration.isFinite, duration > 0 else {
      throw AudioEngineError.invalid("Không đọc được thời lượng file này.")
    }
    return ["durationMs": duration, "hasAudio": !audio.isEmpty, "hasVideo": !video.isEmpty]
  }

  func cancel() {
    cancelled = true
    activeSession?.cancelExport()
  }

  // https://developer.apple.com/documentation/avfoundation/avmutablecomposition
  func export(_ clips: [AudioClip]) async throws -> String {
    guard !busy else { throw AudioEngineError.invalid("Đang xử lý một file khác.") }
    busy = true
    cancelled = false
    defer { busy = false; activeSession = nil }
    guard (1...10).contains(clips.count) else { throw AudioEngineError.invalid("Chọn từ 1 đến 10 đoạn.") }
    let composition = AVMutableComposition()
    guard let outputTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
      throw AudioEngineError.invalid("Không tạo được track âm thanh.")
    }
    var cursor = CMTime.zero
    for clip in clips {
      let asset = AVURLAsset(url: try localAudioURL(clip.uri))
      let durationMs = try await asset.load(.duration).seconds * 1000
      let tracks = try await asset.loadTracks(withMediaType: .audio)
      guard let audio = tracks.first else { throw AudioEngineError.invalid("File không có âm thanh.") }
      guard clip.startMs.isFinite, clip.endMs.isFinite, clip.startMs >= 0,
        clip.endMs - clip.startMs >= 100, clip.endMs <= durationMs + 1 else {
        throw AudioEngineError.invalid("Khoảng cắt không hợp lệ.")
      }
      if cancelled { throw CancellationError() }
      let range = CMTimeRange(start: CMTime(seconds: clip.startMs / 1000, preferredTimescale: 48000),
                              duration: CMTime(seconds: (clip.endMs - clip.startMs) / 1000, preferredTimescale: 48000))
      try outputTrack.insertTimeRange(range, of: audio, at: cursor)
      cursor = cursor + range.duration
      guard cursor.seconds <= 3600 else { throw AudioEngineError.invalid("Bản ghép tối đa 60 phút.") }
    }
    let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("lifemate-audio", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let destination = directory.appendingPathComponent(UUID().uuidString + ".m4a")
    guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetAppleM4A) else {
      throw AudioEngineError.invalid("Thiết bị chưa hỗ trợ xuất file này.")
    }
    session.outputURL = destination
    session.outputFileType = .m4a
    activeSession = session
    if cancelled { throw CancellationError() }
    do {
      try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
        session.exportAsynchronously {
          switch session.status {
          case .completed: continuation.resume()
          case .cancelled: continuation.resume(throwing: CancellationError())
          default: continuation.resume(throwing: AudioEngineError.invalid("Không thể xuất âm thanh. Codec hoặc file có thể không được hỗ trợ."))
          }
        }
      }
      if cancelled { throw CancellationError() }
      return destination.absoluteString
    } catch {
      try? FileManager.default.removeItem(at: destination)
      throw error
    }
  }
}
