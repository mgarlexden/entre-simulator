# 카페 작업 이어하기 (2026-10-17 기준)

새 세션에서 "CAFE_NEXT.md 읽고 이어서"라고 하면 바로 시작한다. 커밋·푸시는 사용자가 말하기 전에는 하지 않는다.

## 규칙
- 3D UI는 하지 않는다. 가게 꾸미기는 목업(러프한 2D 입력)으로만 둔다. 3D 마무리는 건희가 한다.
- 건희 레포의 3D 에셋(`engines/`, `*.glb`, `*.blend`, `*.fbx`)은 받지 않는다. 용량이 커서 사용자 로컬에서 못 받는다.
  받을 때는 sparse checkout으로 필요한 것만: `sim/cafe/`, `api/cafe.py`, `api/cafe_app.py`, `research/cafe/`, `docs/CAFE*.md`, `tests/test_cafe*.py`.
- 매출은 중앙값 + 범위로 보여 준다 (반영 완료, model.ts `CAFE_MEDIAN`).
- 정책자금 추천은 '모자란 돈' 탭에서: 나이대와 부족액으로 제도를 걸러 한도가 맞는 것부터. 제도는 funds.ts (정책자금_1015.xlsx). "알아볼 만한 제도"로 표시하고 공고 확인 안내를 붙인다. 아직 안 만들었다.

## 2026-10-17 진행 (3단계 모두 1차 완료)
- 동네 분석 보강: 상권변화지표(버티는 기간, 상권 변화 유형)와 소비(여가·문화 지출 비중)를 cafe_dong_profile.json에 더함 (pipelines/build_cafe_extra.py, area.ts). 데이터는 Drive에서 받아 data/raw/seoul_extra에 둠.
- 열기 전 점검: web/src/mock/cafeChecks.ts + CafeBuild.tsx (가게 꾸미기 자리는 비워 두고 평수·수준·직원 러프 입력). 2-2 정량 데이터(커피전문점 전국 평균) 기반.
- 엔진 연결: 건희 feat/cafe-month의 sim/cafe, research/cafe, api/cafe.py, tests, docs/CAFE.md를 복사(3D 에셋 제외). sim/cafe/build_dongs.py로 서울 421개 동을 상권으로 추가(params.py가 합쳐 읽음). api/changeup.py에 /cafe 라우터 연결. 화면은 CafeSim.tsx.
- 3D 구조 목업(건희가 위에 덮어씀): CafeRoom3D.tsx가 엔진 /cafe/preview의 layout·roster 좌표를 상자로 그린다(가게 꾸미기 탭 + 시뮬 탭). 입력은 CafeBuild의 Step 버튼(테이블·의자·바·머신 그룹·키오스크·POS·진열장·오븐), 엔진 요청은 cafeChecks.ts engineBody. 건희 3D는 같은 좌표계(원점=방 모서리, +x 앞벽, +z 안쪽, rot_deg 시계 방향)를 쓰면 그대로 얹힌다.
- 남은 일: 엔진 견적(1억 3,600만, VAT·설비 포함)과 '드는 돈' 견적(7,500만)의 불일치 정리, 정책자금 추천('모자란 돈' 탭), 건희 값 vs v6 충돌 결정, 단골·별점 가정 점검, Sources 카페 탭 갱신, 가게 꾸미기(3D)는 건희.
- 함정: `npx tsc -b`는 web/src에 .js를 만들어 화면이 옛 코드로 돈다. 타입 검사는 `npx tsc --noEmit`만 쓴다.

## 이미 된 것
- 카페 동네 분석 + 드는 돈 (pipelines/build_cafe_area.py, cafe.ts, 업종 전환 model.ts setIndustry / area.ts useIndustry / Mock.tsx).
- 가게 꾸미기와 시뮬은 카페에서 "준비 중" 안내만 나온다.

## 순서
1. 동네 분석 보강: Drive '상권 관련' 폴더의 상권분석서비스 CSV 중 **상권변화지표**(운영·폐업 영업개월 평균 -> 평균 생존 기간)와 **소비**(지출 총액, 음식 지출 -> 구매력)를 행정동 단위로 가공해 cafe_dong_profile.json에 넣고 화면에 반영. 지하철 역 좌표는 동 지도 표시용(선택).
   - Drive는 MCP로 읽는다 (parentId '1mtMM9nbgAYTEDqQA3pVThiew8k_k8KWj'). 큰 CSV는 내용을 못 읽을 수 있으니 로컬 data/raw/seoul_files에 같은 파일이 있는지 먼저 본다.
2. 열기 전 점검: `2-2 정량 데이터_1014.xlsx`(Drive 루트)의 커피전문점 손익으로 카페용 점검 5문항을 만든다. 식재료 39.1%, 고용인 인건비 16.4%, 임차 8.4%, 세금·공과 6.0%, 기타 5.8%, 객단가 5,704원, 채널 매장 64.8/배달 8.8/포장 26.4. 전국·프랜차이즈 포함 값이라는 한계를 화면에 적는다. 독립 카페 값(v6 cst_*)이 있으면 그쪽을 우선.
3. 엔진 연결: 건희 레포 `origin/feat/cafe-month`의 `sim/cafe/`(월별 모델, `/cafe/season`, `/cafe/season/month`, 상태 토큰)를 기반으로 지원 상권을 3곳(대학로 3120012, 신촌 3120094, 성수동카페거리 3110131)에서 서울 425개 동으로 확장(`sim/cafe/build_districts.py`와 research/cafe/districts.yaml). 우리 앱의 시뮬 화면(SimulateEngine.tsx)은 조절 항목을 가격 변경률·영업시간·직원 정책·마케팅·디저트로 바꿔 틀을 재사용. 손님 장면은 시간대별 수치(주문, 서비스, 이탈)로 만든다.
   - 미정: 건희 값과 v6 값 충돌(수요 기준, 채널 비중, 권리금, 영업일·마감), 매출 기준 통일.
