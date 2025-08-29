// Jest manual mock for ../models/User
// Provides in-memory user store with Mongoose-like API surface used by routes

const bcrypt = require('bcryptjs');

let users = [];
let idSeq = 1;

function clone(u) {
  return JSON.parse(JSON.stringify(u));
}

function matchQuery(user, query) {
  if (!query) return false;
  const entries = Object.entries(query);
  return entries.every(([k, v]) => user[k] === v);
}

function orQuery(user, q) {
  return Array.isArray(q.$or) && q.$or.some((sub) => matchQuery(user, sub));
}

class UserDoc {
  constructor(data) {
    Object.assign(this, data);
  }
  async save() {
    const idx = users.findIndex((u) => u.id === this.id);
    if (idx >= 0) users[idx] = clone(this);
    return this;
  }
}

const User = {
  __reset() {
    users = [];
    idSeq = 1;
  },
  async create({ email, username, passwordHash, gamesPlayed = 0 }) {
    const now = new Date().toISOString();
    const newId = String(idSeq++);
    const doc = {
      id: newId,
      _id: newId,
      email,
      username,
      passwordHash,
      gamesPlayed,
      createdAt: now,
      updatedAt: now,
    };
    users.push(clone(doc));
    return new UserDoc(doc);
  },
  findOne(query) {
    const found = users.find((u) => orQuery(u, query) || matchQuery(u, query));
    const result = found ? new UserDoc(clone(found)) : null;
    return {
      lean: () => (found ? clone(found) : null),
      then: (res, rej) => Promise.resolve(result).then(res, rej),
    };
  },
  findById(id) {
    const found = users.find((u) => u.id === id || u._id === id);
    const doc = found ? new UserDoc(clone(found)) : null;
    return {
      lean: () => (found ? clone(found) : null),
      then: (res, rej) => Promise.resolve(doc).then(res, rej),
    };
  },
  async findByIdAndDelete(id) {
    const idx = users.findIndex((u) => u.id === id || u._id === id);
    if (idx >= 0) {
      const [removed] = users.splice(idx, 1);
      return new UserDoc(removed);
    }
    return null;
  },
};

module.exports = User;
