export const APP_NAME = 'Paper Dispatch';
export const APP_VERSION = '2.1';
export const APP_RELEASE_DATE = '13 November 2026';
export const DEVELOPER = 'Parth D. Joshi';

/** Date shown on the legal pages. Update whenever their content changes. */
export const LEGAL_LAST_UPDATED = '28 October 2026';

export interface Release {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const RELEASES: Release[] = [
  {
    version: '2.1',
    date: 'November 2026',
    title: 'Practical examiner duty allocation',
    changes: [
      'Import college data from the Google Form and the practical timetable; college codes are matched automatically',
      'Automatic duty allocation: seniors first, only faculty who teach the practical, never two duties on one day',
      'Duty letters in the Gujarat University format, with the chairperson and coordinators entered once',
      'Send letters to college admins one by one, by college or all together; PDFs are made on the spot and never stored',
      'Cancel a duty for one day or all days: letters update by themselves and every cancellation is kept on record',
      'Cancellation record and letter download log, downloadable as Excel or PDF',
      'Chairperson chooses which colleges see the examiners coming to them',
      'My Duties page for college admins: their faculty\'s duties and letters in one place',
    ],
  },
  {
    version: '2.0',
    date: 'October 2026',
    title: 'Secure storage, bulk tools and a new design',
    changes: [
      'Question papers are uploaded as PDFs to private storage instead of shared Google Drive links',
      'Paper files are deleted automatically 7 days after their last exam',
      'Downloads are locked to the exam window and enforced on the server',
      'University-managed accounts: no emails, temporary passwords, forced password change on first login',
      'Bulk CSV import for colleges, batches, college admins and allocations, and multi-file PDF upload',
      'Bulk publish, unpublish and delete for allocations; download log export to CSV',
      'Security fix: college admins can no longer change their own assigned college',
      'Completely redesigned interface, mobile tab bar and smooth animations',
    ],
  },
  {
    version: '1.0',
    date: 'November 2025',
    title: 'First release',
    changes: [
      'Colleges, batches and college admin management',
      'Exam papers shared as Google Drive links',
      'Paper allocation to multiple colleges with exam date and time',
      'Download logging for the university',
    ],
  },
];
