import { Stat } from '../core/proto/common';

const SPEC_CONFIG = registerSpecConfig(Spec.SpecX, {
	epReferenceStat: Stat.StatAttackPower,
	defaults: {
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Stats.fromMap(
			{
				[Stat.StatStrength]: 2,
				[Stat.StatAgility]: 1.5,
				[Stat.StatAttackPower]: 1,
				[Stat.StatMeleeHit]: 20,
				[Stat.StatMeleeCrit]: 16,
				[Stat.StatFireResistance]: 0.5,
			},
			{
				[PseudoStat.PseudoStatMainHandDps]: 8,
				[PseudoStat.PseudoStatOffHandDps]: 3,
			},
		),
	},
});
