import type { AudioService } from './AudioService';
import { WebAudioService } from './WebAudioService';
import { NativeAudioService } from '../bridge/NativeAudioService';
import { getNativeTaleAudio } from '../bridge/TaleAudioPlugin';

/** Внутри Capacitor с плагином TaleAudio — нативный звук (KMP), иначе — web-реализация. */
export function createAudioService(): AudioService {
  const plugin = getNativeTaleAudio();
  return plugin ? new NativeAudioService(plugin) : new WebAudioService();
}
