import { Stat } from '../core/proto/common';

const SPEC_CONFIG = registerSpecConfig(Spec.SpecX, {
	epReferenceStat: Stat.StatSpellPower,
	defaults: {
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Stats.fromMap(
			{
				[Stat.StatIntellect]: 0.5,
				[Stat.StatSpirit]: 0.25,
				[Stat.StatSpellPower]: 1,
				[Stat.StatSpellCrit]: 5,
				[Stat.StatMP5]: 2,
			},
		),
	},
});
