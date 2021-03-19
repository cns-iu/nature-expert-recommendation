import { readFileSync, writeFileSync } from 'fs';
import { sync as glob } from 'glob';
import { parse } from 'papaparse';

import { scienceMap } from './science-mapper';

interface ScienceMapData {
  src: string;
  year: number;
  subd_id: number;
  measure: string;
  measureCount: number;
}

function readCSV(inputFile: string): {[field: string]: unknown}[] {
  return parse(readFileSync(inputFile).toString('utf-8'), {header: true}).data as {[field: string]: unknown}[];
}
function writeJSON(data: unknown, outputFile: string) {
  writeFileSync(outputFile, JSON.stringify(data));
}

function scienceMapCSV(inputFile: string, outputFile: string, issnFields: string[], journalNameFields: string[]): unknown[] {
  const records = readCSV(inputFile).map((data) => 
    scienceMap(data, { issnFields, journalNameFields }).map(r => ({ ...data, ...r}))
  ).reduce((acc, results) => acc.concat(results), [] as any[]);
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
        const citationCount = parseInt(data[field] as string, 10) * data.weight;
        addMeasure([year, data.subdisciplineId, '# Citations'], !isNaN(citationCount) ? citationCount : 0);
      }
    }
    const pubYear = parseInt(data.Year as string, 10);
    if (!isNaN(pubYear)) {
      addMeasure([pubYear, data.subdisciplineId, '# Papers'], data.weight);
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

  // writeJSON(output, outputFile);
  console.log(`${inputFile.split('/').slice(-1)[0]} -- Total: ${records.length}, Science Mapped: ${numSciMapped} (${Math.round(numSciMapped / records.length * 100)}%)`);
  return output.filter(n => n.subd_id !== -1);
}

function printStats(measurements: ScienceMapData[]) {
  console.log('|Dataset|#Papers|#Citations|#Subdisciplines out of 554|#Papers in Multidisciplinary|#Papers in Unclassified|\n|:--|--:|--:|--:|--:|--:|');
  const stats: {[src:string]: {
    src: string; numPapers: number; numCites: number; subdisciplines: Set<number>;
    mdPapers: number; unclassifiedPapers: number;
  }} = {};

  for (const data of measurements) {
    if (!stats.hasOwnProperty(data.src)) {
      stats[data.src] = {
        src: data.src,
        numPapers: 0,
        numCites: 0,
        subdisciplines: new Set(),
        mdPapers: 0,
        unclassifiedPapers: 0
      }
    }
    const stat = stats[data.src];
    stat.subdisciplines.add(data.subd_id);

    switch (data.measure) {
      case '# Papers':
        stat.numPapers += data.measureCount;
        switch (data.subd_id) {
          case -1:
            stat.unclassifiedPapers += data.measureCount;
            break;
          case -2:
            stat.mdPapers += data.measureCount;
            break;
        }
        break;
      case '# Citations':
        stat.numCites += data.measureCount;
        break;
    }
  }

  for (const stat of Object.values(stats)) {
    console.log(`|${stat.src}|${stat.numPapers.toLocaleString()}|${stat.numCites.toLocaleString()}|${stat.subdisciplines.size.toLocaleString()}|${stat.mdPapers.toLocaleString()}|${stat.unclassifiedPapers.toLocaleString()}|`);
  }
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
  const files = glob('../raw-data/publications/**/*.csv');

  let allData: ScienceMapData[] = [];
  for (const inputFile of files) {
    const sourceBase = inputFile.split('/').slice(-1)[0].replace('_tomap.csv', '');
    const outputFile = `../website/data/${sourceBase}.json`;
    const output = scienceMapCSV(inputFile, outputFile, issnFields, journalNameFields)
    const source = sourceBase.replace(/_/g, ' ').split(' ').slice(-1)[0];
    allData = allData.concat(output.map(n => Object.assign(n, {src: source})) as ScienceMapData[]);
  }
  printStats(allData);
  writeJSON(allData, '../website/data/combined-nodes.json');
}

main();
