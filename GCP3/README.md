# GCP3 - VM Proxy Server for Fixed IP

이 폴더에는 알리고 SMS API를 위한 고정 IP VM 프록시 서버 설정 파일들이 있습니다.

## 📋 개요

**목적**: 알리고 SMS API가 요구하는 고정 IP 화이트리스트 대응

**아키텍처**:
```
Cloud Functions (us-central1)
    ↓ HTTP Proxy
VM (us-central1, f1-micro, Tinyproxy)
    ↓ 고정 IP
알리고 API
```

**비용**: **$0/월** (프리티어)

---

## 🚀 빠른 시작

### 1️⃣ VM 생성

```bash
cd GCP3
bash create-vm.sh
```

### 2️⃣ 고정 IP 할당

```bash
# 고정 IP 생성
gcloud compute addresses create aligo-proxy-ip --region=us-central1

# VM에 연결
gcloud compute instances delete-access-config aligo-proxy \
  --zone=us-central1-a \
  --access-config-name="external-nat"

gcloud compute instances add-access-config aligo-proxy \
  --zone=us-central1-a \
  --address=$(gcloud compute addresses describe aligo-proxy-ip --region=us-central1 --format='value(address)')
```

### 3️⃣ 고정 IP 확인

```bash
gcloud compute addresses describe aligo-proxy-ip --region=us-central1 --format='value(address)'
```

**출력 예시**: `34.72.123.45`

### 4️⃣ VM에 Tinyproxy 설치

```bash
# VM에 SSH 접속
gcloud compute ssh aligo-proxy --zone=us-central1-a

# Tinyproxy 설치 스크립트 다운로드 및 실행
curl -sSL https://raw.githubusercontent.com/YOUR_REPO/main/GCP3/setup-tinyproxy.sh | bash

# 또는 수동 설치
sudo apt update && sudo apt install -y tinyproxy
sudo cp tinyproxy.conf /etc/tinyproxy/tinyproxy.conf
sudo systemctl restart tinyproxy
sudo systemctl enable tinyproxy
```

### 5️⃣ 방화벽 설정

```bash
gcloud compute firewall-rules create allow-tinyproxy \
  --allow=tcp:8888 \
  --source-ranges=0.0.0.0/0 \
  --target-tags=proxy-server \
  --description="Allow Tinyproxy access"
```

### 6️⃣ GCP2 환경변수 업데이트

`GCP2/.env` 파일 수정:
```env
PROXY_URL=http://34.72.123.45:8888
```
(위 IP를 3단계에서 확인한 실제 IP로 변경)

### 7️⃣ Cloud Functions 재배포

```bash
cd ../GCP2
.\deploy.ps1
```

### 8️⃣ 알리고에 IP 등록

1. 알리고 관리자 페이지 로그인
2. 설정 → IP 화이트리스트
3. 3단계에서 확인한 IP 등록: `34.72.123.45`

---

## 🧪 테스트

### 프록시 동작 확인

```bash
# VM에서 확인
curl -x http://localhost:8888 ifconfig.me
# 출력: 34.72.123.45 (VM의 고정 IP)

# Cloud Functions에서 확인 (배포 후)
# SMS 발송 로그에 "Using proxy: http://34.72.123.45:8888" 출력되어야 함
```

---

## 📁 파일 설명

| 파일 | 설명 |
|-----|------|
| `README.md` | 이 파일 |
| `create-vm.sh` | VM 자동 생성 스크립트 |
| `setup-tinyproxy.sh` | Tinyproxy 설치 스크립트 |
| `tinyproxy.conf` | Tinyproxy 설정 파일 |

---

## 💰 비용

| 항목 | 비용 | 조건 |
|-----|------|------|
| **VM (f1-micro)** | $0 | us-central1 프리티어 |
| **디스크 (10GB)** | $0 | 30GB까지 프리티어 |
| **고정 IP** | $0 | VM에 연결 시 무료 |
| **네트워크 egress** | $0.12/GB | 프리티어 1GB 초과 시 |

**월 예상 비용**: **$0~1** (SMS는 데이터 적음)

---

## 🔧 유지보수

### VM 재부팅

```bash
gcloud compute instances stop aligo-proxy --zone=us-central1-a
gcloud compute instances start aligo-proxy --zone=us-central1-a
```

### Tinyproxy 로그 확인

```bash
gcloud compute ssh aligo-proxy --zone=us-central1-a
sudo tail -f /var/log/tinyproxy/tinyproxy.log
```

### VM 삭제 (필요 시)

```bash
# VM 삭제
gcloud compute instances delete aligo-proxy --zone=us-central1-a

# 고정 IP 삭제
gcloud compute addresses delete aligo-proxy-ip --region=us-central1

# 방화벽 규칙 삭제
gcloud compute firewall-rules delete allow-tinyproxy
```

---

## 🚨 트러블슈팅

### 문제: SMS 발송 실패

1. **프록시 연결 확인**
   ```bash
   curl -x http://VM_IP:8888 https://apis.aligo.in
   ```

2. **방화벽 확인**
   ```bash
   gcloud compute firewall-rules list --filter="name=allow-tinyproxy"
   ```

3. **Tinyproxy 상태 확인**
   ```bash
   gcloud compute ssh aligo-proxy --zone=us-central1-a
   sudo systemctl status tinyproxy
   ```

### 문제: 알리고에서 IP 차단

- 알리고 관리 페이지에서 등록한 IP가 VM의 고정 IP와 일치하는지 확인
- Tinyproxy 로그에서 실제 요청 IP 확인

---

## 📚 참고 자료

- [Google Cloud Free Tier](https://cloud.google.com/free)
- [Tinyproxy Documentation](https://tinyproxy.github.io/)
- [알리고 API 문서](https://smartsms.aligo.in/admin/api/info.html)
