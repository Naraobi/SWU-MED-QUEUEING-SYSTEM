// =====================================================
// LEGAL DOCUMENTS
// =====================================================
//
// The Privacy Policy and Terms & Conditions shown under
// Settings > Legal & Policies.
//
// The bodies stay in English on purpose. The rest of the
// Admin section is translated through i18n.js, but a legal
// document carries obligations that a machine translation
// can quietly change, so these need a reviewed translation
// from a person before they appear in Filipino or Cebuano.

export const LEGAL_ORGANIZATION = [
  'SWUMed Queuing System',
  'Southwestern University PHINMA Medical Center',
  'Cebu City, Philippines',
];

export const PRIVACY_POLICY = {
  id: 'privacy',
  title: 'Privacy Policy',
  lastUpdated: 'September 2026',

  intro:
    'The SWUMed Queuing System respects the privacy of patients, staff, and other users who use the system. This Privacy Policy explains what information may be collected, how it is used, how it is protected, and the rights of users regarding their personal information.',

  sections: [
    {
      heading: '1. Information We Collect',
      paragraphs: [
        'The SWUMed Queuing System may collect and process information necessary to provide and manage queuing services, including:',
      ],
      bullets: [
        'Queue number and queue type',
        'Selected hospital service or department',
        'Priority status, when applicable',
        'Date and time of queue registration',
        'Transaction or queue status',
        'Terminal and service information',
        'Information provided by authorized staff when required for queue management',
      ],
      callout:
        'The system only collects information that is necessary for its intended queuing and operational purposes.',
    },
    {
      heading: '2. How We Use Your Information',
      paragraphs: [
        'Information collected through the system may be used to:',
      ],
      bullets: [
        'Generate and manage queue numbers',
        'Organize patients according to their selected service and priority',
        'Display queue information on authorized screens',
        'Notify or assist patients regarding their queue status',
        'Help hospital staff manage daily queues and transactions',
        'Generate operational reports and statistics',
        'Monitor system performance and improve queuing services',
        'Maintain the security and proper operation of the system',
      ],
    },
    {
      heading: '3. Display of Queue Information',
      paragraphs: [
        'Queue information may be displayed on authorized patient-facing screens, such as queue displays and hospital TV screens.',
        'Only information necessary for identifying and managing the queue should be displayed. Sensitive personal information should not be publicly displayed through the queuing system.',
      ],
    },
    {
      heading: '4. Data Sharing and Access',
      paragraphs: [
        'Access to information is limited to authorized users based on their assigned roles.',
        'Different system roles may have different levels of access. Hospital administrators, terminals, and system administrators may only access information necessary for their responsibilities.',
        'Personal information will not be shared with unauthorized individuals or organizations unless required for legitimate operational, legal, or regulatory purposes.',
      ],
    },
    {
      heading: '5. Data Security',
      paragraphs: [
        'Reasonable security measures are implemented to protect information from unauthorized access, alteration, disclosure, loss, or misuse.',
        'Access to the system may be controlled through authentication, role-based permissions, and other appropriate security measures.',
        'However, no electronic system can guarantee complete security. Users are encouraged to keep their account credentials confidential and to log out after using the system.',
      ],
    },
    {
      heading: '6. Data Retention',
      paragraphs: [
        'Queue and transaction information may be retained for as long as necessary for legitimate hospital operations, reporting, auditing, system management, and other lawful purposes.',
        'Information that is no longer necessary may be deleted, archived, or securely disposed of according to applicable policies and requirements.',
      ],
    },
    {
      heading: '7. Patient Privacy',
      paragraphs: [
        'Patients are encouraged to avoid entering unnecessary personal or sensitive information into the queuing system.',
        "The queuing system is primarily intended for queue management and is not intended to replace the hospital's official patient records or other healthcare information systems.",
      ],
    },
    {
      heading: '8. User Rights',
      paragraphs: [
        'Subject to applicable laws and regulations, users may have rights regarding their personal information, including the right to:',
      ],
      bullets: [
        'Be informed about how their information is processed',
        'Request access to their personal information',
        'Request correction of inaccurate information',
        'Request deletion or restriction of information when applicable',
        'Raise concerns regarding the handling of their information',
      ],
      closing:
        'Requests may be subject to identity verification and applicable legal or institutional requirements.',
    },
    {
      heading: '9. Cookies and Technical Information',
      paragraphs: [
        'The system may use technical information, such as session data, device information, or system logs, when necessary to maintain security, authentication, and system functionality.',
        'These technologies are used to support the operation and security of the system and are not intended to collect unnecessary personal information.',
      ],
    },
    {
      heading: '10. Changes to This Privacy Policy',
      paragraphs: [
        'This Privacy Policy may be updated when necessary to reflect changes in the system, hospital procedures, security practices, or applicable requirements.',
        'Users will be informed of significant changes through appropriate channels.',
      ],
    },
    {
      heading: '11. Contact Us',
      paragraphs: [
        'If you have questions, concerns, or requests regarding this Privacy Policy or the handling of your information, please contact the appropriate SWUMed administration or authorized data privacy personnel.',
      ],
    },
  ],

  acknowledgement:
    'By using the SWUMed Queuing System, you acknowledge that you have read and understood this Privacy Policy and that your information may be processed as described above, subject to applicable laws, regulations, and institutional policies.',
};

export const TERMS_AND_CONDITIONS = {
  id: 'terms',
  title: 'Terms & Conditions',
  lastUpdated: 'September 2026',

  intro:
    'Welcome to the SWUMed Queue Management System. By accessing or using this system, you agree to follow these Terms & Conditions. Please read them carefully before using the system.',

  sections: [
    {
      heading: '1. Purpose of the System',
      paragraphs: [
        'The SWUMed Queue Management System is designed to help manage and monitor patient queues within participating SWUMed hospital departments. The system supports queue generation, queue monitoring, patient calling, transaction tracking, and administrative management.',
      ],
    },
    {
      heading: '2. Authorized Access',
      paragraphs: [
        'Access to the administrative and staff features of the system is restricted to authorized SWUMed personnel.',
        'Users are responsible for:',
      ],
      bullets: [
        'Using only the account assigned to them.',
        'Keeping their login credentials confidential.',
        'Not sharing their password or account with another person.',
        'Logging out when they are finished using the system.',
        'Immediately reporting suspected unauthorized access or account activity.',
      ],
    },
    {
      heading: '3. Proper Use of the System',
      paragraphs: [
        'Users must use the system only for authorized hospital and queue-management activities.',
        'Users must not:',
      ],
      bullets: [
        'Access information or features they are not authorized to use.',
        "Use another person's account.",
        'Attempt to bypass system security or access restrictions.',
        'Modify, delete, or manipulate queue records without authorization.',
        'Use the system for purposes unrelated to its intended function.',
        'Intentionally interfere with the operation or availability of the system.',
      ],
    },
    {
      heading: '4. Queue and Transaction Information',
      paragraphs: [
        'Queue numbers and transaction information generated by the system are used to support queue management and service operations.',
        'Users should ensure that information entered or managed through the system is accurate and appropriate for its intended purpose.',
      ],
    },
    {
      heading: '5. Personal Information',
      paragraphs: [
        'The system may process personal information necessary for account management and queue-related operations. Personal information should only be collected, accessed, and processed for legitimate and authorized purposes.',
        'The processing of personal information must follow applicable data privacy laws and organizational policies, including the Data Privacy Act of 2012 (Republic Act No. 10173) and its applicable rules and regulations. The National Privacy Commission identifies transparency, legitimate purpose, and proportionality as core principles for processing personal information.',
        'For more information about how personal information is handled, please refer to the Privacy Policy.',
      ],
    },
    {
      heading: '6. Account Security',
      paragraphs: [
        'Users are responsible for maintaining the security of their account credentials. The system may require users to change temporary passwords or reset passwords when necessary.',
        'If a user suspects that their account has been compromised, they should report the issue to the designated system administrator or authorized SWUMed personnel.',
      ],
    },
    {
      heading: '7. System Availability',
      paragraphs: [
        'The SWUMed Queue Management System is intended to support hospital queue operations. However, temporary interruptions may occur because of maintenance, technical problems, network issues, hardware problems, or other circumstances.',
        'Authorized personnel may perform maintenance or system updates when necessary.',
      ],
    },
    {
      heading: '8. Administrative Controls',
      paragraphs: [
        'Authorized administrators may manage system users, roles, positions, kiosks, departments, terminals, queues, and other system configurations according to their assigned permissions.',
        'Administrative actions should only be performed by authorized personnel and for legitimate operational purposes.',
      ],
    },
    {
      heading: '9. Changes to the System',
      paragraphs: [
        "SWUMed may update, modify, or improve the system's features and functionality when necessary to support hospital operations, security, or system requirements.",
        'Changes to these Terms & Conditions may also be made when necessary. The updated version will indicate the applicable Last Updated date.',
      ],
    },
    {
      heading: '10. Acceptance of These Terms',
      paragraphs: [
        'By accessing and using the SWUMed Queue Management System, you acknowledge that you have read and understood these Terms & Conditions and agree to comply with the applicable system rules, security requirements, and organizational policies.',
        'If you do not agree with these Terms & Conditions, do not use the system and contact the designated system administrator.',
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS = [
  PRIVACY_POLICY,
  TERMS_AND_CONDITIONS,
];
