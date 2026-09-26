const { realtimeDb } = require("../config/firebase");

/**
 * Update the current queue state for a department
 * in Firebase Realtime Database.
 */
async function updateDepartmentQueue(
  departmentPrefix,
  queueData
) {
  if (!departmentPrefix) {
    throw new Error(
      "Department prefix is required."
    );
  }

  const ref = realtimeDb.ref(
    `queues/${departmentPrefix}`
  );

  await ref.set({
    ...queueData,
    updatedAt:
      new Date().toISOString(),
  });

  return true;
}

/**
 * Read the current queue state for a department.
 */
async function getDepartmentQueue(
  departmentPrefix
) {
  if (!departmentPrefix) {
    throw new Error(
      "Department prefix is required."
    );
  }

  const snapshot = await realtimeDb
    .ref(`queues/${departmentPrefix}`)
    .get();

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.val();
}

module.exports = {
  updateDepartmentQueue,
  getDepartmentQueue,
};