const crypto = require("crypto");
const { getSuperKey: getSecretKey, getIV } = require("./databases/vault");

function deterministicEncrypt(data, keyString, ivString) {
  try {
    const key = Buffer.from(keyString, "utf8");
    const iv = Buffer.from(ivString, "utf8");
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  } catch (error) {
    console.error("Error in deterministic encryption:", error);
    return null;
  }
}

function deterministicDecrypt(encryptedData, keyString, ivString) {
  try {
    const key = Buffer.from(keyString, "utf8");
    const iv = Buffer.from(ivString, "utf8");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Error in deterministic decryption:", error);
    return null;
  }
}

function standardEncrypt(data, keyString) {
  try {
    const key = Buffer.from(keyString, "utf8");
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + encrypted;
  } catch (error) {
    console.error("Error in standard encryption:", error);
    return null;
  }
}

function standardDecrypt(data, keyString) {
  try {
    const key = Buffer.from(keyString, "utf8");
    const iv = Buffer.from(data.slice(0, 32), "hex");
    const encryptedText = data.slice(32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("Error in decryption:", error);
    return null;
  }
}

async function savePseudonym(pseudonym, id, authId, dbClient) {
  const secretKey = await getSecretKey();
  const iv = await getIV();
  const keyBuffer = Buffer.from(secretKey, "hex");
  const ivBuffer = Buffer.from(iv, "base64");
  const encryptedKey = deterministicEncrypt(pseudonym, keyBuffer, ivBuffer);
  const encryptedId = standardEncrypt(id, keyBuffer);
  const encryptedAuthId = deterministicEncrypt(authId, keyBuffer, ivBuffer);
  const query = `INSERT INTO users_pseudonyms(pseudonym, id, auth_id) VALUES($1, $2, $3);`;
  const values = [encryptedKey, encryptedId, encryptedAuthId];
  try {
    await dbClient.query(query, values);
  } catch (err) {
    console.log("Error:", err);
  }
}

async function getIds(pseudonym, dbClient) {
  const secretKey = await getSecretKey();
  const iv = await getIV();
  const keyBuffer = Buffer.from(secretKey, "hex");
  const ivBuffer = Buffer.from(iv, "base64");
  const searchKey = deterministicEncrypt(pseudonym, keyBuffer, ivBuffer);
  const query = `SELECT id, auth_id FROM users_pseudonyms WHERE pseudonym = $1`;
  const values = [searchKey];
  try {
    const result = await dbClient.query(query, values);
    if (result.rows.length) {
      return {
        id: standardDecrypt(result.rows[0].id, keyBuffer),
        authId: deterministicDecrypt(
          result.rows[0].auth_id,
          keyBuffer,
          ivBuffer
        ),
      };
    }
  } catch (err) {
    console.log("Error:", err);
  }
  return null;
}

async function getPseudonymByAuthId(authId, dbClient) {
  const secretKey = await getSecretKey();
  const iv = await getIV();
  const keyBuffer = Buffer.from(secretKey, "hex");
  const ivBuffer = Buffer.from(iv, "base64");
  const searchKey = deterministicEncrypt(authId, keyBuffer, ivBuffer);
  const query = `SELECT pseudonym FROM users_pseudonyms WHERE auth_id = $1`;
  const values = [searchKey];
  try {
    const result = await dbClient.query(query, values);
    if (result.rows.length) {
      return deterministicDecrypt(
        result.rows[0].pseudonym,
        keyBuffer,
        ivBuffer
      );
    }
  } catch (err) {
    console.log("Error:", err);
  }
  return null;
}

async function deletePseudonym(pseudonym, dbClient) {
  const secretKey = await getSecretKey();
  const iv = await getIV();
  const keyBuffer = Buffer.from(secretKey, "hex");
  const ivBuffer = Buffer.from(iv, "base64");
  const searchKey = deterministicEncrypt(pseudonym, keyBuffer, ivBuffer);
  const query = `DELETE FROM users_pseudonyms WHERE pseudonym = $1`;
  const values = [searchKey];
  try {
    await dbClient.query(query, values);
  } catch (err) {
    console.log("Error:", err);
  }
}

module.exports = {
  standardEncrypt,
  standardDecrypt,
  savePseudonym,
  getIds,
  getPseudonymByAuthId,
  deletePseudonym,
};
