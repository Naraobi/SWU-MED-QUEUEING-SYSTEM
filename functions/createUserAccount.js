const {
  onCall,
  HttpsError,
} = require('firebase-functions/v2/https');

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.createUserAccount = onCall(
  {
    cors: true,
  },
  async (request) => {
    try {
      // Make sure the person calling this function is authenticated
      if (!request.auth) {
        throw new HttpsError(
          'unauthenticated',
          'You must be signed in to create a user.'
        );
      }

      const data = request.data || {};

      const email = String(data.email || '')
        .trim()
        .toLowerCase();

      const password = String(data.password || '');

      const profile = data.profile || {};

      // Validate email
      if (!email) {
        throw new HttpsError(
          'invalid-argument',
          'Email is required.'
        );
      }

      // Validate password
      if (!password) {
        throw new HttpsError(
          'invalid-argument',
          'Password is required.'
        );
      }

      if (password.length < 8) {
        throw new HttpsError(
          'invalid-argument',
          'Password must be at least 8 characters.'
        );
      }

      let userRecord;

      // --------------------------------------------------
      // CREATE FIREBASE AUTHENTICATION ACCOUNT
      // --------------------------------------------------
      try {
        userRecord = await admin.auth().createUser({
          email,
          password,
        });
      } catch (error) {
        console.error(
          'CREATE AUTH USER ERROR:',
          error
        );

        if (error.code === 'auth/email-already-exists') {
          throw new HttpsError(
            'already-exists',
            'This email is already registered.'
          );
        }

        throw new HttpsError(
          'internal',
          'Unable to create Firebase Authentication account.'
        );
      }

      // --------------------------------------------------
      // CREATE FIRESTORE USER PROFILE
      // --------------------------------------------------
      try {
        await db
          .collection('users')
          .doc(userRecord.uid)
          .set({
            user_id: userRecord.uid,

            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            mi: profile.mi || '',

            email,

            contact_number:
              profile.contact_number || '',

            role:
              profile.role || 'Staff',

            role_id:
              profile.role_id || null,

            position:
              profile.position ?? null,

            kiosk:
              profile.kiosk || 'Whole',

            kiosk_id:
              profile.kiosk_id || null,

            department:
              profile.department || 'Whole',

            department_id:
              profile.department_id || null,

            status:
              profile.status || 'Active',

            created_at:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString(),
          });
      } catch (firestoreError) {
        console.error(
          'CREATE FIRESTORE PROFILE ERROR:',
          firestoreError
        );

        // If Firestore profile creation fails,
        // delete the Authentication account so
        // we don't leave an incomplete user behind.
        try {
          await admin.auth().deleteUser(
            userRecord.uid
          );
        } catch (rollbackError) {
          console.error(
            'ROLLBACK AUTH USER ERROR:',
            rollbackError
          );
        }

        throw new HttpsError(
          'internal',
          'Unable to create the user profile.'
        );
      }

      // --------------------------------------------------
      // SUCCESS
      // --------------------------------------------------
      return {
        success: true,
        uid: userRecord.uid,
        message: 'User created successfully.',
      };

    } catch (error) {
      console.error(
        'CREATE USER ACCOUNT ERROR:',
        error
      );

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        'An unexpected error occurred while creating the user.'
      );
    }
  }
);