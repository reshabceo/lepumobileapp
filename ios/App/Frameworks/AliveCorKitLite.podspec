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
  # Simulator exclusions (arm64 simulator not supported)
  s.pod_target_xcconfig = {
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'arm64',
    # Ensure dSYM is generated for the host app — the xcframework itself ships
    # without a dSYM (vendor restriction); suppress the Xcode/App Store warning.
    'DWARF_DSYM_SHOULD_STRIP' => 'NO',
    'DEBUG_INFORMATION_FORMAT' => 'dwarf-with-dsym',
    'VALIDATE_BITCODE' => 'NO'
  }
  s.user_target_xcconfig = {
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'arm64',
    'DWARF_DSYM_SHOULD_STRIP' => 'NO',
    'DEBUG_INFORMATION_FORMAT' => 'dwarf-with-dsym',
    'VALIDATE_BITCODE' => 'NO'
  }
end
