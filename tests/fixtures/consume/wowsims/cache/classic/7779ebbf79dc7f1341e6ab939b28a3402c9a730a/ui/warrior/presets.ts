import * as PresetUtils from '../core/preset_utils.js';
import BlankGear from './gear_sets/blank.gear.json';
import P0BISGear from './gear_sets/p0.bis.gear.json';
import Phase1Gear from './gear_sets/phase_1.gear.json';

export const GearBlank = PresetUtils.makePresetGear('Blank', BlankGear);
export const GearP0BIS = PresetUtils.makePresetGear('Pre-BiS', P0BISGear);
export const GearPhase1 = PresetUtils.makePresetGear('P1 BiS', Phase1Gear);
