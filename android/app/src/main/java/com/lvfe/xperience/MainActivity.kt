package com.lvfe.xperience

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.view.View
import android.util.Base64
import android.webkit.GeolocationPermissions
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.lifecycle.lifecycleScope
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
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
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
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

    private var sensorManager: SensorManager? = null
    private var rotationSensor: Sensor? = null
    private var headingListening = false
    @Volatile private var deviceHeadingDeg: Float = Float.NaN
    private val rotationMatrix = FloatArray(9)
    private val orientationAngles = FloatArray(3)
    private var pendingDeepLink: JSONObject? = null
    private var pageReady = false

    private val headingListener = object : SensorEventListener {
        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        override fun onSensorChanged(event: SensorEvent?) {
            if (event == null || event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) return
            SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values)
            SensorManager.getOrientation(rotationMatrix, orientationAngles)
            // azimuth: radians, -π…π, 0 = north, clockwise positive in our map convention
            var deg = Math.toDegrees(orientationAngles[0].toDouble()).toFloat()
            deg = (deg + 360f) % 360f
            deviceHeadingDeg = deg
        }
    }

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
            runOnUiThread {
                startHeadingUpdates()
                bindRearPreview(CameraSelector.DEFAULT_BACK_CAMERA)
            }
        }

        @JavascriptInterface
        fun stopArCamera() {
            runOnUiThread {
                stopHeadingUpdates()
                unbindRearPreview()
            }
        }

        /** Device heading in degrees clockwise from north, or -1 if unknown. */
        @JavascriptInterface
        fun getDeviceHeading(): Double {
            val h = deviceHeadingDeg
            return if (h.isNaN()) -1.0 else h.toDouble()
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
        fun googleSignInReady(): Boolean = googleConfigured()

        @JavascriptInterface
        fun signInWithGoogle() {
            runOnUiThread { startGoogleSignIn() }
        }

        @JavascriptInterface
        fun hasNotifications(): Boolean = hasNotificationPermission()

        @JavascriptInterface
        fun requestNotifications() {
            runOnUiThread { requestNotificationPerms() }
        }

        /** JSON payload from LvfeGameNotify.buildPayload. Returns status string. */
        @JavascriptInterface
        fun showGameNotification(json: String): String {
            return try {
                val obj = JSONObject(json)
                if (!hasNotificationPermission()) {
                    runOnUiThread { requestNotificationPerms() }
                    return "denied"
                }
                postGameNotification(obj)
            } catch (err: Exception) {
                "error"
            }
        }

        @JavascriptInterface
        fun cancelGameNotification(id: Int) {
            runOnUiThread {
                NotificationManagerCompat.from(this@MainActivity).cancel(NOTIF_TAG, id)
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
        ensureNotificationChannels()
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
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        rotationSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        captureDeepLink(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        captureDeepLink(intent)
        flushDeepLink()
    }

    private fun startHeadingUpdates() {
        val sm = sensorManager ?: return
        val sensor = rotationSensor ?: return
        if (headingListening) return
        headingListening = true
        sm.registerListener(headingListener, sensor, SensorManager.SENSOR_DELAY_GAME)
    }

    private fun stopHeadingUpdates() {
        if (!headingListening) return
        headingListening = false
        try {
            sensorManager?.unregisterListener(headingListener)
        } catch (err: Exception) { /* */ }
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
        webView.addOnLayoutChangeListener { _, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom ->
            if (right - left != oldRight - oldLeft || bottom - top != oldBottom - oldTop) {
                notifyMapFit(webView)
                webView.postDelayed({ notifyMapFit(webView) }, 50)
            }
        }

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
                notifyMapFit(view)
                view?.post { notifyMapFit(view) }
                view?.postDelayed({ notifyMapFit(view) }, 80)
                view?.postDelayed({ notifyMapFit(view) }, 400)
                pageReady = true
                flushDeepLink()
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

    private fun notifyMapFit(view: WebView? = null) {
        val wv = view ?: if (this::webView.isInitialized) webView else return
        wv.evaluateJavascript("window.lvfeFitMap&&window.lvfeFitMap()", null)
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

    private fun googleWebClientId(): String = getString(R.string.google_web_client_id).trim()

    private fun googleConfigured(): Boolean {
        val id = googleWebClientId()
        if (id.isEmpty()) return false
        if (id.contains("REPLACE", ignoreCase = true) ||
            id.contains("YOUR_", ignoreCase = true) ||
            id.contains("PASTE", ignoreCase = true)
        ) {
            return false
        }
        return id.endsWith(".apps.googleusercontent.com")
    }

    private fun startGoogleSignIn() {
        if (!googleConfigured()) {
            notifyGoogleSignIn(
                JSONObject()
                    .put("ok", false)
                    .put("code", "oauth_not_configured")
                    .put("title", "Google sign-in is not wired yet.")
                    .put(
                        "message",
                        "Paste a Web OAuth client ID into google-auth.config.js and strings.xml google_web_client_id. Android package com.lvfe.xperience. SHA-1 from the debug keystore. Do not add Maps SDK, Places, or Photorealistic 3D.",
                    ),
            )
            return
        }
        lifecycleScope.launch {
            try {
                val option = GetGoogleIdOption.Builder()
                    .setFilterByAuthorizedAccounts(false)
                    .setServerClientId(googleWebClientId())
                    .setAutoSelectEnabled(false)
                    .build()
                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(option)
                    .build()
                val cm = CredentialManager.create(this@MainActivity)
                val result = cm.getCredential(this@MainActivity, request)
                val google = GoogleIdTokenCredential.createFrom(result.credential.data)
                val parsed = parseIdToken(google.idToken)
                if (parsed == null) {
                    notifyGoogleSignIn(
                        JSONObject()
                            .put("ok", false)
                            .put("code", "bad_token")
                            .put("message", "Google token did not parse."),
                    )
                    return@launch
                }
                val photo = google.profilePictureUri?.toString()
                    ?: parsed.third.takeIf { it.isNotBlank() }
                    ?: ""
                notifyGoogleSignIn(
                    JSONObject()
                        .put("ok", true)
                        .put("sub", parsed.first)
                        .put("email", parsed.second)
                        .put("photoUrl", photo)
                        .put("idToken", google.idToken),
                )
            } catch (err: Exception) {
                notifyGoogleSignIn(
                    JSONObject()
                        .put("ok", false)
                        .put("code", "native_fail")
                        .put("message", err.message ?: "Google sign-in failed."),
                )
            }
        }
    }

    private fun parseIdToken(token: String?): Triple<String, String, String>? {
        if (token.isNullOrBlank()) return null
        return try {
            val parts = token.split(".")
            if (parts.size < 2) return null
            val body = String(
                Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING),
            )
            val obj = JSONObject(body)
            val sub = obj.optString("sub")
            if (sub.isBlank()) null
            else Triple(sub, obj.optString("email"), obj.optString("picture"))
        } catch (err: Exception) {
            null
        }
    }

    private fun notifyGoogleSignIn(payload: JSONObject) {
        if (!this::webView.isInitialized) return
        webView.evaluateJavascript(
            "window.lvfeOnGoogleSignIn&&window.lvfeOnGoogleSignIn($payload)",
            null,
        )
    }

    private fun ensureNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val mgr = getSystemService(NotificationManager::class.java) ?: return
        val channels = listOf(
            NotificationChannel(CHANNEL_CLAIMS, "Your claims", NotificationManager.IMPORTANCE_DEFAULT),
            NotificationChannel(CHANNEL_NEARBY, "Nearby assets", NotificationManager.IMPORTANCE_DEFAULT),
            NotificationChannel(CHANNEL_ENEMY, "Rival alerts", NotificationManager.IMPORTANCE_HIGH),
            NotificationChannel(CHANNEL_GAME, "Lvfe", NotificationManager.IMPORTANCE_LOW),
        )
        channels.forEach { ch ->
            ch.description = "Game alerts for Lvfe"
            mgr.createNotificationChannel(ch)
        }
    }

    private fun hasNotificationPermission(): Boolean {
        if (Build.VERSION.SDK_INT < 33) return true
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestNotificationPerms() {
        if (Build.VERSION.SDK_INT < 33) return
        if (hasNotificationPermission()) return
        launchPerms(listOf(Manifest.permission.POST_NOTIFICATIONS))
    }

    private fun postGameNotification(obj: JSONObject): String {
        return try {
            val id = obj.optInt("id", (System.currentTimeMillis() % 100000).toInt())
            val channel = when (obj.optString("channel")) {
                "claims" -> CHANNEL_CLAIMS
                "nearby" -> CHANNEL_NEARBY
                "enemy" -> CHANNEL_ENEMY
                else -> CHANNEL_GAME
            }
            val title = obj.optString("title", "Lvfe")
            val body = obj.optString("body", "")
            val placeId = obj.optString("placeId", "")
            val type = obj.optString("type", "")
            val tapAction = obj.optString("action", "open")

            val contentIntent = deepLinkIntent(placeId, tapAction, type, id)
            val builder = NotificationCompat.Builder(this, channel)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(contentIntent)

            val actions = obj.optJSONArray("actions") ?: JSONArray()
            for (i in 0 until actions.length()) {
                val act = actions.optJSONObject(i) ?: continue
                val actId = act.optString("id", "open")
                val label = act.optString("label", "Open")
                val pi = deepLinkIntent(placeId, actId, type, id * 10 + i + 1)
                builder.addAction(0, label, pi)
            }

            NotificationManagerCompat.from(this).notify(NOTIF_TAG, id, builder.build())
            "ok"
        } catch (err: Exception) {
            "error"
        }
    }

    private fun deepLinkIntent(
        placeId: String,
        action: String,
        type: String,
        requestCode: Int,
    ): PendingIntent {
        val intent = Intent(this, MainActivity::class.java).apply {
            this.action = Intent.ACTION_VIEW
            data = if (placeId.isNotBlank()) {
                Uri.parse("lvfe://place/$placeId?action=$action")
            } else {
                Uri.parse("lvfe://place/?action=$action")
            }
            putExtra(EXTRA_PLACE_ID, placeId)
            putExtra(EXTRA_ACTION, action)
            putExtra(EXTRA_TYPE, type)
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getActivity(this, requestCode, intent, flags)
    }

    private fun captureDeepLink(intent: Intent?) {
        if (intent == null) return
        var placeId = intent.getStringExtra(EXTRA_PLACE_ID) ?: ""
        var action = intent.getStringExtra(EXTRA_ACTION) ?: "open"
        var type = intent.getStringExtra(EXTRA_TYPE) ?: ""
        val data = intent.data
        if (placeId.isBlank() && data != null && data.scheme == "lvfe") {
            placeId = data.lastPathSegment?.takeIf { it.isNotBlank() && it != "place" } ?: ""
            action = data.getQueryParameter("action") ?: action
        }
        if (placeId.isBlank() && action == "open" && type.isBlank()) return
        pendingDeepLink = JSONObject()
            .put("placeId", placeId)
            .put("action", action)
            .put("type", type)
    }

    private fun flushDeepLink() {
        val payload = pendingDeepLink ?: return
        if (!pageReady || !this::webView.isInitialized) return
        pendingDeepLink = null
        webView.evaluateJavascript(
            "window.lvfeDeepLink&&window.lvfeDeepLink($payload)",
            null,
        )
    }

    companion object {
        private const val WEB_ORIGIN = "https://appassets.androidplatform.net"
        private const val NOTIF_TAG = "lvfe"
        private const val CHANNEL_CLAIMS = "claims"
        private const val CHANNEL_NEARBY = "nearby"
        private const val CHANNEL_ENEMY = "enemy"
        private const val CHANNEL_GAME = "game"
        const val EXTRA_PLACE_ID = "lvfe_place_id"
        const val EXTRA_ACTION = "lvfe_action"
        const val EXTRA_TYPE = "lvfe_type"
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
        stopHeadingUpdates()
        try {
            cameraProvider?.unbindAll()
        } catch (err: Exception) { /* */ }
        if (this::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }
}
