# 회사 PC 서버 설정 체크리스트
> 서비스: Smart Manual Monitoring
> 도메인: http://smart-m.poscofuturem.com
> 목표: `:3000` 없이 도메인만으로 접속 가능하게 설정

---

## 집에서 USB에 담아갈 것

프로젝트 폴더(`Smart-Manual-monitoring-new`)를 USB에 복사할 때:

- [ ] 폴더 전체 복사 — 단, 아래 두 폴더는 **용량이 매우 크므로 제외**해도 됨
  - `node_modules` 폴더 제외 (회사 PC에서 npm install 로 재설치)
  - `.next` 폴더 제외 (회사 PC에서 npm run build 로 재생성)
- [ ] ⚠️ **`.env.local` 파일 반드시 포함** (POSCO GPT API 키가 들어있음, 없으면 AI 기능 안 됨)
- [ ] 이 체크리스트 파일 (`회사PC_서버설정_체크리스트.md`)

> 탐색기에서 `.env.local` 파일이 안 보이면: 보기 탭 → **숨긴 항목** 체크

---

## STEP 1 — Node.js 설치 확인

### 1-1. PowerShell 열기
- 시작 버튼 → `powershell` 검색 → **Windows PowerShell** 클릭

### 1-2. Node.js 버전 확인
PowerShell 창에 아래 명령어 입력 후 Enter:
```powershell
node -v
```
- `v18.x.x` 또는 `v20.x.x` 같이 나오면 OK, 다음 STEP으로 이동
- `'node'은(는) 내부 또는 외부 명령...` 오류가 나오면 Node.js 미설치

### 1-3. Node.js 미설치 시
1. 브라우저에서 `https://nodejs.org` 접속
2. **LTS 버전** (왼쪽 초록 버튼) 다운로드 후 설치
3. 설치 완료 후 PowerShell **재시작**, 다시 `node -v` 확인

---

## STEP 2 — 프로젝트 폴더로 이동 후 설치 및 빌드

### 2-1. 프로젝트 폴더 경로 확인
USB에서 복사한 폴더가 어디 있는지 확인 (예시):
```
C:\Users\[사용자이름]\Desktop\Smart-Manual-monitoring-new
```

### 2-2. PowerShell에서 프로젝트 폴더로 이동
```powershell
cd "C:\Users\[사용자이름]\Desktop\Smart-Manual-monitoring-new"
```
> `[사용자이름]` 부분을 본인 계정명으로 바꾸기
> 예: `cd "C:\Users\posco\Desktop\Smart-Manual-monitoring-new"`

폴더 이동이 잘 됐는지 확인 (현재 위치 출력):
```powershell
pwd
```
→ `...Smart-Manual-monitoring-new` 로 끝나면 정상

### 2-3. 의존성 설치
```powershell
npm install
```
→ 수십 초~수 분 소요, `added XXX packages` 메시지가 나오면 완료

### 2-4. 프로덕션 빌드
```powershell
npm run build
```
→ 완료 메시지 예시:
```
✓ Compiled successfully
✓ Generating static pages (17/17)
```
이 메시지가 나오면 빌드 성공

---

## STEP 3 — PM2 설치 및 앱 등록

> PM2 = Next.js 앱을 백그라운드에서 계속 실행시켜주는 프로그램
> 터미널 창을 닫아도 앱이 꺼지지 않고, PC 재시작 시 자동으로 켜짐

### 3-1. PM2 전역 설치
아래 두 줄을 **한 줄씩** 입력:
```powershell
npm install -g pm2
```
```powershell
npm install -g pm2-windows-startup
```
각각 `added XXX packages` 메시지 나오면 설치 완료

### 3-2. Next.js 앱을 PM2로 등록

⚠️ **반드시 프로젝트 폴더 안에 있을 때 실행** (STEP 2-2에서 이동한 상태)

```powershell
pm2 start node_modules/next/dist/bin/next --name smart-manual -- start
```

명령어 분해 설명:
- `pm2 start` — PM2로 실행
- `node_modules/next/dist/bin/next` — 이 프로젝트 폴더 안의 Next.js 실행 파일 (상대 경로라서 반드시 프로젝트 폴더 안에서 실행해야 함)
- `--name smart-manual` — PM2에서 식별할 이름
- `-- start` — Next.js에게 "프로덕션 모드로 시작해" 라는 명령

### 3-3. 실행 상태 확인
```powershell
pm2 status
```
아래처럼 `online` 이 보이면 정상:
```
┌─────┬──────────────┬─────────┬──────────┐
│ id  │ name         │ status  │ ...      │
├─────┼──────────────┼─────────┼──────────┤
│ 0   │ smart-manual │ online  │ ...      │
└─────┴──────────────┴─────────┴──────────┘
```
→ `stopped` 나 `errored` 이면 STEP 3-4로 이동

### 3-4. 오류 시 로그 확인
```powershell
pm2 logs smart-manual --lines 30
```
로그 내용 보고 오류 원인 파악 (Ctrl+C로 로그 종료)

### 3-5. PC 재시작 시 자동 실행 등록
```powershell
pm2 save
```
```powershell
pm2-startup install
```
각각 `Successfully saved` / `Successfully added` 메시지 나오면 완료

---

## STEP 4 — nginx 다운로드 및 설치

> nginx = 80번 포트로 들어온 요청을 3000번으로 전달해주는 프로그램

### 4-1. 다운로드
1. 브라우저에서 `https://nginx.org/en/download.html` 접속
2. **Stable version** 항목에서 `nginx/Windows-x.x.x` 링크 클릭 → `.zip` 파일 다운로드

### 4-2. 압축 해제 및 폴더 이동
1. 다운로드된 zip 파일 우클릭 → **모두 압축 풀기** → 바탕화면 등 아무 곳에 압축 해제
2. 압축이 풀리면 `nginx-1.26.2` 같은 이름의 폴더가 생김
3. 그 폴더를 **`C:\` (C드라이브 바로 아래)** 로 이동
4. 이동한 폴더의 이름을 **`nginx`** 로 변경 (우클릭 → 이름 바꾸기)

최종 구조가 아래처럼 되면 OK:
```
C:\
└── nginx\
    ├── nginx.exe       ← 이 파일이 있어야 함
    ├── conf\
    │   └── nginx.conf  ← 다음 단계에서 이 파일을 교체
    └── logs\
```

### 4-3. 구조 확인
PowerShell에서:
```powershell
ls C:\nginx
```
`nginx.exe` 파일이 목록에 보이면 OK

---

## STEP 5 — nginx 설정 파일 적용

프로젝트 폴더 안에 `nginx.conf` 파일이 준비되어 있음. 이걸 nginx 폴더로 복사:

```powershell
Copy-Item "C:\Users\[사용자이름]\Desktop\Smart-Manual-monitoring-new\nginx.conf" -Destination "C:\nginx\conf\nginx.conf" -Force
```
> `[사용자이름]` 을 본인 계정명으로 변경

복사 확인:
```powershell
cat C:\nginx\conf\nginx.conf
```
`server_name  smart-m.poscofuturem.com;` 줄이 보이면 올바르게 복사된 것

---

## STEP 6 — NSSM으로 nginx를 Windows 서비스로 등록

> Windows 서비스로 등록 = PC를 켜면 nginx가 자동으로 백그라운드에서 실행됨
> NSSM은 이 등록을 쉽게 해주는 유틸리티

### 6-1. NSSM 다운로드
1. 브라우저에서 `https://nssm.cc/download` 접속
2. **Latest release** 의 zip 파일 다운로드
3. zip 파일 우클릭 → **모두 압축 풀기** → 아무 곳에 압축 해제
4. 압축이 풀리면 `nssm-2.24` 같은 이름의 폴더가 생김
5. 그 폴더를 **`C:\` (C드라이브 바로 아래)** 로 이동
6. 이동한 폴더 이름을 **`nssm`** 으로 변경 (우클릭 → 이름 바꾸기)

최종 구조:
```
C:\
└── nssm\
    ├── win32\
    └── win64\
        └── nssm.exe   ← 이 파일이 있어야 함
```

### 6-2. 관리자 권한으로 PowerShell 열기
- 시작 버튼 → `powershell` 검색 → **우클릭** → **관리자 권한으로 실행** 클릭
- "이 앱이 디바이스를 변경하도록 허용하시겠습니까?" → **예**

### 6-3. nginx 서비스 등록
아래 세 줄을 **한 줄씩** 입력:
```powershell
C:\nssm\win64\nssm.exe install nginx "C:\nginx\nginx.exe"
```
→ `Service "nginx" installed successfully!` 메시지 확인

```powershell
C:\nssm\win64\nssm.exe set nginx AppDirectory "C:\nginx"
```

```powershell
Start-Service nginx
```

### 6-4. 서비스 실행 확인
```powershell
Get-Service nginx
```
```
Status   Name
------   ----
Running  nginx
```
→ `Running` 이면 정상

---

## STEP 7 — Windows 방화벽 80포트 허용

> 방화벽이 80포트를 막고 있으면 외부에서 접속이 안 됨

**관리자 권한 PowerShell** 에서 실행 (STEP 6-2에서 열어둔 창 사용):
```powershell
New-NetFirewallRule -DisplayName "nginx HTTP 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```
→ 오류 없이 완료되면 OK

---

## 최종 확인

### 앱 상태 확인
```powershell
pm2 status
```
→ `smart-manual` 이 `online` 이어야 함

```powershell
Get-Service nginx
```
→ `Running` 이어야 함

### 브라우저 접속 테스트

| 주소 | 기대 결과 |
|---|---|
| `http://localhost` | Smart Manual 화면이 나오면 nginx 정상 |
| `http://localhost:3000` | Smart Manual 화면 (Next.js 직접 접속 확인용) |
| `http://smart-m.poscofuturem.com` | 포트 없이 접속되면 최종 성공 |

---

## 문제 발생 시 대처법

### pm2 status 에서 stopped / errored 인 경우
```powershell
# 오류 로그 확인
pm2 logs smart-manual --lines 50

# 앱 재시작 시도
pm2 restart smart-manual
```

### nginx 시작 안 되는 경우
```powershell
# 오류 로그 확인
cat C:\nginx\logs\error.log

# nginx 재시작
Restart-Service nginx
```

### 80포트가 이미 다른 프로그램이 사용 중인 경우
```powershell
# 80포트 점유 프로세스 확인
netstat -ano | findstr :80
```
→ 나온 PID(숫자)로 작업 관리자에서 해당 프로세스 종료 후 `Start-Service nginx` 재시도

### 도메인 접속은 안 되는데 localhost는 되는 경우
→ IT 담당자에게 **"`smart-m.poscofuturem.com` 도메인이 이 PC의 IP 주소로 연결되어 있는지 확인 요청"**
→ 현재 PC의 IP 확인: `ipconfig` 명령어 실행 후 `IPv4 주소` 확인
