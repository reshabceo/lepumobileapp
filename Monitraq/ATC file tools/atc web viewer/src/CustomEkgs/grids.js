import * as d3 from 'd3'
import * as Lib from './const';

export const paintGrid = (context, rowSeconds, height, width, scale = 1) => {
  const secondsScale = () => d3.scaleLinear().domain([ 0, 1 ]).range([ 0, (Lib.PX_PER_SECOND) * scale ])
  renderXGrid(context, height, secondsScale, rowSeconds)
  renderXGridDark(context, height, secondsScale, rowSeconds)
  renderYGrid(context, height, scale, width)
}
export const renderXGrid = (context, height, secondsScale, rowSeconds) => {
  /* eslint-disable no-param-reassign */
  let i = 0
  while (i <= rowSeconds) {
    context.beginPath()
    context.moveTo(secondsScale()(i) + Lib.SVG_OFFSET, Lib.SVG_OFFSET)
    context.lineTo(secondsScale()(i) + Lib.SVG_OFFSET, height)
    context.strokeStyle = Lib.LIGHT_RED
    context.lineWidth = 1
    context.stroke()
    i += 0.2
  }
}
export const renderXGridDark = (context, height, secondsScale, rowSeconds) => {
  /* eslint-disable no-param-reassign */
  let i = 0
  while (i <= rowSeconds) {
    context.beginPath()
    context.moveTo(secondsScale()(i) + Lib.SVG_OFFSET, Lib.SVG_OFFSET)
    context.lineTo(secondsScale()(i) + Lib.SVG_OFFSET, height)
    context.strokeStyle = Lib.DARK_RED
    context.lineWidth = 1
    context.stroke()
    i += 1
  }
}

export const renderYGrid = (context, height, scale, width) => {
  /* eslint-disable no-param-reassign */
  let i = 0
  const redAt = 100

  while ((i * scale) < height) {
    context.beginPath()
    context.moveTo(0, (i * scale) + Lib.SVG_OFFSET)
    context.lineTo(width + 1, (i * scale) + Lib.SVG_OFFSET)
    if (i % redAt === 0) {
      context.strokeStyle = Lib.DARK_RED
    } else {
      context.strokeStyle = Lib.LIGHT_RED
    }
    context.lineWidth = 1
    context.stroke()
    i += Lib.PX_PER_MM * 5
  }
}