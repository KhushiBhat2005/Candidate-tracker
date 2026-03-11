const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Candidate = require('../models/Candidate');

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|jpg|jpeg|png/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, JPG, JPEG, PNG files are allowed'));
    }
  }
});

// GET /api/candidates/stats/summary — dashboard statistics (must come before /:id route)
router.get('/stats/summary', async (req, res) => {
  try {
    const total = await Candidate.countDocuments();
    const recruited = await Candidate.countDocuments({ recruitmentStatus: 'Recruited' });
    const failed = await Candidate.countDocuments({ result: 'Fail' });
    const pending = await Candidate.countDocuments({ result: 'Pending' });
    const passed = await Candidate.countDocuments({ result: 'Pass' });

    // Stats by facility
    const byFacility = await Candidate.aggregate([
      {
        $group: {
          _id: '$facility',
          total: { $sum: 1 },
          recruited: { $sum: { $cond: [{ $eq: ['$recruitmentStatus', 'Recruited'] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $eq: ['$result', 'Fail'] }, 1, 0] } },
          passed: { $sum: { $cond: [{ $eq: ['$result', 'Pass'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$result', 'Pending'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      total,
      recruited,
      failed,
      pending,
      passed,
      byFacility
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/candidates — list all candidates with optional filters
router.get('/', async (req, res) => {
  try {
    const { result, facility, interviewStatus, search } = req.query;
    const filter = {};

    if (result) filter.result = result;
    if (facility) filter.facility = facility;
    if (interviewStatus) filter.interviewStatus = interviewStatus;
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { fin: { $regex: search, $options: 'i' } },
        { positionAppliedFor: { $regex: search, $options: 'i' } }
      ];
    }

    const candidates = await Candidate.find(filter).sort({ createdAt: -1 });
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/candidates/:id — get single candidate
router.get('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    res.json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/candidates — create a new candidate
router.post(
  '/',
  upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'idDoc', maxCount: 1 }]),
  async (req, res) => {
    try {
      // Check for duplicate FIN
      const fin = (req.body.fin || '').toUpperCase().trim();
      const existing = await Candidate.findOne({ fin });
      if (existing) {
        return res.status(409).json({
          error: 'Duplicate FIN detected',
          duplicate: {
            id: existing._id,
            name: existing.name,
            facility: existing.facility,
            result: existing.result,
            recruitmentStatus: existing.recruitmentStatus
          }
        });
      }

      const data = { ...req.body };
      data.fin = fin;
      
      if (req.files?.cv) data.cvPath = '/uploads/' + req.files.cv[0].filename;
      if (req.files?.idDoc) data.idPath = '/uploads/' + req.files.idDoc[0].filename;

      const candidate = new Candidate(data);
      await candidate.save();
      res.status(201).json(candidate);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// PUT /api/candidates/:id — update a candidate
router.put(
  '/:id',
  upload.fields([{ name: 'cv', maxCount: 1 }, { name: 'idDoc', maxCount: 1 }]),
  async (req, res) => {
    try {
      const data = { ...req.body };
      
      // If FIN is being changed, check for duplicates
      if (data.fin) {
        data.fin = data.fin.toUpperCase().trim();
        const existing = await Candidate.findOne({ fin: data.fin, _id: { $ne: req.params.id } });
        if (existing) {
          return res.status(409).json({
            error: 'Duplicate FIN detected',
            duplicate: {
              id: existing._id,
              name: existing.name,
              facility: existing.facility,
              result: existing.result
            }
          });
        }
      }

      if (req.files?.cv) data.cvPath = '/uploads/' + req.files.cv[0].filename;
      if (req.files?.idDoc) data.idPath = '/uploads/' + req.files.idDoc[0].filename;

      const candidate = await Candidate.findByIdAndUpdate(
        req.params.id,
        data,
        { new: true, runValidators: true }
      );
      if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
      res.json(candidate);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// DELETE /api/candidates/:id — delete a candidate
router.delete('/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    res.json({ message: 'Candidate deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
