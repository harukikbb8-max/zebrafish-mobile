import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { db } from '@/db/database';
import { AutoSync } from '@/ui/AutoSync';
import { SyncGate } from '@/ui/SyncGate';
import { ToastHost } from '@/ui/Toast';
import { C } from '@/lib/theme';

/**
 * web(ローカル確認用)のみ: expo-sqlite の同期 API は Worker の起動完了前に呼ぶと
 * タイムアウトするため、先に非同期で一度開いて Worker を起こしてから本体を描画する。
 * iOS/Android では何もせず素通りする。
 */
export default function RootLayout() {
  const [ready, setReady] = useState(Platform.OS !== 'web');
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // 新しい Chrome は Atomics.pause を持ち、expo-sqlite の同期待ちが約50msで打ち切られる。
    // 無効化して従来のビジーループ(十分長い上限)へフォールバックさせる。
    try {
      delete (Atomics as any).pause;
    } catch {}
    SQLite.openDatabaseAsync(':memory:').then(() => setReady(true));
  }, []);
  return ready ? <App /> : null;
}

function App() {
  // 起動時に一度だけ DB を初期化(スキーマ作成・初期データ投入)
  useState(() => {
    db();
    return true;
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AutoSync />
        <SyncGate>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: C.bgTop },
              headerShadowVisible: false,
              headerTintColor: C.accentDeep,
              headerTitleStyle: { fontWeight: '800', color: C.text },
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: C.bg },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'ホーム' }} />
            <Stack.Screen name="rack" options={{ title: '棚ビュー' }} />
            <Stack.Screen name="analysis" options={{ title: '成績分析' }} />
            <Stack.Screen name="logs" options={{ title: 'アクティビティログ' }} />
            <Stack.Screen name="settings" options={{ title: '設定' }} />
          </Stack>
        </SyncGate>
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
