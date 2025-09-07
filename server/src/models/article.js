import mongoose from 'mongoose'

const ArticleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true, minlength: 3 },
    content: { type: String, required: true, minlength: 20 },
    author_id: { type: String, required: true },
    status: { type: String, enum: ['draft', 'pending', 'published'], default: 'pending' },
    tags: { type: [String], default: [] },
    categories: { type: [String], default: [] },
    thumbnail_url: { type: String, default: '' },
    thumbnail_path: { type: String, default: '' },
    like_count: { type: Number, default: 0 },
    created_at: { type: Date },
    updated_at: { type: Date },
  },
  { timestamps: false }
)

export function validateArticle(doc) {
  const Model = mongoose.models._ArticleValidate || mongoose.model('_ArticleValidate', ArticleSchema)
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

export { ArticleSchema }
