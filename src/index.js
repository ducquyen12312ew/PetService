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
    AppointmentCollection,
    ShopInformationCollection
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
// Add these routes to src/index.js

// Login page route
app.get("/login", (req, res) => {
    const redirectTo = req.query.redirect || "";
    res.render("login", { redirectTo });
});
app.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        const redirectTo = req.body.redirectTo || "";

        // Tìm người dùng bằng tên đăng nhập hoặc email
        const user = await UserCollection.findOne({
            $or: [
                { name: username },
                { email: username }
            ]
        });
        
        if (!user) {
            return res.render("login", { 
                error: "Tài khoản không tồn tại", 
                redirectTo 
            });
        }

        // Trong môi trường thật, bạn nên sử dụng bcrypt.compare
        const validPassword = password === user.password;
        
        if (!validPassword) {
            return res.render("login", { 
                error: "Mật khẩu không đúng", 
                redirectTo 
            });
        }

        // Lưu thông tin người dùng vào session
        req.session.name = user.name;
        req.session.role = user.role;
        req.session.userId = user._id;

        // Chuyển hướng dựa trên vai trò
        if (user.role === 'admin') {
            return res.redirect("/admin/dashboard");
        } else if (user.role === 'vet') {
            return res.redirect("/vet/dashboard");
        } else {
            // Người dùng thông thường
            return res.redirect("/user/dashboard");
        }
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).render("login", { 
            error: "Lỗi đăng nhập", 
            redirectTo: req.body.redirectTo || "" 
        });
    }
});

// Logout route
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

// User dashboard route
app.get("/user/dashboard", async (req, res) => {
    // Check if user is logged in
    if (!req.session.userId) {
        return res.redirect("/login");
    }
    
    try {
        // Get the current user
        const currentUser = await UserCollection.findById(req.session.userId);
        if (!currentUser) {
            req.session.destroy();
            return res.redirect("/login");
        }
        
        // Find user's pets using multiple methods
        let userPets = await PetCollection.find({ 
            $or: [
                { ownerName: currentUser.name },
                { ownerEmail: currentUser.email },
                { ownerPhone: currentUser.phone }
            ]
        }).sort({ registeredAt: -1 });
        
        // If no pets found directly, try finding through appointments
        if (userPets.length === 0) {
            console.log("No pets found directly, searching through appointments...");
            const userAppointments = await AppointmentCollection.find({
                $or: [
                    { customerEmail: currentUser.email },
                    { customerName: currentUser.name },
                    { customerPhone: currentUser.phone }
                ]
            });
            
            console.log(`Found ${userAppointments.length} appointments for this user`);
            
            // Create a unique set of pet identifiers from appointments
            const petIdentifiers = new Set();
            userAppointments.forEach(appointment => {
                petIdentifiers.add(JSON.stringify({
                    name: appointment.petName,
                    phone: appointment.customerPhone
                }));
            });
            
            // Find pets based on appointments
            for (const identifierJson of petIdentifiers) {
                const identifier = JSON.parse(identifierJson);
                const pet = await PetCollection.findOne({
                    name: identifier.name,
                    ownerPhone: identifier.phone
                });
                
                if (pet) {
                    userPets.push(pet);
                    console.log(`Found pet through appointment: ${pet.name}`);
                }
            }
        }

        // Add prescriptions and appointments to each pet
        const processedPets = await Promise.all(userPets.map(async (pet) => {
            const prescriptions = await PrescriptionCollection.find({ pet: pet._id })
                .sort({ date: -1 })
                .limit(1);

            const appointments = await AppointmentCollection.find({ 
                petName: pet.name,
                customerPhone: pet.ownerPhone
            })
            .sort({ date: -1 })
            .limit(1);

            const petObj = typeof pet.toObject === 'function' ? pet.toObject() : pet;
            petObj.prescriptions = prescriptions;
            petObj.appointments = appointments;
            
            return petObj;
        }));
        
        console.log(`Displaying ${processedPets.length} pets to user ${currentUser.name}`);
        
        // Pass both user and userPets to the template
        res.render("user", { 
            user: {
                name: currentUser.name,
                email: currentUser.email,
                role: currentUser.role
            },
            userPets: processedPets 
        });
    } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).render("error", { 
            message: "Error loading user dashboard",
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Signup page route
app.get("/signup", (req, res) => {
    res.render("signup");
});

// Signup form submission
app.post("/signup", async (req, res) => {
    try {
        const { fullName, email, password, confirmPassword, phone } = req.body;
        
        // Check if passwords match
        if (password !== confirmPassword) {
            return res.render("signup", { error: "Mật khẩu không khớp" });
        }
        
        // Check if email already exists
        const existingEmail = await UserCollection.findOne({ email: email });
        if (existingEmail) {
            return res.render("signup", { error: "Email đã được sử dụng" });
        }
        
        // Create new user with email as name/username
        const newUser = await UserCollection.create({
            name: fullName,
            password: password, // In production, use bcrypt.hash
            email: email,
            phone: phone,
            role: 'user'
        });
        
        // Set session
        req.session.userId = newUser._id;
        req.session.name = newUser.name;
        req.session.role = 'user';
        
        res.redirect("/user/dashboard");
    } catch (error) {
        console.error("Signup error:", error);
        res.status(500).render("signup", { error: "Lỗi đăng ký, vui lòng thử lại" });
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
    res.redirect("/login?redirect=admin");
});

app.post("/admin-login", async (req, res) => {
    try {
        const { username, password } = req.body;

        // Tìm người dùng bằng tên đăng nhập hoặc email
        const user = await UserCollection.findOne({
            $or: [
                { name: username },
                { email: username }
            ]
        });
        
        if (!user) {
            return res.render("login", { 
                error: "Tài khoản không tồn tại",
                redirectTo: "admin" 
            });
        }

        const validPassword = password === user.password; // In real app, use bcrypt.compare
        
        if (!validPassword) {
            return res.render("login", { 
                error: "Mật khẩu không đúng",
                redirectTo: "admin" 
            });
        }

        req.session.name = user.name;
        req.session.role = user.role;
        req.session.userId = user._id;

        // Kiểm tra quyền - chỉ admin và vet mới được truy cập
        if (user.role !== 'admin' && user.role !== 'vet') {
            return res.render("login", { 
                error: "Bạn không có quyền truy cập khu vực này",
                redirectTo: "admin" 
            });
        }

        // Chuyển hướng dựa vào vai trò
        if (user.role === 'admin') {
            return res.redirect("/admin/dashboard");
        } else if (user.role === 'vet') {
            return res.redirect("/vet/dashboard");
        }

        res.redirect("/");
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).render("login", { 
            error: "Lỗi đăng nhập",
            redirectTo: "admin"
        });
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
        // Update appointment status
        await AppointmentCollection.findByIdAndUpdate(
            req.params.id, 
            { 
                status: 'confirmed',
                assignedVet: req.session.userId
            }
        );

        // Get the updated appointment with complete data
        const appointment = await AppointmentCollection.findById(req.params.id);
        if (!appointment) {
            return res.redirect("/vet/appointments");
        }

        // Check if pet exists
        let pet = await PetCollection.findOne({
            name: appointment.petName,
            ownerPhone: appointment.customerPhone
        });

        // If pet doesn't exist, create it
        if (!pet) {
            console.log(`Creating new pet from confirmed appointment: ${appointment.petName}`);
            pet = new PetCollection({
                name: appointment.petName,
                type: appointment.petType,
                breed: appointment.petBreed || 'Không xác định',
                ownerName: appointment.customerName,
                ownerPhone: appointment.customerPhone,
                ownerEmail: appointment.customerEmail
            });
            await pet.save();
        }

        console.log(`Appointment confirmed: ID ${appointment._id}, Pet: ${pet.name}`);
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

// Routes for the admin section in index.js
// Thêm vào hàm createDefaultVet hoặc chạy riêng
async function createAdminAccount() {
    try {
        const adminExists = await UserCollection.findOne({ email: 'admin@example.com' });
        if (!adminExists) {
            await UserCollection.create({
                name: 'admin',
                password: 'admin123',
                role: 'admin',
                email: 'admin@example.com',
                phone: '0123456789'
            });
            
            console.log('Admin account with email admin@example.com created');
        } else {
            console.log('Admin account with email admin@example.com already exists');
        }
    } catch (error) {
        console.error('Error creating admin account:', error);
    }
}

// Gọi hàm để tạo tài khoản
createAdminAccount();
// Admin dashboard
app.get("/admin/dashboard", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        // Get counts of different types of users
        const totalUsers = await UserCollection.countDocuments();
        const adminUsers = await UserCollection.countDocuments({ role: 'admin' });
        const vetUsers = await UserCollection.countDocuments({ role: 'vet' });
        const staffUsers = await UserCollection.countDocuments({ role: 'staff' });
        
        res.render("admin-dashboard", { 
            stats: {
                totalUsers,
                adminUsers,
                vetUsers,
                staffUsers
            }
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).send("Error loading dashboard");
    }
});

// User management view
app.get("/admin/users", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const users = await UserCollection.find().sort({ createdAt: -1 });
        res.render("admin-users", { users });
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).send("Error loading users");
    }
});

// Add new user
app.post("/admin/users/add", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { username, password, email, phone, role } = req.body;
        
        // Check if username already exists
        const existingUser = await UserCollection.findOne({ name: username });
        if (existingUser) {
            // In a real app, you would handle this error better
            return res.status(400).send("Username already exists");
        }
        
        // Validate role
        if (!['admin', 'vet', 'staff'].includes(role)) {
            return res.status(400).send("Invalid role");
        }
        
        // Create user
        await UserCollection.create({
            name: username,
            password, // In a production app, you should hash this password
            email,
            phone,
            role
        });
        
        res.redirect("/admin/users");
    } catch (error) {
        console.error("Error adding user:", error);
        res.status(500).send("Error adding user");
    }
});

// Update user
app.post("/admin/users/update", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { userId, email, phone, newRole, resetPassword, newPassword } = req.body;
        
        // Don't allow changing own role (to prevent admin from removing their own access)
        if (userId === req.session.userId && newRole !== 'admin') {
            return res.status(400).send("You cannot change your own role from admin");
        }
        
        // Validate new role
        if (!['admin', 'vet', 'staff'].includes(newRole)) {
            return res.status(400).send("Invalid role");
        }
        
        const updateData = {
            email,
            phone,
            role: newRole
        };
        
        // Update password if requested
        if (resetPassword === 'on' && newPassword) {
            updateData.password = newPassword; // In a production app, you should hash this password
        }
        
        await UserCollection.findByIdAndUpdate(userId, updateData);
        
        res.redirect("/admin/users");
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send("Error updating user");
    }
});

// Delete user
app.post("/admin/users/delete", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { userId } = req.body;
        
        // Don't allow deleting own account
        if (userId === req.session.userId) {
            return res.status(400).send("You cannot delete your own account");
        }
        
        await UserCollection.findByIdAndDelete(userId);
        
        res.redirect("/admin/users");
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send("Error deleting user");
    }
});

// Add these routes to your existing index.js file

// Admin appointments page
app.get("/admin/appointments", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const appointments = await AppointmentCollection.find().sort({ date: -1 });
        
        // Get all veterinarians for assigning to appointments
        const vets = await UserCollection.find({ role: 'vet' }).sort({ name: 1 });
        
        res.render("admin-appointments", { 
            appointments, 
            vets 
        });
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).send("Error loading appointments");
    }
});

// Admin - Add new appointment
app.post("/admin/appointments/add", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { 
            customerName, 
            customerEmail, 
            customerPhone, 
            petName, 
            petType, 
            petBreed, 
            service, 
            date, 
            time, 
            notes,
            status,
            vetId 
        } = req.body;
        
        // Create new appointment
        await AppointmentCollection.create({
            customerName,
            customerEmail,
            customerPhone,
            petName,
            petType,
            petBreed,
            service,
            date,
            time,
            notes,
            status: status || 'pending',
            assignedVet: vetId || null,
            createdAt: new Date()
        });
        
        // Check if pet exists, if not create it
        const existingPet = await PetCollection.findOne({
            name: petName,
            ownerPhone: customerPhone
        });
        
        if (!existingPet) {
            await PetCollection.create({
                name: petName,
                type: petType,
                breed: petBreed || 'Không xác định',
                ownerName: customerName,
                ownerPhone: customerPhone,
                ownerEmail: customerEmail,
                registeredAt: new Date()
            });
        }
        
        res.redirect("/admin/appointments");
    } catch (error) {
        console.error("Error adding appointment:", error);
        res.status(500).send("Error creating appointment");
    }
});

// Admin - Update appointment
app.post("/admin/appointments/update", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { appointmentId, status, vetId, notes } = req.body;
        
        const updateData = {};
        
        if (status) updateData.status = status;
        if (vetId) updateData.assignedVet = vetId;
        if (notes !== undefined) updateData.notes = notes;
        
        await AppointmentCollection.findByIdAndUpdate(appointmentId, updateData);
        
        res.redirect("/admin/appointments");
    } catch (error) {
        console.error("Error updating appointment:", error);
        res.status(500).send("Error updating appointment");
    }
});

// Admin - Delete appointment
app.post("/admin/appointments/delete", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { appointmentId } = req.body;
        
        await AppointmentCollection.findByIdAndDelete(appointmentId);
        
        res.redirect("/admin/appointments");
    } catch (error) {
        console.error("Error deleting appointment:", error);
        res.status(500).send("Error deleting appointment");
    }
});

// Admin - Assign vet to appointment
app.post("/admin/appointments/assign", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { appointmentId, vetId } = req.body;
        
        await AppointmentCollection.findByIdAndUpdate(appointmentId, {
            assignedVet: vetId,
            // If assigning a vet, also confirm the appointment
            status: 'confirmed'
        });
        
        res.redirect("/admin/appointments");
    } catch (error) {
        console.error("Error assigning vet:", error);
        res.status(500).send("Error assigning vet to appointment");
    }
});

app.get("/admin/shop", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        let shopInfo = await ShopInformationCollection.findOne();
        
        // Nếu chưa có thông tin shop, tạo mới với dữ liệu mặc định
        if (!shopInfo) {
            shopInfo = await ShopInformationCollection.create({
                shopName: "Pet Care Center",
                address: "123 Đường ABC, Quận XYZ, TP.HCM",
                phone: "0982-495-562",
                email: "phanquyenkols.booking@gmail.com",
                description: "Chăm sóc tốt nhất cho người bạn thân yêu của bạn",
                workingHours: {
                    monday: { open: "08:00", close: "18:00" },
                    tuesday: { open: "08:00", close: "18:00" },
                    wednesday: { open: "08:00", close: "18:00" },
                    thursday: { open: "08:00", close: "18:00" },
                    friday: { open: "08:00", close: "18:00" },
                    saturday: { open: "09:00", close: "17:00" },
                    sunday: { open: "09:00", close: "17:00" }
                },
                services: ["Khám sức khỏe", "Tắm", "Cắt tỉa lông", "Lưu trú"],
                socialMedia: {
                    facebook: "",
                    instagram: "",
                    website: ""
                }
            });
        }
        
        res.render("admin-shop", { shopInfo });
    } catch (error) {
        console.error("Error fetching shop info:", error);
        res.status(500).send("Error loading shop information");
    }
});

app.post("/admin/shop/update", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const {
            shopName, address, phone, email, description,
            mondayOpen, mondayClose, tuesdayOpen, tuesdayClose,
            wednesdayOpen, wednesdayClose, thursdayOpen, thursdayClose,
            fridayOpen, fridayClose, saturdayOpen, saturdayClose,
            sundayOpen, sundayClose,
            services, facebook, instagram, website
        } = req.body;

        const updateData = {
            shopName,
            address,
            phone,
            email,
            description,
            workingHours: {
                monday: { open: mondayOpen, close: mondayClose },
                tuesday: { open: tuesdayOpen, close: tuesdayClose },
                wednesday: { open: wednesdayOpen, close: wednesdayClose },
                thursday: { open: thursdayOpen, close: thursdayClose },
                friday: { open: fridayOpen, close: fridayClose },
                saturday: { open: saturdayOpen, close: saturdayClose },
                sunday: { open: sundayOpen, close: sundayClose }
            },
            services: Array.isArray(services) ? services : [services],
            socialMedia: {
                facebook,
                instagram,
                website
            },
            updatedAt: new Date(),
            updatedBy: req.session.userId
        };

        await ShopInformationCollection.findOneAndUpdate({}, updateData, { 
            upsert: true, 
            new: true 
        });

        res.redirect("/admin/shop?success=1");
    } catch (error) {
        console.error("Error updating shop info:", error);
        res.redirect("/admin/shop?error=1");
    }
});

app.get("/admin/pets/:id", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const pet = await PetCollection.findById(req.params.id);
        
        if (!pet) {
            return res.status(404).send("Pet not found");
        }

        // Lấy thông tin bổ sung về thú cưng
        const healthRecords = await HealthRecordCollection.find({ 
            pet: req.params.id 
        }).sort({ date: -1 }).populate('veterinarian', 'name');

        const medicalRecords = await MedicalRecordCollection.find({ 
            pet: req.params.id 
        }).sort({ date: -1 }).populate('veterinarian', 'name');

        const prescriptions = await PrescriptionCollection.find({ 
            pet: req.params.id 
        }).sort({ date: -1 }).populate('veterinarian', 'name');

        const appointments = await AppointmentCollection.find({
            petName: pet.name,
            customerPhone: pet.ownerPhone
        }).sort({ date: -1 });
        
        res.render("admin-pet-detail", { 
            pet,
            healthRecords,
            medicalRecords,
            prescriptions,
            appointments
        });
    } catch (error) {
        console.error("Error fetching pet details:", error);
        res.status(500).send("Error loading pet details");
    }
});

// Route để sửa thông tin thú cưng
app.get("/admin/pets/:id/edit", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const pet = await PetCollection.findById(req.params.id);
        
        if (!pet) {
            return res.status(404).send("Pet not found");
        }
        
        res.render("admin-pet-edit", { pet });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Error loading edit form");
    }
});

// Route để cập nhật thông tin thú cưng
app.post("/admin/pets/:id/update", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        const { name, type, breed, age, weight, gender, ownerName, ownerPhone, ownerEmail } = req.body;
        
        await PetCollection.findByIdAndUpdate(req.params.id, {
            name,
            type,
            breed,
            age: age ? parseInt(age) : undefined,
            weight: weight ? parseFloat(weight) : undefined,
            gender,
            ownerName,
            ownerPhone,
            ownerEmail
        });
        
        res.redirect(`/admin/pets/${req.params.id}?success=1`);
    } catch (error) {
        console.error("Error updating pet:", error);
        res.redirect(`/admin/pets/${req.params.id}/edit?error=1`);
    }
});

// Route để xóa thú cưng
app.post("/admin/pets/:id/delete", async (req, res) => {
    if (req.session.role !== 'admin') {
        return res.redirect("/admin-secret");
    }
    
    try {
        // Xóa tất cả dữ liệu liên quan đến thú cưng
        await HealthRecordCollection.deleteMany({ pet: req.params.id });
        await MedicalRecordCollection.deleteMany({ pet: req.params.id });
        await PrescriptionCollection.deleteMany({ pet: req.params.id });
        
        // Xóa thú cưng
        await PetCollection.findByIdAndDelete(req.params.id);
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error deleting pet:", error);
        res.status(500).json({ success: false });
    }
});

async function createDefaultShopInfo() {
    try {
        const shopExists = await ShopInformationCollection.findOne();
        if (!shopExists) {
            await ShopInformationCollection.create({
                shopName: "Pet Care Center",
                address: "123 Đường ABC, Quận XYZ, TP.HCM",
                phone: "0982-495-562",
                email: "phanquyenkols.booking@gmail.com",
                description: "Chăm sóc tốt nhất cho người bạn thân yêu của bạn",
                workingHours: {
                    monday: { open: "08:00", close: "18:00" },
                    tuesday: { open: "08:00", close: "18:00" },
                    wednesday: { open: "08:00", close: "18:00" },
                    thursday: { open: "08:00", close: "18:00" },
                    friday: { open: "08:00", close: "18:00" },
                    saturday: { open: "09:00", close: "17:00" },
                    sunday: { open: "09:00", close: "17:00" }
                },
                services: ["Khám sức khỏe", "Tắm", "Cắt tỉa lông", "Lưu trú"]
            });
            console.log('Default shop information created');
        }
    } catch (error) {
        console.error('Error creating shop info:', error);
    }
}

const port = 5000;
app.listen(port, () => {
    createDefaultVet();
    console.log(`Pet services server running on port ${port}`);
});