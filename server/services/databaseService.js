const { db } = require("../config/firebase");
const pool = require("../config/mysql");

// TEMPORARY TEST SWITCH
// false = automatically use Firebase first
// true = force MySQL for testing
const FORCE_MYSQL = false;

let currentMode = "firebase";

/*
|--------------------------------------------------------------------------
| CHECK FIREBASE
|--------------------------------------------------------------------------
*/
async function checkFirebaseConnection() {
  try {
    await db
      .collection("connection_test")
      .limit(1)
      .get();

    return true;
  } catch (error) {
    console.error(
      "Firebase connection check failed:",
      error.message
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| CHECK MYSQL
|--------------------------------------------------------------------------
*/
async function checkMySQLConnection() {
  try {
    await pool.query("SELECT 1");

    return true;
  } catch (error) {
    console.error(
      "MySQL connection check failed:",
      error.message
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| DETERMINE DATABASE MODE
|--------------------------------------------------------------------------
*/
async function getDatabaseMode() {
  // FORCE MYSQL TEST
  if (FORCE_MYSQL) {
    const mysqlAvailable = await checkMySQLConnection();

    if (mysqlAvailable) {
      currentMode = "mysql";
      return "mysql";
    }

    currentMode = "offline";
    return "offline";
  }

  // NORMAL MODE
  const firebaseAvailable = await checkFirebaseConnection();

  if (firebaseAvailable) {
    currentMode = "firebase";
    return "firebase";
  }

  // Firebase unavailable → try MySQL
  const mysqlAvailable = await checkMySQLConnection();

  if (mysqlAvailable) {
    currentMode = "mysql";
    return "mysql";
  }

  currentMode = "offline";
  return "offline";
}

/*
|--------------------------------------------------------------------------
| GET CURRENT MODE
|--------------------------------------------------------------------------
*/
function getCurrentMode() {
  return currentMode;
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/
module.exports = {
  checkFirebaseConnection,
  checkMySQLConnection,
  getDatabaseMode,
  getCurrentMode,
};