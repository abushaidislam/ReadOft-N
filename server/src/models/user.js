import mongoose from 'mongoose'
import { ROLES } from '../utils/roles.js'

const UserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // UUID from Supabase
    email: { type: String, required: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.READER },
    bio: { type: String, default: '' },
    avatar_url: { type: String, default: '' },
    avatar_path: { type: String, default: '' },
    created_at: { type: Date },
  },
  { timestamps: false }
)

// Expose validation without DB persistence
export function validateUser(doc) {
  const Model = mongoose.models._UserValidate || mongoose.model('_UserValidate', UserSchema)
  const instance = new Model(doc)
  const error = instance.validateSync()
  if (error) {
    const messages = Object.values(error.errors).map((e) => e.message)
    const err = new Error(messages.join(', '))
    err.status = 400
    throw err
  }
  return instance.toObject()
}

export { UserSchema }
