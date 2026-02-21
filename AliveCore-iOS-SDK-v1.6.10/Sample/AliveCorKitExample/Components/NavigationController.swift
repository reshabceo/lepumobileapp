//
//  NavigationController.swift
//  AliveCorKitExample
//
//  Created by Sanjana Somayajula on 7/15/23.
//  Copyright © 2023 Alivecor. All rights reserved.
//

import UIKit

class NavigationController: UINavigationController {
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        if let topViewController = self.topViewController {
            return topViewController.supportedInterfaceOrientations
        }
        
        if UIDevice.current.userInterfaceIdiom == .pad {
            return [.portrait, .portraitUpsideDown]
        } else {
            return .portrait
        }
    }
    
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        if let topViewController = self.topViewController {
            return topViewController.preferredInterfaceOrientationForPresentation
        }
        return .portrait
    }
    
    override var shouldAutorotate: Bool {
        if let topViewController = self.topViewController {
            return topViewController.shouldAutorotate
        }
        return false
    }
    
    // Public
    
    static func controllerWithOpaqueNavigationBarAndRootViewController(_ rootViewController: UIViewController) -> NavigationController {
        let navigationController = NavigationController(rootViewController: rootViewController)
        navigationController.navigationBar.isTranslucent = false
        
        return navigationController
    }
    
    // Initializers
    
    override init(rootViewController: UIViewController) {
        super.init(rootViewController: rootViewController)
        configureNavigationBarAppearance()
    }
    
    required init?(coder aDecoder: NSCoder) {
        super.init(coder: aDecoder)
        configureNavigationBarAppearance()
    }
    
    // Private
    
    private func configureNavigationBarAppearance() {
        if #available(iOS 13.0, *) {
            let appearance = UINavigationBarAppearance()
            appearance.backgroundColor = UIColor.white
            appearance.shadowColor = UIColor.clear
            navigationBar.standardAppearance = appearance
            navigationBar.scrollEdgeAppearance = navigationBar.standardAppearance
        }
    }
}

