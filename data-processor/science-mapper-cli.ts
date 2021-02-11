import { readFileSync, writeFileSync } from 'fs';
import { sync as glob } from 'glob';
import { parse } from 'papaparse';

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
      if (!isNaN(year)) {
        const citationCount = parseInt(data[field] as string, 10);
        addMeasure([year, data.subdisciplineId, '# Citations'], citationCount != NaN ? citationCount : 0);
      }
    }
    const pubYear = parseInt(data.Year as string, 10);
    if (!isNaN(pubYear)) {
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
  }).filter(n => !!n.year && n.measureCount > 0);

  writeJSON(output, outputFile);
  console.log(`${inputFile.split('/').slice(-1)[0]} -- Total: ${records.length}, Science Mapped: ${numSciMapped} (${Math.round(numSciMapped / records.length * 100)}%)`);
  return output;
}

function main() {
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
  const files = glob('raw-data/**/*.csv');

  let allData = [];
  for (const inputFile of files) {
    const sourceBase = inputFile.split('/').slice(-1)[0].replace('_tomap.csv', '');
    const outputFile = `../website/data/${sourceBase}.json`;
    const output = scienceMapCSV(inputFile, outputFile, issnFields, journalNameFields)
    const source = sourceBase.replace(/_/g, ' ');
    allData = allData.concat(output.map(n => Object.assign(n, {source})));
  }
  writeJSON(allData, '../website/data/combined.json');
}

main();
