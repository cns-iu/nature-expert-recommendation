import { readFileSync, writeFileSync } from 'fs';
import { parse, unparse } from 'papaparse';
import { argv } from 'process';

import { scienceMap } from './science-mapper';


function readCSV(inputFile: string): {[field: string]: unknown}[] {
  return parse(readFileSync(inputFile).toString('utf-8'), {header: true}).data as {[field: string]: unknown}[];
}
function writeJSON(data: unknown, outputFile: string) {
  writeFileSync(outputFile, JSON.stringify(data, null, 2));
}

function scienceMapCSV(inputFile: string, outputFile: string, issnFields: string[], journalNameFields: string[]): unknown[] {
  const records = readCSV(inputFile).map((data) => 
    Object.assign(data, scienceMap(data, { issnFields, journalNameFields }))
  );
  const numSciMapped = records.filter(n => n.subdisciplineId !== -1).length;

  const rollup: {[fields: string]: number} = {};
  function addMeasure(fields: unknown[], measureCount: number) {
    const key = fields.join('|');
    if (rollup.hasOwnProperty(key)) {
      rollup[key] += measureCount;
    } else {
      rollup[key] = measureCount || 0;
    }
  }
  for (const data of records) {
    const citationFields = Object.keys(data).filter(field => field.startsWith('Citations '));
    for (const field of citationFields) {
      const year = parseInt(field.split(' ').slice(-1)[0], 10);
      if (year != NaN) {
        const citationCount = parseInt(data[field] as string, 10);
        addMeasure([year, data.subdisciplineId, '# Citations'], citationCount != NaN ? citationCount : 0);
      }
    }
    const pubYear = parseInt(data.Year as string, 10);
    if (pubYear != NaN) {
      addMeasure([pubYear, data.subdisciplineId, '# Papers'], 1);
    }
  }
  const output = Object.entries(rollup).map(([key, measureCount]) => {
    const [year, subdisciplineId, measure] = key.split('|');
    return {
      year: parseInt(year, 10),
      subd_id: parseInt(subdisciplineId, 10),
      measure,
      measureCount
    };
  }).filter(n => !!n.year);

  writeJSON(output, outputFile);
  console.log(`${inputFile.split('/').slice(-1)[0]} -- Total: ${records.length}, Science Mapped: ${numSciMapped} (${Math.round(numSciMapped / records.length * 100)}%)`);
  return output;
}

const issnFields = [
  'Venue ISBN'
];
const journalNameFields = [
  'Journal Long Name',
  'Journal Name',
  'Publisher',
  'OriginalVenue',
  'Venue Map Name',
  'Venue Acronym'
];
const files = [
  'Biomedical_Papers_HGP_tomap.csv',
  'Physics_Papers_ATLAS_tomap.csv',
  'Biomedical_Papers_HuBMAP+HCA_tomap.csv',
  'Physics_Papers_IceCube_tomap.csv',
  'Physics_Papers_BaBar_tomap.csv',
  'Physics_Papers_LIGO_tomap.csv'
];

let allData = [];
for (const f of files) {
  const output = scienceMapCSV(`raw-data/${f}`, `../docs/data/${f.replace('_tomap.csv', '')}.json`, issnFields, journalNameFields)
  const source = f.replace('_tomap.csv', '').replace(/_/g, ' ');
  allData = allData.concat(output.map(n => Object.assign(n, {source})));
}
writeJSON(allData, '../docs/data/combined.json');
