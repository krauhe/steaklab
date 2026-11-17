# English voice guide

English cooking guidance recorded with ElevenLabs on 17 November 2026. The active clips listed in `en/phrases.json` are embedded by the build for offline playback. Earlier numbered-setting recordings are retained as unused assets. Model: `eleven_multilingual_v2`; voice: `JBFqnCBsd6RMkjVDRZzb`; format: MP3, 44.1 kHz, 128 kbps.

Set `ELEVENLABS_API_KEY` locally, optionally set `ELEVENLABS_VOICE_ID`, then explicitly run `node scripts/generate-voice.mjs`. This consumes ElevenLabs credits. It skips existing recordings and stops on errors without automatic retries. The default voice ID is the one used in ElevenLabs' official conversion example.

Run `node build.mjs` afterward. Only a complete set of recordings is embedded into the standalone HTML; playback then needs neither a server nor an API key. Until that set exists, the English interface uses an English browser voice. Audio files and phrase text may be published; API keys must never be committed or embedded.

Heat changes say “Increase the heat”, “Decrease the heat”, or “Turn off the heat”, based on the preceding enabled action (including rest in the pan, which switches off the stove). Repeated identical settings use “Change the heat”. The timeline shows watts and the corresponding calibrated stove step. Oil guidance refers to the amount shown in the plan.

API reference: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
