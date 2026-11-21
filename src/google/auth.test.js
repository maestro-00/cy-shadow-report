import { jest } from '@jest/globals';

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: () => true,
  },
}));

afterAll(async () => {
  jest.unstable_unmockModule('fs');
  jest.resetModules();
});

// Mock the googleapis module
jest.unstable_mockModule('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn(() => ({
        getClient: jest.fn().mockResolvedValue({ id: 'dummy-client' }),
      })),
    },
    sheets: jest.fn(() => ({
      spreadsheets: {
        values: {
          get: jest.fn(),
        },
      },
    })),
  },
}));

// Mock the constants module
jest.unstable_mockModule('../../constants.js', () => ({
  GOOGLE_SHEET_ID: jest.fn(() => 'dummy-spreadsheet-id'),
  GOOGLE_KEYFILE_PATH: jest.fn(() => 'dummy-key-file-path'),
}));

describe('Google Sheets Authentication', () => {
  let mockConsoleError;

  beforeEach(() => {
    // Mock console.error
    mockConsoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Reset modules before each test
    jest.resetModules();
  });

  afterEach(() => {
    mockConsoleError.mockRestore();
  });

  describe('Initialization', () => {
    test('should initialize Google Sheets API client successfully', async () => {
      // Mock the modules
      await jest.unstable_mockModule('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn(() => ({
              getClient: jest.fn().mockResolvedValue({ id: 'dummy-client' }),
            })),
          },
          sheets: jest.fn(() => ({
            spreadsheets: {
              values: {
                get: jest.fn(),
              },
            },
          })),
        },
      }));

      await jest.unstable_mockModule('../../constants.js', () => ({
        GOOGLE_SHEET_ID: jest.fn(() => 'dummy-spreadsheet-id'),
        GOOGLE_KEYFILE_PATH: jest.fn(() => 'dummy-key-file-path'),
      }));

      // Import the module
      const { auth, sheets, spreadsheetId, getAuthContext } =
        await import('./auth.js');

      expect(auth).toBeDefined();
      expect(sheets).toBeDefined();
      expect(spreadsheetId).toBe('dummy-spreadsheet-id');
      expect(getAuthContext()).toEqual({ auth, sheets, spreadsheetId });
    });

    test('should handle missing key file path', async () => {
      // Mock the modules
      await jest.unstable_mockModule('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn(() => ({
              getClient: jest.fn().mockResolvedValue({ id: 'dummy-client' }),
            })),
          },
          sheets: jest.fn(() => ({
            spreadsheets: {
              values: {
                get: jest.fn(),
              },
            },
          })),
        },
      }));

      await jest.unstable_mockModule('../../constants.js', () => ({
        GOOGLE_SHEET_ID: jest.fn(() => 'dummy-spreadsheet-id'),
        GOOGLE_KEYFILE_PATH: jest.fn(() => ''),
      }));

      // Import the module
      const { auth, sheets, spreadsheetId } = await import('./auth.js');

      expect(auth).toBeUndefined();
      expect(sheets).toBeUndefined();
      expect(spreadsheetId).toBeUndefined();
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    test('should handle missing spreadsheet ID', async () => {
      // Mock the modules
      await jest.unstable_mockModule('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn(() => ({
              getClient: jest.fn().mockResolvedValue({ id: 'dummy-client' }),
            })),
          },
          sheets: jest.fn(() => ({
            spreadsheets: {
              values: {
                get: jest.fn(),
              },
            },
          })),
        },
      }));

      await jest.unstable_mockModule('../../constants.js', () => ({
        GOOGLE_SHEET_ID: jest.fn(() => ''),
        GOOGLE_KEYFILE_PATH: jest.fn(() => 'dummy-key-file-path'),
      }));

      // Import the module
      const { auth, sheets, spreadsheetId } = await import('./auth.js');

      expect(auth).toBeDefined();
      expect(sheets).toBeDefined();
      expect(spreadsheetId).toBe('');
    });
  });

  describe('Error Handling', () => {
    test('skips Google authentication for CSV output', async () => {
      const GoogleAuth = jest.fn(() => { throw new Error('Invalid key'); });
      jest.unstable_mockModule('googleapis', () => ({
        google: { auth: { GoogleAuth }, sheets: jest.fn() },
      }));
      const originalArgv = process.argv;
      process.argv = [...originalArgv, '--csv'];
      try {
        const { getAuthContext } = await import('./auth.js');
        expect(getAuthContext().initializationError).toBeUndefined();
        expect(GoogleAuth).not.toHaveBeenCalled();
        expect(mockConsoleError).not.toHaveBeenCalled();
      } finally {
        process.argv = originalArgv;
      }
    });

    test('should handle Google API client initialization failure', async () => {
      // Mock the modules
      await jest.unstable_mockModule('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn(() => ({
              getClient: jest
                .fn()
                .mockRejectedValue(new Error('API Client Error')),
            })),
          },
          sheets: jest.fn(),
        },
      }));

      await jest.unstable_mockModule('../../constants.js', () => ({
        GOOGLE_SHEET_ID: jest.fn(() => 'dummy-spreadsheet-id'),
        GOOGLE_KEYFILE_PATH: jest.fn(() => 'dummy-key-file-path'),
      }));

      // Import the module
      const { auth, sheets, spreadsheetId, getAuthContext } = await import('./auth.js');

      expect(auth).toBeUndefined();
      expect(sheets).toBeUndefined();
      expect(spreadsheetId).toBeUndefined();
      const { initializationError } = getAuthContext();
      expect(initializationError).toBeInstanceOf(Error);
      const { batchUpdateMasterSheet } = await import('./googleSheetIntegration/writeToSheet.js');
      await expect(batchUpdateMasterSheet({ requests: [] })).rejects.toMatchObject({
        code: 'GOOGLE_SHEETS_NOT_CONFIGURED',
        cause: initializationError,
      });
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    test('should handle GoogleAuth initialization failure', async () => {
      // Mock the modules
      await jest.unstable_mockModule('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn(() => {
              throw new Error('Initialization Error');
            }),
          },
          sheets: jest.fn(),
        },
      }));

      await jest.unstable_mockModule('../../constants.js', () => ({
        GOOGLE_SHEET_ID: jest.fn(() => 'dummy-spreadsheet-id'),
        GOOGLE_KEYFILE_PATH: jest.fn(() => 'dummy-key-file-path'),
      }));

      // Import the module
      const { auth, sheets, spreadsheetId, getAuthContext } = await import('./auth.js');

      expect(auth).toBeUndefined();
      expect(sheets).toBeUndefined();
      expect(spreadsheetId).toBeUndefined();
      const { initializationError } = getAuthContext();
      expect(initializationError).toBeInstanceOf(Error);
      const { batchUpdateMasterSheet } = await import('./googleSheetIntegration/writeToSheet.js');
      await expect(batchUpdateMasterSheet({ requests: [] })).rejects.toMatchObject({
        code: 'GOOGLE_SHEETS_NOT_CONFIGURED',
        cause: initializationError,
      });
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    test('should handle sheets API initialization failure', async () => {
      // Mock the modules
      await jest.unstable_mockModule('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn(() => ({
              getClient: jest.fn().mockResolvedValue({ id: 'dummy-client' }),
            })),
          },
          sheets: jest.fn(() => {
            throw new Error('Sheets API Error');
          }),
        },
      }));

      await jest.unstable_mockModule('../../constants.js', () => ({
        GOOGLE_SHEET_ID: jest.fn(() => 'dummy-spreadsheet-id'),
        GOOGLE_KEYFILE_PATH: jest.fn(() => 'dummy-key-file-path'),
      }));

      // Import the module
      const { auth, sheets, spreadsheetId, getAuthContext } = await import('./auth.js');

      expect(auth).toBeUndefined();
      expect(sheets).toBeUndefined();
      expect(spreadsheetId).toBeUndefined();
      const { initializationError } = getAuthContext();
      expect(initializationError).toBeInstanceOf(Error);
      const { batchUpdateMasterSheet } = await import('./googleSheetIntegration/writeToSheet.js');
      await expect(batchUpdateMasterSheet({ requests: [] })).rejects.toMatchObject({
        code: 'GOOGLE_SHEETS_NOT_CONFIGURED',
        cause: initializationError,
      });
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    test('should initialize within acceptable time', async () => {
      // Mock the modules
      await jest.unstable_mockModule('googleapis', () => ({
        google: {
          auth: {
            GoogleAuth: jest.fn(() => ({
              getClient: jest.fn().mockResolvedValue({ id: 'dummy-client' }),
            })),
          },
          sheets: jest.fn(() => ({
            spreadsheets: {
              values: {
                get: jest.fn(),
              },
            },
          })),
        },
      }));

      await jest.unstable_mockModule('../../constants.js', () => ({
        GOOGLE_SHEET_ID: jest.fn(() => 'dummy-spreadsheet-id'),
        GOOGLE_KEYFILE_PATH: jest.fn(() => 'dummy-key-file-path'),
      }));

      const startTime = performance.now();
      await import('./auth.js');
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });
  });
});
