import React, { useRef, useEffect } from "react";
import styles from "./styles.module.css";
import {paintGrid} from './grids'
import * as d3 from "d3";

const Index = (props) => {
  const AnnotatorCanvas = useRef();
  const {
    height = 100,
    width = 600,
    strokeWidth,
    totalSeconds = 6,
    sample = [],
    frequency = 300,
  } = props;
  const AvailableEKGWidth = width - 2 * strokeWidth;
  const AvailableEKGHeight = height - 2 * strokeWidth;
  const EKGWidth = AvailableEKGWidth;
  const EKGVerticalZoom = AvailableEKGHeight / (EKGWidth / totalSeconds);
  const ekgRange = [d3.min(sample), d3.max(sample)];
  const ekgSwing = [-5000, 5000];
// find the zoom factor for ekgrange to fit in 80% of ekgswing
    const ekgZoom = ((ekgSwing[1] - ekgSwing[0]) / (ekgRange[1] - ekgRange[0]) * 0.8 + EKGVerticalZoom)/2;
function getObjectFitSize(
    contains /* true = contain, false = cover */,
    containerWidth,
    containerHeight,
    width,
    height
  ) {
    var doRatio = width / height;
    var cRatio = containerWidth / containerHeight;
    var targetWidth = 0;
    var targetHeight = 0;
    var test = contains ? doRatio > cRatio : doRatio < cRatio;
  
    if (test) {
      targetWidth = containerWidth;
      targetHeight = targetWidth / doRatio;
    } else {
      targetHeight = containerHeight;
      targetWidth = targetHeight * doRatio;
    }
  
    return {
      width: targetWidth,
      height: targetHeight,
      x: (containerWidth - targetWidth) / 2,
      y: (containerHeight - targetHeight) / 2
    };
  }
  
  
  useEffect(() => {
    const myCanvas = AnnotatorCanvas.current;
    const originalHeight = myCanvas.height;
    const originalWidth = myCanvas.width;
      let dimensions = getObjectFitSize(
        true,
        myCanvas.clientWidth,
        myCanvas.clientHeight,
        myCanvas.width,
        myCanvas.height
      );
      myCanvas.width = dimensions.width;
      myCanvas.height = dimensions.height;
    
      let ctx = myCanvas.getContext("2d");
      let ratio = Math.min(
        myCanvas.clientWidth / originalWidth,
        myCanvas.clientHeight / originalHeight
      );
      ctx.scale(ratio, ratio); //adjust this!
    const context = AnnotatorCanvas.current.getContext("2d");
    context.clearRect(0, 0, width, height);
    context.translate(0.5, 0.5);
    context.beginPath();
    context.lineWidth = strokeWidth;
    context.strokeStyle = "rgba(31, 53, 104, 0.15)";
    context.rect(0, 0, width, height);
    context.stroke();

    const xScale = d3
      .scaleLinear()
      .domain([0, sample.length])
      .range([0, AvailableEKGWidth]);

    const yScale =  d3
    .scaleLinear()
    .domain([-5000, 5000])
    .range([AvailableEKGHeight,0]);

    const returnX = (d, k) => xScale(k);
    const returnY = d => yScale(d*ekgZoom);
    // const returnY = d => yScale(d);
    const line = d3
    .line()
    .x(returnX)
    .y(returnY)
    .context(context);

    context.save()
    context.beginPath();
    context.lineWidth = 1;
    context.strokeStyle = "#3D2525";
    line(sample);
    context.stroke();
    context.restore();
  });
  return <canvas style={{height,width,objectFit:"contain"}} width={width} height={height} ref={AnnotatorCanvas} />;
};

export default Index;
