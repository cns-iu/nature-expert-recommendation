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

function getSubdisciplines(journalId: string): {subd_id: number, weight: number}[] {
  return journalIdSubdLookup.get(journalId) || [];
}

function getSubdiscipline(journalId: string): number {
  const weights = getSubdisciplines(journalId);
  switch (weights.length) {
    case 0: return -1;
    case 1: return -2;
    default: return weights[0].subd_id;
  }
}

function edgeBundleCSV(inputFile: string, outputFile: string, measure: string, sourceField: string, targetField: string, yearField: string): Edge[] {
  const edgeCounts: any = {};
  for (const row of readCSV(inputFile)) {
    const source = parseInt(row[sourceField] as string, 10);
    const target = parseInt(row[targetField] as string, 10);
    const year = parseInt(row[yearField] as string, 10);
    const key = ['' + year, '' + Math.min(source, target), '' + Math.max(source, target)];

    set(edgeCounts, key, get(edgeCounts, key, 0) + 1);
  }

  /*
  for (const row of readCSV(inputFile)) {
    const sources = getSubdisciplines(row[sourceField] as string);
    const targets = getSubdisciplines(row[targetField] as string);
    const year = parseInt(row[yearField] as string, 10);

    for (const source of sources) {
      for (const target of targets) {
        const key = ['' + year, '' + Math.min(source.subd_id, target.subd_id),
                                '' + Math.max(source.subd_id, target.subd_id)];
        set(edgeCounts, key, get(edgeCounts, key, 0) + source.weight);
      }
    }
  }
  */

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
        edges.push({
          subd_id1: parseInt(source, 10),
          subd_id2: parseInt(target, 10),
          edgeMeasure: measure,
          weight: parseFloat(count.toFixed(2)),
          edgeYear: parseInt(year, 10)
        });
      }
    }
  }

  const slimEdges = pfnetSims(edges);
  console.log(`${inputFile.split('/').slice(-1)[0]} -- Total: ${edges.length}, PFNET: ${slimEdges.length}`);
  return slimEdges;
}

function main() {
  const files = glob('../raw-data/citations2/**/*.csv');

  let allData: Edge[] = [];
  for (const inputFile of files) {
    // Old format
    //Citing ID,Citing Venue Name,Citing Venue SciMap ID,Citing Publication Year,
    // Cited ID,Cited Venue Name,Cited Venue SciMap ID,Cited Publication Year

    // New format
    //,Citing ID,Citing Venue Name,Citing Venue SciMap ID,Citing Publication Year,
    // Cited ID,Cited Venue Name,Cited Venue SciMap ID,Cited Publication Year,
    // Citing Top Subject ID,Citing Top Subject Weight,Citing Subject IDs,
    // Cited Top Subject ID,Cited Top Subject Weight,Cited Subject IDs

    const sourceBase = inputFile.split('/').slice(-1)[0]
      .replace('_tomap.csv', '').replace('_tomap_keywords.csv', '');
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
      'Citing Top Subject ID', 'Cited Top Subject ID', year);
    
    allData = allData.concat(output.map(n => Object.assign(n, {src: source})));
  }
  writeJSON(allData, '../website/data/combined-edges.json');
}

main();
