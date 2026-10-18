# 카페 3D 작업 전달 (건희)

카페 화면의 3D는 지금 **상자로만 그린 목업(placeholder)** 입니다. 이 자리에 실제 3D를 덮어 주세요.

## 3D가 들어 있는 탭 (2곳)
| 탭 | 화면 파일 | 3D 자리 |
|---|---|---|
| 3 가게 꾸미기 | `web/src/mock/CafeBuild.tsx` | 화면 전체 폭 무대(`.m-stage` 안 `.m-canvas`). 고깃집 가게 꾸미기와 같은 틀 |
| 4 시뮬레이션 | `web/src/mock/CafeSim.tsx` | 전체 화면 배경(`.sx-canvas`). 위에 지표 줄과 팝업이 얹힘 |

두 탭 모두 `web/src/mock/CafeRoom3D.tsx` 한 파일이 그립니다. 이 파일만 바꾸면 두 탭이 같이 바뀝니다.

## 받는 값 (엔진 `POST /cafe/preview`)
- `room`: `width_m`, `depth_m`, `door`
- `layout[]`: `type`, `x`, `z`, `rot_deg`, `w`, `d`, `fits`
- `roster[]`: 직원 위치와 역할
- `occupancy` (0~1): 시뮬 탭에서만. 의자 중 손님이 앉은 비율
- 좌표계: 원점은 방 모서리, +x는 앞벽(창·문)을 따라, +z는 방 안쪽, `rot_deg`는 위에서 본 시계 방향

## 작업 범위와 쓸 엔진
- 3D만 하면 **`web/src/mock/CafeRoom3D.tsx` 한 파일**만 고치면 됩니다. 엔진은 건드릴 필요가 없습니다.
- 엔진은 `main`에 들어 있는 것을 그대로 씁니다(`python -m uvicorn api.changeup:app --port 8010`). 건희 `sim/cafe` 위에 서울 421개 동 데이터를 더한 버전입니다. `feat/cafe-month`의 `api/cafe_app.py`를 따로 띄우면 동네 목록이 달라져 화면이 어긋납니다.
- `/cafe/preview` 호출은 화면이 알아서 하므로 직접 부를 일은 없습니다.
- `CafeRoom3D`의 props(`room`, `layout`, `roster`, `occupancy`, `height`)는 그대로 둡니다. 그래야 두 화면을 안 건드려도 됩니다.
- `layout[].type`(table, chair, espresso, showcase 등)별로 모델을 매핑합니다. 지금 상자 색 표(`LOOK`)가 그 목록입니다.
- 3D 에셋(glb 등)은 `web/public/` 아래에 두고 불러옵니다. 용량이 크면 받는 사람 로컬 부담이 되니 가볍게 줄이거나 경로만 알려 주세요.
- `sim/cafe`는 `feat/cafe-month`에서 복사해 쓰고 있어 합치지 않았습니다. 엔진을 고치면 겹칠 수 있으니 엔진 수정이 필요하면 먼저 말해 주세요.
- 엔진 수정이 필요한 경우: 손님이 한 명씩 걸어 들어오는 장면처럼 지금 엔진이 주지 않는 값이 필요할 때뿐입니다.

## 알아둘 점
- 가게 꾸미기는 고깃집처럼 놓는 방식이 아니라 개수 입력(테이블, 의자, 머신 그룹 등)이고, 엔진이 배치를 정합니다.
- 시뮬 탭의 영업 장면은 엔진이 시간대별 숫자만 줘서 의자가 차고 빠지는 정도입니다. 손님이 한 명씩 걸어 들어오는 장면은 엔진 추가가 필요합니다.
- 실행: 엔진 `python -m uvicorn api.changeup:app --port 8010`, 화면 `cd web && npx vite`.
