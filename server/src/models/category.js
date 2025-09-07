import mongoose from 'mongoose'

const CategorySchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    slug: { type: String, required: true, minlength: 2 },
    name: { type: String, required: true, minlength: 2 },
    created_at: { type: Date },
  },
  { timestamps: false }
)

export function validateCategory(doc) {
  const Model = mongoose.models._CategoryValidate || mongoose.model('_CategoryValidate', CategorySchema)
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

export { CategorySchema }

