import { assemblyai } from './assemblyai'
import { deepgram } from './deepgram'
import { elevenlabs } from './elevenlabs'
import { gemini } from './gemini'
import { gladia } from './gladia'
import { groq } from './groq'
import { mistral } from './mistral'
import { openai } from './openai'
import { soniox } from './soniox'
import { speechmatics } from './speechmatics'
import type { Provider } from './types'
import { yandex } from './yandex'

/** Порядок = рекомендация: сначала бесплатные и простые. */
export const providers: Provider[] = [
  groq,
  gemini,
  elevenlabs,
  speechmatics,
  assemblyai,
  gladia,
  mistral,
  deepgram,
  soniox,
  yandex,
  openai,
]

export function providerById(id: string): Provider | undefined {
  return providers.find((p) => p.id === id)
}
