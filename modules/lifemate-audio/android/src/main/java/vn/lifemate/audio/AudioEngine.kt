package vn.lifemate.audio

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.ChannelMixingAudioProcessor
import androidx.media3.common.audio.ChannelMixingMatrix
import androidx.media3.common.audio.SonicAudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.transformer.*
import java.io.File
import java.util.UUID

data class AudioClip(val uri: String, val startMs: Double, val endMs: Double)

@androidx.annotation.OptIn(UnstableApi::class)
class AudioEngine(private val context: Context) {
  private var transformer: Transformer? = null
  private var output: File? = null
  private var callback: ((String?, Throwable?) -> Unit)? = null

  fun localFile(uri: String): File {
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "File cần được tải về trước khi xử lý." }
    val file = File(requireNotNull(parsed.path)).canonicalFile
    require(file.path.startsWith(context.filesDir.parentFile!!.canonicalPath + "/") && file.isFile) {
      "Không tìm thấy file âm thanh trong ứng dụng."
    }
    return file
  }

  fun inspect(uri: String): Map<String, Any> {
    val retriever = MediaMetadataRetriever()
    try {
      retriever.setDataSource(localFile(uri).path)
      val duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toDoubleOrNull() ?: 0.0
      require(duration > 0) { "Không đọc được thời lượng file này." }
      return mapOf("durationMs" to duration,
        "hasAudio" to (retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO) == "yes"),
        "hasVideo" to (retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO) == "yes"))
    } finally { retriever.release() }
  }

  // All Transformer lifecycle calls run on the main looper.
  // https://developer.android.com/media/media3/transformer/transformations
  fun export(clips: List<AudioClip>, completion: (String?, Throwable?) -> Unit) {
    check(transformer == null) { "Đang xử lý một file khác." }
    require(clips.size in 1..10) { "Chọn từ 1 đến 10 đoạn." }
    var totalMs = 0.0
    val items = clips.map { clip ->
      require(clip.startMs.isFinite() && clip.endMs.isFinite() && clip.startMs >= 0 && clip.endMs - clip.startMs >= 100) { "Khoảng cắt không hợp lệ." }
      val details = inspect(clip.uri)
      require(details["hasAudio"] == true && clip.endMs <= (details["durationMs"] as Double) + 1) { "File không có tiếng hoặc khoảng cắt vượt quá thời lượng." }
      totalMs += clip.endMs - clip.startMs
      val item = MediaItem.Builder().setUri(Uri.fromFile(localFile(clip.uri)))
        .setClippingConfiguration(MediaItem.ClippingConfiguration.Builder()
          .setStartPositionMs(clip.startMs.toLong()).setEndPositionMs(clip.endMs.toLong()).build()).build()
      val channels = ChannelMixingAudioProcessor().apply {
        for (count in 1..6) putChannelMixingMatrix(ChannelMixingMatrix.createForConstantPower(count, 2))
      }
      val resampler = SonicAudioProcessor().apply { setOutputSampleRateHz(44100) }
      EditedMediaItem.Builder(item).setRemoveVideo(true)
        .setEffects(Effects(listOf(channels, resampler), emptyList())).build()
    }
    require(totalMs <= 3600000) { "Bản ghép tối đa 60 phút." }
    val folder = File(context.cacheDir, "lifemate-audio").apply { mkdirs() }
    val destination = File(folder, "${UUID.randomUUID()}.m4a")
    output = destination
    callback = completion
    val engine = Transformer.Builder(context).setAudioMimeType(MimeTypes.AUDIO_AAC)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, exportResult: ExportResult) {
          finish(Uri.fromFile(destination).toString(), null)
        }
        override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
          finish(null, IllegalStateException("Không thể xuất âm thanh. Codec hoặc file có thể không được hỗ trợ.", exportException))
        }
      }).build()
    transformer = engine
    try {
      engine.start(Composition.Builder(EditedMediaItemSequence.Builder(items).build()).build(), destination.path)
    } catch (error: Throwable) { finish(null, error) }
  }

  private fun finish(uri: String?, error: Throwable?) {
    if (error != null) output?.delete()
    val completed = callback
    callback = null
    transformer = null
    output = null
    completed?.invoke(uri, error)
  }

  fun cancel() {
    transformer?.cancel()
    if (callback != null) finish(null, java.util.concurrent.CancellationException("Đã hủy xử lý âm thanh."))
  }
}
