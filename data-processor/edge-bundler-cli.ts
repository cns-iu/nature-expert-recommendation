import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { sync as glob } from 'glob';
import { get, set, sortBy } from 'lodash';
import { parse } from 'papaparse';
import { journalIdSubdLookup } from '@dvl-fw/science-map';
import { fileSync } from 'tmp';


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
function pfnetSims(data: Edge[]): Edge[] {
  const edges:Record<string, number> = {};
  for (const edge of data) {
    const key = `${edge.subd_id1}\t${edge.subd_id2}`;
    edges[key] = (edges[key] || 0) + edge.weight;
  }
  const tempInput = fileSync({prefix: 'pfnet', postfix: '.sim'});
  const tempOutput = fileSync({prefix: 'pfnet', postfix: '.slim.csv'});

  const output = Object.entries(edges).map(([e, weight]) => `${e}\t${weight.toFixed(2)}\n`).join('');
  // const output = data.map(e => `${e.subd_id1}\t${e.subd_id2}\t${e.weight}\n`).join('');
  writeFileSync(tempInput.name, output);
  execSync(`./pfnet/pfnet.sh ${tempInput.name} ${tempOutput.name}.slim.csv`);
  const slimEdges = readCSV(`${tempOutput.name}.slim.csv`);
  const keep = new Set(slimEdges.map(({source, target}) => `${source}|${target}`));

  tempInput.removeCallback();
  tempOutput.removeCallback();
  return data.filter((e) => keep.has(`${e.subd_id1}|${e.subd_id2}`));
}

function getSubdiscipline(journalId: string): number {
  const weights = journalIdSubdLookup.get(journalId);
  const subdisciplineId = !weights ? -1 : weights.length === 1 ? weights[0].subd_id : -2;
  return subdisciplineId;
}

function getSubdisciplines(journalId: string): {subd_id: number, weight: number}[] {
  return journalIdSubdLookup.get(journalId) || [];
}

function edgeBundleCSV(inputFile: string, outputFile: string, measure: string, sourceField: string, targetField: string, yearField: string): Edge[] {
  const edgeCounts: any = {};
  for (const row of readCSV(inputFile)) {
    const assignments = sortBy([
      ...getSubdisciplines(row[sourceField] as string),
      ...getSubdisciplines(row[targetField] as string)
    ], 'subd_id');

    for (let i=0; i < assignments.length; i++) {
      for (let j=i+1; j < assignments.length; j++) {
        const source = assignments[i].subd_id;
        const target = assignments[j].subd_id;
        const weight = assignments[i].weight + assignments[j].weight;

        const year = parseInt(row[yearField] as string, 10);
        const key = ['' + year, '' + source, '' + target];

        set(edgeCounts, key, get(edgeCounts, key, 0) + weight);
      }
    }
  }

  /* 
  for (const row of readCSV(inputFile)) {
    const source = getSubdiscipline(row[sourceField] as string);
    const target = getSubdiscipline(row[targetField] as string);
    const year = parseInt(row[yearField] as string, 10);
    const key = ['' + year, '' + Math.min(source, target), '' + Math.max(source, target)];

    set(edgeCounts, key, get(edgeCounts, key, 0) + 1);
  }
  */

  const edges: Edge[] = [];
  for (const year of Object.keys(edgeCounts)) {
    for (const source of Object.keys(edgeCounts[year])) {
      for (const target of Object.keys(edgeCounts[year][source])) {
        const count = edgeCounts[year][source][target];
        // if (count > 0.25) {
          edges.push({
            subd_id1: parseInt(source, 10),
            subd_id2: parseInt(target, 10),
            edgeMeasure: measure,
            weight: parseFloat(count.toFixed(2)),
            edgeYear: parseInt(year, 10)
          });
        // }
      }
    }
  }

  const slimEdges = pfnetSims(edges);
  console.log(`${inputFile.split('/').slice(-1)[0]} -- Total: ${edges.length}, PFNET: ${slimEdges.length}`);
  return slimEdges;
}

function main() {
  const files = glob('../raw-data/citations/**/*.csv');

  let allData: Edge[] = [];
  for (const inputFile of files) {
    //Citing ID,Citing Venue Name,Citing Venue SciMap ID,Citing Publication Year,
    // Cited ID,Cited Venue Name,Cited Venue SciMap ID,Cited Publication Year

    const sourceBase = inputFile.split('/').slice(-1)[0].replace('_tomap.csv', '');
    const source = sourceBase.replace(/_/g, ' ').split(' ').slice(-1)[0];

    let measure = '# Edges';
    let year = '';
    if (inputFile.indexOf('Citing') !== -1) {
      measure = '# Citations';
      year = 'Citing Publication Year';
    } else if (inputFile.indexOf('Referenced') !== -1) {
      measure = '# References';
      year = 'Cited Publication Year';
    }
    const outputFile = `../website/data/temp-${source}-${measure.slice(2)}.sim`;
    const output = edgeBundleCSV(inputFile, outputFile, measure, 
      'Citing Venue SciMap ID', 'Cited Venue SciMap ID', year);
    
    allData = allData.concat(output.map(n => Object.assign(n, {src: source})));
  }
  writeJSON(allData, '../website/data/combined-edges.json');
}

main();
