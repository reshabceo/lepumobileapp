const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    model: {
        type: String,
        required: true
    },
    macAddress: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['BP', 'ECG', 'OXIMETER', 'GLUCOSE']
    },
    connected: {
        type: Boolean,
        default: false
    },
    clientId: String,
    battery: Number,
    firmware: String,
    lastSeen: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Device', deviceSchema);