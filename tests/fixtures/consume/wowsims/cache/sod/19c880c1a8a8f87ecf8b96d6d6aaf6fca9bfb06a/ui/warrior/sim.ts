import { Stat } from '../core/proto/common';

const SPEC_CONFIG = registerSpecConfig(Spec.SpecX, {
	epReferenceStat: Stat.StatAttackPower,
	defaults: {
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Stats.fromMap(
			{
				[Stat.StatStrength]: 2.7,
				[Stat.StatAttackPower]: 1,
				[Stat.StatMeleeHit]: 0.8,
				[Stat.StatMeleeCrit]: 2.1,
				[Stat.StatArmorPenetration]: 2.2,
			},
		),
	},
});
