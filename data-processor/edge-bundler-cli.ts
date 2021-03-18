import { readFileSync, writeFileSync } from 'fs';
import { sync as glob } from 'glob';
import { set, get } from 'lodash';
import { parse } from 'papaparse';
import { journalIdSubdLookup } from '@dvl-fw/science-map';

interface Edge {
  subd_id1: number;
  subd_id2: number;
  edgeMeasure: string;
  weight: number;
  edgeYear: number;
  src?: string;
}

function readCSV(inputFile: string): {[field: string]: unknown}[] {
  return parse(readFileSync(inputFile).toString('utf-8'), {header: true}).data as {[field: string]: unknown}[];
}
function writeJSON(data: unknown, outputFile: string) {
  writeFileSync(outputFile, JSON.stringify(data));
}

function getSubdiscipline(journalId: string): number {
  const weights = journalIdSubdLookup.get(journalId);
  const subdisciplineId = !weights ? -1 : weights.length === 1 ? weights[0].subd_id : -2;
  return subdisciplineId;
}

function edgeBundleCSV(inputFile: string, outputFile: string, measure: string, sourceField: string, targetField: string, yearField: string): Edge[] {
  const edgeCounts: any = {};
  for (const row of readCSV(inputFile)) {
    const source = getSubdiscipline(row[sourceField] as string);
    const target = getSubdiscipline(row[targetField] as string);
    const year = parseInt(row[yearField] as string, 10);
    const key = ['' + year, '' + Math.min(source, target), '' + Math.max(source, target)];

    set(edgeCounts, key, get(edgeCounts, key, 0) + 1);
  }

  const edges: Edge[] = [];
  for (const year of Object.keys(edgeCounts)) {
    for (const source of Object.keys(edgeCounts[year])) {
      for (const target of Object.keys(edgeCounts[year][source])) {
        const count = edgeCounts[year][source][target];
        edges.push({
          subd_id1: parseInt(source, 10),
          subd_id2: parseInt(target, 10),
          edgeMeasure: measure,
          weight: count,
          edgeYear: parseInt(year, 10)
        });
      }
    }
  }

  // writeJSON(edges, outputFile);
  console.log(`${inputFile.split('/').slice(-1)[0]} -- Total: ${edges.length}`);
  return edges;
}

function main() {
  const files = glob('../raw-data/citations/**/*.csv');

  let allData: Edge[] = [];
  for (const inputFile of files) {
    //Citing ID,Citing Venue Name,Citing Venue SciMap ID,Citing Publication Year,
    // Cited ID,Cited Venue Name,Cited Venue SciMap ID,Cited Publication Year

    const sourceBase = inputFile.split('/').slice(-1)[0].replace('_tomap.csv', '');
    const outputFile = `../website/data/${sourceBase}.json`;
    let measure = '# Edges';
    let year = '';
    if (inputFile.indexOf('Citing') !== -1) {
      measure = '# Citations';
      year = 'Citing Publication Year';
    } else if (inputFile.indexOf('Referenced') !== -1) {
      measure = '# References';
      year = 'Cited Publication Year';
    }
    const output = edgeBundleCSV(inputFile, outputFile, measure, 
      'Citing Venue SciMap ID', 'Cited Venue SciMap ID', year);

    const source = sourceBase.replace(/_/g, ' ').split(' ').slice(-1)[0];
    allData = allData.concat(output.map(n => Object.assign(n, {src: source})));
  }
  writeJSON(allData, '../website/data/combined-edges.json');
}

main();
