# OZKIZ Styling Board

아동복 브랜드를 위한 AI 코디 연출 앱

## 설치 & 실행

```bash
npm install
npm run dev
```

## Vercel 배포 후 API 키 설정

1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
2. Name: `ANTHROPIC_API_KEY`
3. Value: `sk-ant-...` (Claude API 키)
4. "Save" 클릭
5. Deployments 탭 → 최신 배포의 "..." → "Redeploy" 클릭
