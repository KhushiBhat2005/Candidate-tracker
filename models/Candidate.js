const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema(
  {
    // Candidate Information
    fin: {
      type: String,
      required: [true, 'FIN number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9]+$/
    },
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: 100
    },
    phone: {
      type: String,
      trim: true
    },
    sourceOfApplication: {
      type: String,
      enum: ['Walk-in', 'Referral', 'Agency', 'Job Board', 'Internal'],
      default: 'Walk-in'
    },
    transportRequired: {
      type: Boolean,
      default: false
    },
    busRoute: {
      type: String,
      trim: true,
      default: null
    },

    // Interview & Assessment
    interviewDate: {
      type: Date,
      default: null
    },
    facility: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E', 'F'],
      required: [true, 'Facility is required']
    },
    department: {
      type: String,
      trim: true,
      default: null
    },
    positionAppliedFor: {
      type: String,
      trim: true
    },
    interviewedBy: {
      type: String,
      trim: true,
      default: null
    },
    interviewStatus: {
      type: String,
      enum: ['Pending', 'Completed'],
      default: 'Pending'
    },
    result: {
      type: String,
      enum: ['Pending', 'Pass', 'Fail'],
      default: 'Pending'
    },
    interviewerComments: {
      type: String,
      default: ''
    },
    rejectionReason: {
      type: String,
      default: null
    },

    // Onboarding & Final Status
    recruitmentStatus: {
      type: String,
      enum: ['Not Recruited', 'Recruited'],
      default: 'Not Recruited'
    },
    dateOfRecruitment: {
      type: Date,
      default: null
    },
    remarks: {
      type: String,
      default: ''
    },

    // File Attachments
    cvPath: {
      type: String,
      default: null
    },
    idPath: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

// Index for faster searching
candidateSchema.index({ fin: 1, facility: 1 });
candidateSchema.index({ name: 'text', positionAppliedFor: 'text' });

module.exports = mongoose.model('Candidate', candidateSchema);
