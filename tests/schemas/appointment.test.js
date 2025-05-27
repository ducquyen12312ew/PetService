// tests/schemas/appointment.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Appointment Schema/Collection Tests', () => {
  let mongoServer;
  let testConnection;
  let AppointmentCollection;

  // Khởi tạo database test
  beforeAll(async () => {
    // Tạo MongoMemoryServer
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Tạo connection riêng cho test
    testConnection = mongoose.createConnection(mongoUri);
    
    // Tạo Appointment Schema cho test
    const AppointmentSchema = new mongoose.Schema({
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
    
    // Tạo model từ connection riêng
    AppointmentCollection = testConnection.model('appointments', AppointmentSchema);
  });

  // Dọn dẹp sau test
  afterAll(async () => {
    if (testConnection) {
      await testConnection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // Xóa dữ liệu trước mỗi test
  beforeEach(async () => {
    if (AppointmentCollection) {
      await AppointmentCollection.deleteMany({});
    }
  });

  // TEST 1: Tạo appointment với dữ liệu hợp lệ
  test('should create appointment with valid data', async () => {
    const appointmentData = {
      customerName: 'Sarah Connor',
      customerEmail: 'sarah@example.com',
      customerPhone: '0123456789',
      petName: 'Fluffy',
      petType: 'cat',
      petBreed: 'Persian',
      service: 'khám sức khỏe',
      date: new Date('2025-06-01'),
      time: '10:00',
      notes: 'First time visit'
    };

    const appointment = await AppointmentCollection.create(appointmentData);

    expect(appointment).toBeDefined();
    expect(appointment.customerName).toBe('Sarah Connor');
    expect(appointment.customerEmail).toBe('sarah@example.com');
    expect(appointment.customerPhone).toBe('0123456789');
    expect(appointment.petName).toBe('Fluffy');
    expect(appointment.petType).toBe('cat');
    expect(appointment.petBreed).toBe('Persian');
    expect(appointment.service).toBe('khám sức khỏe');
    expect(appointment.date).toEqual(new Date('2025-06-01'));
    expect(appointment.time).toBe('10:00');
    expect(appointment.notes).toBe('First time visit');
    expect(appointment.status).toBe('pending'); // default value
    expect(appointment.createdAt).toBeDefined();
    expect(appointment.createdAt).toBeInstanceOf(Date);
  });

  // TEST 2: Kiểm tra validation các field bắt buộc
  test('should require customerName field', async () => {
    const appointmentData = {
      customerEmail: 'test@example.com',
      customerPhone: '0123456789',
      petName: 'TestPet',
      petType: 'dog',
      service: 'tắm',
      date: new Date('2025-06-01'),
      time: '14:00'
    };

    await expect(AppointmentCollection.create(appointmentData))
      .rejects
      .toThrow();
  });

  test('should require customerEmail field', async () => {
    const appointmentData = {
      customerName: 'John Doe',
      customerPhone: '0123456789',
      petName: 'TestPet',
      petType: 'dog',
      service: 'tắm',
      date: new Date('2025-06-01'),
      time: '14:00'
    };

    await expect(AppointmentCollection.create(appointmentData))
      .rejects
      .toThrow();
  });

  test('should require service field', async () => {
    const appointmentData = {
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      customerPhone: '0123456789',
      petName: 'TestPet',
      petType: 'dog',
      date: new Date('2025-06-01'),
      time: '14:00'
    };

    await expect(AppointmentCollection.create(appointmentData))
      .rejects
      .toThrow();
  });

  // TEST 3: Kiểm tra service enum validation
  test('should only allow valid service types', async () => {
    const validServices = ['khám sức khỏe', 'tắm', 'cắt tỉa lông', 'lưu trú'];
    
    // Test các service hợp lệ
    for (const service of validServices) {
      const appointmentData = {
        customerName: 'Valid Service Test',
        customerEmail: 'valid@example.com',
        customerPhone: '0123456789',
        petName: 'ValidPet',
        petType: 'dog',
        service: service,
        date: new Date('2025-06-01'),
        time: '10:00'
      };

      const appointment = await AppointmentCollection.create(appointmentData);
      expect(appointment.service).toBe(service);
      
      // Xóa để chuẩn bị cho test tiếp theo
      await AppointmentCollection.findByIdAndDelete(appointment._id);
    }
  });

  test('should reject invalid service types', async () => {
    const appointmentData = {
      customerName: 'Invalid Service Test',
      customerEmail: 'invalid@example.com',
      customerPhone: '0123456789',
      petName: 'InvalidPet',
      petType: 'dog',
      service: 'invalid_service', // Invalid service
      date: new Date('2025-06-01'),
      time: '10:00'
    };

    await expect(AppointmentCollection.create(appointmentData))
      .rejects
      .toThrow();
  });

  // TEST 4: Kiểm tra default values
  test('should set default status to pending', async () => {
    const appointmentData = {
      customerName: 'Default Status Test',
      customerEmail: 'default@example.com',
      customerPhone: '0555666777',
      petName: 'DefaultPet',
      petType: 'rabbit',
      service: 'khám sức khỏe',
      date: new Date('2025-06-15'),
      time: '09:00'
    };

    const appointment = await AppointmentCollection.create(appointmentData);
    expect(appointment.status).toBe('pending');
  });

  // TEST 5: Kiểm tra status enum validation
  test('should validate status enum values', async () => {
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    
    for (const status of validStatuses) {
      const appointmentData = {
        customerName: 'Status Test',
        customerEmail: 'status@example.com',
        customerPhone: '0123456789',
        petName: 'StatusPet',
        petType: 'cat',
        service: 'khám sức khỏe',
        date: new Date('2025-06-01'),
        time: '11:00',
        status: status
      };

      const appointment = await AppointmentCollection.create(appointmentData);
      expect(appointment.status).toBe(status);
      
      await AppointmentCollection.findByIdAndDelete(appointment._id);
    }
  });

  // TEST 6: Kiểm tra update appointment
  test('should update appointment status', async () => {
    // Tạo appointment
    const appointmentData = {
      customerName: 'Update Test',
      customerEmail: 'update@example.com',
      customerPhone: '0999888777',
      petName: 'UpdatePet',
      petType: 'cat',
      service: 'khám sức khỏe',
      date: new Date('2025-06-01'),
      time: '10:00'
    };

    const appointment = await AppointmentCollection.create(appointmentData);
    expect(appointment.status).toBe('pending');

    // Update status
    const updatedAppointment = await AppointmentCollection.findByIdAndUpdate(
      appointment._id,
      { status: 'confirmed' },
      { new: true }
    );

    expect(updatedAppointment.status).toBe('confirmed');
    expect(updatedAppointment.customerName).toBe('Update Test');
  });

  // TEST 7: Kiểm tra query appointments
  test('should find appointments by customer phone', async () => {
    const phoneNumber = '0123123123';
    
    // Tạo nhiều appointments cho cùng một customer
    const appointmentData1 = {
      customerName: 'Query Test Customer',
      customerEmail: 'query@example.com',
      customerPhone: phoneNumber,
      petName: 'Pet1',
      petType: 'dog',
      service: 'khám sức khỏe',
      date: new Date('2025-06-01'),
      time: '10:00'
    };

    const appointmentData2 = {
      customerName: 'Query Test Customer',
      customerEmail: 'query@example.com',
      customerPhone: phoneNumber,
      petName: 'Pet2',
      petType: 'cat',
      service: 'tắm',
      date: new Date('2025-06-02'),
      time: '14:00'
    };

    await AppointmentCollection.create(appointmentData1);
    await AppointmentCollection.create(appointmentData2);

    // Query appointments
    const customerAppointments = await AppointmentCollection.find({
      customerPhone: phoneNumber
    });

    expect(customerAppointments).toHaveLength(2);
    expect(customerAppointments[0].customerPhone).toBe(phoneNumber);
    expect(customerAppointments[1].customerPhone).toBe(phoneNumber);
  });
});