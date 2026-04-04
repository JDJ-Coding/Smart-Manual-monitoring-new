# Critical Bug Fix 리스트 (현재 코드 기준)

1. **PDF 구조 손실 버그**
   - 위치: `src/lib/pdfParser.ts`
   - 원인: `textContent.items`를 공백으로 단순 join하여 줄/열/레이아웃 정보를 소거함.
   - 영향: 표/파라미터/캡션 분리 실패 → 검색 정확도 급락.
   - 조치: 좌표 기반 line 재구성 + table/caption detector 적용.

2. **Alarm 오탐 전처리 버그 (`no. 13` 이슈)**
   - 위치: `src/app/api/chat/route.ts` (`detectAlarmQuery`, `enhanceQueryForSearch`)
   - 원인: `no.` 패턴과 숫자 결합 시 무조건 알람 의도로 강화됨.
   - 영향: 문서 번호/목차 질의가 알람 검색으로 라우팅.
   - 조치: Intent classifier 도입 후 `document_index`를 alarm보다 우선 판정.

3. **BM25 토큰화 성능/정확도 버그**
   - 위치: `src/lib/bm25.ts`
   - 원인: 매 토큰마다 `doc.filter(...)` 수행(O(N*T*L)). 코드 토큰(`E.OC1`)이 분리되어 의미 손실.
   - 영향: 대용량 매뉴얼에서 느리고 코드 검색 품질 저하.
   - 조치: 문서별 term frequency map 사전 계산 + 코드 보존 토크나이저 적용.

4. **근거 없는 답변 허용 프롬프트 버그**
   - 위치: `src/app/api/chat/route.ts` (`buildContextPromptFromResults`, `buildSystemPrompt`)
   - 원인: "검색 결과 없음" 시 일반지식 답변 허용.
   - 영향: 현장 신뢰성 하락, 환각 증가.
   - 조치: 근거 없으면 모른다고 응답하도록 hard guardrail로 변경.

5. **임계값 상수화로 인한 도메인 민감도 손실**
   - 위치: `src/app/api/chat/route.ts` (`computeDynamicThreshold`)
   - 원인: 동적 함수명이지만 항상 0.25 고정.
   - 영향: 질의 타입/문서 품질에 따른 recall-precision 튜닝 불가.
   - 조치: 질의의도별 threshold 및 top-k 분리, 실측 기반 자동 튜닝.
