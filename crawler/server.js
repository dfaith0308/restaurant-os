const express = require('express')
const puppeteer = require('puppeteer')

const app = express()
app.use(express.json())

app.use((req, res, next) => {
  const key = req.headers['x-api-key']
  if (key !== process.env.CRAWLER_API_KEY) {
    return res.status(401).json({ error: '인증 실패' })
  }
  next()
})

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/crawl/naver-place', async (req, res) => {
  const { url } = req.body
  if (!url || !url.includes('naver.com')) {
    return res.status(400).json({ error: '유효하지 않은 URL' })
  }

  let browser
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    })

    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    )
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    const data = await page.evaluate(() => {
      return {
        name: document.querySelector('.GHAhO')?.textContent?.trim() ?? null,
        category: document.querySelector('.lnJFt')?.textContent?.trim() ?? null,
        address: document.querySelector('.LDgIH')?.textContent?.trim() ?? null,
        phone: document.querySelector('.xlx7Q')?.textContent?.trim() ?? null,
        business_hours: Array.from(document.querySelectorAll('.w9QyJ'))
          .map(el => el.textContent?.trim())
          .filter(Boolean),
        menus: Array.from(document.querySelectorAll('.fDkNE'))
          .map(el => ({
            name: el.querySelector('.HJdkr')?.textContent?.trim() ?? '',
            price: el.querySelector('.GXS1X')?.textContent?.trim() ?? '',
          }))
          .filter(m => m.name),
        visitor_reviews: Array.from(document.querySelectorAll('.zPfVt'))
          .slice(0, 20)
          .map(el => el.textContent?.trim())
          .filter(Boolean),
        blog_reviews: Array.from(document.querySelectorAll('.UFNKz'))
          .slice(0, 10)
          .map(el => ({
            title: el.querySelector('.tit')?.textContent?.trim() ?? '',
            summary: el.querySelector('.desc')?.textContent?.trim() ?? '',
          }))
          .filter(r => r.title),
        rating: document.querySelector('.PXMot')?.textContent?.trim() ?? null,
        review_count: document.querySelector('.MVx6e')?.textContent?.trim() ?? null,
      }
    })

    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  } finally {
    if (browser) await browser.close()
  }
})

app.listen(process.env.PORT || 3001)
