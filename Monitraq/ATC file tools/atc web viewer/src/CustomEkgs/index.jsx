import React, { useEffect } from "react";
import styles from "./styles.module.css";
import * as d3 from "d3";
const Index = (props) => {
  const {
    height = 100,
    width = 600,
    strokeWidth,
    gridStrokeWidth = 1,
    totalSeconds = 6,
    sample = [],
    // frequency = 300,
    grids = false,
    smallGrids = false,
    leadText,
    waveformStrokeWidth = 1.25,
  } = props;
  const AvailableEKGWidth = width - 2 * strokeWidth;
  const AvailableEKGHeight = height - 2 * strokeWidth;
  const EKGWidth = AvailableEKGWidth;
  const EKGVerticalZoom = AvailableEKGHeight / (EKGWidth / totalSeconds);
  const ekgRange = [d3.min(sample), d3.max(sample)];
  const ekgSwing = [-5000, 5000];
  const ekgZoom = 1;
    // (((ekgSwing[1] - ekgSwing[0]) / (ekgRange[1] - ekgRange[0])) * 0.7 +
    //   EKGVerticalZoom) /
    // 2;

  // no of lines = seconds * 5 + 1
  // no of gaps = seconds * 5
  const noOfLines = Math.floor(totalSeconds * 5) + 1;
  const noOfGaps = Math.floor(totalSeconds * 5);

  // Figureout gap width
  const gapWidth = (width - noOfLines * gridStrokeWidth) / noOfGaps;
  const lineWidth = gridStrokeWidth;

  // 5 gaps + 4 lines
  const SecondWidth = 5 * (gapWidth + lineWidth);
  const oneFifthSeondWidth = gapWidth + lineWidth;
  // Do the xGridL
  const xScale = d3
    .scaleLinear()
    .domain([0, sample.length])
    .range([0, AvailableEKGWidth]);

  const yScale = d3
    .scaleLinear()
    .domain(ekgSwing)
    .range([AvailableEKGHeight, 0]);

  const returnX = (d, k) => xScale(k);
  // const returnY = (d) => yScale(d);
  const returnY = (d) => yScale(d * ekgZoom);
  const line = d3.line().x(returnX).y(returnY);
  const grid = () => {
    let linesxL = [];
    let linesyL = [];
    let linesxS = [];
    let linesyS = [];
    // Do the xGridL
    for (let i = 0; i < width; i = i + SecondWidth) {
      linesxL.push(<line key={i} x1={i} y1={0} x2={i} y2={height} />);
    }
    // Do the yGridL
    for (let i = 0; i < height; i = i + SecondWidth) {
      linesyL.push(<line key={i} x1={0} y1={i} x2={width} y2={i} />);
    }
    // Do the xGridS
    for (let i = 0; i < width; i = i + oneFifthSeondWidth) {
      linesxS.push(<line key={i} x1={i} y1={0} x2={i} y2={height} />);
    }
    // Do the yGridS
    for (let i = 0; i < height; i = i + oneFifthSeondWidth) {
      linesyS.push(<line key={i} x1={0} y1={i} x2={width} y2={i} />);
    }

    return (
      <React.Fragment>
        <g
          style={{
            stroke: "rgba(255, 255, 255, 0.5)",
            strokeWidth: gridStrokeWidth,
            fill: "transparent",
          }}
        >
          {linesxL}
        </g>
        <g
          style={{
            stroke: "rgba(255, 255, 255, 0.5)",
            strokeWidth: gridStrokeWidth,
            fill: "transparent",
          }}
        >
          {linesyL}
        </g>
        {smallGrids && (
          <React.Fragment>
            <g
              style={{
                stroke: "rgba(255, 255, 255, 0.10)",
                strokeWidth: gridStrokeWidth,
                fill: "transparent",
              }}
            >
              {linesxS}
            </g>
            <g
              style={{
                stroke: "rgba(255, 255, 255, 0.10)",
                strokeWidth: gridStrokeWidth,
                fill: "transparent",
              }}
            >
              {linesyS}
            </g>
          </React.Fragment>
        )}
      </React.Fragment>
    );
  };
  
  return (
    <svg width={width} height={height}>
      {/* TODO make the font size a bit more dynamic */}
      {leadText && (
        <text
          x={gapWidth / 2}
          y={height - gapWidth / 2}
          style={{ 
            fontSize: "1rem",
            fill: "#fff"
          }}
        >
          {leadText} - {totalSeconds}s
        </text>
      )}
      <rect
        width={width}
        height={height}
        style={{
          stroke: "rgba(255, 255, 255, 0.95)",
          strokeWidth,
          fill: "transparent",
        }}
      />
      {grids && grid()}
      {grids && (
        <React.Fragment>
          <rect
            width={90}
            height={10}
            x={width - (gapWidth / 2 + 90)}
            y={height - (gapWidth / 2 + 8)}
            style={{
              fill: "white",
            }}
          />
          <text
            x={width - (gapWidth / 2 + 90)}
            y={height - gapWidth / 2}
            style={{ fontSize: 8, background: "#fff" }}
          >
            {(EKGVerticalZoom * 10).toFixed(1)}mm/mV &nbsp;-&nbsp; 25mm/s
          </text>
        </React.Fragment>
      )}
      <g transform={`translate(${strokeWidth},${strokeWidth})`}>
        <path
          style={{
            fill: "none",
            stroke: "#fff",
            strokeWidth: waveformStrokeWidth,
            strokeLinejoin: "round",
          }}
          className={styles.wave}
          d={line(sample)}
        ></path>
      </g>
    </svg>
  );
};

export default Index;
