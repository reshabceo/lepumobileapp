//
//  CustomFooterView.swift
//  AliveCorKitExample
//
//  Created by rex hsu on 10/1/24.
//  Copyright © 2024 AliveCor. All rights reserved.
//

import Foundation
import UIKit

class CustomFooterView: UIView {
    
    typealias TapHandler = (CustomFooterView)->Void
    
    private var tapHandler: TapHandler!
    
    init(tapHandler: @escaping TapHandler) {
        super.init(frame: .zero)
        
        self.tapHandler = tapHandler
        backgroundColor = .yellow
        
        let button = UIButton(type: .custom)
        button.setTitle("Show PDF", for: .normal)
        button.setTitleColor(.black, for: .normal)
        button.contentHorizontalAlignment = .center
        
        addSubview(button)
        button.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            button.leadingAnchor.constraint(equalTo: leadingAnchor),
            button.trailingAnchor.constraint(equalTo: trailingAnchor),
            button.topAnchor.constraint(equalTo: topAnchor),
            button.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
        
        button.addTarget(self, action: #selector(buttonTapHandler), for: .touchUpInside)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    @objc
    private func buttonTapHandler() {
        self.tapHandler(self)
    }
}
