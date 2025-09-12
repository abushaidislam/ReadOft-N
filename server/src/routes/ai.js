import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'

const router = express.Router()

router.post('/summarize', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return res.status(400).json({ message: 'AI is not configured. Set GEMINI_API_KEY on the server.' })

    const { text, level = 'medium', lang = 'English' } = req.body || {}
    if (!text || typeof text !== 'string') return res.status(400).json({ message: 'Missing text' })

    // Guard: limit input size
    const input = String(text).slice(0, 20000)

    const maxTokens = level === 'short' ? 160 : level === 'long' ? 520 : 320
    const style = level === 'short'
      ? `Format:
• Start with a short abstract paragraph.
• Then 3–5 bullet points of key takeaways.`
      : level === 'long'
        ? `Format:
• Start with a short abstract paragraph.
• Then 6–10 bullet points, each beginning with a short bold key phrase, followed by a concise explanation.
• If relevant, add an "Actionable steps:" sublist (3–5 bullets).`
        : `Format:
• Start with a short abstract paragraph.
• Then 4–6 bullet points, each beginning with a short bold key phrase, followed by a concise explanation.`

    const prompt = `You are a precise writing assistant.
Summarize the article below in ${lang}.
${style}

Rules:
• Output should be valid Markdown. Headings, bold/italic, lists, links, tables, and fenced code blocks are allowed when helpful.
• Prefer concise, readable structure similar to ChatGPT-style answers.
• Be faithful to the source and avoid repetition.
• Keep it crisp and readable. Stay within the token budget.

ARTICLE:\n${input}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: maxTokens },
    })
    const out = result?.response?.text?.() || ''
    if (!out.trim()) return res.status(500).json({ message: 'Empty AI response' })
    res.json({ summary: out.trim() })
  } catch (e) {
    console.error('AI summarize failed', e)
    res.status(500).json({ message: 'Summarization failed' })
  }
})

export default router
