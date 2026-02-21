//
//  FileUtils.swift
//  AliveCorKitExample
//
//  Created by Oleksandr Vlasenko on 9/23/21.
//  Copyright © 2021 Alivecor. All rights reserved.
//

import Foundation
import AliveCorKitLite

class FileUtils {

    // Method reads time/mV values from the sample file.
    // Input example: 0.003333333,-0.161590576
    // Returns triple [seconds,signal, filtered signal]
    class func filterRawEcgData(from file: String?, filterType: ACKFilterType) -> ([[Double]])? {
        guard let file = file else {
            return nil
        }
        
        var error: ACKError?
        guard let filter = ACKStreamingFilter.init(filterType: filterType, sampleRate: .rate300Hz, mainsFrequency: .frequency60Hz, error: &error) else {
            assertionFailure("Fail to initialize filter: \(error?.localizedDescription ?? "No error description")")
            return nil
        }
        
        guard error == nil else {
            assertionFailure("Fail to initialize filter: \(error?.localizedDescription ?? "No error description")")
            return nil
        }

        guard let path = Bundle.main.path(forResource: file, ofType: "txt") else { return nil }
        
        do {
            let fileOutput = try String.init(contentsOfFile: path, encoding: .utf8).components(separatedBy: "\n")
            
            var result: [[Double]] = []
            for stringPair in fileOutput {

                var tripleHolder: [Double] = stringPair.replacingOccurrences(of: "\r", with: "").components(separatedBy: ",").map { (value) -> Double in
                    (Double(value) ?? 0)
                }
                let filteredMiliVoltValue = filter.filterSample(tripleHolder[1])
                tripleHolder.append(filteredMiliVoltValue)
                result.append(tripleHolder)
            }
            return result
        } catch {
            assertionFailure("rawEcgData \(String(describing: error))")
        }
        return nil

    }
    
}
