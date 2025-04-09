const express = require("express");
const path = require("path");
const bcrypt = require('bcrypt');
const session = require('express-session');
const { 
    UserCollection, 
    PetCollection, 
    HealthRecordCollection, 
    MedicalRecordCollection, 
    PrescriptionCollection, 
    AppointmentCollection 
} = require('./config');

const app = express();

app.use(session({
    secret: 'your-secret-key', 
    resave: false, 
    saveUninitialized: true, 
    cookie: { secure: false },
    name: 'pet_session'
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.set("view engine", "ejs");

app.use((req, res, next) => {
    res.locals.user = {
        name: req.session.name || null,
        role: req.session.role || null,
        id: req.session.userId || null
    };
    next();
});

app.get("/", async (req, res) => {
    try {
        const pets = await PetCollection.find().sort({ registeredAt: -1 }).limit(10);

        const registeredPets = await Promise.all(pets.map(async (pet) => {
            const prescriptions = await PrescriptionCollection.find({ pet: pet._id })
                .sort({ date: -1 })
                .limit(1);

            const appointments = await AppointmentCollection.find({ 
                petName: pet.name,
                customerPhone: pet.ownerPhone
            })
            .sort({ date: -1 })
            .limit(1);

            const petObj = pet.toObject();
            petObj.prescriptions = prescriptions;
            petObj.appointments = appointments;
            
            return petObj;
        }));
        
        res.render("home", { registeredPets });
    } catch (error) {
        console.error("Error fetching registered pets:", error);
        res.render("home", { registeredPets: [] });
    }
});
app.get("/vet/appointments", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const appointments = await AppointmentCollection.find().sort({ date: 1 });
        
        res.render("vet-appointments", { appointments });
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).send("Error loading appointments");
    }
});

app.get("/services", (req, res) => {
    res.render("services");
});


app.get("/appointment", (req, res) => {
    res.render("appointment");
});

app.post("/appointment", async (req, res) => {
    try {
        const { petName, petType, petBreed, ownerName, ownerPhone, ownerEmail, service, date, time, notes } = req.body;

        let existingPet = await PetCollection.findOne({
            name: petName,
            ownerPhone: ownerPhone
        });
        
        if (!existingPet) {
            existingPet = await PetCollection.create({
                name: petName,
                type: petType,
                breed: petBreed,
                ownerName: ownerName,
                ownerPhone: ownerPhone,
                ownerEmail: ownerEmail
            });
            console.log("New pet registered:", existingPet);
        }
        const appointment = await AppointmentCollection.create({
            customerName: ownerName,
            customerEmail: ownerEmail,
            customerPhone: ownerPhone,
            petName: petName,
            petType: petType,
            petBreed: petBreed,
            service: service,
            date: date,
            time: time,
            notes: notes,
            status: 'pending'
        });
        
        res.render("appointment-success", {
            appointmentInfo: {
                customerName: ownerName,
                petName: petName,
                service: service,
                date: date,
                time: time
            }
        });
    } catch (error) {
        console.error("Appointment error:", error);
        res.status(500).render("appointment", { error: "Lỗi đặt lịch" });
    }
});

app.get("/pet-health", (req, res) => {
    res.render("pet-health");
});

app.get("/about", (req, res) => {
    res.render("about");
});

app.get("/contact", (req, res) => {
    res.render("contact");
});

app.get("/appointment-success", (req, res) => {
    res.render("appointment-success");
});

app.get("/admin-secret", (req, res) => {
    res.render("admin-login");
});

app.post("/admin-login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await UserCollection.findOne({ name: username });
        
        if (!user) {
            return res.render("admin-login", { error: "Tên đăng nhập không tồn tại" });
        }

        const validPassword = password === user.password; // In real app, use bcrypt.compare
        
        if (!validPassword) {
            return res.render("admin-login", { error: "Mật khẩu không đúng" });
        }

        req.session.name = user.name;
        req.session.role = user.role;
        req.session.userId = user._id;

        if (user.role === 'admin') {
            return res.redirect("/admin/dashboard");
        } else if (user.role === 'vet') {
            return res.redirect("/vet/dashboard");
        }

        res.redirect("/admin/dashboard");
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).render("admin-login", { error: "Lỗi đăng nhập" });
    }
});

app.get("/admin/dashboard", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const appointments = await AppointmentCollection.find().sort({ date: 1 });
        const petCount = await PetCollection.countDocuments();
        const pendingAppointments = await AppointmentCollection.countDocuments({ status: 'pending' });
        const todayAppointments = await AppointmentCollection.countDocuments({ 
            date: { 
                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                $lt: new Date(new Date().setHours(23, 59, 59, 999))
            }
        });
        
        res.render("admin-dashboard", { 
            appointments,
            stats: {
                petCount,
                pendingAppointments,
                todayAppointments
            }
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).send("Error loading dashboard");
    }
});

app.get("/admin/pets", async (req, res) => {
    if (req.session.role !== 'admin' && req.session.role !== 'vet') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const pets = await PetCollection.find().sort({ registeredAt: -1 });
        res.render("admin-pets", { pets });
    } catch (error) {
        console.error("Error fetching pets:", error);
        res.status(500).send("Error loading pets");
    }
});

app.get("/vet/dashboard", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const appointments = await AppointmentCollection.find({ 
            status: { $in: ['pending', 'confirmed'] }
        }).sort({ date: 1 });
        
        const todayAppointments = await AppointmentCollection.find({ 
            date: { 
                $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                $lt: new Date(new Date().setHours(23, 59, 59, 999))
            }
        }).sort({ time: 1 });
        
        const pets = await PetCollection.find().sort({ registeredAt: -1 }).limit(5);
        
        res.render("vet-dashboard", { 
            appointments,
            todayAppointments,
            pets
        });
    } catch (error) {
        console.error("Vet dashboard error:", error);
        res.status(500).send("Error loading dashboard");
    }
});

app.get("/vet/pets", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const allPets = await PetCollection.find().sort({ name: 1 });
        const petsWithDetails = await Promise.all(allPets.map(async (pet) => {
            const latestAppointment = await AppointmentCollection.findOne({
                petName: pet.name,
                customerPhone: pet.ownerPhone
            }).sort({ createdAt: -1 });
            if (latestAppointment && latestAppointment.status === 'cancelled') {
                return null;
            }
            const petObj = pet.toObject();

            if (latestAppointment) {
                petObj.service = latestAppointment.service;
                petObj.appointmentStatus = latestAppointment.status;
            }
            
            return petObj;
        }));

        const filteredPets = petsWithDetails.filter(pet => pet !== null);
        
        res.render("vet-pets", { pets: filteredPets });
    } catch (error) {
        console.error("Error fetching pets:", error);
        res.status(500).send("Error loading pets");
    }
});

app.get("/vet/pets/:id", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const pet = await PetCollection.findById(req.params.id);
        
        if (!pet) {
            return res.status(404).send("Pet not found");
        }

        const healthRecords = await HealthRecordCollection.find({ 
            pet: req.params.id 
        }).sort({ date: -1 });

        const medicalRecords = await MedicalRecordCollection.find({ 
            pet: req.params.id 
        }).sort({ date: -1 });

        const prescriptions = await PrescriptionCollection.find({ 
            pet: req.params.id 
        }).sort({ date: -1 });
        
        res.render("vet-pet-detail", { 
            pet,
            healthRecords,
            medicalRecords,
            prescriptions
        });
    } catch (error) {
        console.error("Error fetching pet details:", error);
        res.status(500).send("Error loading pet details");
    }
});

app.get("/vet/pets/:id/health", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const pet = await PetCollection.findById(req.params.id);
        
        if (!pet) {
            return res.status(404).send("Pet not found");
        }
        
        res.render("vet-add-health-record", { pet });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Error loading form");
    }
});
app.get("/vet/medical-records", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const medicalRecords = await MedicalRecordCollection.find()
            .sort({ date: -1 })
            .populate({
                path: 'pet',
                select: 'name type breed ownerName'
            })
            .populate({
                path: 'veterinarian',
                select: 'name'
            });

        const healthCheckPets = await AppointmentCollection.find({
            service: 'khám sức khỏe',
            status: { $in: ['confirmed', 'completed'] }
        }).sort({ date: -1 });

        const uniquePetsMap = new Map();
        
        for (const appointment of healthCheckPets) {
            if (!uniquePetsMap.has(appointment.petName + appointment.customerPhone)) {
                const pet = await PetCollection.findOne({
                    name: appointment.petName,
                    ownerPhone: appointment.customerPhone
                });
                
                if (pet) {
                    uniquePetsMap.set(appointment.petName + appointment.customerPhone, pet);
                }
            }
        }
        const availablePets = Array.from(uniquePetsMap.values());
        
        res.render("vet-medical-records", {
            medicalRecords,
            availablePets
        });
    } catch (error) {
        console.error("Error fetching medical records:", error);
        res.status(500).send("Error loading medical records");
    }
});

app.post("/vet/medical-records", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { petId, symptoms, diagnosis, notes, followUpDate, veterinarianComments, medications, instructions } = req.body;

        let symptomsArray = [];
        if (typeof symptoms === 'string') {
            symptomsArray = symptoms.split(',').map(s => s.trim());
        } else if (Array.isArray(symptoms)) {
            symptomsArray = symptoms;
        }

        const medicalRecord = await MedicalRecordCollection.create({
            pet: petId,
            symptoms: symptomsArray,
            diagnosis,
            notes,
            followUpDate,
            veterinarian: req.session.userId,
            veterinarianComments
        });
 
        let medsArray = [];
        if (Array.isArray(medications.name)) {
            // Nhiều loại thuốc
            for (let i = 0; i < medications.name.length; i++) {
                if (medications.name[i]) {
                    medsArray.push({
                        name: medications.name[i],
                        dosage: medications.dosage[i],
                        frequency: medications.frequency[i],
                        duration: medications.duration[i],
                        notes: medications.notes[i]
                    });
                }
            }
        } else {
            if (medications.name) {
                medsArray.push({
                    name: medications.name,
                    dosage: medications.dosage,
                    frequency: medications.frequency,
                    duration: medications.duration,
                    notes: medications.notes
                });
            }
        }
        if (medsArray.length > 0) {
            await PrescriptionCollection.create({
                pet: petId,
                medications: medsArray,
                instructions,
                veterinarian: req.session.userId,
                medicalRecord: medicalRecord._id
            });
        }
        
        res.redirect("/vet/medical-records");
    } catch (error) {
        console.error("Error adding medical record:", error);
        res.status(500).send("Error saving medical record");
    }
});

app.post("/vet/prescriptions/:id/status", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { status } = req.body;
        
        if (!['active', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).send("Trạng thái không hợp lệ");
        }
        
        await PrescriptionCollection.findByIdAndUpdate(req.params.id, { status });
        
        res.status(200).send("Cập nhật thành công");
    } catch (error) {
        console.error("Error updating prescription status:", error);
        res.status(500).send("Error updating status");
    }
});

app.get("/vet/pets/:id/prescriptions", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const pet = await PetCollection.findById(req.params.id);
        
        if (!pet) {
            return res.status(404).send("Không tìm thấy thú cưng");
        }

        const prescriptions = await PrescriptionCollection.find({ pet: req.params.id })
            .sort({ date: -1 })
            .populate({
                path: 'veterinarian',
                select: 'name'
            })
            .populate({
                path: 'medicalRecord',
                select: 'diagnosis symptoms'
            });
        
        res.render("vet-pet-prescriptions", {
            pet,
            prescriptions
        });
    } catch (error) {
        console.error("Error fetching prescriptions:", error);
        res.status(500).send("Error loading prescriptions");
    }
});

app.post("/vet/prescriptions/:id/status", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { status } = req.body;
        
        if (!['active', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).send("Trạng thái không hợp lệ");
        }
        
        await PrescriptionCollection.findByIdAndUpdate(req.params.id, { status });
        
        res.status(200).send("Cập nhật thành công");
    } catch (error) {
        console.error("Error updating prescription status:", error);
        res.status(500).send("Error updating status");
    }
});

app.post("/vet/appointments/delete", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { appointmentId } = req.body;

        await AppointmentCollection.findByIdAndDelete(appointmentId);
        
        res.redirect("/vet/appointments");
    } catch (error) {
        console.error("Error deleting appointment:", error);
        res.status(500).send("Error deleting appointment");
    }
});

app.post("/vet/medical-records/delete", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { recordId } = req.body;       
        await PrescriptionCollection.deleteMany({ medicalRecord: recordId });
        await MedicalRecordCollection.findByIdAndDelete(recordId);
        
        res.redirect("/vet/medical-records");
    } catch (error) {
        console.error("Error deleting medical record:", error);
        res.status(500).send("Error deleting medical record");
    }
});

app.post("/vet/pets/:id/health", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { temperature, weight, heartRate, respirationRate, notes, status, nextCheckupDate } = req.body;
        
        await HealthRecordCollection.create({
            pet: req.params.id,
            temperature,
            weight,
            heartRate,
            respirationRate,
            notes,
            status,
            nextCheckupDate,
            veterinarian: req.session.userId
        });

        if (weight) {
            await PetCollection.findByIdAndUpdate(req.params.id, { weight });
        }
        
        res.redirect(`/vet/pets/${req.params.id}`);
    } catch (error) {
        console.error("Error adding health record:", error);
        res.status(500).send("Error saving health record");
    }
});

app.get("/vet/pets/:id/medical", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const pet = await PetCollection.findById(req.params.id);
        
        if (!pet) {
            return res.status(404).send("Pet not found");
        }
        
        res.render("vet-add-medical-record", { pet });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Error loading form");
    }
});

app.post("/vet/pets/:id/medical", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { symptoms, diagnosis, treatment, notes, followUpDate } = req.body;

        let symptomsArray = [];
        if (typeof symptoms === 'string') {
            symptomsArray = symptoms.split(',').map(s => s.trim());
        } else if (Array.isArray(symptoms)) {
            symptomsArray = symptoms;
        }
        
        await MedicalRecordCollection.create({
            pet: req.params.id,
            symptoms: symptomsArray,
            diagnosis,
            treatment,
            notes,
            followUpDate,
            veterinarian: req.session.userId
        });
        
        res.redirect(`/vet/pets/${req.params.id}`);
    } catch (error) {
        console.error("Error adding medical record:", error);
        res.status(500).send("Error saving medical record");
    }
});

app.get("/vet/pets/:id/prescription", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const pet = await PetCollection.findById(req.params.id);
        
        if (!pet) {
            return res.status(404).send("Pet not found");
        }
        
        res.render("vet-add-prescription", { pet });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Error loading form");
    }
});

app.post("/vet/appointments/:id/confirm", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        await AppointmentCollection.findByIdAndUpdate(
            req.params.id, 
            { 
                status: 'confirmed',
                assignedVet: req.session.userId
            }
        );

        res.redirect("/vet/appointments");
    } catch (error) {
        console.error("Error confirming appointment:", error);
        res.status(500).send("Error updating appointment status");
    }
});

app.post("/vet/appointments/:id/cancel", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        await AppointmentCollection.findByIdAndUpdate(
            req.params.id, 
            { status: 'cancelled' }
        );

        res.redirect("/vet/appointments");
    } catch (error) {
        console.error("Error cancelling appointment:", error);
        res.status(500).send("Error updating appointment status");
    }
});

app.post("/vet/pets/:id/prescription", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { medications, instructions } = req.body;

        let medsArray = [];
        if (Array.isArray(medications.name)) {
            // Multiple medications
            for (let i = 0; i < medications.name.length; i++) {
                if (medications.name[i]) {
                    medsArray.push({
                        name: medications.name[i],
                        dosage: medications.dosage[i],
                        frequency: medications.frequency[i],
                        duration: medications.duration[i],
                        notes: medications.notes[i]
                    });
                }
            }
        } else {
            medsArray.push({
                name: medications.name,
                dosage: medications.dosage,
                frequency: medications.frequency,
                duration: medications.duration,
                notes: medications.notes
            });
        }
        
        await PrescriptionCollection.create({
            pet: req.params.id,
            medications: medsArray,
            instructions,
            veterinarian: req.session.userId
        });
        
        res.redirect(`/vet/pets/${req.params.id}`);
    } catch (error) {
        console.error("Error adding prescription:", error);
        res.status(500).send("Error saving prescription");
    }
});
async function createDefaultVet() {
    try {
        const vetExists = await UserCollection.findOne({ role: 'vet' });
        if (!vetExists) {
            await UserCollection.create({
                name: 'vet',
                password: 'vet',
                role: 'vet',
                email: 'vet@example.com'
            });
            
            console.log('Default vet account created');
        }

        const adminExists = await UserCollection.findOne({ role: 'admin' });
        if (!adminExists) {
            await UserCollection.create({
                name: 'admin',
                password: 'admin123',
                role: 'admin'
            });
            
            console.log('Default admin account created');
        }
    } catch (error) {
        console.error('Error creating accounts:', error);
    }
}
const port = 5000;
app.listen(port, () => {
    createDefaultVet();
    console.log(`Pet services server running on port ${port}`);
});