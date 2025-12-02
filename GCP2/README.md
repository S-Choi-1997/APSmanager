# APS Inquiry Management API

상담 조회 및 관리를 위한 Cloud Functions 기반 백엔드 API

## 기술 스택

- **Cloud Functions** (2nd gen)
- **Express.js**
- **Firebase Admin SDK**
- **Firebase Authentication** (인증)

---

## API 엔드포인트

### Health Check
```
GET /
```
인증 불필요, 서버 상태 확인

### 상담 목록 조회
```
GET /inquiries
Authorization: Bearer <firebase-id-token>

Query Parameters:
- check: true/false (확인 여부 필터)
- status: new/in_progress/completed (상태 필터)
- category: visa/corporate/civil/etc (카테고리 필터)
- limit: 숫자 (기본값 100)
- offset: 숫자 (페이지네이션)
```

### 상담 상세 조회
```
GET /inquiries/:id
Authorization: Bearer <firebase-id-token>
```

### 상담 업데이트
```
PATCH /inquiries/:id
Authorization: Bearer <firebase-id-token>
Content-Type: application/json

Body:
{
  "check": true,
  "status": "in_progress",
  "notes": "상담 진행 중",
  "assignedTo": "admin@example.com"
}
```

### 첨부파일 다운로드 URL 발급
```
GET /inquiries/:id/attachments/urls
Authorization: Bearer <firebase-id-token>

Response:
{
  "status": "ok",
  "data": [
    {
      "name": "resume.pdf",
      "type": "application/pdf",
      "size": 123456,
      "downloadUrl": "https://storage.googleapis.com/..."
    }
  ]
}
```
- Signed URL (1시간 유효)
- 프론트엔드에서 이 URL로 직접 다운로드

### 상담 삭제
```
DELETE /inquiries/:id
Authorization: Bearer <firebase-id-token>
```

---

## 배포 방법

### 1. 의존성 설치
```bash
cd GCP2
npm install
```

### 2. Firebase 프로젝트 설정
```bash
# Firebase CLI 로그인
firebase login

# 프로젝트 선택
firebase use <project-id>
```

### 3. Cloud Functions 배포
```bash
npm run deploy
```

또는 직접 명령:
```bash
gcloud functions deploy inquiryApi \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region asia-northeast3 \
  --entry-point api \
  --set-env-vars ALLOWED_ORIGINS=https://yourdomain.com
```

### 4. 환경 변수 설정
```bash
gcloud functions deploy inquiryApi \
  --update-env-vars ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:5173
```

---

## 로그 확인

```bash
npm run logs
```

또는:
```bash
gcloud functions logs read inquiryApi --region asia-northeast3 --limit 50
```

---

## 프론트엔드 연동

### Firebase Auth 토큰 가져오기
```javascript
import { auth } from './firebase/config';

const user = auth.currentUser;
const token = await user.getIdToken();

// 상담 목록 조회
const response = await fetch('https://[region]-[project-id].cloudfunctions.net/api/inquiries', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
```

### 첨부파일 다운로드
```javascript
// 1. 다운로드 URL 발급
const token = await auth.currentUser.getIdToken();
const response = await fetch(
  `https://[region]-[project-id].cloudfunctions.net/api/inquiries/${inquiryId}/attachments/urls`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const { data: attachments } = await response.json();

// 2. 다운로드 (새 탭 또는 직접 다운로드)
attachments.forEach(file => {
  if (file.downloadUrl) {
    window.open(file.downloadUrl, '_blank');
    // 또는
    // const link = document.createElement('a');
    // link.href = file.downloadUrl;
    // link.download = file.name;
    // link.click();
  }
});
```

---

## 보안

- **Firebase Authentication 필수**: 모든 `/inquiries` 엔드포인트는 인증 필요
- **CORS 설정**: `ALLOWED_ORIGINS` 환경 변수로 허용 도메인 제한
- **읽기 전용 API**: 데이터 생성은 GCP(1번 백엔드)에서만 가능

---

## 데이터 구조

Firestore `inquiries` 컬렉션:
```javascript
{
  number: 1,
  check: false,
  name: "홍길동",
  phone: "010-1234-5678",
  email: "test@example.com",
  category: "visa",
  nationality: "KOR",
  company: "APS Consulting",
  message: "상담 내용...",
  attachments: [
    { name: "file.pdf", url: "gs://...", size: 12345 }
  ],
  ip: "1.2.3.4",
  recaptchaScore: 0.9,
  createdAt: Timestamp,
  status: "new",
  updatedAt: Timestamp,
  updatedBy: "uid"
}
```

---

## 개발 팁

### 로컬 테스트
```bash
# Functions Framework 설치
npm install -g @google-cloud/functions-framework

# 로컬 실행
functions-framework --target=api --port=8080
```

### 환경 변수 로드
로컬 개발 시 `.env` 파일 생성:
```bash
cp .env.example .env
```
