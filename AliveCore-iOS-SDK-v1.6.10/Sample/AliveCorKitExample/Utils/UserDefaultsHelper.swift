//
//  UserDefaultsHelper.swift
//  AliveCorKitExample
//
//  Created by rex hsu on 9/9/24.
//  Copyright © 2024 AliveCor. All rights reserved.
//

import Foundation
import AliveCorKitLite


@objcMembers
class UserDefaultsHelper: NSObject {
    
    private enum Keys: String {
        case selectedRecordingDeviceType
        case selectedRecordingDuration
        case selectedRecordingLeadsConfig
        case selectedRecordingFilterType
        case selectedMainsFrequency
        case pdfLanguageKey
        case recordingLanguageKey
        case enableLeadModeSwitch
    }
    
    static let shared = UserDefaultsHelper()
    
    let userDefaults = UserDefaults.standard
    
    override init() {
        UserDefaults.standard.register(defaults: [
            Keys.enableLeadModeSwitch.rawValue: true,
            Keys.selectedRecordingDeviceType.rawValue: ACKDeviceType.triangle.rawValue,
            Keys.selectedRecordingDuration.rawValue: 30,
            Keys.selectedRecordingLeadsConfig.rawValue: ACKLeadsConfig.six.rawValue,
            Keys.selectedRecordingFilterType.rawValue: ACKFilterType.enhanced.rawValue,
            Keys.selectedMainsFrequency.rawValue: ACKMainsFrequency.frequency50Hz.rawValue
        ])
    }
    
    var enableLeadModeSwitch: Bool {
        set {
            UserDefaults.standard.setValue(newValue, forKey: Keys.enableLeadModeSwitch.rawValue)
        }
        
        get {
            return UserDefaults.standard.bool(forKey: Keys.enableLeadModeSwitch.rawValue)
        }
    }
    
    var pdfLanguageType: ACKLanguageType? {
        set {
            guard let value = newValue else {
                UserDefaults.standard.removeObject(forKey: Keys.pdfLanguageKey.rawValue)
                return
            }
            UserDefaults.standard.setValue(value, forKey: Keys.pdfLanguageKey.rawValue)
        }
        
        get {
            guard let type = UserDefaults.standard.string(forKey: Keys.pdfLanguageKey.rawValue) else {
                return nil
            }
            return ACKLanguageType(rawValue: type)
        }
    }
    
    var recordingLanguageType: ACKLanguageType? {
        set {
            guard let value = newValue else {
                UserDefaults.standard.removeObject(forKey: Keys.recordingLanguageKey.rawValue)
                return
            }
            UserDefaults.standard.setValue(value, forKey: Keys.recordingLanguageKey.rawValue)
        }
        
        get {
            guard let type = UserDefaults.standard.string(forKey: Keys.recordingLanguageKey.rawValue) else {
                return nil
            }
            return ACKLanguageType(rawValue: type)
        }
    }

    var enabledLeadSwitch: Bool {
        get {
            return userDefaults.bool(forKey: Keys.enableLeadModeSwitch.rawValue)
        }
        set {
            userDefaults.setValue(newValue, forKey: Keys.enableLeadModeSwitch.rawValue)
            print("rex:: set enabledLeadSwitch to \(enabledLeadSwitch)")
        }
    }
    
    var selectedRecordingDeviceType: ACKDeviceType {
        get {
            let type = userDefaults.string(forKey: Keys.selectedRecordingDeviceType.rawValue)!
            return ACKDeviceType(rawValue: type)
        }
        set {
            userDefaults.setValue(newValue.rawValue, forKey: Keys.selectedRecordingDeviceType.rawValue)
        }
    }
    
    var selectedRecordingLeadsConfig: ACKLeadsConfig {
        get {
            let type = userDefaults.integer(forKey: Keys.selectedRecordingLeadsConfig.rawValue)
            return ACKLeadsConfig(rawValue: type)!
        }
        set {
            userDefaults.setValue(newValue.rawValue, forKey: Keys.selectedRecordingLeadsConfig.rawValue)
        }
    }
    
    var selectedRecordingDuration: Int {
        get {
            return userDefaults.integer(forKey: Keys.selectedRecordingDuration.rawValue)
        }
        set {
            userDefaults.setValue(newValue, forKey: Keys.selectedRecordingDuration.rawValue)
        }
    }
    
    var selectedRecordingFilter: ACKFilterType {
        get {
            let type = userDefaults.integer(forKey: Keys.selectedRecordingFilterType.rawValue)
            return ACKFilterType(rawValue: type)!
        }
        set {
            userDefaults.setValue(newValue.rawValue, forKey: Keys.selectedRecordingFilterType.rawValue)
        }
    }
    
    var selectedMainsFrequency: ACKMainsFrequency {
        get {
            let frequency = userDefaults.integer(forKey: Keys.selectedMainsFrequency.rawValue)
            return ACKMainsFrequency(rawValue: UInt(frequency))!
        }
        set {
            userDefaults.setValue(newValue.rawValue, forKey: Keys.selectedMainsFrequency.rawValue)
        }
    }
    
}
