Pod::Spec.new do |s|
  s.name           = 'FoodprintVision'
  s.version        = '1.0.0'
  s.summary        = 'Private on-device ingredient label text recognition'
  s.description    = 'Foodprint local Expo module using Apple Vision. No images are uploaded.'
  s.author         = 'Foodprint'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.swift_version  = '5.0'
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.frameworks     = 'Vision', 'ImageIO', 'UIKit'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
