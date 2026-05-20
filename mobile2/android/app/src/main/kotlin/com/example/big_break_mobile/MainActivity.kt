package com.sergeypolyakov.dateasy.mobile2

import android.content.Intent
import androidx.core.content.FileProvider
import com.yandex.authsdk.YandexAuthLoginOptions
import com.yandex.authsdk.YandexAuthOptions
import com.yandex.authsdk.YandexAuthResult
import com.yandex.authsdk.YandexAuthSdk
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterFragmentActivity() {
    private val yandexAuthSdk: YandexAuthSdk by lazy {
        YandexAuthSdk.create(YandexAuthOptions(this))
    }
    private val yandexAuthLauncher = registerForActivityResult(yandexAuthSdk.contract) { authResult ->
        handleYandexAuthResult(authResult)
    }
    private var pendingYandexResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            YANDEX_AUTH_CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "signIn" -> startYandexSignIn(result)
                else -> result.notImplemented()
            }
        }

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            SOCIAL_SHARE_CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "shareInstagramStory" -> shareInstagramStory(call.arguments, result)
                else -> result.notImplemented()
            }
        }
    }

    private fun startYandexSignIn(result: MethodChannel.Result) {
        if (pendingYandexResult != null) {
            result.error(
                "yandex_auth_in_progress",
                "Yandex auth is already in progress",
                null,
            )
            return
        }

        pendingYandexResult = result
        runCatching {
            yandexAuthLauncher.launch(YandexAuthLoginOptions())
        }.onFailure { error ->
            pendingYandexResult = null
            result.error(
                "yandex_auth_failed",
                error.message ?: "Yandex auth failed",
                null,
            )
        }
    }

    private fun handleYandexAuthResult(authResult: YandexAuthResult) {
        val result = pendingYandexResult ?: return
        pendingYandexResult = null

        when (authResult) {
            is YandexAuthResult.Success -> {
                val token = authResult.token.value
                if (token.isBlank()) {
                    result.error(
                        "missing_yandex_token",
                        "Yandex token is missing",
                        null,
                    )
                } else {
                    result.success(token)
                }
            }
            is YandexAuthResult.Failure -> {
                result.error(
                    "yandex_auth_failed",
                    authResult.exception.message ?: "Yandex auth failed",
                    null,
                )
            }
            YandexAuthResult.Cancelled -> {
                result.error(
                    "yandex_auth_cancelled",
                    "Yandex auth was cancelled",
                    null,
                )
            }
        }
    }

    private fun shareInstagramStory(arguments: Any?, result: MethodChannel.Result) {
        val args = arguments as? Map<*, *>
        val imageBytes = args?.get("backgroundImageBytes") as? ByteArray
        val contentUrl = args?.get("contentUrl") as? String
        val facebookAppId = args?.get("facebookAppId") as? String

        if (imageBytes == null || imageBytes.isEmpty() || contentUrl.isNullOrBlank() || facebookAppId.isNullOrBlank()) {
            result.error(
                "invalid_instagram_story_payload",
                "Instagram story payload is invalid",
                null,
            )
            return
        }

        runCatching {
            val shareDir = File(cacheDir, "share")
            shareDir.mkdirs()
            val storyFile = File(shareDir, "dateasy-story.png")
            storyFile.writeBytes(imageBytes)

            val storyUri = FileProvider.getUriForFile(
                this,
                "$packageName.fileprovider",
                storyFile,
            )
            val intent = Intent("com.instagram.share.ADD_TO_STORY").apply {
                setDataAndType(storyUri, "image/png")
                setPackage("com.instagram.android")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                putExtra("source_application", facebookAppId)
                putExtra("content_url", contentUrl)
            }

            grantUriPermission(
                "com.instagram.android",
                storyUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION,
            )

            if (intent.resolveActivity(packageManager) == null) {
                result.success(false)
            } else {
                startActivity(intent)
                result.success(true)
            }
        }.onFailure { error ->
            result.error(
                "instagram_story_failed",
                error.message ?: "Instagram story share failed",
                null,
            )
        }
    }

    companion object {
        private const val YANDEX_AUTH_CHANNEL = "app.yandex.auth"
        private const val SOCIAL_SHARE_CHANNEL = "app.social.share"
    }
}
