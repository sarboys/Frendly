package com.sergeypolyakov.dateasy.mobile2

import android.app.Application
import android.util.Log
import com.yandex.mapkit.MapKitFactory

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        MapKitFactory.setLocale("ru_RU")

        val apiKey = BuildConfig.MAPKIT_API_KEY
        if (apiKey.isBlank()) {
            Log.w("MainApplication", "BIG_BREAK_MAPKIT_API_KEY is not set")
            return
        }

        MapKitFactory.setApiKey(apiKey)
    }
}
