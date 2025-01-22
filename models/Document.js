const mongoose = require('mongoose');
const { Schema } = mongoose;

const DocumentSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true, // Removes whitespace from both ends of the string
  },
  data: {
    type: Object,
    default: {}, // Provide a default empty object
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  collaborators: [{
    type: Schema.Types.ObjectId,
    ref: "User",
  }],
}, {
  timestamps: true
});

module.exports = mongoose.model('Document', DocumentSchema);