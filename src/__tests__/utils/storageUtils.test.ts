import * as storageUtils from '../../utils/storageUtils';

describe('storageUtils', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('getLocalStorageSize', () => {
    it('should return 0 when localStorage is empty', () => {
      // Mock empty localStorage
      Object.defineProperty(global, 'localStorage', {
        value: {
          length: 0,
          key: jest.fn(),
          getItem: jest.fn(() => null),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
          hasOwnProperty: jest.fn(() => false)
        },
        configurable: true,
        writable: true
      });
      
      const size = storageUtils.getLocalStorageSize();
      expect(size).toBe(0);
    });
  });

  describe('getLocalStorageSizeForKey', () => {
    it('should return 0 for non-existent key', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);
      
      const size = storageUtils.getLocalStorageSizeForKey('nonExistent');
      expect(size).toBe(0);
    });

    it('should calculate correct size for existing key', () => {
      const testKey = 'testKey';
      const testValue = 'testValue';
      
      (localStorage.getItem as jest.Mock).mockReturnValue(testValue);
      
      const size = storageUtils.getLocalStorageSizeForKey(testKey);
      // testKey (7) + testValue (9) = 16 * 2 = 32 bytes
      expect(size).toBe(32);
    });
  });

  describe('getLocalStorageUsagePercent', () => {
    it('should return 0 when localStorage is empty', () => {
      // Mock getLocalStorageSize to return 0
      jest.spyOn(storageUtils, 'getLocalStorageSize').mockReturnValue(0);
      
      const percent = storageUtils.getLocalStorageUsagePercent();
      expect(percent).toBe(0);
    });

    it('should calculate correct percentage', () => {
      // Mock getLocalStorageSize to return 1MB
      const oneMB = 1 * 1024 * 1024;
      jest.spyOn(storageUtils, 'getLocalStorageSize').mockReturnValue(oneMB);
      
      const percent = storageUtils.getLocalStorageUsagePercent();
      // 1MB / 10MB * 100 = 10%
      expect(percent).toBe(10);
    });
  });

  describe('isLocalStorageNearLimit', () => {
    it('should return false when usage is below threshold', () => {
      jest.spyOn(storageUtils, 'getLocalStorageUsagePercent').mockReturnValue(50);
      
      const nearLimit = storageUtils.isLocalStorageNearLimit();
      expect(nearLimit).toBe(false);
    });

    it('should return true when usage is above threshold', () => {
      jest.spyOn(storageUtils, 'getLocalStorageUsagePercent').mockReturnValue(86);
      
      const nearLimit = storageUtils.isLocalStorageNearLimit();
      expect(nearLimit).toBe(true);
    });
  });

  describe('formatStorageSize', () => {
    it('should format bytes correctly', () => {
      expect(storageUtils.formatStorageSize(100)).toBe('100 bytes');
      expect(storageUtils.formatStorageSize(500)).toBe('500 bytes');
    });

    it('should format KB correctly', () => {
      expect(storageUtils.formatStorageSize(1024)).toBe('1.00 KB');
      expect(storageUtils.formatStorageSize(2048)).toBe('2.00 KB');
      expect(storageUtils.formatStorageSize(1536)).toBe('1.50 KB');
    });

    it('should format MB correctly', () => {
      expect(storageUtils.formatStorageSize(1024 * 1024)).toBe('1.00 MB');
      expect(storageUtils.formatStorageSize(2 * 1024 * 1024)).toBe('2.00 MB');
      expect(storageUtils.formatStorageSize(1.5 * 1024 * 1024)).toBe('1.50 MB');
    });
  });
});
