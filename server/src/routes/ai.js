import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'

const router = express.Router()

const LEVEL_TOKEN_BUDGET = {
  short: 160,
  medium: 320,
  long: 520,
}

const FOCUS_INSTRUCTIONS = {
  balanced: 'Provide a balanced overview mixing the core narrative with the most important supporting details.',
  insights: 'Highlight surprising insights, trends, and implications. Explain why each point matters.',
  actionable: 'Emphasize practical recommendations and next steps that the reader can act on immediately.',
  simplify: 'Use plain, beginner-friendly language and briefly explain any jargon that appears.',
}

router.post('/summarize', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return res.status(400).json({ message: 'AI is not configured. Set GEMINI_API_KEY on the server.' })

    const { text, level = 'medium', lang = 'English', focus = 'balanced' } = req.body || {}
    const sourceText = typeof text === 'string' ? text : ''
    if (!sourceText.trim()) return res.status(400).json({ message: 'Missing text' })

    const requestedLevel = typeof level === 'string' ? level.toLowerCase() : 'medium'
    const normalizedLevel = Object.prototype.hasOwnProperty.call(LEVEL_TOKEN_BUDGET, requestedLevel) ? requestedLevel : 'medium'
    const tokenBudget = LEVEL_TOKEN_BUDGET[normalizedLevel]

    const requestedFocus = typeof focus === 'string' ? focus.toLowerCase() : 'balanced'
    const focusKey = Object.prototype.hasOwnProperty.call(FOCUS_INSTRUCTIONS, requestedFocus) ? requestedFocus : 'balanced'
    const focusLine = FOCUS_INSTRUCTIONS[focusKey]

    const language = typeof lang === 'string' && lang.trim() ? String(lang).slice(0, 40) : 'English'

    const input = sourceText.slice(0, 20000)

    const style = normalizedLevel === 'short'
      ? `Format:
- Start with a short abstract paragraph.
- Then 3-5 bullet points of key takeaways.`
      : normalizedLevel === 'long'
        ? `Format:
- Start with a short abstract paragraph.
- Then 6-10 bullet points, each beginning with a short bold key phrase followed by a concise explanation.
- If relevant, add an "Actionable steps" sublist with 3-5 bullets.`
        : `Format:
- Start with a short abstract paragraph.
- Then 4-6 bullet points, each beginning with a short bold key phrase followed by a concise explanation.`

    const prompt = `You are a precise writing assistant.
Summarize the article below in ${language}.
${style}

Focus:
${focusLine}

Rules:
- Output should be valid Markdown. Headings, bold/italic, lists, links, tables, and fenced code blocks are allowed when helpful.
- Prefer concise, readable structure similar to ChatGPT-style answers.
- Be faithful to the source and avoid repetition.
- Keep it crisp and readable. Stay within the token budget.

ARTICLE:
${input}`

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: tokenBudget },
    })
    const out = result?.response?.text?.() || ''
    if (!out.trim()) return res.status(500).json({ message: 'Empty AI response' })
    res.json({ summary: out.trim(), level: normalizedLevel, focus: focusKey })
  } catch (e) {
    console.error('AI summarize failed', e)
    res.status(500).json({ message: 'Summarization failed' })
  }
})

export default router
