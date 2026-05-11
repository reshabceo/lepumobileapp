//
//  DebugUtils.swift
//  AliveCorKitExample
//
//  Created by rex hsu on 7/8/24.
//  Copyright © 2024 AliveCor. All rights reserved.
//

import Foundation
import AliveCorKitLite

@objc
class DebugUtils: NSObject {
    static func createEcgRecord(in directory: String, with atcFilename: String, fileExtension: String, determination: ACKAlgorithmDetermination, leadConfig: ACKLeadsConfig) -> ACKEcgRecord {
        let uuid = UUID().uuidString
        // To mimic how we store the atc after recording.
        let filepath = copyFile(fromResource: atcFilename, withExtension: fileExtension, toSpecificDirectory: directory, copiedFilename: "ecg-\(uuid)")
        _ = copyFile(fromResource: atcFilename, withExtension: fileExtension, toSpecificDirectory: directory, copiedFilename: "ecg-enhanced-\(uuid)")
        
        let ecgFile = ECGFile.openedEcgFile(withAtcPath: filepath!)
        let timezoneOffset = NSNumber(value: TimeZone.current.secondsFromGMT())
        let duration = NSNumber(value:1000*ecgFile.totalSamples/300)
        let config = ACKEcgRecordingConfig(deviceType: .triangle, leadsConfig: leadConfig, filterType: .enhanced, algorithmPackage: "kaiv2", error: nil)
        let device = ACKDevice(deviceType: .triangle, hardwareRevision: "000000000", firmwareRevision: "0.0.0", serialNumber: "11111", batteryLevel: 1, uuid: uuid, bluetoothId: "333333", deviceName: "deviceName")
        
        let evaluation = ACKEcgEvaluation(kaiVersion: "0.0.1", algorithmPackage: "kaiv2", determination: determination.rawValue, modifier: "", averageHeartRate: 80, isInverted: false, errors: nil)
        let record = ACKEcgRecord(uuid: uuid, duration: duration, config: config!, device: device, recordedAt: Date(), timeZoneOffset: timezoneOffset, evaluation: evaluation);
        return record
    }
    
    private static func copyFile(fromResource resource: String, withExtension ext: String, toSpecificDirectory destinationPath: String, copiedFilename: String) -> String? {
        guard let sourceURL = Bundle.main.url(forResource: resource, withExtension: ext) else {
            print("Source file not found in bundle.")
            return nil
        }
        
        let fileManager = FileManager.default
        let destinationURL = URL(fileURLWithPath: destinationPath).appendingPathComponent("\(copiedFilename).\(ext)")
        
        if !fileManager.fileExists(atPath: destinationPath) {
            do {
                try fileManager.createDirectory(atPath: destinationPath, withIntermediateDirectories: true)
            } catch {
                print("Error creating directory: \(error.localizedDescription)")
            }
        }
        
        do {
            if fileManager.fileExists(atPath: destinationURL.path) {
                try fileManager.removeItem(at: destinationURL) // Remove the existing file if it exists
            }
            try fileManager.copyItem(at: sourceURL, to: destinationURL)
            print("File copied to \(destinationURL.path)")
        } catch {
            print("Error copying file: \(error.localizedDescription)")
            return nil
        }
        
        return destinationPath
    }
    
    static func presentAlert(title: String?, message: String?, from viewController: UIViewController) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        let okActon = UIAlertAction(title: "Ok", style: .default)
        alert.addAction(okActon)
        viewController.present(alert, animated: true)
    }
    
}
