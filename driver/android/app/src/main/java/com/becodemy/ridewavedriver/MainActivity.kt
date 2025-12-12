package com.becodemy.ridewavedriver

import android.content.Intent
import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    
    // Fix for UserHandle serialization error when app is opened from notification
    // Remove UserHandle from Intent extras before it's processed by expo-notifications
    // This prevents "Could not put 'class android.os.UserHandle' to WritableMap" error
    try {
      intent?.let { currentIntent ->
        if (currentIntent.hasExtra("android.intent.extra.USER")) {
          currentIntent.removeExtra("android.intent.extra.USER")
        }
        // Also check for any other non-serializable extras that might cause issues
        val extras = currentIntent.extras
        if (extras != null) {
          val keys = extras.keySet()
          for (key in keys) {
            val value = extras.get(key)
            // Remove UserHandle objects if found under any key
            if (value != null && value.javaClass.name == "android.os.UserHandle") {
              currentIntent.removeExtra(key)
            }
          }
        }
      }
    } catch (e: Exception) {
      // Silently handle any errors during Intent cleanup
      // This ensures the app can still start even if Intent manipulation fails
    }
    
    super.onCreate(savedInstanceState)
  }
  
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    
    // Fix for UserHandle serialization error when app receives new intent from notification
    // Remove UserHandle from Intent extras before it's processed by expo-notifications
    // This prevents "Could not put 'class android.os.UserHandle' to WritableMap" error
    try {
      if (intent.hasExtra("android.intent.extra.USER")) {
        intent.removeExtra("android.intent.extra.USER")
      }
      // Also check for any other non-serializable extras that might cause issues
      val extras = intent.extras
      if (extras != null) {
        val keys = extras.keySet()
        for (key in keys) {
          val value = extras.get(key)
          // Remove UserHandle objects if found under any key
          if (value != null && value.javaClass.name == "android.os.UserHandle") {
            intent.removeExtra(key)
          }
        }
      }
    } catch (e: Exception) {
      // Silently handle any errors during Intent cleanup
      // This ensures the app can still handle the intent even if cleanup fails
    }
    setIntent(intent)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
