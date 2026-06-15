# VTProductLib

 #### 1. Quick Start
 First of all, because `VTMURATUtils` does not use the singleton mode, you need to subclass a singleton, and subsequent use can avoid some unnecessary problems.
 Then, set the property `peripheral` and `VTMURATDeviceDelegate` proxy of `VTMURATUtils`, the SDK will configure services and features, and return YES through the callback method `utilDeployCompletion:`, that is, normal communication can be performed.
 Finally, set `VTMURATUtilsDelegate` on the page that needs to be communicated, send the corresponding command to get the data, and return the corresponding structure through the `VTMBLEParser`.

 #### 2. All methods the following is used communicate with product. Whether the product supports it, please refer to the protocol of the corresponding product.

 ##### 2.1 Common
 - Request product info.
 ```
 - (void)requestDeviceInfo;
 ```
 
- Request product current battery info.
 ```
 - (void)requestBatteryInfo;
 ```

 - Sync product time.
 ```
 - (void)syncTime:(NSDate * _Nullable)date;
 ```

 - Request file list from product.
 ```
 - (void)requestFilelist;
 ```

 - Prepare to read file by the file name from file list.
 ```
 - (void)prepareReadFile:(NSString * _Nonnull)fileName;
 ```

 - Read the next package file by the offset length of the file, and return a certain number of file bytes each time.
 ```
 - (void)readFile:(u_int)offset;
 ```

 - End read file.
 ```
 - (void)endReadFile;
 ```

 - Restore factory.
 ```
 - (void)factoryReset;
 ```
 ##### 2.2 ECG series related product specific command：
 - Request config info.
 ```
 - (void)requestECGConfig;
 ```

 - Request real data.
 ```
 - (void)requestECGRealData;
 ```

 - Sync config info, Struct supported by the reference protocol.
 ```
 - (void)syncER1Config:(VTMER1Config)config;
 - (void)syncER2Config:(VTMER2Config)config;
 ```
 ##### 2.3 Blood pressure series related product specific command：
 - Request config info.
 ```
 - (void)requestBPConfig;
 ```

 - Set the config info.
 ```
 - (void)syncBPConfig:(VTMBPConfig)config;
 ```

 - Request real data.
 ```
 - (void)requestBPRealData;
 ```
 ##### 2.4 S1 body scale series related product specific command:
 - Request real waveform.
 ```
 - (void)requestScaleRealWve;
 ```

 - Request real data.
 ```
 - (void)requestScaleRealData;

 #### 3. Parse the data.
 Parse the data through `VTMBLEParser`, Reference protocol document and the corresponding structure in `VTMBLEStruct.h`.
