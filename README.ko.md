# JavManager

자동화된 JAV 콘텐츠 관리를 위한 명령줄 도구로, 빠른 반복 검색, 토렌트 검색 및 qBittorrent 통합을 제공합니다.

[中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

> **참고:** Everything(로컬 검색)과 qBittorrent(다운로드)는 선택적 통합입니다. JavManager는 이들 없이도 작동합니다(JavDB 검색 및 마그넷 링크 출력은 가능). HTTP API를 지원하는 다른 도구(예: 다른 검색 엔진 또는 다운로드 클라이언트)를 사용하려면 [이슈 생성](../../issues/new)해 주세요.

## 기능

- JavDB에서 JAV 메타데이터 및 마그넷 링크 검색
- 빠른 검색
- Everything 검색 엔진을 통한 로컬 파일 확인
- qBittorrent WebUI API를 통한 다운로드
- 가중치 기반 순위 시스템을 통한 스마트 토렌트 선택

## 워크플로우

```mermaid
flowchart TD
    A[입력 JAV ID] --> B{데이터 있음?}
    B -->|예| C[기존 메타데이터 사용]
    B -->|아니오| D[JavDB에서 가져오기]
    C --> E[토렌트 순위 매기기]
    D --> E
    E --> F{로컬 파일 존재?}
    F -->|예| G[옵션 표시]
    F -->|아니오| H[다운로더에 추가]
    G --> H
    H --> I[완료]

    classDef primary fill:#2563eb,stroke:#1d4ed8,color:#ffffff;
    classDef decision fill:#f59e0b,stroke:#d97706,color:#111827;
    classDef neutral fill:#ffffff,stroke:#e5e7eb,color:#1f2937;

    class A,H,I primary;
    class B,F decision;
    class C,D,E,G neutral;
```

## 외부 종속성

| 서비스 | 필수 | 용도 | 링크 |
|---------|----------|---------|------|
| JavDB | 예 | 메타데이터 및 마그넷 링크 | [javdb.com](https://javdb.com/) |
| Everything | 아니오 (선택 사항) | 로컬 파일 검색 | [voidtools.com](https://www.voidtools.com/everything-1.5a/) ([HTTP 플러그인](https://www.voidtools.com/forum/viewtopic.php?f=12&t=9799)) |
| qBittorrent | 아니오 (선택 사항) | 토렌트 다운로드 | [qBittorrent](https://github.com/qbittorrent/qBittorrent) |

### Cloudflare 403 문제

JavDB에서 HTTP 403을 반환하면 Cloudflare 챌린지 때문일 가능성이 높습니다. JavManager는 기본 제공되는 Chrome과 유사한 헤더를 사용하며, 타사 도구 없이 재시도합니다. 그래도 403이 발생하면 브라우저에서 `cf_clearance`와 일치하는 `UserAgent`를 구성하세요(`doc/CloudflareBypass.md` 참조).

## 구성

모든 설정은 `JavManager/appsettings.json`에서 구성됩니다(로컬 오버라이드를 위해 `appsettings.Development.json` 사용). 환경 변수 오버라이드는 지원되지 않습니다.

구성 참조:

| 섹션 | 키 | 필수 | 기본값 | 설명 |
|---------|-----|----------|---------|-------------|
| Everything | `BaseUrl` | 아니오 (선택 사항) | `http://localhost` | Everything HTTP 서버 기본 URL(스키마 및 호스트 포함). 사용 불가능한 경우 로컬 중복 검사가 건너뜁니다. |
| Everything | `UserName` | 아니오 (선택 사항) | _(비어 있음)_ | 기본 인증 사용자 이름. |
| Everything | `Password` | 아니오 (선택 사항) | _(비어 있음)_ | 기본 인증 비밀번호. |
| QBittorrent | `BaseUrl` | 아니오 (선택 사항) | `http://localhost:8080` | qBittorrent WebUI 기본 URL(필요한 경우 포트 포함). 사용 불가능하거나 인증 실패 시, JavManager는 다운로드 대기열에 추가하지 않고 마그넷 링크를 출력합니다. |
| QBittorrent | `UserName` | 아니오 (선택 사항) | `admin` | WebUI 사용자 이름. |
| QBittorrent | `Password` | 아니오 (선택 사항) | _(비어 있음)_ | WebUI 비밀번호. |
| JavDb | `BaseUrl` | 예 | `https://javdb.com` | 기본 JavDB 기본 URL. |
| JavDb | `MirrorUrls` | 아니오 (선택 사항) | `[]` | 추가 미러 URL(배열). |
| JavDb | `RequestTimeout` | 아니오 (선택 사항) | `30000` | 요청 시간 제한(밀리초). |
| JavDb | `CfClearance` | 경우에 따라 | _(비어 있음)_ | `cf_clearance` 쿠키 값(Cloudflare 챌린지가 활성화된 경우 필요). |
| JavDb | `CfBm` | 아니오 (선택 사항) | _(비어 있음)_ | `__cf_bm` 쿠키 값(선택 사항; 성공률 향상 가능). |
| JavDb | `UserAgent` | 경우에 따라 | _(비어 있음)_ | 쿠키 소스와 일치하는 브라우저 User-Agent 문자열(Cloudflare 쿠키 사용 시 필요). |
| Download | `DefaultSavePath` | 아니오 (선택 사항) | _(비어 있음)_ | qBittorrent에 토렌트 추가 시 기본 저장 경로. |
| Download | `DefaultCategory` | 아니오 (선택 사항) | `jav` | qBittorrent의 기본 카테고리. |
| Download | `DefaultTags` | 아니오 (선택 사항) | `auto-download` | 생성된 다운로드의 기본 태그. |
| LocalCache | `Enabled` | 아니오 (선택 사항) | `true` | 로컬 캐시 저장소 활성화 또는 비활성화. |
| LocalCache | `DatabasePath` | 아니오 (선택 사항) | _(비어 있음)_ | JSON 캐시 파일 경로(비워 두면 실행 파일 옆의 기본 `jav_cache.json` 사용). |
| LocalCache | `CacheExpirationDays` | 아니오 (선택 사항) | `0` | 캐시 TTL(일 단위, 0은 만료 비활성화). |
| Console | `Language` | 아니오 (선택 사항) | `en` | UI 언어(`en`, `zh`, 또는 `auto`). |
| Console | `HideOtherTorrents` | 아니오 (선택 사항) | `true` | 목록에서 일치하지 않는 토렌트 숨기기. |
| Telemetry | `Enabled` | 아니오 (선택 사항) | `true` | 익명 원격 분석 활성화 또는 비활성화. |
| Telemetry | `Endpoint` | 아니오 (선택 사항) | _(비어 있음)_ | 원격 분석 엔드포인트 URL(비워 두면 기본값 사용). |
| JavInfoSync | `Enabled` | 아니오 (선택 사항) | `false` | JavInfo 동기화 활성화 또는 비활성화. |
| JavInfoSync | `Endpoint` | 활성화 시 | _(비어 있음)_ | JavInfo 동기화 엔드포인트 URL. |
| JavInfoSync | `ApiKey` | 아니오 (선택 사항) | _(비어 있음)_ | 선택적 API 키(`X-API-Key`를 통해 전송). |

## 사용법

```bash
# 대화형 모드
dotnet run --project JavManager/JavManager.csproj

# 직접 검색
dotnet run --project JavManager/JavManager.csproj -- STARS-001

# 도움말 표시
dotnet run --project JavManager/JavManager.csproj -- help

# 버전 표시
dotnet run --project JavManager/JavManager.csproj -- version
```

**대화형 명령어:**

| 명령어 | 설명 |
|---------|-------------|
| `<code>` | JAV 코드로 검색(예: `STARS-001`) |
| `r <code>` | 검색 새로 고침 |
| `c` | 저장된 데이터 통계 표시 |
| `h` | 도움말 표시 |
| `q` | 종료 |

## 빌드 및 패키징

```bash
# 빌드
dotnet build JavManager/JavManager.csproj

# 테스트 실행
dotnet test JavManager.Tests/JavManager.Tests.csproj

# 패키징(Windows 독립 실행형 zip)
pwsh scripts/package.ps1

# PATH에 설치(Windows)
pwsh scripts/install-windows.ps1 -AddToPath
```