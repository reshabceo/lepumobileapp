#
#  Be sure to run `pod spec lint VTMProductLib.podspec' to ensure this is a
#  valid spec and to remove all comments including this before submitting the spec.
#
#  To learn more about Podspec attributes see https://guides.cocoapods.org/syntax/podspec.html
#  To see working Podspecs in the CocoaPods repo see https://github.com/CocoaPods/Specs/
#

Pod::Spec.new do |spec|


  spec.name         = "VTMProductLib"
  spec.version      = "1.5.5"
  spec.summary      = "Support Lepu's products."

  spec.description  = <<-DESC
                  Support communication between Lepu's products and iOS devices.
                   DESC

  spec.homepage     = "https://github.com/Viatom-iOS/VTProductLib_Pods"
  spec.license      = { :type => "MIT", :file => "LICENSE" }
  spec.author       = { "yangweichao" => "yangweichao@lepucloud.com"}
  spec.source       = {
        :git => "https://github.com/Viatom-iOS/VTProductLib_Pods.git",
        :tag => spec.version
    }
  spec.ios.deployment_target = "11.0"

  spec.vendored_frameworks = "VTMProductLib.xcframework"
  spec.libraries = 'c++', 'stdc++'


  spec.pod_target_xcconfig = { 'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'arm64' }

  spec.public_header_files = "VTMProductLib.xcframework/ios-arm64/VTMProductLib.framework/Headers/*.h"
  spec.source_files = "VTMProductLib.xcframework/**/Headers/*.h"
  
end
