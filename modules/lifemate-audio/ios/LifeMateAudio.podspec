Pod::Spec.new do |s|
  s.name = 'LifeMateAudio'
  s.version = '1.0.0'
  s.summary = 'On-device audio editing for LifeMate'
  s.description = 'AVFoundation audio extraction, trimming and sequential composition.'
  s.license = { :type => 'Proprietary' }
  s.author = 'LifeMate'
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'AVFoundation'
  s.source_files = '*.swift'
end
