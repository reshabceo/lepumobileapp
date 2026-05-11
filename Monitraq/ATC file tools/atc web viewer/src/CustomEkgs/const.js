// DO NOT TOUCH THESE NUMBERS UNLESS YOU KNOW WHAT YOU ARE DOING

export const ECG_MARGIN = 40;
export const TOOLBAR_HEIGHT = 40;

// these are needed for rendering on headless webkit
const QT_WEBKIT_SCREEN_WIDTH = 800;
const QT_WEBKIT_PX_PER_MM = 0.00463177397;

// MV - milli-Volt -  mostly used for y-axis plot / measurement
// MM - millimeter - mostly in x-axis, convert into time (sec)

export const PX_PER_MM =
  window.innerWidth > 0 ? 4 : QT_WEBKIT_SCREEN_WIDTH * QT_WEBKIT_PX_PER_MM;

export const GAIN_MM_PER_MV = 10;
// +-3 mV for a total 6mV swing
export const MV_BANDWIDTH = 2.5;
// mm/sec
export const PAPER_SPEED = 25;

export const PX_PER_MV = GAIN_MM_PER_MV * PX_PER_MM;
export const PX_PER_SECOND = PAPER_SPEED * PX_PER_MM;

export const SVG_OFFSET = 0.5;

export const SAMPLES_PER_SECOND = 300;
export const SAMPLES_PER_PIXEL = 3;
export const SAMPLE_UNITS_PER_MV = 2000;

export const WAVEFORM_BLACK = '#3D2525';
export const LIGHT_RED = 'rgba(174, 30, 8, .2)';
export const DARK_RED = 'rgba(174, 30, 8, .4)';

export const leadTextMap = {
  leadI: 'Lead I',
  leadII: 'Lead II',
  leadIII: 'Lead III',
  aVR: 'aVR',
  aVL: 'aVL',
  aVF: 'aVF',
};

export const leadColorMap = {
  leadI: '#888888',
  leadII: '#11202c',
  leadIII: '#422b47',
  aVR: '#1cacb2',
  aVL: '#1eb21c',
  aVF: '#7d7f0c',
};

export const BEAT_TYPES = {
  GHOST: {
    label: 'ghost',
    key: 'g',
    fill: '#747474ad',
    stroke: '#7d7c7c36',
  },
  PURPLE: {
    label: 'Purple',
    key: 'p',
    fill: '#673ab7',
    stroke: '#8561c5',
  },
  BLUE: {
    label: 'Blue',
    key: 'b',
    fill: '#03a9f4',
    stroke: '#35baf6',
  },
  GREEN: {
    label: 'Green',
    key: 'g',
    fill: '#4caf50',
    stroke: '#6fbf73',
  },
  YELLOW: {
    label: 'Yellow',
    key: 'y',
    fill: '#ffc107',
    stroke: '#ffcd38',
  },
};
