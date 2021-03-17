import { readFileSync, writeFileSync } from 'fs';
import { sync as glob } from 'glob';
import { parse } from 'papaparse';
import { journalIdSubdLookup } from '@dvl-fw/science-map';

interface Edge {
  source: number;
  target: number;
  edgeMeasure: string;
  edgeMeasureCount: number;
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

function edgeBundleCSV(inputFile: string, outputFile: string, measure: string, sourceField: string, targetField: string): Edge[] {
  const edgeCounts: Record<string, number> = {};
  for (const row of readCSV(inputFile)) {
    const source = getSubdiscipline(row['Citing Venue SciMap ID'] as string);
    const target = getSubdiscipline(row['Cited Venue SciMap ID'] as string);

    const edgeId = `${source}|${target}`;
    edgeCounts[edgeId] = 1 + (edgeCounts[edgeId] || 0);
  }
  const edges = Object.entries(edgeCounts).map(([edgeId, edgeMeasureCount]) => {
    const [source, target] = edgeId.split('|').map(n => parseInt(n));
    return {source, target, edgeMeasure: measure, edgeMeasureCount} as Edge;
  });

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
    if (inputFile.indexOf('Citing') !== -1) {
      measure = '# Citing';
    } else if (inputFile.indexOf('Referenced') !== -1) {
      measure = '# Referenced';
    }
    const output = edgeBundleCSV(inputFile, outputFile, measure, 'Citing Venue SciMap ID', 'Cited Venue SciMap ID');

    const source = sourceBase.replace(/_/g, ' ').split(' ').slice(-1)[0];
    allData = allData.concat(output.map(n => Object.assign(n, {src: source})));
  }
  writeJSON(allData, '../website/data/combined-edges.json');
}

main();
