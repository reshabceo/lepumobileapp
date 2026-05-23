Pod::Spec.new do |s|
  s.name             = 'CameraBridge'
  s.version          = '1.0.0'
  s.summary          = 'Monitraq RTSP→WHIP camera bridge (gomobile).'
  s.description      = 'Pulls Reolink RTSP on the LAN and publishes WHIP to camera-stream-service. Built from camera-bridge-core/mobile via `gomobile bind -target=ios`.'
  s.homepage         = 'https://monitraq.com'
  s.license          = { :type => 'Proprietary', :text => 'Copyright Monitraq.' }
  s.author           = { 'Monitraq' => 'dev@monitraq.com' }
  s.platform         = :ios, '14.0'
  s.source           = { :path => '.' }
  # Produced by: cd camera-bridge-core && make xcframework
  s.vendored_frameworks = 'Mobile.xcframework'
  s.frameworks       = 'AVFoundation'
end
