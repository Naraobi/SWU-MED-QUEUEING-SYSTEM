const crypto = require("crypto");

function generateTemporaryPassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

  let password = "";

  for (let i = 0; i < 10; i++) {
    password += chars.charAt(
      crypto.randomInt(0, chars.length)
    );
  }

  return password;
}

module.exports = {
  generateTemporaryPassword,
};