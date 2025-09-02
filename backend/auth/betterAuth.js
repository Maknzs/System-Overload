// Better Auth integration with MongoDB (via Mongoose native driver)
// - Adapter is implemented using better-auth's createAdapter API
// - Mounted under `/api/better-auth` to avoid clashing with existing routes
// - Email+password flows enabled; sessions managed with HttpOnly cookies

/* eslint-disable no-console */
const mongoose = require('mongoose');

let betterAuth;
let toNodeHandler;
let createAdapter;

try {
  // CommonJS entrypoints are exposed by better-auth
  betterAuth = require('better-auth').betterAuth;
  toNodeHandler = require('better-auth/node').toNodeHandler;
  createAdapter = require('better-auth/adapters').createAdapter;
} catch (e) {
  // Defer throw until handler is invoked to keep app booting in environments without deps installed
  console.warn('[BetterAuth] Packages not installed yet. Run `npm i better-auth@^1.3.7` in backend/');
}

// Small helper to get the native Mongo DB instance from Mongoose
function getDb() {
  if (!mongoose.connection || !mongoose.connection.db) {
    throw new Error('[BetterAuth] Mongoose not connected');
  }
  return mongoose.connection.db;
}

// Convert Better Auth's generic where clause into a MongoDB filter
function whereToMongo(where) {
  if (!Array.isArray(where) || where.length === 0) return {};
  const and = [];
  const or = [];
  for (const w of where) {
    if (!w || !w.field) continue;
    let cond;
    if (w.operator === 'in' && Array.isArray(w.value)) {
      cond = { [w.field]: { $in: w.value } };
    } else {
      cond = { [w.field]: w.value };
    }
    if (w.connector === 'OR') or.push(cond);
    else and.push(cond);
  }
  if (and.length && or.length) return { $and: and, $or: or };
  if (and.length === 1 && or.length === 0) return and[0];
  if (or.length === 1 && and.length === 0) return or[0];
  if (and.length) return { $and: and };
  if (or.length) return { $or: or };
  return {};
}

// A minimal Mongo adapter backed by the native driver.
// We intentionally store `id` as a string field in documents (we do NOT reuse `_id`).
function mongoAdapter() {
  if (!createAdapter) throw new Error('[BetterAuth] createAdapter not available');
  return createAdapter({
    adapter: () => {
      return {
        async create({ model, data }) {
          const db = getDb();
          await db.collection(model).insertOne({ ...data });
          return { ...data };
        },
        async findOne({ model, where, select, sortBy }) {
          const db = getDb();
          const projection = Array.isArray(select) && select.length
            ? select.reduce((acc, f) => ((acc[f] = 1), acc), {})
            : undefined;
          const filter = whereToMongo(where);
          const cursor = db.collection(model).find(filter, { projection });
          if (sortBy && sortBy.field) {
            cursor.sort({ [sortBy.field]: sortBy.order === 'desc' ? -1 : 1 });
          }
          const doc = await cursor.limit(1).toArray();
          return doc[0] || null;
        },
        async findMany({ model, where, select, limit, offset, sortBy }) {
          const db = getDb();
          const projection = Array.isArray(select) && select.length
            ? select.reduce((acc, f) => ((acc[f] = 1), acc), {})
            : undefined;
          const filter = whereToMongo(where);
          const cursor = db.collection(model).find(filter, { projection });
          if (sortBy && sortBy.field) {
            cursor.sort({ [sortBy.field]: sortBy.order === 'desc' ? -1 : 1 });
          }
          if (typeof offset === 'number') cursor.skip(offset);
          if (typeof limit === 'number') cursor.limit(limit);
          return await cursor.toArray();
        },
        async update({ model, where, update }) {
          const db = getDb();
          const filter = whereToMongo(where);
          const res = await db.collection(model).findOneAndUpdate(
            filter,
            { $set: { ...update } },
            { returnDocument: 'after' }
          );
          return res && (res.value || res);
        },
        async delete({ model, where }) {
          const db = getDb();
          const filter = whereToMongo(where);
          const res = await db.collection(model).findOneAndDelete(filter);
          return res && (res.value || res);
        },
        async deleteMany({ model, where }) {
          const db = getDb();
          const filter = whereToMongo(where);
          const res = await db.collection(model).deleteMany(filter);
          return { count: res.deletedCount || 0 };
        },
        async count({ model, where }) {
          const db = getDb();
          const filter = whereToMongo(where);
          return await db.collection(model).countDocuments(filter || {});
        },
      };
    },
    config: {
      adapterId: 'mongodb',
      adapterName: 'MongoDB',
      supportsBooleans: true,
      supportsDates: true,
      supportsJSON: true,
    },
  });
}

// Create the Better Auth instance and an Express-compatible handler
function createBetterAuth() {
  if (!betterAuth || !toNodeHandler) {
    throw new Error('[BetterAuth] better-auth not installed. Please install dependencies.');
  }

  // Trusted origins: allow configuring via env to unblock local dev
  const trusted = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const auth = betterAuth({
    // Let Better Auth infer baseURL from first request; set a distinct basePath
    basePath: '/api/better-auth',
    trustedOrigins: trusted,
    // Persist sessions in DB for revocation/listing
    session: { storeSessionInDatabase: true },
    // Enable email/password
    emailAndPassword: { enabled: true },
    // Use env secret or Better Auth default; recommend setting BETTER_AUTH_SECRET
    // secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
    // Better Auth 1.x uses `database` to configure persistence/adapters
    database: mongoAdapter(),
    // Minimal CORS/trusted origins: with Caddy same-origin proxy, defaults are fine
  });

  const handler = toNodeHandler(auth.handler);
  return { auth, handler };
}

module.exports = { createBetterAuth };
