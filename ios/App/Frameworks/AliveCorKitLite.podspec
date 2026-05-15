Pod::Spec.new do |s|
  s.name             = 'AliveCorKitLite'
  s.version          = '1.6.10'
  s.summary          = 'AliveCor SDK for iOS'
  s.description      = 'Kardia SDK for performing ECG recordings.'
  s.homepage         = 'https://www.alivecor.com'
  s.license          = { :type => 'Commercial', :text => 'Copyright AliveCor, Inc.' }
  s.author           = { 'AliveCor' => 'support@alivecor.com' }
  s.platform         = :ios, '14.0'
  s.source           = { :path => '.' }
  s.vendored_frameworks = 'AliveCorKitLite.xcframework'
  s.resource_bundles = {
    'AliveCorKitAssets' => ['AliveCorKitAssets.bundle']
  }
  s.frameworks       = 'CoreBluetooth', 'CoreMedia', 'AVFoundation'
  s.libraries        = 'c++'
  s.pod_target_xcconfig = { 'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'arm64' }
  s.user_target_xcconfig = { 'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'arm64' }
end
