# 네이버 플레이스 크롤러 (Railway)

식당OS 매장 설정에서 네이버 플레이스 URL로 매장·메뉴·리뷰 정보를 수집하는 Puppeteer 서버입니다.

## 로컬 실행

```bash
cd crawler
npm install
CRAWLER_API_KEY=siksiki-crawler-2026 PORT=3001 npm start
```

테스트:

```bash
curl -X POST http://localhost:3001/crawl/naver-place \
  -H "Content-Type: application/json" \
  -H "x-api-key: siksiki-crawler-2026" \
  -d "{\"url\":\"https://map.naver.com/v5/entry/place/...\"}"
```

## Railway 배포

1. [railway.app](https://railway.app) 가입
2. **New Project** → **Deploy from GitHub**
3. 저장소 연결 후 **Root Directory**를 `crawler`로 설정
4. 환경 변수 설정:
   - `CRAWLER_API_KEY` — restaurant_os `CRAWLER_API_KEY`와 동일 값
   - `PORT` — Railway가 자동 주입하면 생략 가능
5. **Deploy** 후 생성된 URL 확인 (예: `https://xxx.up.railway.app`)

## restaurant_os / Vercel 연동

Vercel 환경 변수:

```
NAVER_CRAWLER_URL=https://your-railway-app.railway.app
CRAWLER_API_KEY=siksiki-crawler-2026
```

## 주의사항

- 네이버 플레이스 DOM 클래스(`.GHAhO` 등)는 변경될 수 있어 주기적 점검이 필요합니다.
- iframe 기반 레이아웃일 경우 셀렉터가 동작하지 않을 수 있습니다.
- Railway 무료/소형 인스턴스에서는 Puppeteer cold start가 10~30초 걸릴 수 있습니다.
