// index.js
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

// Session configuration
app.use(session({
    secret: 'your-secret-key', 
    resave: false, 
    saveUninitialized: true, 
    cookie: { secure: false },
    name: 'pet_session'
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Set EJS as view engine
app.set("view engine", "ejs");

// Add user info to all views
app.use((req, res, next) => {
    res.locals.user = {
        name: req.session.name || null,
        role: req.session.role || null,
        id: req.session.userId || null
    };
    next();
});

// Main page with services
app.get("/", async (req, res) => {
    try {
        // Truy vấn lấy thú cưng đã đăng ký gần đây nhất (giới hạn 10 con)
        const pets = await PetCollection.find().sort({ registeredAt: -1 }).limit(10);
        
        // Với mỗi thú cưng, kiểm tra xem đã có đơn thuốc chưa
        const registeredPets = await Promise.all(pets.map(async (pet) => {
            const prescriptions = await PrescriptionCollection.find({ pet: pet._id })
                .sort({ date: -1 })
                .limit(1);
                
            // Chuyển đổi document Mongoose thành object để có thể thêm thuộc tính mới
            const petObj = pet.toObject();
            petObj.prescriptions = prescriptions;
            
            return petObj;
        }));
        
        res.render("home", { registeredPets });
    } catch (error) {
        console.error("Error fetching registered pets:", error);
        res.render("home", { registeredPets: [] });
    }
});

// Services page
app.get("/services", (req, res) => {
    res.render("services");
});

// Appointment booking - available without login
app.get("/appointment", (req, res) => {
    res.render("appointment");
});

app.post("/appointment", async (req, res) => {
    try {
        const { petName, petType, petBreed, ownerName, ownerPhone, ownerEmail, service, date, time, notes } = req.body;
        
        // Check if pet already exists
        let existingPet = await PetCollection.findOne({
            name: petName,
            ownerPhone: ownerPhone
        });
        
        // If pet doesn't exist, create it
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
        
        // Create appointment
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

// Pet health info
app.get("/pet-health", (req, res) => {
    res.render("pet-health");
});

// About us page
app.get("/about", (req, res) => {
    res.render("about");
});

// Contact page
app.get("/contact", (req, res) => {
    res.render("contact");
});

// Appointment success page
app.get("/appointment-success", (req, res) => {
    res.render("appointment-success");
});

// Hidden admin login route
app.get("/admin-secret", (req, res) => {
    res.render("admin-login");
});

app.post("/admin-login", async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user (admin or vet)
        const user = await UserCollection.findOne({ name: username });
        
        if (!user) {
            return res.render("admin-login", { error: "Tên đăng nhập không tồn tại" });
        }
        
        // Check password
        const validPassword = password === user.password; // In real app, use bcrypt.compare
        
        if (!validPassword) {
            return res.render("admin-login", { error: "Mật khẩu không đúng" });
        }
        
        // Set session
        req.session.name = user.name;
        req.session.role = user.role;
        req.session.userId = user._id;
        
        // Redirect based on role
        if (user.role === 'admin') {
            return res.redirect("/admin/dashboard");
        } else if (user.role === 'vet') {
            return res.redirect("/vet/dashboard");
        }
        
        // Default fallback
        res.redirect("/admin/dashboard");
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).render("admin-login", { error: "Lỗi đăng nhập" });
    }
});

// Admin Dashboard
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

// Pet list for admin
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

// ==================== VET ROUTES ====================

// Vet Dashboard
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

// Pet list for vet
app.get("/vet/pets", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const pets = await PetCollection.find().sort({ name: 1 });
        res.render("vet-pets", { pets });
    } catch (error) {
        console.error("Error fetching pets:", error);
        res.status(500).send("Error loading pets");
    }
});

// View single pet details and health records
app.get("/vet/pets/:id", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const pet = await PetCollection.findById(req.params.id);
        
        if (!pet) {
            return res.status(404).send("Pet not found");
        }
        
        // Get health records
        const healthRecords = await HealthRecordCollection.find({ 
            pet: req.params.id 
        }).sort({ date: -1 });
        
        // Get medical records
        const medicalRecords = await MedicalRecordCollection.find({ 
            pet: req.params.id 
        }).sort({ date: -1 });
        
        // Get prescriptions
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

// Add health record form
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

// Add health record - POST
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
        
        // Update pet weight
        if (weight) {
            await PetCollection.findByIdAndUpdate(req.params.id, { weight });
        }
        
        res.redirect(`/vet/pets/${req.params.id}`);
    } catch (error) {
        console.error("Error adding health record:", error);
        res.status(500).send("Error saving health record");
    }
});

// Add medical record form
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

// Add medical record - POST
app.post("/vet/pets/:id/medical", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { symptoms, diagnosis, treatment, notes, followUpDate } = req.body;
        
        // Convert symptoms to array
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

// Add prescription form
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

// Add prescription - POST
app.post("/vet/pets/:id/prescription", async (req, res) => {
    if (req.session.role !== 'vet' && req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { medications, instructions } = req.body;
        
        // Process medications
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
            // Single medication
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

// Initialize server - Create default vet account
async function createDefaultVet() {
    try {
        const vetExists = await UserCollection.findOne({ role: 'vet' });
        if (!vetExists) {
            await UserCollection.create({
                name: 'vet',
                password: 'vet123',
                role: 'vet',
                email: 'vet@example.com'
            });
            
            console.log('Default vet account created');
        }
        
        // Also create admin if doesn't exist
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