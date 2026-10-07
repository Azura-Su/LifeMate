package vn.lifemate.audio

import android.net.Uri
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class AudioEngineTest {
  private val instrumentation = InstrumentationRegistry.getInstrumentation()
  private val context = instrumentation.targetContext
  private val engine = AudioEngine(context)
  private fun fixture(name: String): String {
    val destination = File(context.cacheDir, name)
    instrumentation.context.assets.open(name).use { input -> destination.outputStream().use { input.copyTo(it) } }
    return Uri.fromFile(destination).toString()
  }
  private fun export(clips: List<AudioClip>): String {
    val done = CountDownLatch(1)
    var result: String? = null
    var failure: Throwable? = null
    instrumentation.runOnMainSync {
      try { engine.export(clips) { uri, error -> result = uri; failure = error; done.countDown() } }
      catch (error: Throwable) { failure = error; done.countDown() }
    }
    assertTrue("Native export timed out", done.await(60, TimeUnit.SECONDS))
    failure?.let { throw it }
    return requireNotNull(result)
  }
  private fun verifyAudio(uri: String, expectedMs: Double) {
    val info = engine.inspect(uri)
    assertEquals(true, info["hasAudio"])
    assertEquals(false, info["hasVideo"])
    assertEquals(expectedMs, info["durationMs"] as Double, 160.0)
  }
  @Test fun extractsOnlyAudioFromVideo() {
    val input = fixture("video.mp4")
    assertEquals(true, engine.inspect(input)["hasVideo"])
    val result = export(listOf(AudioClip(input, 0.0, 4000.0)))
    verifyAudio(result, 4000.0)
  }
  @Test fun trimsAtRequestedBounds() {
    val result = export(listOf(AudioClip(fixture("tone-a.wav"), 1000.0, 3000.0)))
    verifyAudio(result, 2000.0)
  }
  @Test fun joinsDifferentCodecsAndSampleRates() {
    val result = export(listOf(AudioClip(fixture("tone-b.mp3"), 0.0, 1000.0), AudioClip(fixture("tone-a.wav"), 500.0, 2500.0)))
    verifyAudio(result, 3000.0)
  }
  @Test fun rejectsSilentVideo() {
    try { export(listOf(AudioClip(fixture("silent.mp4"), 0.0, 1000.0))); fail("Silent video accepted") }
    catch (expected: IllegalArgumentException) { assertTrue(expected.message!!.contains("không có tiếng")) }
  }
  @Test fun rejectsRangeOutsideInput() {
    try { export(listOf(AudioClip(fixture("tone-a.wav"), 3000.0, 6000.0))); fail("Out-of-bounds trim accepted") }
    catch (expected: IllegalArgumentException) { assertTrue(expected.message!!.contains("khoảng cắt")) }
  }
}
