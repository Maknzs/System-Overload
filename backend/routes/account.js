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
    const { newEmail, currentPassword } = req.body;
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
