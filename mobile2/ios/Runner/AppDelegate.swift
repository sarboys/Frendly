import Flutter
import UIKit
import YandexLoginSDK
import YandexMapsMobile

private let mapkitApiKeyInfoKey = "MapkitApiKey"
private let dartDefinesInfoKey = "DartDefines"
private let mapkitDartDefineKey = "BIG_BREAK_MAPKIT_API_KEY"
private let pushTokenChannelName = "app.push.token"
private let pushTokenStorageKey = "app.push.token.cached"
private let socialShareChannelName = "app.social.share"
private let yandexAuthChannelName = "app.yandex.auth"
private let yandexClientIdInfoKey = "YandexClientId"

@main
@objc class AppDelegate: FlutterAppDelegate {
  private var bootstrapChannel: FlutterMethodChannel?
  private var pushTokenChannel: FlutterMethodChannel?
  private var socialShareChannel: FlutterMethodChannel?
  private var yandexAuthChannel: FlutterMethodChannel?
  private var pendingPushTokenResult: FlutterResult?
  private var pendingYandexAuthResult: FlutterResult?
  private var yandexLoginClientId: String?
  private var isMapkitConfigured = false

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    YMKMapKit.setLocale("ru_RU")
    configureMapkit(apiKey: configuredMapkitApiKey())

    GeneratedPluginRegistrant.register(with: self)

    if let registrar = registrar(forPlugin: "AppBootstrapChannel") {
      registerBootstrapChannel(with: registrar)
      registerPushTokenChannel(with: registrar)
      registerSocialShareChannel(with: registrar)
      registerYandexAuthChannel(with: registrar)
    }

    YandexLoginSDK.shared.add(observer: self)
    activateConfiguredYandexLoginSDK()

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  private func registerBootstrapChannel(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(
      name: "app.mapkit.bootstrap",
      binaryMessenger: registrar.messenger()
    )
    channel.setMethodCallHandler { call, result in
      guard call.method == "ensureInitialized" else {
        result(FlutterMethodNotImplemented)
        return
      }

      let args = call.arguments as? [String: Any]
      let apiKey = args?["apiKey"] as? String
      if self.configureMapkit(apiKey: apiKey ?? self.configuredMapkitApiKey()) {
        result(nil)
      } else {
        result(FlutterError(
          code: "mapkit_api_key_missing",
          message: "BIG_BREAK_MAPKIT_API_KEY is not set",
          details: nil
        ))
      }
    }
    bootstrapChannel = channel
  }

  private func configuredMapkitApiKey() -> String? {
    if let key = normalizedMapkitApiKey(
      Bundle.main.object(forInfoDictionaryKey: mapkitApiKeyInfoKey) as? String
    ) {
      return key
    }

    if let key = normalizedMapkitApiKey(
      ProcessInfo.processInfo.environment[mapkitDartDefineKey]
    ) {
      return key
    }

    return mapkitApiKeyFromDartDefines()
  }

  @discardableResult
  private func configureMapkit(apiKey: String?) -> Bool {
    guard !isMapkitConfigured else {
      return true
    }

    guard let key = normalizedMapkitApiKey(apiKey) else {
      NSLog("BIG_BREAK_MAPKIT_API_KEY is not set")
      return false
    }

    YMKMapKit.setApiKey(key)
    isMapkitConfigured = true
    return true
  }

  private func normalizedMapkitApiKey(_ value: String?) -> String? {
    let key = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    guard !key.isEmpty, !key.hasPrefix("$(") else {
      return nil
    }
    return key
  }

  private func mapkitApiKeyFromDartDefines() -> String? {
    guard let encodedDefines = Bundle.main.object(
      forInfoDictionaryKey: dartDefinesInfoKey
    ) as? String else {
      return nil
    }

    for encodedDefine in encodedDefines.split(separator: ",") {
      guard let data = Data(base64Encoded: String(encodedDefine)),
            let define = String(data: data, encoding: .utf8) else {
        continue
      }

      let parts = define.split(
        separator: "=",
        maxSplits: 1,
        omittingEmptySubsequences: false
      )
      guard parts.count == 2, parts[0] == mapkitDartDefineKey else {
        continue
      }

      return normalizedMapkitApiKey(String(parts[1]))
    }

    return nil
  }

  private func registerPushTokenChannel(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(
      name: pushTokenChannelName,
      binaryMessenger: registrar.messenger()
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(nil)
        return
      }

      switch call.method {
      case "registerDeviceToken":
        self.registerDeviceToken(result: result)
      case "clearRegisteredToken":
        UserDefaults.standard.removeObject(forKey: pushTokenStorageKey)
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    pushTokenChannel = channel
  }

  private func registerYandexAuthChannel(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(
      name: yandexAuthChannelName,
      binaryMessenger: registrar.messenger()
    )
    channel.setMethodCallHandler { [weak self] call, result in
      guard let self else {
        result(nil)
        return
      }

      switch call.method {
      case "signIn":
        self.startYandexAuth(call: call, result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    yandexAuthChannel = channel
  }

  private func registerSocialShareChannel(with registrar: FlutterPluginRegistrar) {
    let channel = FlutterMethodChannel(
      name: socialShareChannelName,
      binaryMessenger: registrar.messenger()
    )
    channel.setMethodCallHandler { call, result in
      switch call.method {
      case "shareInstagramStory":
        self.shareInstagramStory(call: call, result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    socialShareChannel = channel
  }

  private func registerDeviceToken(result: @escaping FlutterResult) {
    if pendingPushTokenResult != nil {
      result(nil)
      return
    }

    pendingPushTokenResult = result
    DispatchQueue.main.async {
      UIApplication.shared.registerForRemoteNotifications()
    }
  }

  private func shareInstagramStory(call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard let arguments = call.arguments as? [String: Any],
          let imageData = arguments["backgroundImageBytes"] as? FlutterStandardTypedData,
          let contentUrl = arguments["contentUrl"] as? String,
          let facebookAppId = arguments["facebookAppId"] as? String,
          !imageData.data.isEmpty,
          !contentUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
          !facebookAppId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      result(FlutterError(
        code: "invalid_instagram_story_payload",
        message: "Instagram story payload is invalid",
        details: nil
      ))
      return
    }

    guard var components = URLComponents(string: "instagram-stories://share") else {
      result(false)
      return
    }
    components.queryItems = [
      URLQueryItem(name: "source_application", value: facebookAppId)
    ]

    guard let shareUrl = components.url,
          UIApplication.shared.canOpenURL(shareUrl) else {
      result(false)
      return
    }

    let pasteboardItems: [[String: Any]] = [
      [
        "com.instagram.sharedSticker.backgroundImage": imageData.data,
        "com.instagram.sharedSticker.contentURL": contentUrl
      ]
    ]
    let options: [UIPasteboard.OptionsKey: Any] = [
      .expirationDate: Date().addingTimeInterval(300)
    ]
    UIPasteboard.general.setItems(pasteboardItems, options: options)

    UIApplication.shared.open(shareUrl, options: [:]) { opened in
      result(opened)
    }
  }

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)

    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    UserDefaults.standard.set(token, forKey: pushTokenStorageKey)
    pendingPushTokenResult?(token)
    pendingPushTokenResult = nil
  }

  override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
    pendingPushTokenResult?(nil)
    pendingPushTokenResult = nil
  }

  override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    if YandexLoginSDK.shared.tryHandleOpenURL(url) {
      return true
    }
    return super.application(app, open: url, options: options)
  }

  override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    if YandexLoginSDK.shared.tryHandleUserActivity(userActivity) {
      return true
    }
    return super.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }

  private func startYandexAuth(call: FlutterMethodCall, result: @escaping FlutterResult) {
    if pendingYandexAuthResult != nil {
      result(FlutterError(
        code: "yandex_auth_in_progress",
        message: "Yandex auth is already in progress",
        details: nil
      ))
      return
    }

    guard let clientId = yandexClientId(from: call) ?? configuredYandexClientId() else {
      result(FlutterError(
        code: "yandex_auth_not_configured",
        message: "Yandex client id is missing",
        details: nil
      ))
      return
    }

    do {
      try ensureYandexLoginActivated(clientId: clientId)
      guard let viewController = activeViewController() else {
        result(FlutterError(
          code: "yandex_auth_unavailable",
          message: "Active view controller is missing",
          details: nil
        ))
        return
      }

      pendingYandexAuthResult = result
      try YandexLoginSDK.shared.authorize(
        with: viewController,
        customValues: nil,
        authorizationStrategy: .default
      )
    } catch {
      pendingYandexAuthResult = nil
      result(FlutterError(
        code: "yandex_auth_failed",
        message: error.localizedDescription,
        details: nil
      ))
    }
  }

  private func activateConfiguredYandexLoginSDK() {
    guard let clientId = configuredYandexClientId() else {
      return
    }

    try? ensureYandexLoginActivated(clientId: clientId)
  }

  private func ensureYandexLoginActivated(clientId: String) throws {
    if yandexLoginClientId == clientId {
      return
    }

    try YandexLoginSDK.shared.activate(with: clientId)
    yandexLoginClientId = clientId
  }

  private func yandexClientId(from call: FlutterMethodCall) -> String? {
    guard let arguments = call.arguments as? [String: Any],
          let raw = arguments["clientId"] as? String else {
      return nil
    }
    return cleanYandexClientId(raw)
  }

  private func configuredYandexClientId() -> String? {
    let raw = Bundle.main.object(forInfoDictionaryKey: yandexClientIdInfoKey) as? String
    return cleanYandexClientId(raw)
  }

  private func cleanYandexClientId(_ raw: String?) -> String? {
    let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if value.isEmpty || value.contains("$(") {
      return nil
    }
    return value
  }

  private func activeViewController() -> UIViewController? {
    let rootViewController: UIViewController?
    if #available(iOS 13.0, *) {
      rootViewController = UIApplication.shared.connectedScenes
        .compactMap { $0 as? UIWindowScene }
        .first { $0.activationState == .foregroundActive }?
        .windows
        .first { $0.isKeyWindow }?
        .rootViewController
    } else {
      rootViewController = UIApplication.shared.keyWindow?.rootViewController
    }

    return topViewController(from: rootViewController)
  }

  private func topViewController(from rootViewController: UIViewController?) -> UIViewController? {
    if let navigationController = rootViewController as? UINavigationController {
      return topViewController(from: navigationController.visibleViewController)
    }
    if let tabController = rootViewController as? UITabBarController {
      return topViewController(from: tabController.selectedViewController)
    }
    if let presented = rootViewController?.presentedViewController {
      return topViewController(from: presented)
    }
    return rootViewController
  }
}

extension AppDelegate: YandexLoginSDKObserver {
  func didFinishLogin(with result: Result<LoginResult, Error>) {
    guard let pendingResult = pendingYandexAuthResult else {
      return
    }

    pendingYandexAuthResult = nil
    switch result {
    case .success(let loginResult):
      let token = loginResult.token.trimmingCharacters(in: .whitespacesAndNewlines)
      if token.isEmpty {
        pendingResult(FlutterError(
          code: "missing_yandex_token",
          message: "Yandex token is missing",
          details: nil
        ))
      } else {
        pendingResult(token)
      }
    case .failure(let error):
      pendingResult(FlutterError(
        code: "yandex_auth_failed",
        message: error.localizedDescription,
        details: nil
      ))
    }
  }
}
