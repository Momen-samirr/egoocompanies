/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(routes)` | `/(routes)/login` | `/(routes)/register` | `/(routes)/track-trip` | `/(routes)/verify` | `/(tabs)` | `/(tabs)/` | `/(tabs)/profile` | `/_sitemap` | `/login` | `/profile` | `/register` | `/track-trip` | `/verify`;
      DynamicRoutes: never;
      DynamicRouteTemplate: never;
    }
  }
}
