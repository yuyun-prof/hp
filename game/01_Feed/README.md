# Feed the Professor — Web Version

## 업로드 위치

홈페이지 프로젝트에서 아래 구조로 업로드합니다.

```text
game/
└─ 01_Feed/
   ├─ fp_index.html
   ├─ fp_style.css
   ├─ fp_game.js
   └─ assets/
```

## 홈페이지 버튼

```html
<button
  class="game-zone-play-button"
  type="button"
  data-game-id="Feed the Professor"
  data-game-title="Feed the Professor"
  data-game-src="game/01_Feed/fp_index.html"
  data-game-width="100%"
  data-game-height="600"
  aria-expanded="false"
  aria-controls="game-player"
>
  <span>PLAY</span>
  <b aria-hidden="true">▶</b>
</button>
```

## 조작법

- Space / 위쪽 방향키 / 마우스 클릭 / 터치: 점프
- 공중에서 다시 입력: 이중 점프
- 게임오버 화면에서 다시 입력: 기록과 게임 상태를 초기화하고 재시작

## 브라우저 기능

- 1200 × 600 내부 캔버스
- iframe 폭에 맞춘 반응형 표시
- 모바일 터치 지원
- 최고 거리 localStorage 저장
- Web Audio 효과음
- 외부 라이브러리와 서버 기능 없이 정적 호스팅 가능


## 수정 사항
- 화면 바깥 물체가 이전 프레임에 남아 번져 보이던 현상 수정
- 배경 반복 좌표를 정상화하여 오른쪽 가장자리의 잔상 제거
- Canvas와 CSS 이미지 보간을 끄고 픽셀 아트 선명도 개선
