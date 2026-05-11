//
//  MainViewController.swift
//  AliveCorKitExample
//
//  Created by Sanjana Somayajula on 7/15/23.
//  Copyright © 2023 Alivecor. All rights reserved.
//

import UIKit
import AliveCorKitLite

enum HomeViewRow: Int, CaseIterable {
    case ecgSample = 0
    case defaultLanguage
    case pdfLanguage
    case about
    case presentPDF
    case lockLead
    case filterSample
}

class MainViewController: UITableViewController {
    
    private let cellIdentifier: String = "cell"
    
    private let provisioningLabel: UILabel = {
        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.textAlignment = .center
        label.font = UIFont.systemFont(ofSize: 16)
        label.textColor = .black
        label.text = "Provisioning..."
        label.isHidden = true
        return label
    }()
    
    override func viewDidLoad() {
        super.viewDidLoad()
        title = "AliveCor"
        
        enableProvisioningLabel(true)
        
        Task { [weak self] in
            guard let strongSelf = self else { return }
            do {
                let accessToken = try await AuthService.fetchAuthToken()
                let _ = ACKManager.initWithApiKey(accessToken, isDebugMode: true) { error, config in
                    strongSelf.enableProvisioningLabel(false)
                    if let error = error {
                        DebugUtils.presentAlert(title: "Error", message: "Initialized ACKManager with error: \(error.localizedDescription)", from: strongSelf)
                        return
                    }
                }
            } catch {
                DebugUtils.presentAlert(title: "Invalid token", message: nil, from: strongSelf)
            }
        }
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: cellIdentifier)
    }
    
    // MARK: - UITableViewDelegate
    
    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        guard let rowType = HomeViewRow(rawValue: indexPath.row) else {
            assertionFailure("Unsupported row: \(indexPath.row)")
            DebugUtils.presentAlert(title: "Error", message: "Unsupported row: \(indexPath.row)", from: self)
            return
        }
        switch rowType {
        case .about:
            let vc = ACKAboutViewController(isEU: false)
            vc.modalPresentationStyle = .fullScreen
            self.present(vc, animated: true)

        case .defaultLanguage:
            presentLanguageSelection() { type in
                UserDefaultsHelper.shared.recordingLanguageType = type
                ACKManager.sharedInstance().defaultLanguageType = UserDefaultsHelper.shared.recordingLanguageType
                tableView.reloadData()
            }
            return
        case .pdfLanguage:
            presentLanguageSelection() { type in
                UserDefaultsHelper.shared.pdfLanguageType = type
                tableView.reloadData()
            }
            return
        case .filterSample:
            let vc = StreamingFilterViewController()
            navigationController?.pushViewController(vc, animated: true)
        case .ecgSample:
            let vc = SettingsViewController()
            navigationController?.pushViewController(vc, animated: true)
        case .presentPDF:
            presentPDFViewController()
            return
        case .lockLead:
            break
        }
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        guard let rowType = HomeViewRow(rawValue: indexPath.row) else {
            assertionFailure("Unsupported row: \(indexPath.row)")
            DebugUtils.presentAlert(title: "Error", message: "Unsupported row: \(indexPath.row)", from: self)
            return UITableViewCell(style: .default, reuseIdentifier: "cell")
        }
        let cell = tableView.dequeueReusableCell(withIdentifier: cellIdentifier, for: indexPath)
        
        var title: String = ""
        
        switch rowType {
        case .ecgSample:
            title = "AliveCorKit"
        case .defaultLanguage:
            let lang = ACKManager.sharedInstance().defaultLanguageType?.rawValue ?? "nil"
            title = "Recording Language: \(lang)"
        case .pdfLanguage:
            let lang = UserDefaultsHelper.shared.pdfLanguageType?.rawValue ?? "nil"
            title = "PDF Language: \(lang)"
        case .filterSample:
            title = "ACKStreamingFilter"
        case .about:
            title = "About"
        case .presentPDF:
            title = "Present PDF"
        case .lockLead: do {
            let title = "Enable Lead mode switch"
            // Create a custom cell with a switch button
            let cell = UITableViewCell(style: .default, reuseIdentifier: "SwitchCell")
            cell.textLabel?.text = title
            let lockSwitch = UISwitch()
            lockSwitch.tag = indexPath.row
            lockSwitch.addTarget(self, action: #selector(lockSwitchValueChanged(_:)), for: .valueChanged)
            cell.accessoryView = lockSwitch
            
            // Get the stored value from user defaults
            let isSwitchOn = UserDefaultsHelper.shared.enableLeadModeSwitch
            lockSwitch.isOn = isSwitchOn
            return cell
        }
            
        }
        cell.textLabel?.text = title
        return cell
    }
    
    
    @objc func lockSwitchValueChanged(_ sender: UISwitch) {
        let isSwitchOn = sender.isOn
        
        // Update the user defaults immediately
        UserDefaultsHelper.shared.enableLeadModeSwitch = isSwitchOn
        
        // Update the state of the lock switch in the view
        let indexPath = IndexPath(row: HomeViewRow.lockLead.rawValue, section: 0)
        if let cell = self.tableView.cellForRow(at: indexPath) {
            if let lockSwitch = cell.accessoryView as? UISwitch {
                lockSwitch.isOn = isSwitchOn
            }
        }
    }
    
    
    // MARK: - UITableViewDataSource
    
    override func numberOfSections(in tableView: UITableView) -> Int {
        return 1
    }
    
    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return HomeViewRow.allCases.count
    }
    
    // MARK: - Rotations
    
    override var shouldAutorotate: Bool {
        return false
    }
    
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .portrait
    }
}

// MARK: - private
private extension MainViewController {
    
    func enableProvisioningLabel(_ enabled: Bool) {
        if enabled {
            view.addSubview(provisioningLabel)
            provisioningLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor).isActive = true
            provisioningLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor).isActive = true
            provisioningLabel.isHidden = false
        } else {
            provisioningLabel.isHidden = true
            provisioningLabel.removeFromSuperview()
        }
    }
    
    func presentLanguageSelection(completion: @escaping (ACKLanguageType?)->Void) {
        let alertController = UIAlertController(title: "Choose Language", message: "The chosen language will be used through the recording flow", preferredStyle: .actionSheet)
        
        let titleLanguagePairs: [(String, ACKLanguageType?)] = [
            ("reset", nil), ("System", .system), ("English", .english), ("Russian", .russian), ("Vietnamese", .vietnamese),
            ("Finnish", .finnish), ("Portuguese-Portugal", .portuguesePortugal), ("Hungarian", .hungarian), ("Czech", .czech), ("German", .german),
            ("Dutch", .dutch), ("French", .french), ("Arabic", .arabic), ("Swedish", .swedish), ("Spanish", .spanish),
            ("Portuguese-Brazil", .portugueseBrazil), ("Polish", .polish), ("Norwegian", .norwegian), ("Korean", .korean), ("Japanese", .japanese),
            ("Italian", .italian), ("English-GB", .englishGB), ("Danish", .danish), ("Chinese-Traditional", .chineseTraditional), ("Chinese-Simplify", .chineseSimplify),
            ("Lithuanian", .lithuanian), ("Thai", .thai), ("Welsh", .welsh), ("Serbian", .serbian), ("Hebrew", .hebrew),
            ("Croatian", .croatian), ("Romanian", .romanian), ("Bulgarian", .bulgarian), ("Slovak", .slovak), ("Greek", .greek), ("Malay", .malay), ("Spanish (US)", .spanishUS), ("Tamil", .tamil)
        ]
        
        for (title, languageType) in titleLanguagePairs {
            updateLanguageSelectionSheet(alertController, title: title, languageType: languageType, completion: completion)
        }
        
        let cancel = UIAlertAction(title: "Cancel", style: .cancel)
        alertController.addAction(cancel)
        present(alertController, animated: true)
    }
    
    func updateLanguageSelectionSheet(_ alertController: UIAlertController,
                                              title: String,
                                              languageType: ACKLanguageType?,
                                              completion: @escaping (ACKLanguageType?)->Void) {
        let action = UIAlertAction(title: title, style: .default) { _ in
            completion(languageType)
        }
        alertController.addAction(action)
    }
    
    func presentPDFViewController() {
        let record = createRecord(filename: "nsr_6L")
        guard let pdfViewController = createPDFViewController(with: record) else {
            DebugUtils.presentAlert(title: "Error", message: "Unable creating PDF", from: self)
            return
        }
        present(pdfViewController, animated: true)
    }
    
    func createRecord(filename: String) -> ACKEcgRecord {
        return DebugUtils.createEcgRecord(in: ACKManager.sharedInstance().ecgFilesDirectory,
                                          with: filename,
                                          fileExtension: "atc",
                                          determination: ACKAlgorithmDetermination.atrialFibrillation,
                                          leadConfig: .six)
    }
    
    func createPDFViewController(with record: ACKEcgRecord) -> ACKPDPPreviewController? {
        let config = ACKPDFConfig(ecg: record)
        let meta = ACKPDFMetadata()
        meta.notes = "Your note are here"
        meta.tags = "additional tag are here!!!"
        config.metadata = meta
        let displaySettings = config.displaySettings
        displaySettings?.languageType = UserDefaultsHelper.shared.pdfLanguageType
        guard let pdfPath = ACKPDFReport.pdfPath(for: config), let uuid = record.uuid else {
            return nil
        }
        let previewController = ACKPDPPreviewController.viewController(withPdfFilePath: pdfPath, navigationBarTitle: uuid, supportsLandscape: true)
        return previewController
    }
}
