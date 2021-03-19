import { issnLookup, journalNameLookup, journalIdSubdLookup } from '@dvl-fw/science-map';


export interface ScienceMappingOptions {
  issnFields: string[];
  journalNameFields: string[];
}
export interface ScienceMappingResult {
  journalId?: number;
  subdisciplineId: number;
  weight: number;
}

export function scienceMap(data: {[field: string]: unknown}, options: ScienceMappingOptions): ScienceMappingResult[] {
  const tries = [
    ...(options.issnFields || []).map(field => issnLookup.get(data[field] as string)),
    ...(options.journalNameFields || []).map(field => journalNameLookup.get(data[field] as string))
  ].filter(x => !!x);

  if (tries.length > 0) {
    const journalId = tries[0].id;
    const weights = journalIdSubdLookup.get('' + journalId) as {subd_id: number, weight: number}[];

    if (!weights || weights.length === 0) {
      return [{ journalId, subdisciplineId: -1, weight: 1 }];
    } else {
      return weights.map(w => ({ journalId, subdisciplineId: w.subd_id, weight: w.weight }));
    }

    // const subdisciplineId = !weights ? -1 : weights.length === 1 ? weights[0].subd_id : -2;
    // return [{ journalId: parseInt(journalId, 10), subdisciplineId, weight: 1 }];
  } else {
    return [{ journalId: undefined, subdisciplineId: -1, weight: 1 }];
  }
}
