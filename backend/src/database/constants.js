module.exports = {
  USER_TYPES: ['student', 'faculty', 'non_teaching'],
  ROLES: ['user', 'staff', 'admin'],
  STATUSES: ['pending', 'approved', 'rejected', 'deactivated'],

  COLLEGES: [
    'College of Arts and Sciences', 'College of Business', 'College of Education',
    'College of Nursing', 'College of Law', 'College of Technologies',
    'College of Public Administration and Governance', 'Other',
  ],
  OFFICES: [
    'Office of the University President', 'Office of the Vice President for Academic Affairs',
    'Office of the Vice President for Administration', 'Office of Student Services',
    'University Registrar', 'University Library', 'Human Resource Management Office',
    'Information and Communication Technology Office', 'Accounting Office',
    'Supply and Property Management Office', 'Other',
  ],
  ORG_POSITIONS: [
    'President', 'Vice President', 'Secretary', 'Treasurer',
    'Auditor', 'Representative', 'Member', 'Other',
  ],

  DOMAIN: { student: '@student.buksu.edu.ph', institutional: '@buksu.edu.ph' },

  // 8-72 chars, with uppercase, lowercase and a number (72 = bcrypt's limit)
  PASSWORD_RE: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/,
  PASSWORD_MSG: 'Password must be 8-72 characters with an uppercase letter, a lowercase letter, and a number.',
  PHONE_RE: /^(09\d{9}|\+639\d{9})$/, // 09XXXXXXXXX or +639XXXXXXXXX
};