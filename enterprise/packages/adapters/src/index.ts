/**
 * @noshow/adapters — translate a platform's registration event into a hold intent.
 *
 * Adapters are deliberately thin. All they do is map a payload onto
 * `NoShowClient.createHoldIntent`, so writing a third one for whatever system you
 * already run is a short file, not a project.
 */
export { LumaAdapter, LUMA_API_BASE } from "./luma.js";
export type { LumaAdapterConfig, LumaGuest, LumaEventType, LumaWebhookBody } from "./luma.js";

export { GenericAdapter } from "./generic.js";
export type { GenericAdapterConfig, GenericRegistration } from "./generic.js";
