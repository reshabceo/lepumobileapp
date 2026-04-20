//
//  StreamingFilterViewController.swift
//  AliveCorKitExample
//
//  Created by Oleksandr Vlasenko on 9/23/21.
//  Copyright © 2021 Alivecor. All rights reserved.
//

import UIKit
import AliveCorKitLite

class StreamingFilterViewController: UIViewController {

    private let cellIdentifier: String = "cell"
    private var isEnhancedFilter: Bool = false {
        didSet {
            let title = isEnhancedFilter ? "Enhanced" : "Original"
            filterButton.setTitle(title, for: .normal)
        }
    }
    
    private var dataSource: [[Double]] = [] // dataSource holds not filtered / filtered signal values

    private lazy var tableView: UITableView = {
        let tableView = UITableView()
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: cellIdentifier)
        tableView.dataSource = self
        return tableView
    }()

    private lazy var filterButton: UIButton = {
        let button = UIButton()
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle("Original", for: .normal)
        button.setTitleColor(.systemBlue, for: .normal)
        button.addTarget(self, action: #selector(didTapFilterButton), for: .touchUpInside)
        button.titleLabel?.font = UIFont.systemFont(ofSize: 15.0)
        return button
    }()
    
    private lazy var filterLabel: UILabel = {
        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.text = "Filter type: "
        label.font = UIFont.systemFont(ofSize: 17.0)
        label.textColor = .black
        return label
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Streaming Filter"
        view.backgroundColor = .white
        setupSubViews()
        filterData()
    }

    private func setupSubViews() {
        view.addSubview(filterButton)
        view.addSubview(tableView)
        view.addSubview(filterLabel)

        if #available(iOS 11.0, *) {
            NSLayoutConstraint.activate([
                tableView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
                tableView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
                tableView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
                tableView.topAnchor.constraint(equalTo: filterButton.bottomAnchor),
                
                
                filterButton.widthAnchor.constraint(equalToConstant: 82),
                filterButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 15),
                filterButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -17),
                
                filterLabel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 17),
                filterLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
                
                filterButton.firstBaselineAnchor.constraint(equalTo: filterLabel.firstBaselineAnchor)

            ])
        } else {
            NSLayoutConstraint.activate([
                tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
                tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
                tableView.topAnchor.constraint(equalTo: filterButton.bottomAnchor),
                
                filterButton.widthAnchor.constraint(equalToConstant: 82),
                filterButton.topAnchor.constraint(equalTo: view.topAnchor),
                filterButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -17),
                
                filterLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 17),
                filterLabel.topAnchor.constraint(equalTo: view.topAnchor),
                
                filterButton.firstBaselineAnchor.constraint(equalTo: filterLabel.firstBaselineAnchor)
            ])
        }
    }
}

extension StreamingFilterViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return dataSource.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: cellIdentifier)
        // cell would show [time, raw value, filtered value]
        // filtered value would be received by applying either enhanced or original filter
        cell?.textLabel?.text = String(describing: dataSource[indexPath.row])
        return cell ?? UITableViewCell()
    }
}

private extension StreamingFilterViewController {

    func filterData() {
        ACKManager.sharedInstance().checkStatus { [weak self](error, config) in
            guard let strongSelf = self else {
                return
            }
            if error == nil {
                let filterType: ACKFilterType = strongSelf.isEnhancedFilter ? .enhanced : .original
                self?.dataSource = FileUtils.filterRawEcgData(from: "ecg_raw_data", filterType: filterType) ?? []
                DispatchQueue.main.async {
                    strongSelf.tableView.reloadData()
                }
            } else {
                //TODO: handle error if needed
                assertionFailure("SDK access was not granted \(String(describing: error))")
            }
        }
    }

    @objc func didTapFilterButton() {
        isEnhancedFilter = !isEnhancedFilter
        filterData()
    }
}
