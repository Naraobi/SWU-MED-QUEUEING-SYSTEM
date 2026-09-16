const {
  onCall,
  HttpsError,
} = require('firebase-functions/v2/https');

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.updateUserAccount = onCall(
  {
    cors: true,
  },
  async (request) => {
    try {
      // Make sure the person calling this function is authenticated
      if (!request.auth) {
        throw new HttpsError(
          'unauthenticated',
          'You must be signed in to update a user.'
        );
      }

      const data = request.data || {};

      const uid = String(data.uid || '')
        .trim();

      const email = String(data.email || '')
        .trim()
        .toLowerCase();

      // Validate UID
      if (!uid) {
        throw new HttpsError(
          'invalid-argument',
          'User UID is required.'
        );
      }

      // Validate email
      if (!email) {
        throw new HttpsError(
          'invalid-argument',
          'Email is required.'
        );
      }

      // --------------------------------------------------
      // UPDATE FIREBASE AUTHENTICATION ACCOUNT
      // --------------------------------------------------
      try {
        await admin.auth().updateUser(
          uid,
          {
            email,
          }
        );
      } catch (error) {
        console.error(
          'UPDATE AUTH USER ERROR:',
          error
        );

        if (
          error.code ===
          'auth/email-already-exists'
        ) {
          throw new HttpsError(
            'already-exists',
            'This email is already registered.'
          );
        }

        if (
          error.code ===
          'auth/user-not-found'
        ) {
          throw new HttpsError(
            'not-found',
            'Firebase Authentication user was not found.'
          );
        }

        throw new HttpsError(
          'internal',
          'Unable to update Firebase Authentication account.'
        );
      }

      // --------------------------------------------------
      // SUCCESS
      // --------------------------------------------------
      return {
        success: true,
        uid,
        email,
      };

    } catch (error) {
      console.error(
        'UPDATE USER ACCOUNT ERROR:',
        error
      );

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        'An unexpected error occurred while updating the user.'
      );
    }
  }
);