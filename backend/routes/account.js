const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { verifyJwt } = require('../middleware/auth');

const router = express.Router();

// PUT /account/email  (auth required)
router.put('/email',
  verifyJwt,
  body('newEmail').isEmail(),
  body('currentPassword').isString().isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok:false, error:{ code:'VALIDATION_ERROR', message: errors.array()[0].msg }});
    }
    const { currentPassword } = req.body;
    const newEmail = (req.body.newEmail || '').toLowerCase();
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ ok:false, error:{ code:'NOT_FOUND', message:'User not found' }});
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(401).json({ ok:false, error:{ code:'BAD_CREDENTIALS', message:'Invalid password' }});
      const exists = await User.findOne({ email: newEmail }).lean();
      if (exists) return res.status(409).json({ ok:false, error:{ code:'EMAIL_IN_USE', message:'Email already in use' }});
      user.email = newEmail;
      await user.save();
      return res.json({ ok:true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok:false, error:{ code:'SERVER_ERROR', message:'Could not update email' }});
    }
  }
);

// PUT /account/username  (auth required)
router.put('/username',
  verifyJwt,
  body('newUsername').isString().isLength({ min: 3 }),
  body('currentPassword').isString().isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok:false, error:{ code:'VALIDATION_ERROR', message: errors.array()[0].msg }});
    }
    const { currentPassword } = req.body;
    const newUsername = (req.body.newUsername || '').trim();
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ ok:false, error:{ code:'NOT_FOUND', message:'User not found' }});
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(401).json({ ok:false, error:{ code:'BAD_CREDENTIALS', message:'Invalid password' }});
      const exists = await User.findOne({ username: newUsername }).lean();
      if (exists) return res.status(409).json({ ok:false, error:{ code:'USERNAME_IN_USE', message:'Username already in use' }});
      user.username = newUsername;
      await user.save();
      return res.json({ ok:true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok:false, error:{ code:'SERVER_ERROR', message:'Could not update username' }});
    }
  }
);

// PUT /account/password  (auth required)
router.put('/password',
  verifyJwt,
  body('currentPassword').isString().isLength({ min: 8 }),
  body('newPassword').isString().isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok:false, error:{ code:'VALIDATION_ERROR', message: errors.array()[0].msg }});
    }
    const { currentPassword, newPassword } = req.body;
    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ ok:false, error:{ code:'NOT_FOUND', message:'User not found' }});
      const ok = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!ok) return res.status(401).json({ ok:false, error:{ code:'BAD_CREDENTIALS', message:'Invalid password' }});
      // Optional: prevent reusing the same password
      const same = await bcrypt.compare(newPassword, user.passwordHash);
      if (same) return res.status(400).json({ ok:false, error:{ code:'SAME_PASSWORD', message:'New password must be different' }});
      user.passwordHash = await bcrypt.hash(newPassword, 12);
      await user.save();
      return res.json({ ok:true });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ ok:false, error:{ code:'SERVER_ERROR', message:'Could not update password' }});
    }
  }
);

// DELETE /account  (auth required)
router.delete('/', verifyJwt, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    return res.json({ ok:true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:{ code:'SERVER_ERROR', message:'Could not delete account' }});
  }
});

// POST /account/games-played  (auth required)
router.post('/games-played', verifyJwt, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok:false, error:{ code:'NOT_FOUND', message:'User not found' }});
    user.gamesPlayed = (user.gamesPlayed || 0) + 1;
    await user.save();
    return res.json({ ok:true, gamesPlayed: user.gamesPlayed });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:{ code:'SERVER_ERROR', message:'Could not update gamesPlayed' }});
  }
});

module.exports = router;
