/**
 * Configuración oficial de Capacitor para compilación y empaquetado de APK Android
 * de la plataforma SivarStock Enterprise.
 */

export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    url?: string;
    cleartext?: boolean;
    androidScheme?: string;
    hostname?: string;
    [key: string]: any;
  };
  android?: {
    allowMixedContent?: boolean;
    captureInput?: boolean;
    backgroundColor?: string;
    [key: string]: any;
  };
  plugins?: {
    [key: string]: any;
  };
}

const config: CapacitorConfig = {
  appId: 'com.sivarstock.enterprise',
  appName: 'SivarStock',
  webDir: 'public',
  server: {
    // Apunta al servidor de producción desplegado para navegación fluida
    url: process.env.CAPACITOR_SERVER_URL || 'https://sivarstock.vercel.app',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    backgroundColor: '#131E17',
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos'],
    },
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: '#131E17',
      showSpinner: false,
    },
  },
};

export default config;
