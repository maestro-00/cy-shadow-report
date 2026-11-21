import { jest } from '@jest/globals';

const getTitles = jest.fn();
jest.unstable_mockModule('../google/sheetDataMethods/getSheetInfo.js', () => ({
  getExistingTabTitlesInRange: getTitles,
}));
jest.unstable_mockModule('./dateFormatting.js', () => ({
  getTodaysFormattedDate: () => 'Mar 20, 2024',
}));

const { doesTodaysReportExist } = await import('./dailyReportRequired.js');

describe('doesTodaysReportExist', () => {
  it.each([
    [['Mar 20, 2024'], true],
    [['Mar 19, 2024'], false],
    [[], false],
  ])('checks titles %j', async (titles, expected) => {
    getTitles.mockResolvedValueOnce(titles);
    await expect(doesTodaysReportExist()).resolves.toBe(expected);
  });

  it('preserves a lookup failure as the cause', async () => {
    const cause = new Error('Sheets API failed');
    getTitles.mockRejectedValueOnce(cause);

    await expect(doesTodaysReportExist()).rejects.toMatchObject({
      message: 'Failed to check whether today\'s report exists.',
      cause,
    });
  });
});
