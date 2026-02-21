//
//  SettingsViewController.swift
//  AliveCorKitExample
//
//  Created by Rex Hsu on 10/01/24.
//  Copyright © 2023 Alivecor. All rights reserved.

import UIKit
import AliveCorKitLite

class SettingsViewController: UITableViewController {
    
    private enum SettingViewCellType: Int, CaseIterable {
        case device = 0
        case duration
        case leadsConfiguration
        case filter
        case mainsFrequency
    }

    var aliveCorKitController: AliveCorKitLiteController!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Settings"
        let rightButton = UIBarButtonItem(title: "Start", style: .plain, target: self, action: #selector(startEcgMonitor(_:)))
        navigationItem.rightBarButtonItem = rightButton
        aliveCorKitController = AliveCorKitLiteController()

        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        tableView.reloadData()
    }

    @objc func startEcgMonitor(_ sender: Any) {
        presentEcgRecordingController()
    }

    func presentEcgRecordingController() {
        let config = RecordingConfig.shared
        aliveCorKitController.pushEcgMonitorViewController(config.deviceType, leadsConfig: config.leadsConfig, filterType: config.filter, maxDuration: config.duration, mainsFrequency: config.mainsFrequency, on: self)
    }

    override func tableView (_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        guard let type = SettingViewCellType(rawValue: indexPath.row) else {
            assertionFailure("Invalid row: \(indexPath.row)")
            return
        }
        switch type {
        case .device:
            showDeviceDropDown()
        case .duration:
            showDurationDropDown()
        case .leadsConfiguration:
            showLeadsDropDown()
        case .filter:
            showFilterDropDown()
        case .mainsFrequency:
            showMainsFrequency()
        }
    }
    
    func supportedDevices() -> [ACKDeviceType] {
        var result = [ACKDeviceType]()
        result = ACKManager.sharedInstance().supportedDevices
        return result
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = UITableViewCell(style: .value1, reuseIdentifier: "cell")
        guard let cellType = SettingViewCellType(rawValue: indexPath.row) else {
            assertionFailure("Invalid row: \(indexPath.row)")
            return cell
        }
        let config = RecordingConfig.shared
        var title = "???"
        switch cellType {
        case .device:
            title = "Device: \(config.deviceType.title)"
        case .filter:
            title = "Filter: \(config.filter.title)"
        case .leadsConfiguration:
            title = "Leads: \(config.leadsConfig.title)"
        case .duration:
            title = "Duration: \(durationText(from:config.duration))"
        case .mainsFrequency:
            title = "Mains Frequency: \(config.mainsFrequency.title)"
        }
        cell.textLabel?.text = title
        return cell
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return SettingViewCellType.allCases.count
    }

    override func numberOfSections(in tableView: UITableView) -> Int {
        return 1
    }

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .portrait
    }

    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        return .portrait
    }

    override var shouldAutorotate: Bool {
        return false
    }
}

// mark: - private
private extension SettingsViewController {
    
    func showDeviceDropDown() {
        let alertController = UIAlertController(title: "Choose Device Type", message: nil, preferredStyle: .actionSheet)
        let config = RecordingConfig.shared
        let deviceTypes = supportedDevices()
        for type in deviceTypes {
            // We don't support Kardia Band anymore
            if type == .band { continue }
            alertController.addAction(UIAlertAction(title: type.title, style: .default) { [weak self] _ in
                config.deviceType = type
                self?.tableView.reloadData()
            })
        }
        alertController.addAction(UIAlertAction(title: "Cancel", style: .cancel, handler: nil))
        present(alertController, animated: true, completion: nil)
    }

    func showDurationDropDown () {
        let config = RecordingConfig.shared
        let alertController = UIAlertController(title: "Choose Duration", message: nil, preferredStyle: .actionSheet)
        let durations: [Int] = [30, 60, 120, 180]
        for duration in durations {
            let title = durationText(from: duration)
            let action = UIAlertAction(title: title, style: .default) { [weak self] _ in
                config.duration = duration
                self?.tableView.reloadData()
            }
            alertController.addAction(action)
        }
        alertController.addAction(UIAlertAction(title: "Cancel", style: .cancel, handler: nil))
        present(alertController, animated: true, completion: nil)
    }
    
    func durationText(from seconds: Int) -> String {
        let sec = seconds % 60
        let mins = seconds / 60
        let title =  mins > 0 ? "\(mins) minutes" : "\(sec) seconds"
        return title
    }
    
    func showMainsFrequency() {
        let config = RecordingConfig.shared
        let alertController = UIAlertController(title: "Choose Mains Frequency", message: nil, preferredStyle: .actionSheet)

        alertController.addAction(UIAlertAction(title: ACKMainsFrequency.frequency50Hz.title, style: .default) { [weak self] _ in
            config.mainsFrequency = .frequency50Hz
            self?.tableView.reloadData()
        })

        alertController.addAction(UIAlertAction(title: ACKMainsFrequency.frequency60Hz.title, style: .default) { [weak self] _ in
            config.mainsFrequency = .frequency60Hz
            self?.tableView.reloadData()
        })

        alertController.addAction(UIAlertAction(title: "Cancel", style: .cancel, handler: nil))
        present(alertController, animated: true, completion: nil)
    }
    
    func showFilterDropDown() {
        let config = RecordingConfig.shared
        let alertController = UIAlertController(title: "Choose Filter", message: nil, preferredStyle: .actionSheet)

        alertController.addAction(UIAlertAction(title: ACKFilterType.original.title, style: .default) { [weak self] _ in
            config.filter = .original
            self?.tableView.reloadData()
        })

        alertController.addAction(UIAlertAction(title: ACKFilterType.enhanced.title, style: .default) { [weak self] _ in
            config.filter = .enhanced
            self?.tableView.reloadData()
        })

        alertController.addAction(UIAlertAction(title: "Cancel", style: .cancel, handler: nil))
        present(alertController, animated: true, completion: nil)
    }
    
    func showLeadsDropDown() {
        let config = RecordingConfig.shared
        
        let alertController = UIAlertController(title: "Choose Lead Configuration", message: nil, preferredStyle: .actionSheet)

        alertController.addAction(UIAlertAction(title: ACKLeadsConfig.single.title, style: .default) { [weak self] _ in
            config.leadsConfig = .single
            self?.tableView.reloadData()
        })

        alertController.addAction(UIAlertAction(title: ACKLeadsConfig.six.title, style: .default) { [weak self] _ in
            config.leadsConfig = .six
            self?.tableView.reloadData()
        })

        alertController.addAction(UIAlertAction(title: "Cancel", style: .cancel, handler: nil))
        present(alertController, animated: true, completion: nil)
    }
}



