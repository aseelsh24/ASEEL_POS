import type { Settings } from '@core/index'
import type { SettingsInput } from '@backend/ServiceLayer_POS_Grocery_MVP'
import { appServices } from './appServices'

export type { SettingsInput }

export async function loadSettings(): Promise<Settings | null> {
  try {
    return await appServices.settingsService.getSettings()
  } catch (err) {
    console.error('Failed to load settings', err)
    throw err
  }
}

export async function saveSettings(input: SettingsInput): Promise<Settings> {
  try {
    return await appServices.settingsService.createOrUpdateSettings(input)
  } catch (err) {
    console.error('Failed to save settings', err)
    throw err
  }
}
