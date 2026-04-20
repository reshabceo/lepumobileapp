//
//  AliveCorKitLiteController.swift
//  AliveCorKitExample
//
//  Created by Rex Hsu on 10/01/24.
//  Copyright © 2023 Alivecor. All rights reserved.
//

import Foundation
import UIKit
import AliveCorKitLite

class AliveCorKitLiteController: NSObject {
    var record: ACKEcgRecord?
    var pdfOwnerViewController: UIViewController?
    
    func pushEcgMonitorViewController(_ device: ACKDeviceType, 
                                      leadsConfig: ACKLeadsConfig,
                                      filterType: ACKFilterType,
                                      maxDuration: Int,
                                      mainsFrequency: ACKMainsFrequency,
                                      on viewController: UIViewController) {
        var config: ACKEcgRecordingConfig?
        var error: ACKError?
        var algorithmPackage = ""
        
        algorithmPackage = ACKManager.sharedInstance().algorithmPackageForCurrentKAI()
        config = ACKEcgRecordingConfig(deviceType: device, leadsConfig: leadsConfig, filterType: filterType, maxDuration: maxDuration, algorithmPackage: algorithmPackage, error: &error)
        
        if config == nil && error != nil {
            let alert = UIAlertController(title: "Settings Error", message: error?.localizedTitle, preferredStyle: .alert)
            let defaultAction = UIAlertAction(title: "OK", style: .default, handler: nil)
            alert.addAction(defaultAction)
            viewController.present(alert, animated: true, completion: nil)
            return
        }
        
        let monitorViewController = ACKEcgMonitorViewController(config: config!, delegate: self)
        
        if viewController.navigationController != nil {
            let newController = NavigationController(rootViewController: monitorViewController!)
            configureNavigationBar(for: newController)
            newController.modalPresentationStyle = .fullScreen
            viewController.present(newController, animated: true, completion: nil)
        }
    }
    
    @objc func presentPdfReport() {
        guard let record = record else {
            return
        }
        let config = ACKPDFConfig(ecg: record)
        let metaData = ACKPDFMetadata()
        metaData.notes = "These are the notes for this PDF file"
        metaData.tags = "There are the tags for this PDF file"
        config.metadata = metaData
        
        // Recording date
        let recordingDateFormatter = DateFormatter()
        recordingDateFormatter.timeStyle = .medium
        recordingDateFormatter.dateStyle = .full
        if record.timeZoneOffset != 0 {
            recordingDateFormatter.timeZone = TimeZone(secondsFromGMT: record.timeZoneOffset.intValue)
        }
        // Set timestamp locale
        var languageType = UserDefaultsHelper.shared.pdfLanguageType
        if languageType == nil {
            languageType = UserDefaultsHelper.shared.recordingLanguageType
        }
        let locale = Locale(identifier: languageType?.rawValue ?? "")
        recordingDateFormatter.locale = locale
        
        var dateRecorded: String?
        if let recordedAt = record.recordedAt {
            dateRecorded = recordingDateFormatter.string(from: recordedAt)
        }
        
        let displaySettings = ACKPDFDisplaySettings()
        displaySettings.filterType = record.config.filterType
        displaySettings.languageType = UserDefaultsHelper.shared.pdfLanguageType
        
        var isInverted = (record.evaluation != nil) ? record.evaluation!.isInverted : false
        if record.config.leadsConfig == .six {
            isInverted = false
        }
        
        var allowPVC = false
        if let evaluation = record.evaluation {
            allowPVC = evaluation.determination == .sinusRhythm
        }
        
        let evaluation = record.evaluation
        let atcFilePath = record.enhancedPath ?? ""
        let uuid = record.uuid ?? ""
        let determinationResult = evaluation?.localizedDeterminationShortTitle(UserDefaultsHelper.shared.pdfLanguageType)
        let averageHeartRate = evaluation?.averageHeartRate ?? 0
        let algorithmPackage = evaluation?.algorithmPackage ?? ""
        
        var error: ACKError?
        let pdfPath = ACKPDFReport.pdf(fromTheAtcFilePath: atcFilePath,
                                       uuid: uuid,
                                       determinationResult: determinationResult,
                                       allowPVC: allowPVC,
                                       averageHeartRate: averageHeartRate,
                                       recordedAt: dateRecorded,
                                       isInverted: isInverted,
                                       metadata: metaData,
                                       displaySettings: displaySettings,
                                       algorithmPackage: algorithmPackage,
                                       averageBeats: evaluation?.averageBeats,
                                       beats: evaluation?.beats,
                                       intervals: evaluation?.intervals,
                                       error: &error)
        if let error = error {
            print("Error creating a PDF report: \(error.localizedDescription)")
        }
        
        if let pdfPath = pdfPath,
           let pdfViewController = ACKPDPPreviewController.viewController(withPdfFilePath: pdfPath,
                                                                          navigationBarTitle: uuid,
                                                                          supportsLandscape: true) {
            pdfOwnerViewController?.present(pdfViewController, animated: true)
        } else {
            assertionFailure("Unable creating ACKPDPPreviewController")
        }
        
    }
}

// MARK: - ACKEcgMonitorDelegate
extension AliveCorKitLiteController: ACKEcgMonitorDelegate {
    
    func ecgMonitorViewController(_ viewController: ACKEcgMonitorViewController, didConnectWith device: ACKDevice, continueWithRecording continueHandler: @escaping (Bool) -> Void) {
        print("Bluetooth device is connect: \(device)")
        continueHandler(true)
    }
    
    func showCancelButton(in viewController: ACKEcgMonitorViewController) -> Bool {
        return true
    }
    
    func showSettingsButton(in viewController: ACKEcgMonitorViewController) -> Bool {
        return true
    }
    
    func ecgMonitorViewControllerShouldEnableLeadModeSwitch(_ viewController: ACKEcgMonitorViewController) -> Bool {
        return UserDefaultsHelper.shared.enableLeadModeSwitch
    }
    
    func ecgMonitorViewController(_ viewController: ACKEcgMonitorViewController, didCompleteRecording record: ACKEcgRecord?) {
        guard let record = record else {
            return
        }
        
        guard let vc = ACKEcgPreviewViewController(record: record) else {
            return
        }
        vc.delegate = self
        
        if let navigationController = viewController.navigationController {
            navigationController.pushViewController(vc, animated: true)
        }
        
        pdfOwnerViewController = vc
        self.record = record
    }
    
    
    func ecgMonitorViewController(_ viewController: ACKEcgMonitorViewController, didPressSettingWith config: ACKEcgRecordingConfig?) {
        let alert = UIAlertController(title: "Settings", message: nil, preferredStyle: .actionSheet)
        let cancelAction = UIAlertAction(title: "Cancel", style: .default, handler: nil)
        let doSomethingAction = UIAlertAction(title: "Settings", style: .default) { (action) in
            viewController.dismiss(animated: true, completion: nil)
        }
        
        alert.addAction(doSomethingAction)
        alert.addAction(cancelAction)
        
        viewController.present(alert, animated: true, completion: nil)
    }
    
    func ecgMonitorViewController(_ viewController: ACKEcgMonitorViewController, didEncounterError error: ACKError?) {
        if let error = error {
            print("Encounter error: \(error.localizedDescription)")
        }
    }
    
    func ecgMonitorViewController(_ viewController: ACKEcgMonitorViewController, didEncounterAudioError error: ACKError?) {
        if let error = error {
            print("Encounter audio error: \(error.localizedDescription)")
        }
    }
    
    func availableDeviceTypes(_ viewController: ACKEcgMonitorViewController) -> [ACKDeviceType] {
        return ACKManager.sharedInstance().supportedDevices
    }
}

// MARK: - ACKEcgPreviewDelegate
extension AliveCorKitLiteController: ACKEcgPreviewDelegate {
    func configureNavigationBar(for navigationController: UINavigationController) {
        if #available(iOS 13.0, *) {
            let appearance = UINavigationBarAppearance()
            appearance.backgroundColor = .white
            appearance.shadowColor = .clear
            let navigationBar = navigationController.navigationBar
            navigationBar.standardAppearance = appearance
            navigationBar.scrollEdgeAppearance = navigationBar.standardAppearance
        }
    }
    
    func ecgPreviewViewController(_ viewController: ACKEcgPreviewViewController, didFinishWith record: ACKEcgRecord?) {
        viewController.dismiss(animated: true, completion: nil)
    }
    
    func footerView(for viewController: ACKEcgPreviewViewController) -> UIView? {
        let footerView = CustomFooterView { _ in
            self.presentPdfReport()
        }
        footerView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            footerView.heightAnchor.constraint(equalToConstant: 70),
            footerView.widthAnchor.constraint(equalToConstant: viewController.view.bounds.width),
        ]
        )
        return footerView
    }
    
    func ecgPreviewViewController(_ viewController: ACKEcgPreviewViewController, didCancelWith record: ACKEcgRecord?) {
        viewController.dismiss(animated: true, completion: nil)
    }
    
    func showDoneButton(in viewController: ACKEcgPreviewViewController) -> Bool {
        return true
    }
    
    func showCancelButton(in viewController: ACKEcgPreviewViewController) -> Bool {
        return true
    }
    
    func headerView(for viewController: ACKEcgPreviewViewController) -> UIView? {
        return nil
    }
}

// MARK: - ACKPDFInteractionControllerDelegate
extension AliveCorKitLiteController: ACKPDFInteractionControllerDelegate {
    
    func pdfInteractionController(_ controller: ACKPDFInteractionController, willPresentPdfFor config: ACKPDFConfig) {
        print("AliveCorKitLiteController willPresentPdfForConfig")
    }
    
    func pdfInteractionController(_ controller: ACKPDFInteractionController, didPresentPdf pdfPath: String?, for config: ACKPDFConfig, withError error: ACKError?) {
        print("AliveCorKitLiteController didPresentPdf")
    }
    
    func pdfInteractionController(_ controller: ACKPDFInteractionController, encryptPDFWithPassword password: String?, with config: ACKPDFConfig, completionHandler: @escaping (Error?, String?) -> Void) {
        print("AliveCorKitLiteController encryptPDFWithPassword")
    }
}

