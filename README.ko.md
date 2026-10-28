# gtm-lens

[English](README.md) | **한국어**

**GTM 컨테이너 공개 파일만으로, 태그가 어디로 데이터를 보내는지와 고장 난 전송 경로를 찾는다.** GTM 계정 권한이 없어도 된다.

```
$ npx gtm-lens ./test/fixtures/broken-server-route.gtm.js

container · version 42
9 tags (1 paused) · 8 variables · 4 trigger rules

Sends to
  GA4         G-TEST000001  4 tag(s)
  Meta Pixel  1234567890123456  2 tag(s)
  GA4         G-OTHER00002  1 tag(s)

Findings
✖ 4 tag(s) send to https://example.com/metrics, which is not a working server container
    https://example.com/metrics/healthy answers with an HTML page (404, text/html; charset=utf-8) —
    something other than a server container is serving this path. Hits sent there are dropped.
    · Google tag (#10)
    · GA4 event "view_item" (#11)
    · GA4 event "purchase" (#12)
    · GA4 event "scroll" (#13)
▲ server_container_url is set in 2 places
    Changing it in one place leaves the others sending to the old URL.
    · Google tag config settings (macro #3)
    · Google tag event settings (macro #4)
▲ 1 GA4 event tag(s) send to G-OTHER00002, but no Google tag configures it
ℹ 1 tag(s) have no firing trigger
…
```

위 예시는 [`test/fixtures`](test/fixtures/broken-server-route.gtm.js)에 있는 합성 컨테이너로 돌린 결과다. 아래 "왜 만들었나"의 장애 상황을 재현해 둔 파일이다. 실제 컨테이너는 `GTM-XXXXXXX`를 넣으면 된다.

## 왜 만들었나

사이트를 새 인프라로 옮긴 뒤 GA4의 구매가 0이 됐다. 브라우저는 이벤트를 정상적으로 보내고 있었고, 같은 GTM에 있는 다른 태그는 멀쩡했다.

원인은 GTM 콘솔 화면에 바로 보이지 않았다. GA4 태그는 `server_container_url` 설정 때문에 구글이 아닌 `사이트/metrics`(서버 GTM)로 데이터를 보내고 있었다. 인프라를 옮기면서 그 경로가 사이트의 404 페이지로 바뀌었고, 응답 코드가 200이라 어디에도 오류가 남지 않았다. 게다가 같은 설정이 변수 두 곳에 있어서, 한 곳만 고치면 커머스 이벤트는 여전히 사라졌다.

GTM 콘솔은 태그를 하나씩 열어 보게 되어 있어서 "이 주소로 보내는 태그가 몇 개인가", "그 주소가 지금 살아 있나" 같은 전체 질문에 답하기 어렵다. gtm-lens는 그 질문에 명령 한 줄로 답한다.

## 무엇을 보나

| 검사 | 심각도 | 내용 |
|---|---|---|
| `server-url-broken` | error | `server_container_url`이 가리키는 곳이 서버 컨테이너가 아님 (`/healthy` 응답 확인) |
| `server-url-multiple-places` | warn | 같은 서버 주소가 여러 곳에 설정됨 — 한 곳만 고치면 나머지가 남는다 |
| `ga4-id-without-google-tag` | warn | GA4 이벤트 태그가 Google 태그에 없는 측정 ID로 보냄 |
| `duplicate-google-tag` | warn | 같은 측정 ID의 Google 태그가 여러 개 (중복 집계 위험) |
| `tags-never-fire` | info | 실행 조건이 없는 태그 |
| `paused-tags` | info | 일시중지된 채 게시된 태그 |
| `unused-variables` | info | 어떤 태그·트리거도 쓰지 않는 변수 |
| `unused-server-url-variable` | info | 안 쓰는 설정 변수에 서버 주소가 남아 있음 |

요약에는 컨테이너가 데이터를 보내는 곳(GA4, Google Ads, Meta·TikTok·X·Kakao 픽셀)과 태그 유형별 개수가 나온다.

GA4 이벤트 태그는 같은 측정 ID의 Google 태그 설정을 물려받는다. gtm-lens는 이 상속까지 따라가서, 이벤트 태그에 서버 주소가 직접 없어도 영향받는 태그로 센다.

## 사용법

```bash
npx gtm-lens GTM-XXXXXXX            # 컨테이너 ID
npx gtm-lens https://www.example.com # 페이지가 불러오는 컨테이너를 찾아서 전부
npx gtm-lens ./gtm.js                # 저장해 둔 파일

--json      JSON으로 출력 (CI·다른 도구 연동)
--offline   서버 주소를 직접 확인하지 않음
--verbose   모든 항목 표시
```

`error`가 하나라도 있으면 종료 코드 1을 돌려준다. 배포 후 점검이나 CI에 그대로 넣을 수 있다.

라이브러리로도 쓸 수 있다.

```ts
import { fetchContainerSource, extractContainer, inspect } from 'gtm-lens';

const container = extractContainer(await fetchContainerSource('GTM-XXXXXXX'));
const { summary, findings } = await inspect(container);
```

## 하는 것 / 하지 않는 것

- ✔ 공개된 `gtm.js`를 읽어 태그·트리거·변수 관계를 복원하고 설정 문제를 찾는다
- ✔ 컨테이너가 가리키는 서버 컨테이너 주소가 살아 있는지 한 번 확인한다 (`--offline`으로 끌 수 있다)
- ✘ 브라우저에서 페이지를 실행하지 않는다 — 실제로 어떤 태그가 발화했는지는 GTM 미리보기로 확인한다
- ✘ GTM 콘솔을 수정하지 않는다
- ✘ 수집된 데이터(GA4 보고서 등)를 분석하지 않는다

## 알아 둘 것

`gtm.js` 안의 데이터 형식은 구글이 공개 문서로 정한 것이 아니다. 형식이 바뀌면 일부 항목을 읽지 못할 수 있다. 그때도 멈추지 않고 읽은 만큼 보고하도록 만들었다. 이상한 결과가 나오면 이슈로 알려 주길 바란다.

남의 사이트를 대량으로 긁는 용도로 쓰지 않길 바란다. gtm-lens는 지정한 컨테이너 하나와, 그 컨테이너가 가리키는 서버 주소 하나만 요청한다.

## 개발

```bash
npm install
npm test          # node:test + 합성 컨테이너 fixture
npm run dev -- GTM-XXXXXXX
npm run build
```

## 다음

- 두 버전 비교(`gtm-lens diff`) — 게시로 무엇이 바뀌었나
- 감시 모드 — 매일 받아 비교하고 바뀌면 알림 (GitHub Actions 예시)
- MCP 서버 — AI 에이전트가 같은 엔진으로 컨테이너를 분석
- 동의 모드(consent) 설정 분석

## License

MIT
