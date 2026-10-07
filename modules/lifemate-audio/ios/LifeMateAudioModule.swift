import ExpoModulesCore

struct AudioSegmentRecord: Record {
  @Field var uri: String = ""
  @Field var startMs: Double = 0
  @Field var endMs: Double = 0
}

public class LifeMateAudioModule: Module {
  @MainActor private lazy var engine = AudioEngine()

  public func definition() -> ModuleDefinition {
    Name("LifeMateAudio")
    AsyncFunction("inspect") { (uri: String) async throws -> [String: Any] in
      try await AudioEngine.inspect(uri)
    }
    AsyncFunction("exportAudio") { (segments: [AudioSegmentRecord], promise: Promise) in
      Task { @MainActor in
        do {
          let clips = segments.map { AudioClip(uri: $0.uri, startMs: $0.startMs, endMs: $0.endMs) }
          promise.resolve(try await self.engine.export(clips))
        } catch is CancellationError {
          promise.reject("AUDIO_CANCELLED", "Đã hủy xử lý âm thanh.")
        } catch {
          promise.reject("AUDIO_EXPORT", error.localizedDescription)
        }
      }
    }
    AsyncFunction("cancel") { (promise: Promise) in
      Task { @MainActor in self.engine.cancel(); promise.resolve() }
    }
    OnDestroy { Task { @MainActor in self.engine.cancel() } }
  }
}
