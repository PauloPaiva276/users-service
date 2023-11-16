const validator = require("validator");
const { v4: uuidv4 } = require("uuid");
const {
  standardEncrypt,
  standardDecrypt,
  savePseudonym,
  getIds,
  getPseudonymByAuthId,
  deletePseudonym,
} = require("../encryption");
const { getSuperKey } = require("../databases/vault");

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MIN_ADDRESS_LENGTH = 5;
const MAX_ADDRESS_LENGTH = 255;
const NIF_MIN = 100000000;
const NIF_MAX = 999999999;

const ErrorConstants = {
  DUPLICATE_NIF: {
    PATTERN:
      /duplicate key value violates unique constraint \"users_data_nif_key\"/,
    MESSAGE: "The provided NIF is invalid.",
  },
  DUPLICATE_EMAIL: {
    PATTERN:
      /duplicate key value violates unique constraint \"users_data_email_key\"/,
    MESSAGE: "The provided email is invalid.",
  },
};

function sanitizeInput(input) {
  if (typeof input === "string") {
    return validator.escape(input.trim());
  }
  return input;
}

function sanitizeUser(user) {
  return {
    name: sanitizeInput(user.name),
    address: sanitizeInput(user.address),
    nif: sanitizeInput(user.nif),
    phone: sanitizeInput(user.phone),
    email: sanitizeInput(user.email).toLowerCase(),
    username: sanitizeInput(user.username),
    password: sanitizeInput(user.password),
    organizationId: sanitizeInput(user.organizationId),
    role: sanitizeInput(user.role),
  };
}

function validateUser(user) {
  if (
    typeof user.name !== "string" ||
    !user.name.match(/^[A-Za-z\s'-]+$/) ||
    user.name.length < MIN_NAME_LENGTH ||
    user.name.length > MAX_NAME_LENGTH
  ) {
    throw new Error(
      `Invalid name format. It should only contain letters, hyphens, and apostrophes and be ${MIN_NAME_LENGTH} to ${MAX_NAME_LENGTH} characters long.`
    );
  }

  if (
    typeof user.address !== "string" ||
    user.address.length < MIN_ADDRESS_LENGTH ||
    user.address.length > MAX_ADDRESS_LENGTH
  ) {
    throw new Error(
      "Invalid address format. It should be 5 to 255 characters long."
    );
  }

  if (
    typeof user.nif !== "number" || // Check if it's a number
    user.nif < NIF_MIN || // Minimum 9-digit number
    user.nif > NIF_MAX // Maximum 9-digit number
  ) {
    throw new Error("Invalid NIF format. It should be a 9-digit number.");
  }

  if (!validator.isMobilePhone(user.phone)) {
    throw new Error("Invalid phone number format.");
  }

  if (!validator.isEmail(user.email)) {
    throw new Error("Invalid email format.");
  }
}

const resolvers = {
  Query: {
    getUserById: async (
      _,
      { id },
      { usersDBClient, pseudonymsDBClient, authDBClient }
    ) => {
      try {
        const ids = await getIds(id, pseudonymsDBClient);

        if (ids.id == null) {
          throw new Error("Invalid user id.");
        }

        const userSelectQuery = `
            SELECT * FROM users_data
            WHERE id = $1;
        `;

        const userResult = await usersDBClient.query(userSelectQuery, [ids.id]);

        if (userResult.rows.length === 0) {
          throw new Error(`User with ID ${id} not found.`);
        }

        const user = userResult.rows[0];

        const authSelectQuery = `
            SELECT * FROM users
            WHERE id = $1;
        `;

        const authResult = await authDBClient.query(authSelectQuery, [
          ids.authId,
        ]);

        if (authResult.rows.length === 0) {
          throw new Error(`User with ID ${id} not found.`);
        }

        const auth = authResult.rows[0];

        const secretKey = await getSuperKey();
        const keyBuffer = Buffer.from(secretKey, "hex");

        return {
          id: id,
          username: auth.username,
          email: standardDecrypt(user.email, keyBuffer),
          name: standardDecrypt(user.name, keyBuffer),
          address: standardDecrypt(user.address, keyBuffer),
          nif: standardDecrypt(user.nif, keyBuffer),
          phone: standardDecrypt(user.phone, keyBuffer),
          organizationId: auth.organization_id,
          role: auth.role,
        };
      } catch (error) {
        throw new Error(`Failed to fetch user: ${error.message}`);
      }
    },
    getUsers: async (_, args, { authDBClient, pseudonymsDBClient }) => {
      try {
        const authSelectQuery = `
            SELECT * FROM users;
        `;

        const authResult = await authDBClient.query(authSelectQuery);

        if (authResult.rows.length === 0) {
          throw new Error(`No users found.`);
        }

        const users = authResult.rows.map(async (row) => ({
          id: await getPseudonymByAuthId(row.id, pseudonymsDBClient),
          username: row.username,
          organizationId: row.organization_id,
          role: row.role,
        }));

        return users;
      } catch (error) {
        throw new Error(`Failed to fetch user: ${error.message}`);
      }
    },
  },
  Mutation: {
    createUser: async (
      _,
      { user },
      { usersDBClient, pseudonymsDBClient, authDBClient }
    ) => {
      const sanitizedUser = sanitizeUser(user);
      validateUser(sanitizedUser);

      await usersDBClient.query("BEGIN");

      try {
        const userInsertQuery = `
            INSERT INTO users_data(name, address, nif, phone, email)
            VALUES($1, $2, $3, $4, $5)
            RETURNING id;
        `;

        const secretKey = await getSuperKey();
        const keyBuffer = Buffer.from(secretKey, "hex");

        const userValues = [
          standardEncrypt(sanitizedUser.name, keyBuffer),
          standardEncrypt(sanitizedUser.address, keyBuffer),
          standardEncrypt(String(sanitizedUser.nif), keyBuffer),
          standardEncrypt(sanitizedUser.phone, keyBuffer),
          standardEncrypt(sanitizedUser.email, keyBuffer),
        ];

        const userResult = await usersDBClient.query(
          userInsertQuery,
          userValues
        );

        const userId = userResult.rows[0].id.toString();

        const authInsertQuery = `
            INSERT INTO users(username, password, organization_id, role)
            VALUES($1, crypt($2, gen_salt('bf')), $3, $4)
            RETURNING id;
        `;

        const authValues = [
          sanitizedUser.username,
          sanitizedUser.password,
          sanitizedUser.organizationId,
          sanitizedUser.role,
        ];

        const authResult = await authDBClient.query(
          authInsertQuery,
          authValues
        );

        const authId = authResult.rows[0].id.toString();

        const userPseudonym = uuidv4();

        await savePseudonym(userPseudonym, userId, authId, pseudonymsDBClient);
        await usersDBClient.query("COMMIT");

        return { id: userPseudonym, ...sanitizedUser };
      } catch (error) {
        await usersDBClient.query("ROLLBACK");

        if (ErrorConstants.DUPLICATE_NIF.PATTERN.test(error.message)) {
          throw new Error(ErrorConstants.DUPLICATE_NIF.MESSAGE);
        }

        if (ErrorConstants.DUPLICATE_EMAIL.PATTERN.test(error.message)) {
          throw new Error(ErrorConstants.DUPLICATE_EMAIL.MESSAGE);
        }

        throw new Error(`Registration failed: ${error.message}`);
      }
    },
    updateUser: async (_, { userId, user }, { usersDBClient }) => {
      const sanitizedUser = sanitizeUser(user);
      validateUser(sanitizedUser);

      await usersDBClient.query("BEGIN");

      try {
        const userUpdateQuery = `
            UPDATE users_data
            SET name = $1,
                address = $2,
                nif = $3,
                phone = $4,
                email = $5
            WHERE id = $6;
        `;

        const secretKey = await getSuperKey();
        const keyBuffer = Buffer.from(secretKey, "hex");

        const userValues = [
          standardEncrypt(sanitizedUser.name, keyBuffer),
          standardEncrypt(sanitizedUser.address, keyBuffer),
          standardEncrypt(String(sanitizedUser.nif), keyBuffer),
          standardEncrypt(sanitizedUser.phone, keyBuffer),
          standardEncrypt(sanitizedUser.email, keyBuffer),
          userId,
        ];

        const userResult = await usersDBClient.query(
          userUpdateQuery,
          userValues
        );

        if (!userResult) {
          throw new Error("Update failed");
        }

        await usersDBClient.query("COMMIT");

        return { id: userId, ...sanitizedUser };
      } catch (error) {
        await usersDBClient.query("ROLLBACK");

        if (ErrorConstants.DUPLICATE_NIF.PATTERN.test(error.message)) {
          throw new Error(ErrorConstants.DUPLICATE_NIF.MESSAGE);
        }

        if (ErrorConstants.DUPLICATE_EMAIL.PATTERN.test(error.message)) {
          throw new Error(ErrorConstants.DUPLICATE_EMAIL.MESSAGE);
        }

        throw new Error(`Registration failed: ${error.message}`);
      }
    },
    deleteUser: async (
      _,
      { userId },
      { usersDBClient, pseudonymsDBClient, authDBClient }
    ) => {
      await usersDBClient.query("BEGIN");

      try {
        const userDeleteQuery = `
            DELETE FROM users_data
            WHERE id = $1 AND organization_id = $2
        `;

        const realIds = await getIds(userId, pseudonymsDBClient);
        const userValues = [realIds.id, organizationId];

        await usersDBClient.query(userDeleteQuery, userValues);

        const authDeleteQuery = `
            DELETE FROM users
            WHERE id = $1;
        `;

        const authValues = [realIds.auth_id];

        await authDBClient.query(authDeleteQuery, authValues);

        await deletePseudonym(userId, pseudonymsDBClient);

        await usersDBClient.query("COMMIT");

        return { success: true, message: "User deleted successfully." };
      } catch (error) {
        await usersDBClient.query("ROLLBACK");
        throw new Error(`Deletion failed: ${error.message}`);
      }
    },
  },
};

module.exports = resolvers;
