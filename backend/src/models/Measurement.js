const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema({
    measurementId: {
        type: String,
        required: true,
        unique: true
    },
    deviceId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['blood_pressure', 'ecg', 'oximeter', 'glucose']
    },

    // Blood Pressure data
    systolic: Number,
    diastolic: Number,
    mean: Number,
    pulseRate: Number,
    unit: String,

    // ECG data
    heartRate: Number,
    waveformData: [Number],
    samplingRate: Number,
    duration: Number,
    leadOff: Boolean,

    // Oximeter data
    spo2: Number,
    pi: Number,
    probeOff: Boolean,
    pulseSearching: Boolean,

    // Glucose data
    value: Number,
    result: String,
    testType: String,

    // Common fields
    timestamp: {
        type: Date,
        default: Date.now
    },
    rawData: mongoose.Schema.Types.Mixed
}, {
    timestamps: true
});

// Indexes for better performance
measurementSchema.index({ deviceId: 1, timestamp: -1 });
measurementSchema.index({ type: 1, timestamp: -1 });

module.exports = mongoose.model('Measurement', measurementSchema);