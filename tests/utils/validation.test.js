// tests/utils/validation.test.js
describe('Validation Utilities Tests', () => {
  
    // Helper functions để test (thường sẽ ở utils/validation.js)
    const isValidPhone = (phone) => {
      if (!phone) return false;
      const phoneRegex = /^[0-9]{10,11}$/;
      return phoneRegex.test(phone);
    };
  
    const isValidEmail = (email) => {
      if (!email) return false;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };
  
    const isValidTimeSlot = (time) => {
      const validTimeSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
      return validTimeSlots.includes(time);
    };
  
    const isValidService = (service) => {
      const validServices = ['khám sức khỏe', 'tắm', 'cắt tỉa lông', 'lưu trú'];
      return validServices.includes(service);
    };
  
    const isValidPetType = (petType) => {
      const validPetTypes = ['dog', 'cat', 'bird', 'rabbit', 'other'];
      return validPetTypes.includes(petType);
    };
  
    const isValidAppointmentStatus = (status) => {
      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
      return validStatuses.includes(status);
    };
  
    const isValidDate = (date) => {
      if (!date) return false;
      const appointmentDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return appointmentDate >= today;
    };
  
    const sanitizeInput = (input) => {
      if (typeof input !== 'string') return input;
      return input.trim().replace(/[<>]/g, '');
    };
  
    const isValidAge = (age) => {
      return age >= 0 && age <= 30; // Reasonable age range for pets
    };
  
    const isValidWeight = (weight) => {
      return weight > 0 && weight <= 200; // Reasonable weight range for pets in kg
    };
  
    // TEST 1: Phone Number Validation
    describe('Phone Number Validation', () => {
      test('should accept valid 10-digit phone numbers', () => {
        const validPhones = [
          '0123456789',
          '0987654321',
          '0555666777',
          '0999888777'
        ];
  
        validPhones.forEach(phone => {
          expect(isValidPhone(phone)).toBe(true);
        });
      });
  
      test('should accept valid 11-digit phone numbers', () => {
        const validPhones = [
          '01234567890',
          '09876543210'
        ];
  
        validPhones.forEach(phone => {
          expect(isValidPhone(phone)).toBe(true);
        });
      });
  
      test('should reject invalid phone numbers', () => {
        const invalidPhones = [
          '123456789',     // too short
          '012345678901',  // too long
          'abc1234567',    // contains letters
          '012-345-6789',  // contains dashes
          '+84123456789',  // contains plus sign
          '',              // empty string
          null,            // null
          undefined        // undefined
        ];
  
        invalidPhones.forEach(phone => {
          expect(isValidPhone(phone)).toBe(false);
        });
      });
    });
  
    // TEST 2: Email Validation
    describe('Email Validation', () => {
      test('should accept valid email formats', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'admin@petcare.vn',
          'customer123@gmail.com',
          'vet.doctor@hospital.org'
        ];
  
        validEmails.forEach(email => {
          expect(isValidEmail(email)).toBe(true);
        });
      });
  
      test('should reject invalid email formats', () => {
        const invalidEmails = [
          'invalid.email',      // no @ symbol
          '@example.com',       // no username
          'user@',              // no domain
          'user@domain',        // no TLD
          'user name@domain.com', // space in username
          'user@domain .com',   // space in domain
          '',                   // empty string
          null,                 // null
          undefined             // undefined
        ];
  
        invalidEmails.forEach(email => {
          expect(isValidEmail(email)).toBe(false);
        });
      });
    });
  
    // TEST 3: Time Slot Validation
    describe('Time Slot Validation', () => {
      test('should accept valid appointment time slots', () => {
        const validTimes = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
        
        validTimes.forEach(time => {
          expect(isValidTimeSlot(time)).toBe(true);
        });
      });
  
      test('should reject invalid time slots', () => {
        const invalidTimes = [
          '08:00',  // too early
          '12:00',  // lunch break
          '13:00',  // lunch break
          '18:00',  // too late
          '19:00',  // after hours
          '9:00',   // wrong format
          '14:30',  // not available slot
          '',       // empty string
          null,     // null
          undefined // undefined
        ];
  
        invalidTimes.forEach(time => {
          expect(isValidTimeSlot(time)).toBe(false);
        });
      });
    });
  
    // TEST 4: Service Type Validation
    describe('Service Type Validation', () => {
      test('should accept valid service types', () => {
        const validServices = ['khám sức khỏe', 'tắm', 'cắt tỉa lông', 'lưu trú'];
        
        validServices.forEach(service => {
          expect(isValidService(service)).toBe(true);
        });
      });
  
      test('should reject invalid service types', () => {
        const invalidServices = [
          'checkup',        // English version
          'bath',           // English version
          'grooming',       // English version
          'boarding',       // English version
          'vaccination',    // not offered
          'surgery',        // not offered
          '',               // empty string
          null,             // null
          undefined         // undefined
        ];
  
        invalidServices.forEach(service => {
          expect(isValidService(service)).toBe(false);
        });
      });
    });
  
    // TEST 5: Pet Type Validation
    describe('Pet Type Validation', () => {
      test('should accept valid pet types', () => {
        const validTypes = ['dog', 'cat', 'bird', 'rabbit', 'other'];
        
        validTypes.forEach(type => {
          expect(isValidPetType(type)).toBe(true);
        });
      });
  
      test('should reject invalid pet types', () => {
        const invalidTypes = [
          'chó',           // Vietnamese
          'mèo',           // Vietnamese
          'fish',          // not supported
          'snake',         // not supported
          '',              // empty string
          null,            // null
          undefined        // undefined
        ];
  
        invalidTypes.forEach(type => {
          expect(isValidPetType(type)).toBe(false);
        });
      });
    });
  
    // TEST 6: Appointment Status Validation
    describe('Appointment Status Validation', () => {
      test('should accept valid appointment statuses', () => {
        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        
        validStatuses.forEach(status => {
          expect(isValidAppointmentStatus(status)).toBe(true);
        });
      });
  
      test('should reject invalid appointment statuses', () => {
        const invalidStatuses = [
          'active',         // not used
          'inactive',       // not used
          'processing',     // not used
          'rejected',       // not used
          '',               // empty string
          null,             // null
          undefined         // undefined
        ];
  
        invalidStatuses.forEach(status => {
          expect(isValidAppointmentStatus(status)).toBe(false);
        });
      });
    });
  
    // TEST 7: Date Validation
    describe('Date Validation', () => {
      test('should accept future dates', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
  
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
  
        expect(isValidDate(tomorrow)).toBe(true);
        expect(isValidDate(nextWeek)).toBe(true);
        expect(isValidDate(nextMonth)).toBe(true);
      });
  
      test('should accept today as valid date', () => {
        const today = new Date();
        expect(isValidDate(today)).toBe(true);
      });
  
      test('should reject past dates', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
  
        expect(isValidDate(yesterday)).toBe(false);
        expect(isValidDate(lastWeek)).toBe(false);
      });
  
      test('should reject invalid date inputs', () => {
        expect(isValidDate('')).toBe(false);
        expect(isValidDate(null)).toBe(false);
        expect(isValidDate(undefined)).toBe(false);
        expect(isValidDate('invalid-date')).toBe(false);
      });
    });
  
    // TEST 8: Input Sanitization
    describe('Input Sanitization', () => {
      test('should trim whitespace from strings', () => {
        expect(sanitizeInput('  hello  ')).toBe('hello');
        expect(sanitizeInput(' John Doe ')).toBe('John Doe');
        expect(sanitizeInput('\ttest\n')).toBe('test');
      });
  
      test('should remove dangerous HTML characters', () => {
        expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
        expect(sanitizeInput('Hello <b>world</b>')).toBe('Hello bworld/b');
        expect(sanitizeInput('Test > 5 < 10')).toBe('Test  5  10');
      });
  
      test('should handle non-string inputs', () => {
        expect(sanitizeInput(123)).toBe(123);
        expect(sanitizeInput(null)).toBe(null);
        expect(sanitizeInput(undefined)).toBe(undefined);
        expect(sanitizeInput({})).toEqual({});
      });
    });
  
    // TEST 9: Pet Age Validation
    describe('Pet Age Validation', () => {
      test('should accept valid pet ages', () => {
        const validAges = [0, 1, 5, 10, 15, 20, 25, 30];
        
        validAges.forEach(age => {
          expect(isValidAge(age)).toBe(true);
        });
      });
  
      test('should reject invalid pet ages', () => {
        const invalidAges = [-1, -5, 31, 50, 100];
        
        invalidAges.forEach(age => {
          expect(isValidAge(age)).toBe(false);
        });
      });
    });
  
    // TEST 10: Pet Weight Validation
    describe('Pet Weight Validation', () => {
      test('should accept valid pet weights', () => {
        const validWeights = [0.5, 1, 5, 10, 25, 50, 100, 150, 200];
        
        validWeights.forEach(weight => {
          expect(isValidWeight(weight)).toBe(true);
        });
      });
  
      test('should reject invalid pet weights', () => {
        const invalidWeights = [0, -1, -5, 201, 500, 1000];
        
        invalidWeights.forEach(weight => {
          expect(isValidWeight(weight)).toBe(false);
        });
      });
    });
  
    // TEST 11: Combined Validation Tests
    describe('Combined Validation Scenarios', () => {
      test('should validate complete appointment data', () => {
        const validAppointmentData = {
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          customerPhone: '0123456789',
          petName: 'Buddy',
          petType: 'dog',
          service: 'khám sức khỏe',
          date: new Date('2025-12-01'),
          time: '10:00'
        };
  
        expect(isValidEmail(validAppointmentData.customerEmail)).toBe(true);
        expect(isValidPhone(validAppointmentData.customerPhone)).toBe(true);
        expect(isValidPetType(validAppointmentData.petType)).toBe(true);
        expect(isValidService(validAppointmentData.service)).toBe(true);
        expect(isValidDate(validAppointmentData.date)).toBe(true);
        expect(isValidTimeSlot(validAppointmentData.time)).toBe(true);
      });
  
      test('should validate complete pet data', () => {
        const validPetData = {
          name: 'Fluffy',
          type: 'cat',
          age: 3,
          weight: 4.5,
          ownerName: 'Jane Smith',
          ownerPhone: '0987654321',
          ownerEmail: 'jane@example.com'
        };
  
        expect(isValidPetType(validPetData.type)).toBe(true);
        expect(isValidAge(validPetData.age)).toBe(true);
        expect(isValidWeight(validPetData.weight)).toBe(true);
        expect(isValidPhone(validPetData.ownerPhone)).toBe(true);
        expect(isValidEmail(validPetData.ownerEmail)).toBe(true);
      });
    });
  });