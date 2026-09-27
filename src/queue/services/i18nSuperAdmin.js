/*
 * SUPERADMIN TRANSLATIONS
 * =======================
 *
 * Keys for the SuperAdmin section, the patient kiosk and the TV display.
 *
 * WHY THIS IS A SEPARATE FILE FROM pages/Admin/i18n.js
 * ----------------------------------------------------
 * That file belongs to the Admin section and is edited by whoever works on
 * it. Adding several hundred SuperAdmin keys into it would put two people
 * in the same file every week, which is how the merge conflicts happen.
 * services/language.js reads BOTH: it looks here first, then falls back to
 * the Admin dictionary, then to English, then to the key itself. So nothing
 * here overrides or breaks anything there.
 *
 * KEY NAMING
 * ----------
 * Prefixed `sa.` so a key here can never collide with an Admin key.
 *
 *   sa.common.*     shared across several pages
 *   sa.nav.*        sidebar
 *   sa.dashboard.*  System Overview
 *   ...one namespace per page
 *
 * ON THE TRANSLATIONS
 * -------------------
 * Filipino and Cebuano here are a careful first pass, not a native-speaker
 * review. Wording for anything a patient sees — the kiosk and the TV — should
 * be checked by a Cebuano speaker before this is shown to real patients.
 * Technical terms in common use (Kiosk, Terminal, Dashboard, Email, PIN) are
 * deliberately left as-is, because that is how staff actually say them.
 */

/* =========================================================
   ENGLISH
========================================================= */

const en = {
  // ---- shared ----
  'sa.common.cancel': 'Cancel',
  'sa.common.save': 'Save',
  'sa.common.saving': 'Saving...',
  'sa.common.saveChanges': 'Save Changes',
  'sa.common.delete': 'Delete',
  'sa.common.deleting': 'Deleting...',
  'sa.common.close': 'Close',
  'sa.common.edit': 'Edit',
  'sa.common.add': 'Add',
  'sa.common.search': 'Search',
  'sa.common.loading': 'Loading...',
  'sa.common.refresh': 'Refresh',
  'sa.common.reset': 'Reset',
  'sa.common.applyFilter': 'Apply Filter',
  'sa.common.confirm': 'Confirm',
  'sa.common.continue': 'Continue',
  'sa.common.done': 'Done',
  'sa.common.back': 'Back',
  'sa.common.next': 'Next',
  'sa.common.previous': 'Previous',
  'sa.common.status': 'Status',
  'sa.common.active': 'Active',
  'sa.common.inactive': 'Inactive',
  'sa.common.department': 'Department',
  'sa.common.departments': 'Departments',
  'sa.common.kiosk': 'Kiosk',
  'sa.common.terminal': 'Terminal',
  'sa.common.prefix': 'Prefix',
  'sa.common.requiredNote': 'Fields marked * are required.',
  'sa.common.noResults': 'No results found.',

  // ---- date range picker ----
  'sa.date.today': 'Today',
  'sa.date.yesterday': 'Yesterday',
  'sa.date.lastWeek': 'Last week',
  'sa.date.lastMonth': 'Last month',
  'sa.date.lastQuarter': 'Last quarter',
  'sa.date.previousMonth': 'Previous month',
  'sa.date.nextMonth': 'Next month',

  // ---- sidebar ----
  'sa.nav.dashboard': 'Dashboard',
  'sa.nav.users': 'User Management',
  'sa.nav.departments': 'Department Management',
  'sa.nav.kiosks': 'Kiosk Management',
  'sa.nav.roles': 'Role Management',
  'sa.nav.positions': 'Position Management',
  'sa.nav.queues': 'Queue Management',
  'sa.nav.reports': 'Reports & Analytics',
  'sa.nav.settings': 'Settings',
  'sa.nav.logout': 'Logout',
  'sa.nav.queuingSystem': 'Queuing System',
  'sa.nav.superAdmin': 'Super Admin',
  'sa.nav.profile': 'Profile',
  'sa.nav.viewProfile': 'View Profile',
  'sa.nav.logoutConfirmTitle': 'Log out?',
  'sa.nav.logoutConfirmBody': 'You will need to sign in again to get back in.',

  // ---- dashboard ----
  'sa.dashboard.title': 'System Overview',
  'sa.dashboard.todayPrefix': 'Today',
  'sa.dashboard.stat.departments': 'Departments',
  'sa.dashboard.stat.activeDepartments': 'Active departments',
  'sa.dashboard.stat.totalWaiting': 'Total Waiting',
  'sa.dashboard.stat.acrossAllDepartments': 'Across all departments',
  'sa.dashboard.stat.averageWait': 'Average Wait',
  'sa.dashboard.stat.averageWaitTime': 'Average wait time',
  'sa.dashboard.stat.skipped': 'Skipped',
  'sa.dashboard.stat.skippedQueuing': 'Skipped queuing',
  'sa.dashboard.stat.completed': 'Completed',
  'sa.dashboard.stat.completedQueuing': 'Completed queuing',
  'sa.dashboard.stat.terminals': 'Terminals',
  'sa.dashboard.stat.activeTerminals': 'Active terminals',
  'sa.dashboard.openPage': 'Open {page}',
  'sa.dashboard.aiInsights': 'AI-Assisted Insights',
  'sa.dashboard.noInsights': 'No insights available for the selected period.',
  'sa.dashboard.departmentVolume': 'Department Volume',
  'sa.dashboard.waitingPerDepartment': 'Waiting patients per department',
  'sa.dashboard.queueVolumeAria': 'Queue volume per department',
  'sa.dashboard.noVolume': 'No queue volume recorded for the selected period.',
  'sa.dashboard.queueDistribution': 'Queue Status Distribution',
  'sa.dashboard.serving': 'Serving',
  'sa.dashboard.waiting': 'Waiting',
  'sa.dashboard.departmentOverview': 'Department Overview',
  'sa.dashboard.searchDepartment': 'Search department',
  'sa.dashboard.loadingDepartments': 'Loading departments...',
  'sa.dashboard.noDepartments': 'No departments yet.',
};

/* =========================================================
   FILIPINO
========================================================= */

const fil = {
  'sa.common.cancel': 'Kanselahin',
  'sa.common.save': 'I-save',
  'sa.common.saving': 'Nag-save...',
  'sa.common.saveChanges': 'I-save ang Pagbabago',
  'sa.common.delete': 'Tanggalin',
  'sa.common.deleting': 'Tinatanggal...',
  'sa.common.close': 'Isara',
  'sa.common.edit': 'I-edit',
  'sa.common.add': 'Magdagdag',
  'sa.common.search': 'Maghanap',
  'sa.common.loading': 'Naglo-load...',
  'sa.common.refresh': 'I-refresh',
  'sa.common.reset': 'I-reset',
  'sa.common.applyFilter': 'I-apply ang Filter',
  'sa.common.confirm': 'Kumpirmahin',
  'sa.common.continue': 'Magpatuloy',
  'sa.common.done': 'Tapos',
  'sa.common.back': 'Bumalik',
  'sa.common.next': 'Susunod',
  'sa.common.previous': 'Nauna',
  'sa.common.status': 'Katayuan',
  'sa.common.active': 'Aktibo',
  'sa.common.inactive': 'Hindi Aktibo',
  'sa.common.department': 'Departamento',
  'sa.common.departments': 'Mga Departamento',
  'sa.common.kiosk': 'Kiosk',
  'sa.common.terminal': 'Terminal',
  'sa.common.prefix': 'Prefix',
  'sa.common.requiredNote': 'Kailangan ang mga may markang *.',
  'sa.common.noResults': 'Walang nahanap na resulta.',

  'sa.date.today': 'Ngayon',
  'sa.date.yesterday': 'Kahapon',
  'sa.date.lastWeek': 'Nakaraang linggo',
  'sa.date.lastMonth': 'Nakaraang buwan',
  'sa.date.lastQuarter': 'Nakaraang quarter',
  'sa.date.previousMonth': 'Nakaraang buwan',
  'sa.date.nextMonth': 'Susunod na buwan',

  'sa.nav.dashboard': 'Dashboard',
  'sa.nav.users': 'Pamamahala ng User',
  'sa.nav.departments': 'Pamamahala ng Departamento',
  'sa.nav.kiosks': 'Pamamahala ng Kiosk',
  'sa.nav.roles': 'Pamamahala ng Tungkulin',
  'sa.nav.positions': 'Pamamahala ng Posisyon',
  'sa.nav.queues': 'Pamamahala ng Pila',
  'sa.nav.reports': 'Ulat at Analytics',
  'sa.nav.settings': 'Mga Setting',
  'sa.nav.logout': 'Mag-logout',
  'sa.nav.queuingSystem': 'Sistema ng Pagpila',
  'sa.nav.superAdmin': 'Super Admin',
  'sa.nav.profile': 'Profile',
  'sa.nav.viewProfile': 'Tingnan ang Profile',
  'sa.nav.logoutConfirmTitle': 'Mag-logout?',
  'sa.nav.logoutConfirmBody': 'Kakailanganin mong mag-sign in ulit para makabalik.',

  'sa.dashboard.title': 'Pangkalahatang-ideya ng Sistema',
  'sa.dashboard.todayPrefix': 'Ngayon',
  'sa.dashboard.stat.departments': 'Mga Departamento',
  'sa.dashboard.stat.activeDepartments': 'Aktibong departamento',
  'sa.dashboard.stat.totalWaiting': 'Kabuuang Naghihintay',
  'sa.dashboard.stat.acrossAllDepartments': 'Sa lahat ng departamento',
  'sa.dashboard.stat.averageWait': 'Karaniwang Paghintay',
  'sa.dashboard.stat.averageWaitTime': 'Karaniwang oras ng paghintay',
  'sa.dashboard.stat.skipped': 'Nilaktawan',
  'sa.dashboard.stat.skippedQueuing': 'Nilaktawang pagpila',
  'sa.dashboard.stat.completed': 'Nakumpleto',
  'sa.dashboard.stat.completedQueuing': 'Nakumpletong pagpila',
  'sa.dashboard.stat.terminals': 'Mga Terminal',
  'sa.dashboard.stat.activeTerminals': 'Aktibong terminal',
  'sa.dashboard.openPage': 'Buksan ang {page}',
  'sa.dashboard.aiInsights': 'Mga Pananaw na Tulong ng AI',
  'sa.dashboard.noInsights': 'Walang pananaw para sa napiling panahon.',
  'sa.dashboard.departmentVolume': 'Dami kada Departamento',
  'sa.dashboard.waitingPerDepartment': 'Mga pasyenteng naghihintay kada departamento',
  'sa.dashboard.queueVolumeAria': 'Dami ng pila kada departamento',
  'sa.dashboard.noVolume': 'Walang naitalang dami ng pila para sa napiling panahon.',
  'sa.dashboard.queueDistribution': 'Pamamahagi ng Katayuan ng Pila',
  'sa.dashboard.serving': 'Nililingkuran',
  'sa.dashboard.waiting': 'Naghihintay',
  'sa.dashboard.departmentOverview': 'Pangkalahatang-ideya ng Departamento',
  'sa.dashboard.searchDepartment': 'Maghanap ng departamento',
  'sa.dashboard.loadingDepartments': 'Naglo-load ng departamento...',
  'sa.dashboard.noDepartments': 'Wala pang departamento.',
};

/* =========================================================
   CEBUANO
========================================================= */

const ceb = {
  'sa.common.cancel': 'Kanselahon',
  'sa.common.save': 'I-save',
  'sa.common.saving': 'Nag-save...',
  'sa.common.saveChanges': 'I-save ang Kausaban',
  'sa.common.delete': 'Tangtangon',
  'sa.common.deleting': 'Gatangtang...',
  'sa.common.close': 'Isira',
  'sa.common.edit': 'I-edit',
  'sa.common.add': 'Pagdugang',
  'sa.common.search': 'Pangita',
  'sa.common.loading': 'Ga-load...',
  'sa.common.refresh': 'I-refresh',
  'sa.common.reset': 'I-reset',
  'sa.common.applyFilter': 'I-apply ang Filter',
  'sa.common.confirm': 'Kumpirmaha',
  'sa.common.continue': 'Padayon',
  'sa.common.done': 'Human',
  'sa.common.back': 'Balik',
  'sa.common.next': 'Sunod',
  'sa.common.previous': 'Nag-una',
  'sa.common.status': 'Kahimtang',
  'sa.common.active': 'Aktibo',
  'sa.common.inactive': 'Dili Aktibo',
  'sa.common.department': 'Departamento',
  'sa.common.departments': 'Mga Departamento',
  'sa.common.kiosk': 'Kiosk',
  'sa.common.terminal': 'Terminal',
  'sa.common.prefix': 'Prefix',
  'sa.common.requiredNote': 'Kinahanglan ang mga may marka nga *.',
  'sa.common.noResults': 'Walay nakit-an nga resulta.',

  'sa.date.today': 'Karon',
  'sa.date.yesterday': 'Gahapon',
  'sa.date.lastWeek': 'Miaging semana',
  'sa.date.lastMonth': 'Miaging bulan',
  'sa.date.lastQuarter': 'Miaging quarter',
  'sa.date.previousMonth': 'Miaging bulan',
  'sa.date.nextMonth': 'Sunod nga bulan',

  'sa.nav.dashboard': 'Dashboard',
  'sa.nav.users': 'Pagdumala sa User',
  'sa.nav.departments': 'Pagdumala sa Departamento',
  'sa.nav.kiosks': 'Pagdumala sa Kiosk',
  'sa.nav.roles': 'Pagdumala sa Tahas',
  'sa.nav.positions': 'Pagdumala sa Posisyon',
  'sa.nav.queues': 'Pagdumala sa Linya',
  'sa.nav.reports': 'Taho ug Analytics',
  'sa.nav.settings': 'Mga Setting',
  'sa.nav.logout': 'Mag-logout',
  'sa.nav.queuingSystem': 'Sistema sa Pagpila',
  'sa.nav.superAdmin': 'Super Admin',
  'sa.nav.profile': 'Profile',
  'sa.nav.viewProfile': 'Tan-awa ang Profile',
  'sa.nav.logoutConfirmTitle': 'Mag-logout?',
  'sa.nav.logoutConfirmBody': 'Kinahanglan ka mag-sign in pag-usab aron makabalik.',

  'sa.dashboard.title': 'Kinatibuk-ang Sistema',
  'sa.dashboard.todayPrefix': 'Karon',
  'sa.dashboard.stat.departments': 'Mga Departamento',
  'sa.dashboard.stat.activeDepartments': 'Aktibo nga departamento',
  'sa.dashboard.stat.totalWaiting': 'Kinatibuk-ang Nagpaabot',
  'sa.dashboard.stat.acrossAllDepartments': 'Sa tanang departamento',
  'sa.dashboard.stat.averageWait': 'Kasagarang Paghulat',
  'sa.dashboard.stat.averageWaitTime': 'Kasagarang oras sa paghulat',
  'sa.dashboard.stat.skipped': 'Gilaktawan',
  'sa.dashboard.stat.skippedQueuing': 'Gilaktawan nga linya',
  'sa.dashboard.stat.completed': 'Nahuman',
  'sa.dashboard.stat.completedQueuing': 'Nahuman nga linya',
  'sa.dashboard.stat.terminals': 'Mga Terminal',
  'sa.dashboard.stat.activeTerminals': 'Aktibo nga terminal',
  'sa.dashboard.openPage': 'Ablihi ang {page}',
  'sa.dashboard.aiInsights': 'Mga Sabot nga Tabang sa AI',
  'sa.dashboard.noInsights': 'Walay sabot para sa gipiling panahon.',
  'sa.dashboard.departmentVolume': 'Gidaghanon kada Departamento',
  'sa.dashboard.waitingPerDepartment': 'Mga pasyente nga nagpaabot kada departamento',
  'sa.dashboard.queueVolumeAria': 'Gidaghanon sa linya kada departamento',
  'sa.dashboard.noVolume': 'Walay narekord nga gidaghanon sa linya para sa gipiling panahon.',
  'sa.dashboard.queueDistribution': 'Pag-apod-apod sa Kahimtang sa Linya',
  'sa.dashboard.serving': 'Ginaserbisyohan',
  'sa.dashboard.waiting': 'Nagpaabot',
  'sa.dashboard.departmentOverview': 'Kinatibuk-ang Departamento',
  'sa.dashboard.searchDepartment': 'Pangitaa ang departamento',
  'sa.dashboard.loadingDepartments': 'Ga-load sa mga departamento...',
  'sa.dashboard.noDepartments': 'Wala pay departamento.',
};

export const SUPERADMIN_TRANSLATIONS = { en, fil, ceb };

export default SUPERADMIN_TRANSLATIONS;
