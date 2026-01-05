package com.becodemy.ridewaveparent

import android.app.Application
import android.content.res.Configuration
import android.util.Log

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
        this,
        object : DefaultReactNativeHost(this) {
          override fun getPackages(): List<ReactPackage> {
            // Packages that cannot be autolinked yet can be added manually here, for example:
            // packages.add(new MyReactNativePackage());
            return PackageList(this).packages
          }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
          override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() {
      try {
        Log.e("RideWaveParent", "MainApplication.reactHost: Creating ReactHost")
        val host = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)
        Log.e("RideWaveParent", "MainApplication.reactHost: ReactHost created successfully")
        return host
      } catch (e: Throwable) {
        Log.e("RideWaveParent", "MainApplication.reactHost: CRASH", e)
        throw e
      }
    }

  override fun onCreate() {
    try {
      Log.e("RideWaveParent", "MainApplication.onCreate: START")
      super.onCreate()
      Log.e("RideWaveParent", "MainApplication.onCreate: super.onCreate() completed")
      
      Log.e("RideWaveParent", "MainApplication.onCreate: Starting SoLoader.init")
      SoLoader.init(this, false)
      Log.e("RideWaveParent", "MainApplication.onCreate: SoLoader.init completed")
      
      if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
        Log.e("RideWaveParent", "MainApplication.onCreate: New Architecture enabled, calling load()")
        // If you opted-in for the New Architecture, we load the native entry point for this app.
        load()
        Log.e("RideWaveParent", "MainApplication.onCreate: load() completed")
      } else {
        Log.e("RideWaveParent", "MainApplication.onCreate: New Architecture disabled")
      }
      
      Log.e("RideWaveParent", "MainApplication.onCreate: Starting ApplicationLifecycleDispatcher.onApplicationCreate")
      ApplicationLifecycleDispatcher.onApplicationCreate(this)
      Log.e("RideWaveParent", "MainApplication.onCreate: ApplicationLifecycleDispatcher.onApplicationCreate completed")
      Log.e("RideWaveParent", "MainApplication.onCreate: SUCCESS")
    } catch (e: Throwable) {
      Log.e("RideWaveParent", "MainApplication.onCreate: CRASH", e)
      throw e
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
