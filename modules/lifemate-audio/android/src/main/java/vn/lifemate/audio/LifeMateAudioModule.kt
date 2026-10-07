package vn.lifemate.audio

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import android.os.Handler
import android.os.Looper

class AudioSegmentRecord : Record {
  @Field var uri: String = ""
  @Field var startMs: Double = 0.0
  @Field var endMs: Double = 0.0
}

class LifeMateAudioModule : Module() {
  private val engine by lazy { AudioEngine(requireNotNull(appContext.reactContext)) }
  override fun definition() = ModuleDefinition {
    Name("LifeMateAudio")
    AsyncFunction("inspect") { uri: String -> engine.inspect(uri) }
    AsyncFunction("exportAudio") { segments: List<AudioSegmentRecord>, promise: Promise ->
      try {
        engine.export(segments.map { AudioClip(it.uri, it.startMs, it.endMs) }) { uri, error ->
          if (error == null) promise.resolve(uri)
          else promise.reject(if (error is java.util.concurrent.CancellationException) "AUDIO_CANCELLED" else "AUDIO_EXPORT", error.message, error)
        }
      } catch (error: Throwable) { promise.reject("AUDIO_EXPORT", error.message, error) }
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("cancel") { engine.cancel() }.runOnQueue(Queues.MAIN)
    OnDestroy { Handler(Looper.getMainLooper()).post { engine.cancel() } }
  }
}
