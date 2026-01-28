# JavManager

로컬 캐싱, 토렌트 검색, qBittorrent 통합을 지원하는 JAV 콘텐츠 관리용 명령줄 도구.

[English](README.md) | [中文](README.zh-CN.md) | [日本語](README.ja.md)

> **참고:** 현재 Everything(로컬 검색)과 qBittorrent(다운로드)를 지원합니다. HTTP API가 있는 다른 도구(다른 검색 엔진이나 다운로드 클라이언트 등)의 지원이 필요하시면 [issue를 생성](../../issues/new)해 주세요.

## 기능

- JavDB에서 JAV 메타데이터 및 마그넷 링크 검색
- 로컬 캐시로 반복 검색 속도 향상
- Everything 검색 엔진으로 로컬 파일 확인
- qBittorrent WebUI API로 다운로드
- 가중치 기반 순위로 스마트한 토렌트 선택

## 외부 의존성

| 서비스 | 용도 | 링크 |
|--------|------|------|
| Everything | 로컬 파일 검색 | [voidtools.com](https://www.voidtools.com/everything-1.5a/) ([HTTP 플러그인](https://www.voidtools.com/forum/viewtopic.php?f=12&t=9799)) |
| JavDB | 메타데이터 및 마그넷 링크 | [javdb.com](https://javdb.com/) |
| qBittorrent | 토렌트 다운로드 | [qBittorrent](https://github.com/qbittorrent/qBittorrent) |

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

**대화형 명령:**

| 명령 | 설명 |
|------|------|
| `<품번>` | 품번으로 검색 (예: `STARS-001`) |
| `r <품번>` | 검색 새로고침 (캐시 우회) |
| `c` | 캐시 통계 표시 |
| `h` | 도움말 표시 |
| `q` | 종료 |

## 빌드 및 패키지

```bash
# 빌드
dotnet build JavManager/JavManager.csproj

# 테스트 실행
dotnet test JavManager.Tests/JavManager.Tests.csproj

# 패키지 (Windows 독립 실행형 zip)
pwsh scripts/package.ps1

# PATH에 설치 (Windows)
pwsh scripts/install-windows.ps1 -AddToPath
```
