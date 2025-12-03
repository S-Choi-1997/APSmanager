# Changelog

## 2025-12-03 - Naver OAuth 통합 및 배포 자동화

### 구현 사항

1. **다중 인증 제공자 통합**
   - Google OAuth (기존)
   - Naver OAuth (신규)
   - 통합 인증 매니저 (`authManager.js`)

2. **보안 개선**
   - Naver 토큰 교환을 백엔드에서 처리 (`/auth/naver/token`)
   - CLIENT_SECRET을 프론트엔드에서 제거
   - CSRF 방지 (state 파라미터 검증)

3. **GitHub Actions CI/CD**
   - `allfiles` 브랜치 push → 자동 빌드 및 배포
   - GitHub Secrets로 환경 변수 관리
   - `main` 브랜치에 빌드 결과 배포

4. **세션 관리**
   - localStorage 기반 세션 유지
   - 새로고침 시 자동 로그인
   - 로그아웃 시 자동 로그인 페이지 이동

### 주요 이슈 및 해결

#### 1. CORS 에러 (Naver 토큰 교환)
**문제**: 브라우저에서 Naver API 직접 호출 시 CORS 차단
**해결**: 백엔드에 `/auth/naver/token` 엔드포인트 추가

#### 2. 백엔드 API URL 불일치
**문제**: 환경 변수의 URL이 실제 Cloud Run URL과 다름
**해결**:
- 기존: `https://inquiryapi-759991718457.us-central1.run.app`
- 변경: `https://inquiryapi-mbi34yrklq-du.a.run.app`

#### 3. 팝업 메시지 전달 실패
**문제**: Naver 콜백 페이지에서 메인 창으로 메시지 전달 안 됨
**해결**: `checkClosed` 인터벌 전에 `let` 선언 이동, 메시지 수신 시 인터벌 즉시 clear

#### 4. 세션 복원 CORS 에러
**문제**: 페이지 새로고침 시 토큰 검증에서 CORS 에러
**해결**: 토큰 검증 제거, localStorage에서 직접 복원 (만료 시 API 호출에서 처리)

### 기술 스택

- **Frontend**: React + Vite
- **Backend**: Express.js on Cloud Run (GCP)
- **Auth**: Google Identity Services + Naver OAuth 2.0
- **Deployment**: GitHub Actions → GitHub Pages
- **Storage**: Firebase Firestore + Cloud Storage

### 허용된 이메일

```
infra.steve.01@gmail.com
nothingjustfake@gmail.com
camrel3850@gmail.com
choho97@naver.com
hwanki2k2019@gmail.com
joys401@naver.com
chanmoolee@gmail.com
```

### 배포 URL

- **Frontend**: https://s-choi-1997.github.io/APSmanager/
- **Backend**: https://inquiryapi-mbi34yrklq-du.a.run.app
- **Naver Callback**: https://s-choi-1997.github.io/APSmanager/naver-callback.html

### 브랜치 전략

- `allfiles`: 소스 코드 브랜치 (작업 브랜치)
- `main`: 빌드된 파일만 (GitHub Pages 배포용)

### 향후 개선 사항

- Naver 프로필 정보 (이름, 사진) 제공 설정 (현재 이메일만)
- package-lock.json 커밋 (빌드 성능 개선)
