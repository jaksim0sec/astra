# ovll mobile

Capacitor 기반 Android/iOS 셸이다. 웹용 `front/`는 원본 그대로 유지하고,
앱 빌드 직전에 `mobile/www/`로 복사하면서 네이티브 런타임 설정만 주입한다.

## 요구사항

- Node.js 22+
- Android: Android Studio 2025.2.1+
- iOS: macOS + Xcode 26+

## 최초 설치

```bash
cd mobile
npm install
```

기본 백엔드는 현재 배포 서버를 사용한다.

```text
https://astra-ep6m.onrender.com
```

다른 서버로 빌드할 때만 HTTPS origin을 덮어쓴다.

```bash
export OVLL_API_ORIGIN=https://your-ovll-server.example
```

### Android

```bash
npm run android:init
npm run android:open
```

### iOS

```bash
npm run ios:init
npm run ios:open
```

## 프론트 변경 후

```bash
npm run sync
```

다른 백엔드를 사용할 때만 `OVLL_API_ORIGIN`을 지정한다.

`npm run sync`는 `../front`를 새로 복사한 뒤 Capacitor native project와 동기화한다.

## 구조

- `../front`: 웹/PWA 원본
- `www/`: 생성물, git에 커밋하지 않음
- `capacitor.config.json`: 앱 ID와 WebView 설정
- `scripts/prepare-web.mjs`: 앱용 런타임 설정 주입

서버는 `capacitor://localhost`(iOS)와 `https://localhost`(Android)의
`/api` CORS 요청만 기본 허용한다. 다른 native origin이 필요하면 서버의
`NATIVE_APP_ORIGINS` 환경변수에 쉼표로 추가한다.
