import Flutter
import UIKit
import YandexLoginSDK

class SceneDelegate: FlutterSceneDelegate {
  override func scene(
    _ scene: UIScene,
    openURLContexts URLContexts: Set<UIOpenURLContext>
  ) {
    for urlContext in URLContexts {
      if YandexLoginSDK.shared.tryHandleOpenURL(urlContext.url) {
        return
      }
    }

    super.scene(scene, openURLContexts: URLContexts)
  }

  override func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    if YandexLoginSDK.shared.tryHandleUserActivity(userActivity) {
      return
    }

    super.scene(scene, continue: userActivity)
  }
}
