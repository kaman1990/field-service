import { assetService } from '../assets';
import { getInitializedPowerSync } from '../../lib/powersync';

// Mock dependencies
jest.mock('../../lib/powersync');
jest.mock('../retoolUser', () => ({
  retoolUserService: {
    getDefaultSiteId: jest.fn().mockResolvedValue(null),
  },
}));

describe('assetService', () => {
  const mockPowerSync = {
    getAll: jest.fn(),
    getOptional: jest.fn(),
    get: jest.fn(),
    execute: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getInitializedPowerSync as jest.Mock).mockResolvedValue(mockPowerSync);
  });

  describe('getAssets', () => {
    it('returns assets from PowerSync', async () => {
      const mockAssets = [
        { id: '1', name: 'Asset 1', enabled: true },
        { id: '2', name: 'Asset 2', enabled: true },
      ];
      mockPowerSync.getAll.mockResolvedValue(mockAssets);

      const result = await assetService.getAssets();

      expect(result).toEqual(mockAssets);
      expect(mockPowerSync.getAll).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM assets WHERE enabled = ?'),
        [true]
      );
    });

    it('applies search filter when provided', async () => {
      mockPowerSync.getAll.mockResolvedValue([]);

      await assetService.getAssets({ search: 'test' });

      expect(mockPowerSync.getAll).toHaveBeenCalledWith(
        expect.stringContaining('name LIKE ?'),
        expect.arrayContaining([expect.stringContaining('%test%')])
      );
    });
  });

  describe('getAssetById', () => {
    it('returns asset by id', async () => {
      const mockAsset = { id: '1', name: 'Asset 1' };
      mockPowerSync.getOptional.mockResolvedValue(mockAsset);

      const result = await assetService.getAssetById('1');

      expect(result).toEqual(mockAsset);
      expect(mockPowerSync.getOptional).toHaveBeenCalledWith(
        'SELECT * FROM assets WHERE id = ?',
        ['1']
      );
    });

    it('returns null when asset not found', async () => {
      mockPowerSync.getOptional.mockResolvedValue(null);

      const result = await assetService.getAssetById('999');

      expect(result).toBeNull();
    });
  });
});

