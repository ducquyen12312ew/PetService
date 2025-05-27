// tests/schemas/pet.test.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

describe('Pet Schema/Collection Tests', () => {
  let mongoServer;
  let testConnection;
  let PetCollection;

  // Khởi tạo database test trước khi chạy tất cả tests
  beforeAll(async () => {
    // Tạo MongoMemoryServer
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Tạo connection riêng cho test
    testConnection = mongoose.createConnection(mongoUri);
    
    // Tạo Pet Schema cho test
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
    
    // Tạo model từ connection riêng
    PetCollection = testConnection.model('pets', PetSchema);
  });

  // Dọn dẹp sau khi chạy xong tất cả tests
  afterAll(async () => {
    if (testConnection) {
      await testConnection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  // Xóa dữ liệu trước mỗi test để đảm bảo clean state
  beforeEach(async () => {
    if (PetCollection) {
      await PetCollection.deleteMany({});
    }
  });

  // TEST 1: Tạo pet với dữ liệu hợp lệ
  test('should create a pet with valid data', async () => {
    // Arrange - Chuẩn bị dữ liệu
    const petData = {
      name: 'Buddy',
      type: 'dog',
      breed: 'Golden Retriever',
      age: 3,
      weight: 25.5,
      gender: 'male',
      ownerName: 'John Doe',
      ownerPhone: '0123456789',
      ownerEmail: 'john@example.com'
    };

    // Act - Thực hiện hành động
    const pet = await PetCollection.create(petData);

    // Assert - Kiểm tra kết quả
    expect(pet).toBeDefined();
    expect(pet.name).toBe('Buddy');
    expect(pet.type).toBe('dog');
    expect(pet.breed).toBe('Golden Retriever');
    expect(pet.age).toBe(3);
    expect(pet.weight).toBe(25.5);
    expect(pet.gender).toBe('male');
    expect(pet.ownerName).toBe('John Doe');
    expect(pet.ownerPhone).toBe('0123456789');
    expect(pet.ownerEmail).toBe('john@example.com');
    expect(pet.registeredAt).toBeDefined();
    expect(pet.registeredAt).toBeInstanceOf(Date);
  });

  // TEST 2: Kiểm tra validation field bắt buộc
  test('should require name field', async () => {
    const petDataWithoutName = {
      type: 'cat',
      ownerName: 'Jane Smith',
      ownerPhone: '0987654321'
    };

    await expect(PetCollection.create(petDataWithoutName))
      .rejects
      .toThrow();
  });

  test('should require type field', async () => {
    const petDataWithoutType = {
      name: 'Whiskers',
      ownerName: 'Alice Johnson',
      ownerPhone: '0111222333'
    };

    await expect(PetCollection.create(petDataWithoutType))
      .rejects
      .toThrow();
  });

  test('should require ownerName field', async () => {
    const petDataWithoutOwnerName = {
      name: 'Rex',
      type: 'dog',
      ownerPhone: '0444555666'
    };

    await expect(PetCollection.create(petDataWithoutOwnerName))
      .rejects
      .toThrow();
  });

  test('should require ownerPhone field', async () => {
    const petDataWithoutOwnerPhone = {
      name: 'Fluffy',
      type: 'cat',
      ownerName: 'Bob Wilson'
    };

    await expect(PetCollection.create(petDataWithoutOwnerPhone))
      .rejects
      .toThrow();
  });

  // TEST 3: Kiểm tra default values
  test('should set default gender to unknown', async () => {
    const petData = {
      name: 'Charlie',
      type: 'bird',
      ownerName: 'Sarah Connor',
      ownerPhone: '0777888999'
    };

    const pet = await PetCollection.create(petData);
    expect(pet.gender).toBe('unknown');
  });

  test('should set registeredAt to current date', async () => {
    const beforeCreate = new Date();
    
    const petData = {
      name: 'Luna',
      type: 'cat',
      ownerName: 'Mike Davis',
      ownerPhone: '0333444555'
    };

    const pet = await PetCollection.create(petData);
    const afterCreate = new Date();

    expect(pet.registeredAt).toBeInstanceOf(Date);
    expect(pet.registeredAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    expect(pet.registeredAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
  });

  // TEST 4: Logic không tạo duplicate pets
  test('should find existing pet with same name and owner phone', async () => {
    // Tạo pet đầu tiên
    const petData = {
      name: 'Max',
      type: 'dog',
      breed: 'Labrador',
      ownerName: 'Tom Hardy',
      ownerPhone: '0999888777'
    };

    const firstPet = await PetCollection.create(petData);
    expect(firstPet).toBeDefined();

    // Kiểm tra có thể tìm thấy pet với cùng tên và số điện thoại
    const existingPet = await PetCollection.findOne({
      name: petData.name,
      ownerPhone: petData.ownerPhone
    });

    expect(existingPet).toBeTruthy();
    expect(existingPet.name).toBe('Max');
    expect(existingPet.ownerPhone).toBe('0999888777');
    expect(existingPet._id.toString()).toBe(firstPet._id.toString());
  });

  test('should allow same pet name with different owner', async () => {
    // Tạo pet đầu tiên
    const pet1Data = {
      name: 'Bella',
      type: 'dog',
      ownerName: 'Owner One',
      ownerPhone: '0111111111'
    };

    // Tạo pet thứ hai với cùng tên nhưng chủ khác
    const pet2Data = {
      name: 'Bella',
      type: 'cat',
      ownerName: 'Owner Two',
      ownerPhone: '0222222222'
    };

    const pet1 = await PetCollection.create(pet1Data);
    const pet2 = await PetCollection.create(pet2Data);

    expect(pet1.name).toBe('Bella');
    expect(pet2.name).toBe('Bella');
    expect(pet1.ownerPhone).toBe('0111111111');
    expect(pet2.ownerPhone).toBe('0222222222');
    expect(pet1._id.toString()).not.toBe(pet2._id.toString());
  });

  // TEST 5: Kiểm tra validation enum values
  test('should validate gender enum values', async () => {
    const validGenders = ['male', 'female', 'unknown'];
    
    for (const gender of validGenders) {
      const petData = {
        name: `Pet_${gender}`,
        type: 'dog',
        gender: gender,
        ownerName: 'Test Owner',
        ownerPhone: `012345678${gender.length}`
      };

      const pet = await PetCollection.create(petData);
      expect(pet.gender).toBe(gender);
      
      // Clean up for next iteration
      await PetCollection.findByIdAndDelete(pet._id);
    }
  });

  test('should reject invalid gender values', async () => {
    const petDataWithInvalidGender = {
      name: 'InvalidGenderPet',
      type: 'cat',
      gender: 'invalid_gender',
      ownerName: 'Test Owner',
      ownerPhone: '0123456789'
    };

    await expect(PetCollection.create(petDataWithInvalidGender))
      .rejects
      .toThrow();
  });

  // TEST 6: Kiểm tra optional fields
  test('should allow creation without optional fields', async () => {
    const minimalPetData = {
      name: 'Minimal',
      type: 'rabbit',
      ownerName: 'Minimal Owner',
      ownerPhone: '0999999999'
    };

    const pet = await PetCollection.create(minimalPetData);
    
    expect(pet.name).toBe('Minimal');
    expect(pet.type).toBe('rabbit');
    expect(pet.breed).toBeUndefined();
    expect(pet.age).toBeUndefined();
    expect(pet.weight).toBeUndefined();
    expect(pet.ownerEmail).toBeUndefined();
  });

  // TEST 7: Kiểm tra data types
  test('should validate number fields', async () => {
    const petData = {
      name: 'NumberTest',
      type: 'dog',
      age: 5,
      weight: 20.5,
      ownerName: 'Number Owner',
      ownerPhone: '0888888888'
    };

    const pet = await PetCollection.create(petData);
    
    expect(typeof pet.age).toBe('number');
    expect(typeof pet.weight).toBe('number');
    expect(pet.age).toBe(5);
    expect(pet.weight).toBe(20.5);
  });

  // TEST 8: Kiểm tra update functionality
  test('should update pet information', async () => {
    // Tạo pet
    const petData = {
      name: 'UpdateTest',
      type: 'cat',
      age: 2,
      ownerName: 'Update Owner',
      ownerPhone: '0777777777'
    };

    const pet = await PetCollection.create(petData);
    const originalId = pet._id;

    // Update pet
    const updatedPet = await PetCollection.findByIdAndUpdate(
      originalId,
      { age: 3, weight: 4.5 },
      { new: true }
    );

    expect(updatedPet._id.toString()).toBe(originalId.toString());
    expect(updatedPet.age).toBe(3);
    expect(updatedPet.weight).toBe(4.5);
    expect(updatedPet.name).toBe('UpdateTest'); // unchanged
  });
});