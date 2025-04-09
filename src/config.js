// config.js
const mongoose = require('mongoose');

// Connect to MongoDB
const connect = mongoose.connect("mongodb://0.0.0.0:27017/Pet");

connect.then(() => {
    console.log("Database Connected Successfully");
})
.catch(() => {
    console.log("Database cannot be Connected");
});

// User schema (for admin and vet)
const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String
    },
    phone: {
        type: String
    },
    role: {
        type: String,
        enum: ['admin', 'vet'],
        default: 'vet'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Pet schema
const PetSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    breed: {
        type: String
    },
    age: {
        type: Number
    },
    weight: {
        type: Number
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'unknown'],
        default: 'unknown'
    },
    ownerName: {
        type: String,
        required: true
    },
    ownerPhone: {
        type: String,
        required: true
    },
    ownerEmail: {
        type: String
    },
    registeredAt: {
        type: Date,
        default: Date.now
    }
});

// Health Record schema
const HealthRecordSchema = new mongoose.Schema({
    pet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'pets',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    veterinarian: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    temperature: Number,
    weight: Number,
    heartRate: Number,
    respirationRate: Number,
    notes: String,
    nextCheckupDate: Date,
    status: {
        type: String,
        enum: ['healthy', 'sick', 'recovering', 'critical'],
        default: 'healthy'
    }
});

// Medical Record (case history) schema
const MedicalRecordSchema = new mongoose.Schema({
    pet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'pets',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    veterinarian: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    symptoms: [String],
    diagnosis: String,
    treatment: String,
    notes: String,
    followUpDate: Date
});

// Prescription schema
const PrescriptionSchema = new mongoose.Schema({
    pet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'pets',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    veterinarian: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    medications: [{
        name: String,
        dosage: String,
        frequency: String,
        duration: String,
        notes: String
    }],
    instructions: String,
    status: {
        type: String,
        enum: ['active', 'completed', 'cancelled'],
        default: 'active'
    }
});

// Appointment schema
const AppointmentSchema = new mongoose.Schema({
    // Customer information
    customerName: {
        type: String,
        required: true
    },
    customerEmail: {
        type: String,
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    // Pet information
    petName: {
        type: String,
        required: true
    },
    petType: {
        type: String,
        required: true
    },
    petBreed: {
        type: String
    },
    // Appointment details
    service: {
        type: String,
        required: true,
        enum: ['khám sức khỏe', 'tắm', 'cắt tỉa lông', 'lưu trú']
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    notes: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending'
    },
    assignedVet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create Models
const UserCollection = mongoose.model("users", UserSchema);
const PetCollection = mongoose.model("pets", PetSchema);
const HealthRecordCollection = mongoose.model("healthRecords", HealthRecordSchema);
const MedicalRecordCollection = mongoose.model("medicalRecords", MedicalRecordSchema);
const PrescriptionCollection = mongoose.model("prescriptions", PrescriptionSchema);
const AppointmentCollection = mongoose.model("appointments", AppointmentSchema);

module.exports = { 
    UserCollection, 
    PetCollection, 
    HealthRecordCollection, 
    MedicalRecordCollection, 
    PrescriptionCollection, 
    AppointmentCollection 
};