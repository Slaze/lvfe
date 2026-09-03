package com.lvfe.xperience

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.graphics.Color
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import java.io.File

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var previewView: PreviewView
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: androidx.camera.core.Camera? = null
    private var arPreviewOn = false
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var captureUri: Uri? = null

    private var geoOrigin: String? = null
    private var geoCallback: GeolocationPermissions.Callback? = null
    private var webMediaRequest: PermissionRequest? = null
    private var permLaunching = false
    private var launchAsked = false

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) {
        permLaunching = false
        settlePendingWebPerms()
        notifyPagePerms()
    }

    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val cb = filePathCallback
        filePathCallback = null
        if (cb == null) return@registerForActivityResult
        val fromChooser = WebChromeClient.FileChooserParams.parseResult(
            result.resultCode,
            result.data,
        )
        val uri = fromChooser?.firstOrNull() ?: captureUri.takeIf { result.resultCode == RESULT_OK }
        cb.onReceiveValue(if (uri != null) arrayOf(uri) else null)
        captureUri = null
    }

    inner class NativeBridge {
        @JavascriptInterface
        fun hasLocation(): Boolean = hasLocationPermission()

        @JavascriptInterface
        fun hasCamera(): Boolean = hasCameraPermission()

        @JavascriptInterface
        fun requestLocation() {
            runOnUiThread { requestLocationPerms() }
        }

        @JavascriptInterface
        fun requestCamera() {
            runOnUiThread { requestCameraPerms(needMic = false) }
        }

        @JavascriptInterface
        fun requestLaunchPerms() {
            runOnUiThread { requestAllLaunchPerms() }
        }

        @JavascriptInterface
        fun hasNativePreview(): Boolean = true

        @JavascriptInterface
        fun startArCamera() {
            runOnUiThread { bindRearPreview(CameraSelector.DEFAULT_BACK_CAMERA) }
        }

        @JavascriptInterface
        fun stopArCamera() {
            runOnUiThread { unbindRearPreview() }
        }

        @JavascriptInterface
        fun setTorch(on: Boolean) {
            runOnUiThread { camera?.cameraControl?.enableTorch(on) }
        }

        @JavascriptInterface
        fun setFacingFront(on: Boolean) {
            runOnUiThread {
                bindRearPreview(if (on) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA)
            }
        }

        @JavascriptInterface
        fun previewLuma(): Int {
            val latch = java.util.concurrent.CountDownLatch(1)
            var luma = -1
            runOnUiThread {
                try {
                    val bmp = previewView.bitmap
                    if (bmp == null) {
                        luma = -2
                    } else {
                        var s = 0L
                        val n = 64
                        for (i in 0 until n) {
                            val x = (bmp.width * (i % 8) / 8).coerceIn(0, bmp.width - 1)
                            val y = (bmp.height * (i / 8) / 8).coerceIn(0, bmp.height - 1)
                            val c = bmp.getPixel(x, y)
                            s += Color.red(c) + Color.green(c) + Color.blue(c)
                        }
                        luma = (s / (n * 3)).toInt()
                    }
                } catch (err: Exception) {
                    luma = -3
                }
                latch.countDown()
            }
            latch.await(2, java.util.concurrent.TimeUnit.SECONDS)
            return luma
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        previewView = PreviewView(this).apply {
            implementationMode = PreviewView.ImplementationMode.PERFORMANCE
            scaleType = PreviewView.ScaleType.FILL_CENTER
            visibility = View.GONE
            setBackgroundColor(Color.BLACK)
        }
        webView = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
        }
        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#0e1116"))
        }
        val lp = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        )
        root.addView(previewView, lp)
        root.addView(webView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT,
        ))
        setContentView(root)
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
        loadGame()
        requestAllLaunchPerms()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun loadGame() {
        if (webView.url != null) return

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            cacheMode = WebSettings.LOAD_DEFAULT
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            textZoom = 100
        }

        webView.addJavascriptInterface(NativeBridge(), "LvfeNative")
        webView.setBackgroundColor(Color.TRANSPARENT)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse? {
                return assetLoader.shouldInterceptRequest(request.url)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                if (hasLocationPermission()) allowWebGeo(null)
                requestAllLaunchPerms()
                notifyPagePerms()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?,
            ) {
                if (callback == null) return
                if (hasLocationPermission()) {
                    allowWebGeo(origin)
                    callback.invoke(origin, true, false)
                    geoCallback = null
                    geoOrigin = null
                    return
                }
                geoOrigin = origin
                geoCallback = callback
                requestLocationPerms()
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                if (request == null) return
                val wantsAudio = request.resources.any {
                    it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
                }
                if (hasCameraPermission() && (!wantsAudio || hasMicPermission())) {
                    grantWebMedia(request)
                    webMediaRequest = null
                    return
                }
                webMediaRequest = request
                requestCameraPerms(needMic = wantsAudio)
            }

            override fun onPermissionRequestCanceled(request: PermissionRequest?) {
                if (webMediaRequest === request) webMediaRequest = null
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                val content = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }
                val camera = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                val photo = File(cacheDir, "capture").apply { mkdirs() }
                    .let { File(it, "visit.jpg") }
                captureUri = FileProvider.getUriForFile(
                    this@MainActivity,
                    "${packageName}.files",
                    photo,
                )
                camera.putExtra(MediaStore.EXTRA_OUTPUT, captureUri)
                camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                val chooser = Intent(Intent.ACTION_CHOOSER).apply {
                    putExtra(Intent.EXTRA_INTENT, content)
                    putExtra(Intent.EXTRA_TITLE, "Photo")
                    putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(camera))
                }
                return try {
                    fileChooserLauncher.launch(chooser)
                    true
                } catch (err: Exception) {
                    this@MainActivity.filePathCallback = null
                    false
                }
            }
        }

        if (hasLocationPermission()) allowWebGeo(null)
        webView.loadUrl("https://appassets.androidplatform.net/assets/www/index.html")
    }

    private fun missingLaunchPerms(): List<String> {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        if (!hasCameraPermission()) needed.add(Manifest.permission.CAMERA)
        return needed
    }

    private fun requestAllLaunchPerms() {
        val needed = missingLaunchPerms()
        if (needed.isEmpty()) {
            if (hasLocationPermission()) allowWebGeo(null)
            notifyPagePerms()
            return
        }
        if (launchAsked) return
        launchAsked = true
        launchPerms(needed)
    }

    private fun requestLocationPerms() {
        if (hasLocationPermission()) {
            allowWebGeo(geoOrigin)
            val cb = geoCallback
            val origin = geoOrigin
            if (cb != null) {
                cb.invoke(origin, true, false)
                geoCallback = null
                geoOrigin = null
            }
            notifyPagePerms()
            return
        }
        launchPerms(
            listOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ),
        )
    }

    private fun requestCameraPerms(needMic: Boolean) {
        val media = webMediaRequest
        if (hasCameraPermission() && (!needMic || hasMicPermission())) {
            if (media != null) {
                grantWebMedia(media)
                webMediaRequest = null
            }
            notifyPagePerms()
            return
        }
        val needed = mutableListOf<String>()
        if (!hasCameraPermission()) needed.add(Manifest.permission.CAMERA)
        if (needMic && !hasMicPermission()) needed.add(Manifest.permission.RECORD_AUDIO)
        launchPerms(needed)
    }

    private fun launchPerms(perms: List<String>) {
        val missing = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            settlePendingWebPerms()
            notifyPagePerms()
            return
        }
        if (permLaunching) return
        permLaunching = true
        permissionLauncher.launch(missing.toTypedArray())
    }

    private fun settlePendingWebPerms() {
        val origin = geoOrigin
        val cb = geoCallback
        if (cb != null) {
            if (hasLocationPermission()) allowWebGeo(origin)
            cb.invoke(origin, hasLocationPermission(), false)
            geoCallback = null
            geoOrigin = null
        }
        val media = webMediaRequest
        if (media != null) {
            grantWebMedia(media)
            webMediaRequest = null
        }
    }

    private fun allowWebGeo(origin: String?) {
        val inst = GeolocationPermissions.getInstance()
        if (!origin.isNullOrBlank()) inst.allow(origin)
        inst.allow(WEB_ORIGIN)
        inst.allow("$WEB_ORIGIN/")
    }

    private fun grantWebMedia(request: PermissionRequest) {
        val grant = mutableListOf<String>()
        for (res in request.resources) {
            when (res) {
                PermissionRequest.RESOURCE_VIDEO_CAPTURE ->
                    if (hasCameraPermission()) grant.add(res)
                PermissionRequest.RESOURCE_AUDIO_CAPTURE ->
                    if (hasMicPermission()) grant.add(res)
                PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID ->
                    grant.add(res)
            }
        }
        if (grant.isNotEmpty()) request.grant(grant.toTypedArray())
        else request.deny()
    }

    private fun notifyPagePerms() {
        if (!this::webView.isInitialized) return
        val loc = if (hasLocationPermission()) "1" else "0"
        val cam = if (hasCameraPermission()) "1" else "0"
        webView.evaluateJavascript(
            "window.lvfeOnNativePerms&&window.lvfeOnNativePerms({loc:$loc,cam:$cam})",
            null,
        )
    }

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.CAMERA,
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasMicPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO,
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun bindRearPreview(selector: CameraSelector = CameraSelector.DEFAULT_BACK_CAMERA) {
        if (!hasCameraPermission()) {
            requestCameraPerms(needMic = false)
            notifyNativeFail()
            return
        }
        arPreviewOn = true
        previewView.visibility = View.VISIBLE
        webView.setBackgroundColor(Color.TRANSPARENT)
        webView.setLayerType(View.LAYER_TYPE_SOFTWARE, null)
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            if (!arPreviewOn) return@addListener
            try {
                val provider = future.get()
                cameraProvider = provider
                val preview = Preview.Builder().build()
                preview.setSurfaceProvider(previewView.surfaceProvider)
                provider.unbindAll()
                val cam = provider.bindToLifecycle(
                    this,
                    selector,
                    preview,
                )
                camera = cam
                try {
                    val range = cam.cameraInfo.exposureState.exposureCompensationRange
                    cam.cameraControl.setExposureCompensationIndex(range.upper)
                } catch (err: Exception) { /* AE offset optional */ }
            } catch (err: Exception) {
                notifyNativeFail()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun unbindRearPreview() {
        arPreviewOn = false
        try {
            camera?.cameraControl?.enableTorch(false)
            cameraProvider?.unbindAll()
        } catch (err: Exception) { /* already torn down */ }
        camera = null
        if (this::previewView.isInitialized) {
            previewView.visibility = View.GONE
        }
        if (this::webView.isInitialized) {
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        }
    }

    private fun notifyNativeFail() {
        arPreviewOn = false
        if (this::previewView.isInitialized) previewView.visibility = View.GONE
        if (!this::webView.isInitialized) return
        webView.evaluateJavascript(
            "window.lvfeArNativeFail&&window.lvfeArNativeFail()",
            null,
        )
    }

    companion object {
        private const val WEB_ORIGIN = "https://appassets.androidplatform.net"
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        arPreviewOn = false
        try {
            cameraProvider?.unbindAll()
        } catch (err: Exception) { /* */ }
        if (this::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }
}
