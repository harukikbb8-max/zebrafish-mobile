// Expo 標準の Metro 設定を継承する。
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite の web 実装が wasm を import するため、解決できるようにしておく
// (本アプリは iOS/Android ネイティブのみ対象。web ビルドの解決エラー回避用)
config.resolver.assetExts.push('wasm');

// web で expo-sqlite(wasm) が SharedArrayBuffer を使えるよう、dev サーバーに COOP/COEP ヘッダを付ける
config.server = config.server || {};
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  return middleware(req, res, next);
};

module.exports = config;
