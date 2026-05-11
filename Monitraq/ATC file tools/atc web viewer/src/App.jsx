import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import './atc2json'
import toast from 'react-hot-toast';
import ReactJson from 'react-json-view'

import EKGPreview from "./CustomEkgs";

import './App.css'

function App() {
  const [Data, setData] = useState({})
  const [disabled, setDisabled] = useState(false)

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      const readingFile = new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e.target.error);
        reader.readAsArrayBuffer(acceptedFiles[0]);
      }).then((FileBuffer) => {
        const data = new Uint8Array(FileBuffer);
        // The ATC Parser used below is not the most efficient way of parsing an ATC File 
        // Refer Atc2Json Library for a better implementation using Go.
        const ATCFileData = JSON.parse(window['atc-parser'].parse(data))
        setData(ATCFileData)
        toast.success('Parsing file success');
      }).catch((error) => {
        toast.error('Parsing file failed');
      });
  } else {
    toast.error('No atc file selected');
  }
  }, [])
  
  const {getRootProps, getInputProps, isDragActive, isDragReject} = useDropzone({
    accept: {
      'application/atc': ['.atc'],
    },
    maxFiles:1,
    disabled,
    onDrop,
  })

  function download() {
    var hiddenElement = document.createElement('a');
    hiddenElement.href = 'data:attachment/text,' + encodeURI(JSON.stringify(Data));
    hiddenElement.target = '_blank';
    // file name will be current date and time
    hiddenElement.download = new Date().toISOString() + '.json';
    hiddenElement.click();
  }
  


  return (
    <div className="App">
      <h1>ATC Web Viewer</h1>
      <div className="card">
        { !(Object.keys(Data).length > 0) ? 
        <div>
          <div className="FContainer" {...getRootProps()}>
            <input className="inputBox" {...getInputProps()} />
            {!isDragActive && !isDragReject && <h3 style={{color:"#fff", fontWeight: "500"}}>Click or Drag & drop .atc file here</h3>}
            {isDragActive && !isDragReject && <h3 style={{color:"#fff", fontWeight: "500"}}>Drop the file to parse...</h3>}
            {isDragReject && <h3 style={{color:"#fff", fontWeight: "500"}}>Drop the file to parse...</h3>}
          </div>
        </div> 
        :
        <>
        <div className='jContainer'>
          <h1>EKG View</h1>
          <div className="EKGpreview">
            {Object.keys(Data.samples).map(leadName => (
              <EKGPreview
                key={leadName}
                height={100}
                width={3100}
                strokeWidth={2}
                sample={Data.samples[leadName]}
                totalSeconds={30}
                grids = {false}
                smallGrids = {false}
                leadText={leadName}
              />
            ))}
          </div>
        </div>
        <div className='jContainer'>
          <h1>JSON View</h1>
          <div className='jsonview'>
            <ReactJson
              src={Data}
              theme="monokai"
              style={{backgroundColor: "#2b2b2b"}}
              displayDataTypes={false}
              displayObjectSize={false}
              enableClipboard={false}
              collapsed={1}
              name={false}
              iconStyle="square"
              indentWidth={2}
            />
          </div>
          <div className="buttonView">
            <button className='jsonviewRefresh' onClick={() => {download()}}>
              Download
            </button>
            <button className='jsonviewRefresh' onClick={() => {setData({})}}>
              Close
            </button>
          </div>
        </div>
        </>
        }
      </div>
    </div>
  )
}

export default App
